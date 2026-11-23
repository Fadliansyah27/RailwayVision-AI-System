import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/inspection.dart';
import '../models/session.dart';
import '../services/api_client.dart';
import '../services/draft_store.dart';
import '../services/evidence_uploader.dart';
import '../services/inspection_edit_service.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';
import 'inspection_detail_screen.dart';

class InspectionsScreen extends StatefulWidget {
  const InspectionsScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onUnauthorized,
    required this.draftStore,
    required this.editor,
    required this.uploader,
  });

  final ApiClient api;
  final SessionUser user;
  final VoidCallback onUnauthorized;
  final DraftStore draftStore;
  final InspectionEditService editor;
  final EvidenceUploader uploader;

  @override
  State<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends State<InspectionsScreen> {
  final List<InspectionSummary> _items = [];
  bool _loading = true;
  String? _error;

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
      final page = await widget.api.listInspections(mine: true);
      if (!mounted) {
        return;
      }
      setState(() {
        _items
          ..clear()
          ..addAll(page.items);
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

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          const InfoBanner(
            title: 'Tugas lapangan saya.',
            message:
                'Daftar ini hanya memuat inspeksi yang ditugaskan kepada Anda '
                'dalam cakupan organisasi. Hak akses tetap divalidasi server.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  _loading
                      ? 'Memuat inspeksi…'
                      : '${_items.length} inspeksi · ${widget.user.scope.name}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: RvColors.secondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              IconButton(
                tooltip: 'Muat ulang',
                onPressed: _loading ? null : _load,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (_error != null) ...[
            _ErrorCard(message: _error!, onRetry: _load),
            const SizedBox(height: 12),
          ],
          if (!_loading && _error == null && _items.isEmpty)
            const SectionCard(
              title: 'Belum ada inspeksi',
              child: Text(
                'Tidak ada inspeksi yang ditugaskan kepada Anda saat ini. '
                'Inspeksi baru dibuat melalui konsol web oleh supervisor '
                'sesuai prosedur yang disetujui.',
              ),
            ),
          for (final inspection in _items) ...[
            _InspectionTile(
              inspection: inspection,
              onTap: () => _open(inspection),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
          Text(
            'Data sintetis. Tidak ada data operasional KCIC pada build ini.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.secondary,
                ),
          ),
        ],
      ),
    );
  }
}

class _InspectionTile extends StatelessWidget {
  const _InspectionTile({required this.inspection, required this.onTap});

  final InspectionSummary inspection;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: RvColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: RvColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      inspection.reference,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  InspectionStatusChip(status: inspection.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${inspection.asset.name} · ${inspection.asset.code}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.build_outlined,
                      size: 14, color: RvColors.secondary),
                  const SizedBox(width: 4),
                  Text(
                    inspectionTypeLabel(inspection.inspectionType),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                        ),
                  ),
                  const SizedBox(width: 12),
                  const Icon(Icons.schedule, size: 14, color: RvColors.secondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      formatDateTime(inspection.inspectedAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: RvColors.secondary,
                          ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: RvColors.primary),
                ],
              ),
              if (inspection.locationReference.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  inspection.locationReference,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.secondary,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

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
          const Icon(Icons.cloud_off, size: 18, color: RvColors.critical),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Coba lagi')),
        ],
      ),
    );
  }
}
