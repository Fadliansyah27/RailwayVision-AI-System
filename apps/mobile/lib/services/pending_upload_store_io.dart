import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/hashing.dart';
import 'pending_upload.dart';

class FilePendingUploadStore implements PendingUploadStore {
  static const _key = 'rv_pending_uploads';

  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  Future<Directory> _directory() async {
    final base = await getApplicationSupportDirectory();
    final directory = Directory('${base.path}/rv_pending');
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  Future<List<PendingUpload>> _readAll() async {
    final preferences = await _prefs;
    final raw = preferences.getString(_key);
    if (raw == null) {
      return [];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return [];
      }
      return decoded
          .whereType<Map>()
          .map((entry) =>
              PendingUpload.fromJson(entry.cast<String, dynamic>()))
          .toList(growable: true);
    } on FormatException {
      return [];
    }
  }

  Future<void> _writeAll(List<PendingUpload> uploads) async {
    final preferences = await _prefs;
    await preferences.setString(
      _key,
      jsonEncode(uploads.map((upload) => upload.toJson()).toList()),
    );
  }

  @override
  Future<List<PendingUpload>> list() => _readAll();

  @override
  Future<PendingUpload> enqueue({
    required String inspectionId,
    required String filename,
    required String contentType,
    required List<int> bytes,
  }) async {
    final directory = await _directory();
    final queueId =
        '${DateTime.now().microsecondsSinceEpoch}-${bytes.length}';
    final file = File('${directory.path}/$queueId.img');
    await file.writeAsBytes(bytes, flush: true);
    final upload = PendingUpload(
      queueId: queueId,
      inspectionId: inspectionId,
      filename: filename,
      contentType: contentType,
      sizeBytes: bytes.length,
      sha256: sha256Hex(bytes),
      storedPath: file.path,
    );
    final uploads = await _readAll();
    uploads.add(upload);
    await _writeAll(uploads);
    return upload;
  }

  @override
  Future<List<int>?> readBytes(PendingUpload upload) async {
    final path = upload.storedPath;
    if (path == null) {
      return null;
    }
    final file = File(path);
    if (!await file.exists()) {
      return null;
    }
    return file.readAsBytes();
  }

  @override
  Future<void> remove(String queueId) async {
    final uploads = await _readAll();
    final removed =
        uploads.where((upload) => upload.queueId == queueId).toList();
    for (final upload in removed) {
      final path = upload.storedPath;
      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
      }
    }
    uploads.removeWhere((upload) => upload.queueId == queueId);
    await _writeAll(uploads);
  }
}

PendingUploadStore createPendingUploadStore() => FilePendingUploadStore();
