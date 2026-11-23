import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

import '../core/format.dart';
import '../core/hashing.dart';
import '../core/theme.dart';
import '../models/inspection.dart';
import '../services/api_client.dart';
import '../services/draft_store.dart';
import '../services/evidence_uploader.dart';
import '../services/inspection_edit_service.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';

class InspectionDetailScreen extends StatefulWidget {
  const InspectionDetailScreen({
    super.key,
    required this.api,
    required this.inspectionId,
    required this.onUnauthorized,
    required this.draftStore,
    required this.editor,
    required this.uploader,
  });

  final ApiClient api;
  final String inspectionId;
  final VoidCallback onUnauthorized;
  final DraftStore draftStore;
  final InspectionEditService editor;
  final EvidenceUploader uploader;

  @override
  State<InspectionDetailScreen> createState() => _InspectionDetailScreenState();
}

class _InspectionDetailScreenState extends State<InspectionDetailScreen> {
  static const _maxUploadBytes = 10 * 1024 * 1024;

  final _notesController = TextEditingController();
  final Map<String, String?> _results = {};
  final Map<String, String> _itemNotes = {};

  InspectionDetail? _detail;
  ChecklistDraft? _draft;
  List<MediaObject> _media = const [];
  bool _loading = true;
  bool _saving = false;
  bool _submitting = false;
  String? _error;
  String? _formError;

  XFile? _selectedFile;
  Uint8List? _selectedBytes;
  String? _selectedContentType;
  String? _selectedDigest;
  bool _uploading = false;
  String? _uploadError;
  int _queuedForInspection = 0;
  bool _syncingQueue = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _load({bool preserveEdits = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await widget.api.fetchInspection(widget.inspectionId);
      List<MediaObject> media;
      try {
        media = await widget.api.listInspectionMedia(widget.inspectionId);
      } on ApiException {
        media = const [];
      }
      final draft = await widget.draftStore.read(widget.inspectionId);
      final pending = await widget.uploader.store.list();
      if (!mounted) {
        return;
      }
      setState(() {
        if (!preserveEdits) {
          _applyValues(detail, draft);
        }
        _detail = detail;
        _media = media;
        _draft = draft;
        _queuedForInspection = pending
            .where((upload) => upload.inspectionId == widget.inspectionId)
            .length;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _applyValues(InspectionDetail detail, ChecklistDraft? draft) {
    if (draft != null) {
      _notesController.text = draft.inspectionNotes;
      _results
        ..clear()
        ..addAll(draft.results);
      _itemNotes
        ..clear()
        ..addAll(draft.itemNotes);
      return;
    }
    _notesController.text = detail.summary.notes;
    _results.clear();
    _itemNotes
      ..clear()
      ..addEntries(
        (detail.checklist?.items ?? const <ChecklistItem>[])
            .map((item) => MapEntry(item.itemCode, item.notes)),
      );
  }

  bool get _dirty {
    final detail = _detail;
    if (detail == null || !detail.summary.isEditable) {
      return false;
    }
    if (_notesController.text != detail.summary.notes) {
      return true;
    }
    for (final item in detail.checklist?.items ?? const <ChecklistItem>[]) {
      if (_results.containsKey(item.itemCode) &&
          _results[item.itemCode] != item.result) {
        return true;
      }
      if (_itemNotes[item.itemCode] != null &&
          _itemNotes[item.itemCode] != item.notes) {
        return true;
      }
    }
    return false;
  }

  void _notice(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _save() async {
    final detail = _detail;
    if (detail == null) {
      return;
    }
    setState(() {
      _saving = true;
      _formError = null;
    });
    try {
      final updated = await widget.editor.save(
        current: detail,
        inspectionNotes: _notesController.text,
        results: _results,
        itemNotes: _itemNotes,
      );
      await widget.draftStore.clear(widget.inspectionId);
      if (!mounted) {
        return;
      }
      setState(() {
        _detail = updated;
        _draft = null;
        _applyValues(updated, null);
      });
      _notice('Checklist dan catatan tersimpan. Versi catatan dinaikkan server.');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      if (error.isNetworkFailure) {
        final draft = widget.editor.draftFrom(
          detail,
          inspectionNotes: _notesController.text,
          results: _results,
          itemNotes: _itemNotes,
        );
        await widget.draftStore.save(widget.inspectionId, draft);
        if (!mounted) {
          return;
        }
        setState(() => _draft = draft);
        _notice('Tidak ada koneksi. Perubahan disimpan sebagai draf luring.');
      } else {
        setState(() => _formError = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _syncDraft() async {
    final detail = _detail;
    final draft = _draft;
    if (detail == null || draft == null) {
      return;
    }
    setState(() {
      _saving = true;
      _formError = null;
    });
    try {
      final updated = await widget.editor.syncDraft(
        current: detail,
        draft: draft,
      );
      await widget.draftStore.clear(widget.inspectionId);
      if (!mounted) {
        return;
      }
      setState(() {
        _detail = updated;
        _draft = null;
        _applyValues(updated, null);
      });
      _notice('Draf luring tersinkron ke server.');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      setState(() => _formError = error.message);
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _discardDraft() async {
    await widget.draftStore.clear(widget.inspectionId);
    if (!mounted) {
      return;
    }
    setState(() => _draft = null);
    await _load();
    _notice('Draf luring dibuang. Nilai dimuat ulang dari server.');
  }

  Future<void> _submit() async {
    final detail = _detail;
    if (detail == null) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kirim inspeksi?'),
        content: const Text(
          'Setelah dikirim, catatan tidak dapat diubah dan diteruskan ke '
          'peninjauan manusia. Pastikan semua item checklist wajib telah diisi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Kirim'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    setState(() {
      _submitting = true;
      _formError = null;
    });
    try {
      await widget.api.submitInspection(widget.inspectionId);
      await widget.draftStore.clear(widget.inspectionId);
      await _load();
      _notice('Inspeksi dikirim dan menunggu peninjauan manusia.');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      setState(() => _formError = error.message);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    setState(() => _uploadError = null);
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1920,
        imageQuality: 85,
      );
      if (file == null) {
        return;
      }
      final bytes = await file.readAsBytes();
      final contentType = normalizeImageContentType(file.mimeType, file.name);
      if (contentType == null) {
        setState(() => _uploadError =
            'Format tidak didukung. Gunakan JPEG, PNG, atau WebP.');
        return;
      }
      if (bytes.length > _maxUploadBytes) {
        setState(() => _uploadError = 'Gambar melebihi batas 10 MiB.');
        return;
      }
      setState(() {
        _selectedFile = file;
        _selectedBytes = bytes;
        _selectedContentType = contentType;
        _selectedDigest = sha256Hex(bytes);
      });
    } catch (_) {
      setState(() => _uploadError =
          'Tidak dapat membuka kamera atau galeri pada perangkat ini.');
    }
  }

  void _clearSelection() {
    setState(() {
      _selectedFile = null;
      _selectedBytes = null;
      _selectedContentType = null;
      _selectedDigest = null;
    });
  }

  Future<void> _uploadSelected() async {
    final bytes = _selectedBytes;
    final file = _selectedFile;
    final contentType = _selectedContentType;
    if (bytes == null || file == null || contentType == null) {
      return;
    }
    setState(() {
      _uploading = true;
      _uploadError = null;
    });
    try {
      await widget.uploader.uploadNow(
        inspectionId: widget.inspectionId,
        filename: file.name,
        contentType: contentType,
        bytes: bytes,
      );
      _clearSelection();
      await _load(preserveEdits: true);
      _notice('Bukti terunggah dan SHA-256 diverifikasi ulang oleh server.');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      if (error.isNetworkFailure) {
        await widget.uploader.queueUpload(
          inspectionId: widget.inspectionId,
          filename: file.name,
          contentType: contentType,
          bytes: bytes,
        );
        _clearSelection();
        await _load(preserveEdits: true);
        _notice(
          'Tidak ada koneksi. Bukti diantrekan di perangkat untuk diunggah ulang.',
        );
      } else {
        setState(() => _uploadError = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
      }
    }
  }

  Future<void> _syncUploadQueue() async {
    setState(() => _syncingQueue = true);
    try {
      final result = await widget.uploader.syncPending();
      if (!mounted) {
        return;
      }
      final suffix =
          result.lastError == null ? '' : ' ${result.lastError}';
      _notice(
        'Antrean: ${result.uploaded} terunggah, ${result.failed} gagal.$suffix',
      );
      if (result.uploaded > 0) {
        await _load(preserveEdits: true);
      } else {
        await _refreshQueueCount();
      }
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      setState(() => _uploadError = error.message);
    } finally {
      if (mounted) {
        setState(() => _syncingQueue = false);
      }
    }
  }

  Future<void> _refreshQueueCount() async {
    final pending = await widget.uploader.store.list();
    if (!mounted) {
      return;
    }
    setState(() {
      _queuedForInspection = pending
          .where((upload) => upload.inspectionId == widget.inspectionId)
          .length;
    });
  }

  Future<void> _reloadDiscardingEdits() async {
    if (_dirty) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Muat ulang catatan?'),
          content: const Text(
            'Perubahan yang belum disimpan akan hilang. Lanjutkan memuat ulang '
            'dari server?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Muat ulang'),
            ),
          ],
        ),
      );
      if (confirmed != true) {
        return;
      }
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(detail?.summary.reference ?? 'Detail inspeksi'),
            if (detail != null)
              Text(
                inspectionStatusLabel(detail.summary.status),
                style: const TextStyle(
                  fontSize: 11,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Muat ulang',
            onPressed: _loading ? null : _reloadDiscardingEdits,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _detail == null) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text('Memuat catatan inspeksi…'),
          ],
        ),
      );
    }
    if (_detail == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 36, color: RvColors.critical),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Catatan inspeksi tidak dapat dimuat.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba lagi'),
              ),
            ],
          ),
        ),
      );
    }

    final detail = _detail!;
    final checklist = detail.checklist;
    final editable = detail.summary.isEditable;

    return RefreshIndicator(
      onRefresh: _reloadDiscardingEdits,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCard(context, detail),
          const SizedBox(height: 12),
          if (_draft != null) ...[
            _draftBanner(context),
            const SizedBox(height: 12),
          ],
          if (_formError != null) ...[
            _ErrorBox(message: _formError!),
            const SizedBox(height: 12),
          ],
          if (checklist != null)
            _checklistCard(context, checklist, editable)
          else
            const SectionCard(
              title: 'Checklist inspeksi',
              child: Text(
                'Jenis inspeksi ini tidak memiliki template checklist aktif '
                'saat draf dibuat. Hubungi administrator master data.',
              ),
            ),
          const SizedBox(height: 12),
          _notesCard(context, detail, editable),
          const SizedBox(height: 12),
          _evidenceCard(context, detail, editable),
          const SizedBox(height: 12),
          _workflowCard(context, detail, editable),
          const SizedBox(height: 18),
          Text(
            'Inspeksi adalah dokumentasi, bukan izin keselamatan. AI bersifat '
            'saran dan tidak ada vonis otomatis aman atau tidak aman.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.secondary,
                  height: 1.5,
                ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _summaryCard(BuildContext context, InspectionDetail detail) {
    final summary = detail.summary;
    return SectionCard(
      title: 'Catatan inspeksi',
      description: 'Inspektur yang ditugaskan, waktu, dan cakupan.',
      child: Column(
        children: [
          _InfoRow(label: 'Aset', value: summary.asset.name,
              hint: summary.asset.code),
          const Divider(height: 18),
          _InfoRow(label: 'Inspektur', value: summary.inspectorName),
          const Divider(height: 18),
          _InfoRow(
            label: 'Jenis',
            value: inspectionTypeLabel(summary.inspectionType),
          ),
          if (summary.locationReference.isNotEmpty) ...[
            const Divider(height: 18),
            _InfoRow(label: 'Lokasi', value: summary.locationReference),
          ],
          const Divider(height: 18),
          _InfoRow(
            label: 'Waktu diperiksa',
            value: formatDateTime(summary.inspectedAt),
          ),
          const Divider(height: 18),
          _InfoRow(label: 'Cakupan', value: summary.scopeName),
          const Divider(height: 18),
          _InfoRow(label: 'Versi catatan', value: 'v${summary.version}'),
        ],
      ),
    );
  }

  Widget _draftBanner(BuildContext context) {
    final draft = _draft!;
    final mismatch = draft.baseVersion != _detail!.summary.version;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: RvColors.warningSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: RvColors.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.offline_pin_outlined,
                  size: 18, color: RvColors.warning),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Draf luring tersimpan ${formatDateTime(draft.savedAt)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            mismatch
                ? 'Versi catatan di server (v${_detail!.summary.version}) sudah '
                    'berubah sejak draf dibuat (v${draft.baseVersion}). Muat '
                    'ulang dari server sebelum menyinkronkan.'
                : 'Perubahan belum tersinkron. Sinkronkan saat koneksi stabil.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.secondary,
                  height: 1.5,
                ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: _saving ? null : _syncDraft,
                icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                label: const Text('Sinkronkan'),
              ),
              OutlinedButton(
                onPressed: _saving ? null : _reloadDiscardingEdits,
                child: const Text('Muat ulang'),
              ),
              TextButton(
                onPressed: _saving ? null : _discardDraft,
                child: const Text('Buang draf'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _checklistCard(
    BuildContext context,
    InspectionChecklist checklist,
    bool editable,
  ) {
    final answeredCount = checklist.items.where((item) {
      final value =
          _results.containsKey(item.itemCode) ? _results[item.itemCode] : item.result;
      return value != null;
    }).length;
    return SectionCard(
      title: 'Checklist inspeksi',
      description:
          '${checklist.templateName ?? 'Template'} '
          '(${checklist.templateCode ?? '—'} · versi '
          '${checklist.templateVersion ?? '—'}). Salinan item dikunci saat draf dibuat.',
      trailing: _ProgressChip(
        answered: answeredCount,
        total: checklist.items.length,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (checklist.requiredUnanswered > 0 && editable)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: RvColors.warningSoft,
                borderRadius: BorderRadius.circular(8),
                border:
                    Border.all(color: RvColors.warning.withValues(alpha: 0.25)),
              ),
              child: Text(
                '${checklist.requiredUnanswered} item wajib belum diisi. '
                'Pengiriman ditolak server sampai checklist lengkap.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.ink,
                      height: 1.5,
                    ),
              ),
            ),
          for (final item in checklist.items) ...[
            _ChecklistItemEditor(
              key: ValueKey(
                '${item.itemCode}-${item.result ?? ''}-${_detail?.summary.version}',
              ),
              item: item,
              editable: editable,
              selectedResult: _results.containsKey(item.itemCode)
                  ? _results[item.itemCode]
                  : item.result,
              notes: _itemNotes[item.itemCode] ?? item.notes,
              onResultChanged: (value) =>
                  setState(() => _results[item.itemCode] = value),
              onNotesChanged: (value) =>
                  setState(() => _itemNotes[item.itemCode] = value),
            ),
            if (item != checklist.items.last) const SizedBox(height: 10),
          ],
          if (editable) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _dirty
                        ? 'Ada perubahan belum disimpan.'
                        : 'Tidak ada perubahan.',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                        ),
                  ),
                ),
                FilledButton.icon(
                  onPressed: (_saving || !_dirty) ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save_outlined, size: 18),
                  label: const Text('Simpan checklist'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _notesCard(
    BuildContext context,
    InspectionDetail detail,
    bool editable,
  ) {
    return SectionCard(
      title: 'Catatan observasi',
      description: editable
          ? 'Observasi teks bebas. Disimpan bersama checklist.'
          : 'Catatan hanya-baca setelah dikirim.',
      child: editable
          ? TextField(
              controller: _notesController,
              maxLines: 4,
              maxLength: 4000,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Observasi sintetis saja…',
              ),
            )
          : Text(
              detail.summary.notes.isEmpty
                  ? 'Tidak ada catatan observasi.'
                  : detail.summary.notes,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
            ),
    );
  }

  Widget _evidenceCard(
    BuildContext context,
    InspectionDetail detail,
    bool editable,
  ) {
    return SectionCard(
      title: 'Bukti foto',
      description:
          'Gambar disimpan privat. Server memverifikasi tipe, ukuran, dan '
          'SHA-256; ketidakcocokan dikarantina.',
      trailing: Text(
        '${_media.length} tersimpan',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: RvColors.secondary,
              fontWeight: FontWeight.w600,
            ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_queuedForInspection > 0) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: RvColors.warningSoft,
                borderRadius: BorderRadius.circular(8),
                border:
                    Border.all(color: RvColors.warning.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_queue,
                      size: 18, color: RvColors.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$_queuedForInspection bukti menunggu unggahan di perangkat.',
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(height: 1.4),
                    ),
                  ),
                  TextButton(
                    onPressed: _syncingQueue ? null : _syncUploadQueue,
                    child: Text(_syncingQueue ? 'Menyinkronkan…' : 'Sinkronkan'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (editable) ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _uploading
                        ? null
                        : () => _pickImage(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined, size: 18),
                    label: const Text('Kamera'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _uploading
                        ? null
                        : () => _pickImage(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined, size: 18),
                    label: const Text('Galeri'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_selectedBytes != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  _selectedBytes!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${_selectedFile?.name ?? 'gambar'} · '
                '${((_selectedBytes?.length ?? 0) / 1024).toStringAsFixed(0)} KiB',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'SHA-256: ${_selectedDigest?.substring(0, 16)}…',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.secondary,
                    ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _uploading ? null : _uploadSelected,
                      icon: _uploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.cloud_upload_outlined, size: 18),
                      label: Text(_uploading ? 'Mengunggah…' : 'Unggah bukti'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: _uploading ? null : _clearSelection,
                    child: const Text('Batal'),
                  ),
                ],
              ),
            ] else
              Text(
                'Pilih kamera atau galeri untuk menyiapkan bukti. SHA-256 '
                'dihitung di perangkat dan diverifikasi ulang server.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.secondary,
                      height: 1.5,
                    ),
              ),
            if (_uploadError != null) ...[
              const SizedBox(height: 10),
              _ErrorBox(message: _uploadError!),
            ],
          ],
          if (_media.isNotEmpty) ...[
            const SizedBox(height: 14),
            for (final media in _media) ...[
              _MediaRow(media: media),
              if (media != _media.last) const Divider(height: 16),
            ],
          ] else if (!editable)
            Text(
              'Belum ada bukti terunggah untuk inspeksi ini.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: RvColors.secondary,
                  ),
            ),
        ],
      ),
    );
  }

  Widget _workflowCard(
    BuildContext context,
    InspectionDetail detail,
    bool editable,
  ) {
    return SectionCard(
      title: 'Alur kerja',
      description: 'Posisi catatan ini pada alur inspeksi.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              InspectionStatusChip(status: detail.summary.status),
              const Spacer(),
              Text(
                'Diperbarui ${formatDateTime(detail.summary.updatedAt)}',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.secondary,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (editable) ...[
            Text(
              'Lengkapi checklist wajib, lampirkan bukti, lalu kirim untuk '
              'peninjauan manusia. Pengiriman mengunci perubahan teks.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: RvColors.secondary,
                    height: 1.5,
                  ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send_outlined, size: 18),
              label: Text(_submitting ? 'Mengirim…' : 'Kirim inspeksi'),
            ),
          ] else
            Text(
              'Catatan ini hanya-baca. Keputusan peninjauan dilakukan peninjau '
              'berwenang melalui konsol web.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: RvColors.secondary,
                    height: 1.5,
                  ),
            ),
        ],
      ),
    );
  }
}

class _ChecklistItemEditor extends StatelessWidget {
  const _ChecklistItemEditor({
    super.key,
    required this.item,
    required this.editable,
    required this.selectedResult,
    required this.notes,
    required this.onResultChanged,
    required this.onNotesChanged,
  });

  final ChecklistItem item;
  final bool editable;
  final String? selectedResult;
  final String notes;
  final ValueChanged<String?> onResultChanged;
  final ValueChanged<String> onNotesChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: RvColors.canvas,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: RvColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.position.toString().padLeft(2, '0'),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.itemLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                ),
              ),
              if (item.isRequired) ...[
                const SizedBox(width: 6),
                Text(
                  'wajib',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (editable)
            DropdownButtonFormField<String>(
              initialValue: selectedResult ?? '',
              decoration: const InputDecoration(
                labelText: 'Hasil',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: const [
                DropdownMenuItem(value: '', child: Text('Belum diisi')),
                DropdownMenuItem(value: 'pass', child: Text('Sesuai / lulus')),
                DropdownMenuItem(value: 'fail', child: Text('Tidak sesuai')),
                DropdownMenuItem(
                    value: 'not_applicable', child: Text('Tidak berlaku')),
              ],
              onChanged: (value) =>
                  onResultChanged(value == null || value.isEmpty ? null : value),
            )
          else
            Row(
              children: [
                Icon(
                  item.result == null
                      ? Icons.remove_circle_outline
                      : item.result == 'pass'
                          ? Icons.check_circle_outline
                          : item.result == 'fail'
                              ? Icons.error_outline
                              : Icons.do_not_disturb_on_outlined,
                  size: 16,
                  color: item.result == 'pass'
                      ? RvColors.success
                      : item.result == 'fail'
                          ? RvColors.critical
                          : RvColors.secondary,
                ),
                const SizedBox(width: 6),
                Text(
                  checklistResultLabel(item.result),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (item.recordedByName.isNotEmpty) ...[
                  const Spacer(),
                  Text(
                    'oleh ${item.recordedByName}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                        ),
                  ),
                ],
              ],
            ),
          const SizedBox(height: 8),
          if (editable)
            TextFormField(
              initialValue: notes,
              maxLines: 2,
              maxLength: 2000,
              onChanged: onNotesChanged,
              decoration: const InputDecoration(
                labelText: 'Catatan item (opsional)',
                border: OutlineInputBorder(),
                isDense: true,
                counterText: '',
              ),
            )
          else if (notes.isNotEmpty)
            Text(
              notes,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: RvColors.secondary,
                    height: 1.5,
                  ),
            ),
        ],
      ),
    );
  }
}

class _ProgressChip extends StatelessWidget {
  const _ProgressChip({required this.answered, required this.total});

  final int answered;
  final int total;

  @override
  Widget build(BuildContext context) {
    final complete = answered == total && total > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: complete ? RvColors.successSoft : RvColors.primarySoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$answered/$total terisi',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: complete ? RvColors.success : RvColors.primary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _MediaRow extends StatelessWidget {
  const _MediaRow({required this.media});

  final MediaObject media;

  @override
  Widget build(BuildContext context) {
    final statusTone = media.isReady ? Tone.success : Tone.warning;
    final statusLabel = media.isReady
        ? 'Terverifikasi'
        : media.status == 'quarantined'
            ? 'Karantina (${media.quarantineReason ?? 'tidak cocok'})'
            : 'Menunggu unggahan';
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: RvColors.primarySoft,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(Icons.image_outlined,
              size: 18, color: RvColors.primary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                media.filename,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              Text(
                '${(media.sizeBytes / 1024).toStringAsFixed(0)} KiB · '
                '${formatDateTime(media.createdAt)}',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.secondary,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        StatusChip(label: statusLabel, tone: statusTone),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.hint});

  final String label;
  final String value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 118,
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.secondary,
                ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              if (hint != null)
                Text(
                  hint!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.secondary,
                      ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: RvColors.criticalSoft,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: RvColors.critical.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: RvColors.critical),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
