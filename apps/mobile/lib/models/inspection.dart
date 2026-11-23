class AssetOption {
  const AssetOption({
    required this.id,
    required this.code,
    required this.name,
  });

  final String id;
  final String code;
  final String name;

  factory AssetOption.fromJson(Map<String, dynamic> json) {
    return AssetOption(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
    );
  }
}

class InspectionSummary {
  const InspectionSummary({
    required this.id,
    required this.reference,
    required this.status,
    required this.inspectionType,
    required this.locationReference,
    required this.notes,
    required this.inspectedAt,
    required this.version,
    required this.asset,
    required this.inspectorId,
    required this.inspectorName,
    required this.scopeName,
    required this.updatedAt,
  });

  final String id;
  final String reference;
  final String status;
  final String inspectionType;
  final String locationReference;
  final String notes;
  final DateTime inspectedAt;
  final int version;
  final AssetOption asset;
  final String inspectorId;
  final String inspectorName;
  final String scopeName;
  final DateTime updatedAt;

  bool get isEditable => status == 'draft';

  factory InspectionSummary.fromJson(Map<String, dynamic> json) {
    return InspectionSummary(
      id: json['id']?.toString() ?? '',
      reference: json['reference']?.toString() ?? '',
      status: json['status']?.toString() ?? 'unknown',
      inspectionType: json['inspection_type']?.toString() ?? 'routine',
      locationReference: json['location_reference']?.toString() ?? '',
      notes: json['notes']?.toString() ?? '',
      inspectedAt:
          DateTime.tryParse(json['inspected_at']?.toString() ?? '') ??
              DateTime.fromMillisecondsSinceEpoch(0),
      version: (json['version'] as num?)?.toInt() ?? 1,
      asset: AssetOption.fromJson(
        json['asset'] is Map<String, dynamic>
            ? json['asset'] as Map<String, dynamic>
            : const {},
      ),
      inspectorId: _briefId(json['inspector']),
      inspectorName: _briefName(json['inspector']),
      scopeName: json['scope'] is Map<String, dynamic>
          ? (json['scope'] as Map<String, dynamic>)['name']?.toString() ?? ''
          : '',
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

String _briefName(Object? raw) {
  if (raw is Map<String, dynamic>) {
    return raw['full_name']?.toString() ?? '';
  }
  return '';
}

String _briefId(Object? raw) {
  if (raw is Map<String, dynamic>) {
    return raw['id']?.toString() ?? '';
  }
  return '';
}

class ChecklistItem {
  ChecklistItem({
    required this.itemCode,
    required this.itemLabel,
    required this.position,
    required this.isRequired,
    required this.result,
    required this.notes,
    required this.recordedByName,
    required this.updatedAt,
  });

  final String itemCode;
  final String itemLabel;
  final int position;
  final bool isRequired;
  String? result;
  String notes;
  final String recordedByName;
  final DateTime updatedAt;

  bool get isAnswered => result != null;

  factory ChecklistItem.fromJson(Map<String, dynamic> json) {
    return ChecklistItem(
      itemCode: json['item_code']?.toString() ?? '',
      itemLabel: json['item_label']?.toString() ?? '',
      position: (json['position'] as num?)?.toInt() ?? 0,
      isRequired: json['is_required'] == true,
      result: json['result']?.toString(),
      notes: json['notes']?.toString() ?? '',
      recordedByName: _briefName(json['recorded_by']),
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class InspectionChecklist {
  InspectionChecklist({
    required this.templateCode,
    required this.templateName,
    required this.templateVersion,
    required this.total,
    required this.requiredTotal,
    required this.answered,
    required this.requiredUnanswered,
    required this.items,
  });

  final String? templateCode;
  final String? templateName;
  final int? templateVersion;
  final int total;
  final int requiredTotal;
  final int answered;
  final int requiredUnanswered;
  final List<ChecklistItem> items;

  factory InspectionChecklist.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return InspectionChecklist(
      templateCode: json['template_code']?.toString(),
      templateName: json['template_name']?.toString(),
      templateVersion: (json['template_version'] as num?)?.toInt(),
      total: (json['total'] as num?)?.toInt() ?? 0,
      requiredTotal: (json['required_total'] as num?)?.toInt() ?? 0,
      answered: (json['answered'] as num?)?.toInt() ?? 0,
      requiredUnanswered: (json['required_unanswered'] as num?)?.toInt() ?? 0,
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map((entry) =>
                  ChecklistItem.fromJson(entry.cast<String, dynamic>()))
              .toList(growable: false)
          : const [],
    );
  }
}

class InspectionDetail {
  const InspectionDetail({
    required this.summary,
    required this.checklist,
    required this.mediaCount,
    required this.pendingDetections,
  });

  final InspectionSummary summary;
  final InspectionChecklist? checklist;
  final int mediaCount;
  final int pendingDetections;

  String get id => summary.id;

  factory InspectionDetail.fromJson(Map<String, dynamic> json) {
    final rawChecklist = json['checklist'];
    return InspectionDetail(
      summary: InspectionSummary.fromJson(json),
      checklist: rawChecklist is Map<String, dynamic>
          ? InspectionChecklist.fromJson(rawChecklist)
          : null,
      mediaCount: (json['media_count'] as num?)?.toInt() ?? 0,
      pendingDetections: (json['pending_detections'] as num?)?.toInt() ?? 0,
    );
  }
}

class MediaObject {
  const MediaObject({
    required this.id,
    required this.filename,
    required this.contentType,
    required this.sizeBytes,
    required this.status,
    required this.quarantineReason,
    required this.createdAt,
  });

  final String id;
  final String filename;
  final String contentType;
  final int sizeBytes;
  final String status;
  final String? quarantineReason;
  final DateTime createdAt;

  bool get isReady => status == 'ready';

  factory MediaObject.fromJson(Map<String, dynamic> json) {
    return MediaObject(
      id: json['id']?.toString() ?? '',
      filename: json['filename']?.toString() ?? '',
      contentType: json['content_type']?.toString() ?? '',
      sizeBytes: (json['size_bytes'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'unknown',
      quarantineReason: json['quarantine_reason']?.toString(),
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
