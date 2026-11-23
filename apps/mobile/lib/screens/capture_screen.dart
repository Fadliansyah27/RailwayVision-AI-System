import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/inspection.dart';
import '../services/api_client.dart';
import '../services/draft_store.dart';
import '../services/evidence_uploader.dart';
import '../services/inspection_edit_service.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';
import 'inspection_detail_screen.dart';

class CaptureScreen extends StatefulWidget {
  const CaptureScreen({
    super.key,
    required this.api,
    required this.onUnauthorized,
    required this.draftStore,
    required this.editor,
    required this.uploader,
  });

  final ApiClient api;
  final VoidCallback onUnauthorized;
  final DraftStore draftStore;
  final InspectionEditService editor;
  final EvidenceUploader uploader;

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  List<InspectionSummary> _drafts = const [];
  int _queued = 0;
  bool _loading = true;
  bool _syncing = false;
  String? _error;
  String? _syncMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.api.listInspections(
        mine: true,
        status: 'draft',
      );
      final pending = await widget.uploader.store.list();
      if (!mounted) {
        return;
      }
      setState(() {
        _drafts = page.items;
        _queued = pending.length;
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

  Future<void> _open(InspectionSummary inspection) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => InspectionDetailScreen(
          api: widget.api,
          inspectionId: inspection.id,
          onUnauthorized: widget.onUnauthorized,
          draftStore: widget.draftStore,
          editor: widget.editor,
          uploader: widget.uploader,
        ),
      ),
    );
    if (mounted) {
      await _load();
    }
  }

  Future<void> _syncQueue() async {
    setState(() {
      _syncing = true;
      _syncMessage = null;
    });
    try {
      final result = await widget.uploader.syncPending();
      if (!mounted) {
        return;
      }
      setState(() {
        _syncMessage = result.lastError == null
            ? '${result.uploaded} bukti terunggah, ${result.failed} gagal.'
            : '${result.uploaded} terunggah, ${result.failed} gagal. '
                '${result.lastError}';
      });
      await _load();
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      if (error.isUnauthorized) {
        widget.onUnauthorized();
        return;
      }
      setState(() => _syncMessage = error.message);
    } finally {
      if (mounted) {
        setState(() => _syncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          const InfoBanner(
            title: 'Bukti visual hanya untuk draf milik Anda.',
            message:
                'Pilih inspeksi draf, lalu ambil foto melalui kamera atau '
                'galeri di halaman detail. Server memverifikasi SHA-256 sebelum '
                'menyimpan bukti.',
          ),
          const SizedBox(height: 12),
          if (_queued > 0) ...[
            SectionCard(
              title: 'Antrean unggahan luring',
              description:
                  '$_queued bukti tersimpan di perangkat dan belum terunggah.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_syncMessage != null) ...[
                    Text(
                      _syncMessage!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: RvColors.secondary,
                            height: 1.5,
                          ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  FilledButton.icon(
                    onPressed: _syncing ? null : _syncQueue,
                    icon: _syncing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.cloud_upload_outlined, size: 18),
                    label: Text(_syncing ? 'Menyinkronkan…' : 'Sinkronkan antrean'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          SectionCard(
            title: 'Pilih draf inspeksi',
            description:
                'Hanya inspeksi berstatus draf yang dapat menerima bukti baru.',
            trailing: IconButton(
              tooltip: 'Muat ulang',
              onPressed: _loading ? null : _load,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, size: 20),
            ),
            child: _loading
                ? const LinearProgressIndicator(minHeight: 3)
                : _error != null
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _error!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(height: 1.5),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: _load,
                            child: const Text('Coba lagi'),
                          ),
                        ],
                      )
                    : _drafts.isEmpty
                        ? Text(
                            'Belum ada draf tugas yang dapat menerima bukti.',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: RvColors.secondary,
                                    ),
                          )
                        : Column(
                            children: [
                              for (final draft in _drafts) ...[
                                _DraftTile(
                                  inspection: draft,
                                  onTap: () => _open(draft),
                                ),
                                if (draft != _drafts.last)
                                  const Divider(height: 12),
                              ],
                            ],
                          ),
          ),
          const SizedBox(height: 16),
          Text(
            'Kamera hanya dibuka setelah Anda memilih inspeksi, sehingga '
            'setiap bukti terikat ke catatan dan aset yang benar.',
            textAlign: TextAlign.center,
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

class _DraftTile extends StatelessWidget {
  const _DraftTile({required this.inspection, required this.onTap});

  final InspectionSummary inspection;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: RvColors.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.photo_camera_outlined,
                  size: 18, color: RvColors.primary),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    inspection.reference,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  Text(
                    '${inspection.asset.name} · '
                    '${formatDateTime(inspection.inspectedAt)}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const InspectionStatusChip(status: 'draft'),
            const Icon(Icons.chevron_right, color: RvColors.primary),
          ],
        ),
      ),
    );
  }
}
