import '../core/hashing.dart';

class PendingUpload {
  const PendingUpload({
    required this.queueId,
    required this.inspectionId,
    required this.filename,
    required this.contentType,
    required this.sizeBytes,
    required this.sha256,
    this.storedPath,
  });

  final String queueId;
  final String inspectionId;
  final String filename;
  final String contentType;
  final int sizeBytes;
  final String sha256;
  final String? storedPath;

  Map<String, Object?> toJson() => {
        'queue_id': queueId,
        'inspection_id': inspectionId,
        'filename': filename,
        'content_type': contentType,
        'size_bytes': sizeBytes,
        'sha256': sha256,
        'stored_path': storedPath,
      };

  factory PendingUpload.fromJson(Map<String, dynamic> json) {
    return PendingUpload(
      queueId: json['queue_id']?.toString() ?? '',
      inspectionId: json['inspection_id']?.toString() ?? '',
      filename: json['filename']?.toString() ?? '',
      contentType: json['content_type']?.toString() ?? '',
      sizeBytes: (json['size_bytes'] as num?)?.toInt() ?? 0,
      sha256: json['sha256']?.toString() ?? '',
      storedPath: json['stored_path']?.toString(),
    );
  }
}

abstract interface class PendingUploadStore {
  Future<List<PendingUpload>> list();

  Future<PendingUpload> enqueue({
    required String inspectionId,
    required String filename,
    required String contentType,
    required List<int> bytes,
  });

  Future<List<int>?> readBytes(PendingUpload upload);

  Future<void> remove(String queueId);
}

class MemoryPendingUploadStore implements PendingUploadStore {
  final List<PendingUpload> _uploads = [];
  final Map<String, List<int>> _bytes = {};
  int _counter = 0;

  @override
  Future<List<PendingUpload>> list() async => List.of(_uploads);

  @override
  Future<PendingUpload> enqueue({
    required String inspectionId,
    required String filename,
    required String contentType,
    required List<int> bytes,
  }) async {
    _counter += 1;
    final upload = PendingUpload(
      queueId: 'memory-$_counter',
      inspectionId: inspectionId,
      filename: filename,
      contentType: contentType,
      sizeBytes: bytes.length,
      sha256: sha256Hex(bytes),
    );
    _uploads.add(upload);
    _bytes[upload.queueId] = List.of(bytes);
    return upload;
  }

  @override
  Future<List<int>?> readBytes(PendingUpload upload) async =>
      _bytes[upload.queueId];

  @override
  Future<void> remove(String queueId) async {
    _uploads.removeWhere((upload) => upload.queueId == queueId);
    _bytes.remove(queueId);
  }
}
