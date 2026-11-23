import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class ChecklistDraft {
  const ChecklistDraft({
    required this.baseVersion,
    required this.inspectionNotes,
    required this.results,
    required this.itemNotes,
    required this.savedAt,
  });

  final int baseVersion;
  final String inspectionNotes;
  final Map<String, String?> results;
  final Map<String, String> itemNotes;
  final DateTime savedAt;

  Map<String, Object?> toJson() => {
        'base_version': baseVersion,
        'inspection_notes': inspectionNotes,
        'results': results,
        'item_notes': itemNotes,
        'saved_at': savedAt.toUtc().toIso8601String(),
      };

  factory ChecklistDraft.fromJson(Map<String, dynamic> json) {
    final rawResults = json['results'];
    final rawNotes = json['item_notes'];
    return ChecklistDraft(
      baseVersion: (json['base_version'] as num?)?.toInt() ?? 1,
      inspectionNotes: json['inspection_notes']?.toString() ?? '',
      results: rawResults is Map
          ? rawResults.map(
              (key, value) => MapEntry(key.toString(), value?.toString()))
          : const {},
      itemNotes: rawNotes is Map
          ? rawNotes.map(
              (key, value) => MapEntry(key.toString(), value?.toString() ?? ''))
          : const {},
      savedAt: DateTime.tryParse(json['saved_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

abstract interface class DraftStore {
  Future<ChecklistDraft?> read(String inspectionId);

  Future<void> save(String inspectionId, ChecklistDraft draft);

  Future<void> clear(String inspectionId);
}

class SharedPreferencesDraftStore implements DraftStore {
  static String _key(String inspectionId) =>
      'rv_checklist_draft_$inspectionId';

  @override
  Future<ChecklistDraft?> read(String inspectionId) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key(inspectionId));
    if (raw == null) {
      return null;
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return ChecklistDraft.fromJson(decoded);
      }
    } on FormatException {
      await preferences.remove(_key(inspectionId));
    }
    return null;
  }

  @override
  Future<void> save(String inspectionId, ChecklistDraft draft) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_key(inspectionId), jsonEncode(draft.toJson()));
  }

  @override
  Future<void> clear(String inspectionId) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_key(inspectionId));
  }
}

class MemoryDraftStore implements DraftStore {
  final Map<String, ChecklistDraft> _drafts = {};

  @override
  Future<ChecklistDraft?> read(String inspectionId) async =>
      _drafts[inspectionId];

  @override
  Future<void> save(String inspectionId, ChecklistDraft draft) async {
    _drafts[inspectionId] = draft;
  }

  @override
  Future<void> clear(String inspectionId) async {
    _drafts.remove(inspectionId);
  }
}
