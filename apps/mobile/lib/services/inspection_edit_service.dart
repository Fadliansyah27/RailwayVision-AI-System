import '../models/inspection.dart';
import 'api_client.dart';
import 'draft_store.dart';

class InspectionEditService {
  InspectionEditService(this.api);

  final ApiClient api;

  Future<InspectionDetail> save({
    required InspectionDetail current,
    required String inspectionNotes,
    required Map<String, String?> results,
    required Map<String, String> itemNotes,
  }) async {
    var detail = current;
    var version = current.summary.version;

    if (inspectionNotes != current.summary.notes) {
      final updated = await api.updateInspectionNotes(
        current.id,
        version: version,
        notes: inspectionNotes,
      );
      version = updated.version;
      detail = InspectionDetail(
        summary: updated,
        checklist: current.checklist,
        mediaCount: current.mediaCount,
        pendingDetections: current.pendingDetections,
      );
    }

    final checklist = current.checklist;
    if (checklist != null && checklist.items.isNotEmpty) {
      final entries = checklist.items
          .map(
            (item) => ChecklistEntryInput(
              itemCode: item.itemCode,
              result: results.containsKey(item.itemCode)
                  ? results[item.itemCode]
                  : item.result,
              notes: itemNotes[item.itemCode] ?? item.notes,
            ),
          )
          .toList(growable: false);
      return api.updateChecklist(
        current.id,
        version: version,
        entries: entries,
      );
    }

    if (!identical(detail, current)) {
      return api.fetchInspection(current.id);
    }
    return detail;
  }

  ChecklistDraft draftFrom(
    InspectionDetail detail, {
    required String inspectionNotes,
    required Map<String, String?> results,
    required Map<String, String> itemNotes,
  }) {
    return ChecklistDraft(
      baseVersion: detail.summary.version,
      inspectionNotes: inspectionNotes,
      results: Map.of(results),
      itemNotes: Map.of(itemNotes),
      savedAt: DateTime.now(),
    );
  }

  Future<InspectionDetail> syncDraft({
    required InspectionDetail current,
    required ChecklistDraft draft,
  }) async {
    if (draft.baseVersion != current.summary.version) {
      throw ApiException(
        'Catatan di server sudah berubah (versi ${current.summary.version}). '
        'Muat ulang catatan sebelum menyinkronkan draf luring.',
        statusCode: 409,
        code: 'version_conflict',
      );
    }
    return save(
      current: current,
      inspectionNotes: draft.inspectionNotes,
      results: draft.results,
      itemNotes: draft.itemNotes,
    );
  }
}
