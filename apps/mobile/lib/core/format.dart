import 'package:intl/intl.dart';

enum Tone { success, warning, critical, neutral, ai }

const inspectionStatusLabels = <String, String>{
  'draft': 'Draf',
  'submitted': 'Dikirim',
  'ai_processing': 'Menunggu Pemrosesan AI',
  'ai_processed': 'AI Selesai Memproses',
  'under_review': 'Menunggu Verifikasi',
  'reviewed': 'Telah Ditinjau',
  'ai_failed': 'Pemrosesan AI Gagal',
  'cancelled': 'Dibatalkan',
  'inconclusive': 'Tidak Dapat Disimpulkan',
};

const inspectionTypeLabels = <String, String>{
  'routine': 'Rutin',
  'detailed': 'Terperinci',
  'follow_up': 'Tindak Lanjut',
  'emergency': 'Darurat',
};

const checklistResultLabels = <String, String>{
  'pass': 'Sesuai / lulus',
  'fail': 'Tidak sesuai',
  'not_applicable': 'Tidak berlaku',
};

const workOrderStatusLabels = <String, String>{
  'open': 'Terbuka',
  'in_progress': 'Sedang Dikerjakan',
  'awaiting_verification': 'Menunggu Verifikasi',
  'completed': 'Selesai',
  'cancelled': 'Dibatalkan',
};

const findingPriorityLabels = <String, String>{
  'low': 'Rendah',
  'medium': 'Sedang',
  'high': 'Tinggi',
};

String workOrderStatusLabel(String status) =>
    workOrderStatusLabels[status] ?? status;

String findingPriorityLabel(String priority) =>
    findingPriorityLabels[priority] ?? priority;

String inspectionStatusLabel(String status) =>
    inspectionStatusLabels[status] ?? status;

String inspectionTypeLabel(String type) => inspectionTypeLabels[type] ?? type;

String checklistResultLabel(String? result) => result == null
    ? 'Belum diisi'
    : checklistResultLabels[result] ?? result;

Tone inspectionStatusTone(String status) {
  switch (status) {
    case 'reviewed':
      return Tone.success;
    case 'submitted':
    case 'under_review':
      return Tone.warning;
    case 'ai_processing':
    case 'ai_processed':
      return Tone.ai;
    case 'ai_failed':
      return Tone.critical;
    default:
      return Tone.neutral;
  }
}

Tone workOrderStatusTone(String status) {
  switch (status) {
    case 'completed':
      return Tone.success;
    case 'awaiting_verification':
      return Tone.warning;
    case 'in_progress':
      return Tone.ai;
    case 'open':
      return Tone.warning;
    default:
      return Tone.neutral;
  }
}

Tone findingPriorityTone(String priority) {
  switch (priority) {
    case 'high':
      return Tone.critical;
    case 'medium':
      return Tone.warning;
    default:
      return Tone.neutral;
  }
}

final DateFormat _dateTimeFormat = DateFormat('d MMM yyyy, HH.mm', 'id_ID');
final DateFormat _dateFormat = DateFormat('d MMM yyyy', 'id_ID');

DateTime jakartaTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 7));

String formatDateTime(DateTime? value) {
  if (value == null) {
    return '—';
  }
  return '${_dateTimeFormat.format(jakartaTime(value))} WIB';
}

String formatDate(DateTime? value) {
  if (value == null) {
    return '—';
  }
  return _dateFormat.format(jakartaTime(value));
}
