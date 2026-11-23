import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config.dart';
import '../models/system_status.dart';

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final http.Client _client;
  final String baseUrl;

  static const Duration _timeout = Duration(seconds: 6);

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
    ).timeout(_timeout);

    final readinessJson = results[0];
    if (readinessJson == null) {
      throw ApiException('Readiness response was empty');
    }
    final metaJson = results[1];

    return SystemSnapshot(
      readiness: Readiness.fromJson(readinessJson),
      meta: metaJson == null ? null : ServiceMeta.fromJson(metaJson),
      checkedAt: DateTime.now(),
    );
  }

  Future<Map<String, dynamic>> _getJson(
    String path, {
    bool allow503 = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await _client
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(_timeout);

    final acceptable = response.statusCode == 200 ||
        (allow503 && response.statusCode == 503);
    if (!acceptable) {
      throw ApiException('Request failed with status ${response.statusCode}');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('Unexpected response format');
    }
    return decoded;
  }
}
