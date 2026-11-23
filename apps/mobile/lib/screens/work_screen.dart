import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/session.dart';
import '../models/work_order.dart';
import '../services/api_client.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';
import 'work_order_detail_screen.dart';

class WorkScreen extends StatefulWidget {
  const WorkScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onUnauthorized,
  });

  final ApiClient api;
  final SessionUser user;
  final VoidCallback onUnauthorized;

  @override
  State<WorkScreen> createState() => _WorkScreenState();
}

class _WorkScreenState extends State<WorkScreen> {
  static const _statusFilters = <String?>[
    null,
    'open',
    'in_progress',
    'awaiting_verification',
    'completed',
    'cancelled',
  ];

  final List<WorkOrder> _items = [];
  bool _mine = true;
  String? _status;
  bool _loading = true;
  String? _error;

  bool get _canRead => widget.user.can('work_orders:read');

  @override
  void initState() {
    super.initState();
    if (_canRead) {
      _load();
    } else {
      _loading = false;
    }
  }

  Future<void> _load() async {
    if (!_canRead) {
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page =
          await widget.api.listWorkOrders(mine: _mine, status: _status);
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

  void _setMine(bool mine) {
    if (_mine == mine) {
      return;
    }
    setState(() => _mine = mine);
    _load();
  }

  void _setStatus(String? status) {
    if (_status == status) {
      return;
    }
    setState(() => _status = status);
    _load();
  }

  Future<void> _open(WorkOrder order) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => WorkOrderDetailScreen(
          api: widget.api,
          workOrderId: order.id,
          user: widget.user,
          onUnauthorized: widget.onUnauthorized,
        ),
      ),
    );
    if (mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_canRead) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          SectionCard(
            title: 'Akses perintah kerja',
            child: Text(
              'Peran Anda tidak memiliki izin membaca perintah kerja. '
              'Otorisasi tetap diperiksa server. Hubungi supervisor bila '
              'penugasan lapangan diperlukan.',
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          const InfoBanner(
            title: 'Perintah kerja lapangan.',
            message:
                'Daftar ini memuat perintah kerja dalam cakupan organisasi Anda. '
                'Setiap transisi status divalidasi API dan tercatat pada audit trail.',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Ditugaskan ke saya'),
                selected: _mine,
                onSelected: (_) => _setMine(true),
              ),
              ChoiceChip(
                label: const Text('Semua dalam cakupan'),
                selected: !_mine,
                onSelected: (_) => _setMine(false),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final status in _statusFilters) ...[
                  ChoiceChip(
                    label: Text(
                      status == null ? 'Semua status' : workOrderStatusLabel(status),
                    ),
                    selected: _status == status,
                    onSelected: (_) => _setStatus(status),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  _loading
                      ? 'Memuat perintah kerja…'
                      : '${_items.length} perintah kerja · ${widget.user.scope.name}',
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
            SectionCard(
              title: 'Belum ada perintah kerja',
              child: Text(
                _mine
                    ? 'Tidak ada perintah kerja yang ditugaskan kepada Anda saat ini. '
                        'Perintah kerja dibuat supervisor dari temuan yang telah ditinjau manusia.'
                    : 'Tidak ada perintah kerja pada cakupan ini untuk filter yang dipilih.',
              ),
            ),
          for (final order in _items) ...[
            _WorkOrderTile(order: order, onTap: () => _open(order)),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
          Text(
            'Perintah kerja merupakan pencatatan tindakan perbaikan, bukan izin '
            'keselamatan atau kendali operasi kereta.',
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

class _WorkOrderTile extends StatelessWidget {
  const _WorkOrderTile({required this.order, required this.onTap});

  final WorkOrder order;
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
                      order.reference,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  WorkOrderStatusChip(status: order.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                order.title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.precision_manufacturing_outlined,
                      size: 14, color: RvColors.secondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '${order.asset.name} · ${order.asset.code}',
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: RvColors.secondary,
                          ),
                    ),
                  ),
                  FindingPriorityChip(priority: order.finding.priority),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.person_outline,
                      size: 14, color: RvColors.secondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Penerima: ${order.assigneeName}',
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: RvColors.secondary,
                          ),
                    ),
                  ),
                  Text(
                    formatDateTime(order.updatedAt),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                        ),
                  ),
                  const Icon(Icons.chevron_right, color: RvColors.primary),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Temuan ${order.finding.reference} · ${order.finding.title}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: RvColors.secondary,
                    ),
              ),
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
