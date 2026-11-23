import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/session.dart';
import '../models/work_order.dart';
import '../services/api_client.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';

class WorkOrderDetailScreen extends StatefulWidget {
  const WorkOrderDetailScreen({
    super.key,
    required this.api,
    required this.workOrderId,
    required this.user,
    required this.onUnauthorized,
  });

  final ApiClient api;
  final String workOrderId;
  final SessionUser user;
  final VoidCallback onUnauthorized;

  @override
  State<WorkOrderDetailScreen> createState() => _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends State<WorkOrderDetailScreen> {
  final _notesController = TextEditingController();

  WorkOrder? _order;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _actionError;
  String? _notice;

  bool get _canWrite => widget.user.can('work_orders:write');
  bool get _canVerify => widget.user.can('work_orders:verify');
  bool get _isAssignee => _order?.assigneeId == widget.user.id;
  bool get _canAct => _isAssignee || _canWrite;

  bool get _startable => _order?.status == 'open' && _canAct;
  bool get _completable => _order?.isActive == true && _canAct;
  bool get _verifiable =>
      _order?.isAwaitingVerification == true &&
      _canVerify &&
      (!_isAssignee || _canWrite);
  bool get _cancellable => _order?.isActive == true && _canWrite;
  bool get _needsNotes => _completable || _verifiable || _cancellable;
  bool get _hasActions => _startable || _completable || _verifiable || _cancellable;

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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final order = await widget.api.fetchWorkOrder(widget.workOrderId);
      if (!mounted) {
        return;
      }
      setState(() {
        _order = order;
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

  Future<bool> _confirm(String label) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(label),
        content: const Text(
          'Tindakan ini dicatat pada riwayat aktivitas dan tidak dapat '
          'diurungkan dari perangkat ini.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Ya, lanjutkan'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _runAction({
    required String label,
    required bool requiresNotes,
    required Future<WorkOrder> Function(String notes) call,
  }) async {
    final notes = _notesController.text.trim();
    if (requiresNotes && notes.length < 5) {
      setState(() {
        _actionError =
            'Masukkan catatan minimal 5 karakter untuk tindakan ini.';
        _notice = null;
      });
      return;
    }
    if (!await _confirm(label)) {
      return;
    }
    setState(() {
      _saving = true;
      _actionError = null;
      _notice = null;
    });
    try {
      final updated = await call(notes);
      if (!mounted) {
        return;
      }
      setState(() {
        _order = updated;
        _saving = false;
        _notice = '$label tercatat.';
        _notesController.clear();
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
        _actionError = error.message;
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_order?.reference ?? 'Perintah kerja')),
      body: _body(context),
    );
  }

  Widget _body(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final order = _order;
    if (order == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Perintah kerja tidak tersedia',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _error ??
                      'Perintah kerja ini tidak ada atau di luar cakupan Anda.',
                ),
                const SizedBox(height: 8),
                TextButton(onPressed: _load, child: const Text('Coba lagi')),
              ],
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
          SectionCard(
            title: order.title,
            description: 'Temuan ${order.finding.reference}',
            trailing: WorkOrderStatusChip(status: order.status),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DetailRow(
                  label: 'Aset',
                  value: '${order.asset.name} · ${order.asset.code}',
                ),
                _DetailRow(label: 'Cakupan', value: order.scopeName),
                _DetailRow(
                  label: 'Penerima tugas',
                  value: order.assigneeName.isEmpty
                      ? 'Belum ditetapkan'
                      : order.assigneeName,
                ),
                _DetailRow(
                  label: 'Dibuat oleh',
                  value:
                      '${order.createdByName} · ${formatDateTime(order.createdAt)}',
                ),
                _DetailRow(
                  label: 'Selesai',
                  value: formatDateTime(order.completedAt),
                ),
                _DetailRow(
                  label: 'Diverifikasi',
                  value: formatDateTime(order.verifiedAt),
                ),
                _DetailRow(label: 'Versi catatan', value: 'v${order.version}'),
                const SizedBox(height: 6),
                Row(
                  children: [
                    FindingPriorityChip(priority: order.finding.priority),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        order.finding.title,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: RvColors.secondary,
                            ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SectionCard(
            title: 'Instruksi',
            description: 'Instruksi yang dicatat pengelola perintah kerja.',
            child: Text(
              order.instructions.isEmpty
                  ? 'Tidak ada instruksi tambahan yang dicatat.'
                  : order.instructions,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.6),
            ),
          ),
          if (order.completionNotes.isNotEmpty) ...[
            const SizedBox(height: 12),
            SectionCard(
              title: 'Catatan penyelesaian',
              child: Text(
                order.completionNotes,
                style:
                    Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.6),
              ),
            ),
          ],
          if (order.verificationNotes.isNotEmpty) ...[
            const SizedBox(height: 12),
            SectionCard(
              title: 'Catatan verifikasi',
              child: Text(
                order.verificationNotes,
                style:
                    Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.6),
              ),
            ),
          ],
          const SizedBox(height: 12),
          SectionCard(
            title: 'Tindakan',
            description: 'Setiap transisi divalidasi API dan diaudit.',
            child: _actions(context),
          ),
          const SizedBox(height: 12),
          Text(
            'Pencatatan tindakan perbaikan. Bukan izin keselamatan, bukan '
            'perintah pengaturan perjalanan, dan tidak terhubung ke kendali '
            'kereta atau persinyalan.',
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

  Widget _actions(BuildContext context) {
    if (!_hasActions) {
      return const Text(
        'Tidak ada tindakan yang tersedia untuk peran Anda pada status ini.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_notice != null) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: RvColors.successSoft,
              borderRadius: BorderRadius.circular(8),
              border:
                  Border.all(color: RvColors.success.withValues(alpha: 0.25)),
            ),
            child: Text(
              _notice!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (_actionError != null) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: RvColors.criticalSoft,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: RvColors.critical.withValues(alpha: 0.25)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _actionError!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                TextButton(
                  onPressed: _saving ? null : _load,
                  child: const Text('Muat ulang data'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (_needsNotes) ...[
          TextField(
            controller: _notesController,
            enabled: !_saving,
            maxLength: 2000,
            minLines: 2,
            maxLines: 5,
            decoration: const InputDecoration(
              labelText: 'Catatan tindakan',
              helperText:
                  'Wajib minimal 5 karakter untuk penyelesaian, verifikasi, '
                  'dan pembatalan.',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (_startable)
          FilledButton.icon(
            onPressed: _saving
                ? null
                : () => _runAction(
                      label: 'Mulai pekerjaan',
                      requiresNotes: false,
                      call: (_) => widget.api.startWorkOrder(_order!.id),
                    ),
            icon: const Icon(Icons.play_arrow),
            label: const Text('Mulai pekerjaan'),
          ),
        if (_completable) ...[
          if (_startable) const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving
                ? null
                : () => _runAction(
                      label: 'Laporkan selesai',
                      requiresNotes: true,
                      call: (notes) => widget.api
                          .completeWorkOrder(_order!.id, notes: notes),
                    ),
            icon: const Icon(Icons.task_alt),
            label: const Text('Laporkan selesai'),
          ),
        ],
        if (_verifiable) ...[
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving
                ? null
                : () => _runAction(
                      label: 'Verifikasi penyelesaian',
                      requiresNotes: true,
                      call: (notes) =>
                          widget.api.verifyWorkOrder(_order!.id, notes: notes),
                    ),
            icon: const Icon(Icons.verified_outlined),
            label: const Text('Verifikasi penyelesaian'),
          ),
        ],
        if (_cancellable) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _saving
                ? null
                : () => _runAction(
                      label: 'Batalkan perintah kerja',
                      requiresNotes: true,
                      call: (notes) =>
                          widget.api.cancelWorkOrder(_order!.id, notes: notes),
                    ),
            icon: const Icon(Icons.block),
            label: const Text('Batalkan perintah kerja'),
          ),
        ],
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: RvColors.secondary,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
