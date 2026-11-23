import 'package:crypto/crypto.dart';

String sha256Hex(List<int> bytes) => sha256.convert(bytes).toString();

const _allowedTypes = {'image/jpeg', 'image/png', 'image/webp'};

String? normalizeImageContentType(String? mimeType, String filename) {
  final normalized = mimeType?.trim().toLowerCase();
  if (normalized == 'image/jpg' || normalized == 'image/pjpeg') {
    return 'image/jpeg';
  }
  if (normalized != null && _allowedTypes.contains(normalized)) {
    return normalized;
  }
  final lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return null;
}
