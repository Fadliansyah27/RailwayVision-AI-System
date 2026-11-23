import 'inspection.dart';

class FindingBrief {
  const FindingBrief({
    required this.id,
    required this.reference,
    required this.title,
    required this.status,
    required this.priority,
  });

  final String id;
  final String reference;
  final String title;
  final String status;
  final String priority;

  factory FindingBrief.fromJson(Map<String, dynamic> json) {
    return FindingBrief(
      id: json['id']?.toString() ?? '',
      reference: json['reference']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      priority: json['priority']?.toString() ?? 'medium',
    );
  }
}

class WorkOrder {
  const WorkOrder({
    required this.id,
    required this.reference,
    required this.title,
    required this.instructions,
    required this.status,
    required this.completionNotes,
    required this.verificationNotes,
    required this.version,
    required this.finding,
    required this.asset,
    required this.scopeName,
    required this.assigneeId,
    required this.assigneeName,
    required this.createdByName,
    required this.completedAt,
    required this.verifiedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String reference;
  final String title;
  final String instructions;
  final String status;
  final String completionNotes;
  final String verificationNotes;
  final int version;
  final FindingBrief finding;
  final AssetOption asset;
  final String scopeName;
  final String assigneeId;
  final String assigneeName;
  final String createdByName;
  final DateTime? completedAt;
  final DateTime? verifiedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isActive => status == 'open' || status == 'in_progress';
  bool get isAwaitingVerification => status == 'awaiting_verification';

  factory WorkOrder.fromJson(Map<String, dynamic> json) {
    final finding = json['finding'];
    final assignee = json['assignee'];
    final createdBy = json['created_by'];
    final scope = json['scope'];
    return WorkOrder(
      id: json['id']?.toString() ?? '',
      reference: json['reference']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      instructions: json['instructions']?.toString() ?? '',
      status: json['status']?.toString() ?? 'unknown',
      completionNotes: json['completion_notes']?.toString() ?? '',
      verificationNotes: json['verification_notes']?.toString() ?? '',
      version: (json['version'] as num?)?.toInt() ?? 1,
      finding: FindingBrief.fromJson(
        finding is Map<String, dynamic> ? finding : const {},
      ),
      asset: AssetOption.fromJson(
        json['asset'] is Map<String, dynamic>
            ? json['asset'] as Map<String, dynamic>
            : const {},
      ),
      scopeName:
          scope is Map<String, dynamic> ? scope['name']?.toString() ?? '' : '',
      assigneeId: _userId(assignee),
      assigneeName: _userName(assignee),
      createdByName: _userName(createdBy),
      completedAt: _parseDate(json['completed_at']),
      verifiedAt: _parseDate(json['verified_at']),
      createdAt: _parseDate(json['created_at']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt: _parseDate(json['updated_at']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class WorkOrderPage {
  const WorkOrderPage({required this.items, required this.total});

  final List<WorkOrder> items;
  final int total;
}

String _userId(Object? raw) {
  if (raw is Map<String, dynamic>) {
    return raw['id']?.toString() ?? '';
  }
  return '';
}

String _userName(Object? raw) {
  if (raw is Map<String, dynamic>) {
    return raw['full_name']?.toString() ?? '';
  }
  return '';
}

DateTime? _parseDate(Object? raw) {
  final value = raw?.toString();
  if (value == null || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}
