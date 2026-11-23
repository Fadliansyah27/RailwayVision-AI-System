import 'pending_upload.dart';
import 'pending_upload_store_fallback.dart'
    if (dart.library.io) 'pending_upload_store_io.dart' as platform;

export 'pending_upload.dart';

PendingUploadStore createPendingUploadStore() =>
    platform.createPendingUploadStore();
