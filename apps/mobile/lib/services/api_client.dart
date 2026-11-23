import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config.dart';
import '../models/inspection.dart';
import '../models/session.dart';
import '../models/system_status.dart';
import 'token_store.dart';

class ApiException implements Exception {
  ApiException(
    this.message, {
    this.statusCode,
    this.code,
  });

  final String message;
  final int? statusCode;
  final String? code;

  bool get isUnauthorized => statusCode == 401;
  bool get isNetworkFailure => statusCode == null;
  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}

class InspectionPage {
  const InspectionPage({required this.items, required this.total});

  final List<InspectionSummary> items;
  final int total;
}

class ChecklistEntryInput {
  const ChecklistEntryInput({
    required this.itemCode,
    required this.result,
    this.notes = '',
  });

  final String itemCode;
  final String? result;
  final String notes;

  Map<String, Object?> toJson() => {
        'item_code': itemCode,
        'result': result,
        'notes': notes,
      };
}

class ApiClient {
  ApiClient({
    http.Client? client,
    String? baseUrl,
    TokenStore? tokenStore,
    this.requestTimeout = const Duration(seconds: 15),
    this.uploadTimeout = const Duration(seconds: 60),
  })  : _client = client ?? http.Client(),
        _tokenStore = tokenStore ?? MemoryTokenStore(),
        baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final http.Client _client;
  final TokenStore _tokenStore;
  final String baseUrl;
  final Duration requestTimeout;
  final Duration uploadTimeout;

  String? _accessToken;
  String? _refreshToken;
  Future<void>? _refreshing;

  bool get hasSession => _accessToken != null;

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  Future<SessionUser> login(String email, String password) async {
    final json = await _requestJson(
      'POST',
      '/api/v1/auth/login',
      body: {'email': email.trim(), 'password': password},
      auth: false,
      extraHeaders: const {'X-Refresh-Transport': 'body'},
    );
    final user = _userFrom(json);
    await _applyTokens(json);
    return user;
  }

  Future<SessionUser?> restoreSession() async {
    final pair = await _tokenStore.read();
    if (pair == null) {
      return null;
    }
    _accessToken = pair.accessToken;
    _refreshToken = pair.refreshToken;
    final json = await _requestJson('GET', '/api/v1/auth/me');
    return _userFrom(json);
  }

  Future<void> logout() async {
    final refresh = _refreshToken;
    try {
      await _requestJson(
        'POST',
        '/api/v1/auth/logout',
        body: {'refresh_token': refresh},
        auth: true,
        allowRefresh: false,
      );
    } on ApiException {
      // Local sign-out must succeed even if the API cannot be reached.
    }
    await _clearSession();
  }

  Future<void> _clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    await _tokenStore.clear();
  }

  Future<void> _applyTokens(Map<String, dynamic> json) async {
    final access = json['access_token']?.toString();
    if (access == null || access.isEmpty) {
      throw ApiException('Respons autentikasi tidak memuat token akses.');
    }
    _accessToken = access;
    final refresh = json['refresh_token']?.toString();
    if (refresh != null && refresh.isNotEmpty) {
      _refreshToken = refresh;
    }
    await _tokenStore.write(
      TokenPair(accessToken: _accessToken!, refreshToken: _refreshToken),
    );
  }

  Future<void> _refreshTokens() {
    return _refreshing ??= _performRefresh().whenComplete(() {
      _refreshing = null;
    });
  }

  Future<void> _performRefresh() async {
    final refresh = _refreshToken;
    if (refresh == null || refresh.isEmpty) {
      await _clearSession();
      throw ApiException('Sesi berakhir. Silakan masuk kembali.',
          statusCode: 401, code: 'unauthorized');
    }
    try {
      final json = await _requestJson(
        'POST',
        '/api/v1/auth/refresh',
        body: {'refresh_token': refresh},
        auth: false,
        extraHeaders: const {'X-Refresh-Transport': 'body'},
      );
      await _applyTokens(json);
    } on ApiException catch (error) {
      if (error.isNetworkFailure) {
        rethrow;
      }
      await _clearSession();
      throw ApiException('Sesi berakhir. Silakan masuk kembali.',
          statusCode: 401, code: 'unauthorized');
    }
  }

  SessionUser _userFrom(Map<String, dynamic> json) {
    final rawUser = json['user'];
    if (rawUser is Map<String, dynamic>) {
      return SessionUser.fromJson(rawUser);
    }
    return SessionUser.fromJson(json);
  }

  // ---------------------------------------------------------------------------
  // Platform status (public)
  // ---------------------------------------------------------------------------

  Future<SystemSnapshot> fetchStatus() async {
    final readinessFuture = _getJson('/health/ready', allow503: true);
    final metaFuture = () async {
      try {
        return await _getJson('/api/v1/meta');
      } catch (_) {
        return null;
      }
    }();

    final results = await Future.wait<Map<String, dynamic>?>(
      [readinessFuture, metaFuture],
    ).timeout(const Duration(seconds: 8));

    final readinessJson = results[0];
    if (readinessJson == null) {
      throw ApiException('Respons kesiapan layanan kosong.');
    }
    final metaJson = results[1];

    return SystemSnapshot(
      readiness: Readiness.fromJson(readinessJson),
      meta: metaJson == null ? null : ServiceMeta.fromJson(metaJson),
      checkedAt: DateTime.now(),
    );
  }

  // ---------------------------------------------------------------------------
  // Inspections
  // ---------------------------------------------------------------------------

  Future<InspectionPage> listInspections({
    bool mine = true,
    String? status,
    int page = 1,
    int pageSize = 50,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'page_size': '$pageSize',
      if (mine) 'mine': 'true',
      if (status != null && status.isNotEmpty) 'status': status,
    };
    final uri = Uri.parse('$baseUrl/api/v1/inspections')
        .replace(queryParameters: query);
    final json = await _sendJson('GET', uri);
    return _inspectionPageFrom(json);
  }

  Future<InspectionDetail> fetchInspection(String inspectionId) async {
    final json =
        await _sendJson('GET', _uri('/api/v1/inspections/$inspectionId'));
    return InspectionDetail.fromJson(json);
  }

  Future<InspectionDetail> updateChecklist(
    String inspectionId, {
    required int version,
    required List<ChecklistEntryInput> entries,
  }) async {
    final json = await _sendJson(
      'PATCH',
      _uri('/api/v1/inspections/$inspectionId/checklist'),
      body: {
        'version': version,
        'entries': entries.map((entry) => entry.toJson()).toList(),
      },
    );
    return InspectionDetail.fromJson(json);
  }

  Future<InspectionSummary> updateInspectionNotes(
    String inspectionId, {
    required int version,
    required String notes,
  }) async {
    final json = await _sendJson(
      'PATCH',
      _uri('/api/v1/inspections/$inspectionId'),
      body: {'version': version, 'notes': notes},
    );
    return InspectionSummary.fromJson(json);
  }

  Future<InspectionSummary> submitInspection(String inspectionId) async {
    final json = await _sendJson(
      'POST',
      _uri('/api/v1/inspections/$inspectionId/submit'),
    );
    return InspectionSummary.fromJson(json);
  }

  Future<List<AssetOption>> listAssets() async {
    final json = await _sendJson(
      'GET',
      Uri.parse('$baseUrl/api/v1/assets?page=1&page_size=100'),
    );
    final items = json['items'];
    if (items is! List) {
      return const [];
    }
    return items
        .whereType<Map>()
        .map((entry) => AssetOption.fromJson(entry.cast<String, dynamic>()))
        .toList(growable: false);
  }

  // ---------------------------------------------------------------------------
  // Evidence (two-phase upload)
  // ---------------------------------------------------------------------------

  Future<List<MediaObject>> listInspectionMedia(String inspectionId) async {
    final json = await _sendJson(
      'GET',
      Uri.parse(
        '$baseUrl/api/v1/inspections/$inspectionId/media?page=1&page_size=50',
      ),
    );
    final items = json['items'];
    if (items is! List) {
      return const [];
    }
    return items
        .whereType<Map>()
        .map((entry) => MediaObject.fromJson(entry.cast<String, dynamic>()))
        .toList(growable: false);
  }

  Future<MediaObject> createMediaIntent({
    required String inspectionId,
    required String filename,
    required String contentType,
    required int sizeBytes,
    required String sha256,
  }) async {
    final json = await _sendJson(
      'POST',
      _uri('/api/v1/inspections/$inspectionId/media'),
      body: {
        'filename': filename,
        'content_type': contentType,
        'size_bytes': sizeBytes,
        'sha256': sha256,
      },
    );
    return MediaObject.fromJson(json);
  }

  Future<MediaObject> uploadMediaContent({
    required String mediaId,
    required List<int> bytes,
    required String contentType,
  }) async {
    Future<http.Response> send() async {
      final request = await _authorized(
        'PUT',
        _uri('/api/v1/media/$mediaId/content'),
        headers: {'Content-Type': contentType},
      );
      request.bodyBytes = bytes;
      try {
        final streamed = await _client.send(request).timeout(uploadTimeout);
        return await http.Response.fromStream(streamed);
      } on TimeoutException {
        throw ApiException(
            'Unggahan melewati batas waktu. Periksa jaringan lalu coba lagi.');
      } on http.ClientException catch (error) {
        throw ApiException('Tidak dapat menghubungi API. ${error.message}');
      }
    }

    var response = await send();
    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshTokens();
      response = await send();
    }
    return MediaObject.fromJson(_decodeResponse(response));
  }

  // ---------------------------------------------------------------------------
  // HTTP plumbing
  // ---------------------------------------------------------------------------

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, dynamic>> _getJson(
    String path, {
    bool allow503 = false,
  }) async {
    final response =
        await _client.get(_uri(path), headers: const {'Accept': 'application/json'})
            .timeout(requestTimeout);
    final acceptable = response.statusCode == 200 ||
        (allow503 && response.statusCode == 503);
    if (!acceptable) {
      throw _errorFrom(response);
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('Format respons tidak dikenal.');
    }
    return decoded;
  }

  Future<Map<String, dynamic>> _requestJson(
    String method,
    String path, {
    Map<String, Object?>? body,
    bool auth = true,
    bool allowRefresh = true,
    Map<String, String> extraHeaders = const {},
  }) async {
    final request = await _authorized(method, _uri(path),
        auth: auth, headers: extraHeaders);
    if (body != null) {
      request.headers['Content-Type'] = 'application/json; charset=utf-8';
      request.bodyBytes = utf8.encode(jsonEncode(body));
    }
    var response = await _sendRequest(request);
    if (response.statusCode == 401 && auth && allowRefresh) {
      await _refreshTokens();
      return _requestJson(method, path,
          body: body, auth: auth, allowRefresh: false, extraHeaders: extraHeaders);
    }
    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> _sendJson(
    String method,
    Uri uri, {
    Map<String, Object?>? body,
  }) async {
    final request = await _authorized(method, uri);
    if (body != null) {
      request.headers['Content-Type'] = 'application/json; charset=utf-8';
      request.bodyBytes = utf8.encode(jsonEncode(body));
    }
    var response = await _sendRequest(request);
    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshTokens();
      return _sendJson(method, uri, body: body);
    }
    return _decodeResponse(response);
  }

  Future<http.Request> _authorized(
    String method,
    Uri uri, {
    bool auth = true,
    Map<String, String> headers = const {},
  }) async {
    final request = http.Request(method, uri);
    request.headers['Accept'] = 'application/json';
    headers.forEach((key, value) => request.headers[key] = value);
    final token = _accessToken;
    if (auth && token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    return request;
  }

  Future<http.Response> _sendRequest(http.Request request) async {
    try {
      final streamed = await _client.send(request).timeout(requestTimeout);
      return await http.Response.fromStream(streamed);
    } on TimeoutException {
      throw ApiException(
          'Waktu koneksi habis. Periksa jaringan Anda lalu coba lagi.');
    } on http.ClientException catch (error) {
      throw ApiException('Tidak dapat menghubungi API. ${error.message}');
    }
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    if (response.bodyBytes.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return const {};
      }
      throw ApiException('Permintaan gagal (${response.statusCode}).',
          statusCode: response.statusCode);
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _errorFromDecoded(decoded, response.statusCode);
    }
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('Format respons tidak dikenal.');
    }
    return decoded;
  }

  ApiException _errorFrom(http.Response response) {
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      return _errorFromDecoded(decoded, response.statusCode);
    } catch (_) {
      return ApiException('Permintaan gagal (${response.statusCode}).',
          statusCode: response.statusCode);
    }
  }

  ApiException _errorFromDecoded(Object? decoded, int statusCode) {
    if (decoded is Map<String, dynamic> && decoded['error'] is Map) {
      final error = (decoded['error'] as Map).cast<String, dynamic>();
      return ApiException(
        error['message']?.toString() ?? 'Permintaan gagal ($statusCode).',
        statusCode: statusCode,
        code: error['code']?.toString(),
      );
    }
    return ApiException('Permintaan gagal ($statusCode).',
        statusCode: statusCode);
  }

  InspectionPage _inspectionPageFrom(Map<String, dynamic> json) {
    final items = json['items'];
    return InspectionPage(
      items: items is List
          ? items
              .whereType<Map>()
              .map((entry) =>
                  InspectionSummary.fromJson(entry.cast<String, dynamic>()))
              .toList(growable: false)
          : const [],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}
