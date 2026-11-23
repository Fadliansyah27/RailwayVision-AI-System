import 'pending_upload.dart';

/// Web builds keep the retry queue in memory only: the browser does not
/// grant durable file storage to a camera capture, so queued evidence is
/// lost when the tab is closed. Native builds persist the queue on disk.
PendingUploadStore createPendingUploadStore() => MemoryPendingUploadStore();
