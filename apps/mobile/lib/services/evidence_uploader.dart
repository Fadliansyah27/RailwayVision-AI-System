import '../core/hashing.dart';
import '../models/inspection.dart';
import 'api_client.dart';
import 'pending_upload.dart';

class UploadSyncResult {
  const UploadSyncResult({
    required this.uploaded,
    required this.failed,
    this.lastError,
  });

  final int uploaded;
  final int failed;
  final String? lastError;

  bool get hasFailures => failed > 0;
}

class EvidenceUploader {
  EvidenceUploader({required this.api, required this.store});

  final ApiClient api;
  final PendingUploadStore store;

  Future<MediaObject> uploadNow({
    required String inspectionId,
    required String filename,
    required String contentType,
    required List<int> bytes,
  }) async {
    final digest = sha256Hex(bytes);
    final intent = await api.createMediaIntent(
      inspectionId: inspectionId,
      filename: filename,
      contentType: contentType,
      sizeBytes: bytes.length,
      sha256: digest,
    );
    return api.uploadMediaContent(
      mediaId: intent.id,
      bytes: bytes,
      contentType: contentType,
    );
  }

  Future<PendingUpload> queueUpload({
    required String inspectionId,
    required String filename,
    required String contentType,
    required List<int> bytes,
  }) {
    return store.enqueue(
      inspectionId: inspectionId,
      filename: filename,
      contentType: contentType,
      bytes: bytes,
    );
  }

  Future<UploadSyncResult> syncPending() async {
    var uploaded = 0;
    var failed = 0;
    String? lastError;
    for (final pending in await store.list()) {
      final bytes = await store.readBytes(pending);
      if (bytes == null) {
        await store.remove(pending.queueId);
        continue;
      }
      if (sha256Hex(bytes) != pending.sha256) {
        await store.remove(pending.queueId);
        failed += 1;
        lastError =
            'Berkas ${pending.filename} berubah sejak diantrekan; unggahan dibatalkan.';
        continue;
      }
      try {
        final intent = await api.createMediaIntent(
          inspectionId: pending.inspectionId,
          filename: pending.filename,
          contentType: pending.contentType,
          sizeBytes: pending.sizeBytes,
          sha256: pending.sha256,
        );
        await api.uploadMediaContent(
          mediaId: intent.id,
          bytes: bytes,
          contentType: pending.contentType,
        );
        await store.remove(pending.queueId);
        uploaded += 1;
      } on ApiException catch (error) {
        failed += 1;
        lastError = error.message;
        if (error.isUnauthorized) {
          break;
        }
      }
    }
    return UploadSyncResult(
      uploaded: uploaded,
      failed: failed,
      lastError: lastError,
    );
  }
}
