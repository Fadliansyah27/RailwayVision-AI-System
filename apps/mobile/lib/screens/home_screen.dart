import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/session.dart';
import '../models/system_status.dart';
import '../services/api_client.dart';
import '../widgets/section_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onUnauthorized,
    required this.onOpenInspections,
  });

  final ApiClient api;
  final SessionUser user;
  final VoidCallback onUnauthorized;
  final VoidCallback onOpenInspections;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  SystemSnapshot? _snapshot;
  String? _error;
  bool _loading = true;
  int? _draftCount;
  int? _submittedCount;

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
      final snapshot = await widget.api.fetchStatus();
      if (!mounted) {
        return;
      }
      setState(() {
        _snapshot = snapshot;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.isNetworkFailure
            ? 'Tidak dapat menghubungi API di ${widget.api.baseUrl}. '
                'Periksa jaringan dan pastikan layanan berjalan.'
            : error.message;
        _loading = false;
      });
    }
    await _loadWorkload();
  }

  Future<void> _loadWorkload() async {
    try {
      final draft = await widget.api.listInspections(
        mine: true,
        status: 'draft',
        pageSize: 1,
      );
      final submitted = await widget.api.listInspections(
        mine: true,
        status: 'submitted',
        pageSize: 1,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _draftCount = draft.total;
        _submittedCount = submitted.total;
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
        _draftCount = null;
        _submittedCount = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final firstName = widget.user.fullName.split(' ').first;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          _GreetingCard(
            name: firstName,
            role: widget.user.roleSummary,
            scopeName: widget.user.scope.name,
          ),
          const SizedBox(height: 12),
          SectionCard(
            title: 'Status platform',
            description: 'Diambil langsung dari API dan dependensinya.',
            trailing: IconButton(
              tooltip: 'Muat ulang status',
              onPressed: _loading ? null : _load,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, size: 20),
            ),
            child: _buildStatus(context),
          ),
          const SizedBox(height: 12),
          SectionCard(
            title: 'Beban tugas saya',
            description: 'Dihitung server untuk cakupan Anda.',
            child: Column(
              children: [
                _WorkloadRow(
                  label: 'Draf perlu diselesaikan',
                  value: _draftCount,
                  onTap: widget.onOpenInspections,
                ),
                const Divider(height: 18),
                _WorkloadRow(
                  label: 'Menunggu peninjauan',
                  value: _submittedCount,
                  onTap: widget.onOpenInspections,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: widget.onOpenInspections,
                  icon: const Icon(Icons.checklist, size: 18),
                  label: const Text('Buka daftar inspeksi'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const _SafetyBoundaryCard(),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Prototipe pendukung keputusan. Bukan sistem kendali kereta '
              'atau izin keselamatan.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: RvColors.secondary,
                  ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildStatus(BuildContext context) {
    final snapshot = _snapshot;
    if (snapshot == null && _loading) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const LinearProgressIndicator(minHeight: 3),
          const SizedBox(height: 12),
          Text(
            'Memeriksa API, PostgreSQL, Redis, dan worker AI…',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: RvColors.secondary,
                ),
          ),
        ],
      );
    }
    if (snapshot == null && _error != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: RvColors.criticalSoft,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: RvColors.critical.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.wifi_off, size: 18, color: RvColors.critical),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          height: 1.5,
                        ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Coba lagi'),
          ),
        ],
      );
    }
    if (snapshot == null) {
      return const SizedBox.shrink();
    }

    final summary = summarizeReadiness(snapshot.readiness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryBanner(summary: summary),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _ServiceTile(
                icon: Icons.dns_outlined,
                name: 'API',
                state: 'ok',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ServiceTile(
                icon: Icons.storage_outlined,
                name: 'PostgreSQL',
                state: snapshot.readiness.component('database'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ServiceTile(
                icon: Icons.memory_outlined,
                name: 'Antrean Redis',
                state: snapshot.readiness.component('redis'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ServiceTile(
                icon: Icons.bolt_outlined,
                name: 'Worker AI',
                state: snapshot.readiness.component('worker'),
                note: 'Informatif',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'API ${snapshot.meta?.version ?? 'tidak diketahui'} · '
          '${snapshot.meta?.environment ?? 'tidak diketahui'} · '
          'diperiksa ${formatDateTime(snapshot.checkedAt)}',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: RvColors.secondary,
              ),
        ),
      ],
    );
  }
}

class _GreetingCard extends StatelessWidget {
  const _GreetingCard({
    required this.name,
    required this.role,
    required this.scopeName,
  });

  final String name;
  final String role;
  final String scopeName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [RvColors.primary, RvColors.primaryStrong],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.waving_hand_outlined,
                  size: 18, color: Colors.white70),
              const SizedBox(width: 6),
              Text(
                'Selamat bertugas, $name',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
              const Spacer(),
              const DemoBadge(onBrand: true),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '$role · $scopeName',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 10),
          const Text(
            'Lengkapi checklist, lampirkan bukti, lalu kirim untuk peninjauan '
            'manusia. Hak akses divalidasi server pada setiap aksi.',
            style: TextStyle(color: Colors.white, height: 1.5, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _WorkloadRow extends StatelessWidget {
  const _WorkloadRow({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final int? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            Text(
              value?.toString() ?? '—',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: RvColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, size: 18, color: RvColors.secondary),
          ],
        ),
      ),
    );
  }
}

class _SummaryBanner extends StatelessWidget {
  const _SummaryBanner({required this.summary});

  final ReadinessSummary summary;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon) = switch (summary.tone) {
      HealthTone.success => (
          RvColors.successSoft,
          RvColors.success,
          Icons.check_circle_outline,
        ),
      HealthTone.warning => (
          RvColors.warningSoft,
          RvColors.warning,
          Icons.error_outline,
        ),
      HealthTone.critical => (
          RvColors.criticalSoft,
          RvColors.critical,
          Icons.cancel_outlined,
        ),
      HealthTone.neutral => (
          RvColors.canvas,
          RvColors.secondary,
          Icons.help_outline,
        ),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: foreground.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: foreground),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary.label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  summary.detail,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.secondary,
                        height: 1.4,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.icon,
    required this.name,
    required this.state,
    this.note,
  });

  final IconData icon;
  final String name;
  final String state;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final healthy = state == 'ok';
    final label = healthy ? 'Sehat' : 'Tidak tersedia';
    final color = healthy ? RvColors.success : RvColors.critical;
    final background = healthy ? RvColors.successSoft : RvColors.criticalSoft;
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: RvColors.canvas,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: RvColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: RvColors.secondary),
          const SizedBox(height: 8),
          Text(
            name,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          if (note != null) ...[
            const SizedBox(height: 4),
            Text(
              note!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: RvColors.secondary,
                    fontSize: 10,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SafetyBoundaryCard extends StatelessWidget {
  const _SafetyBoundaryCard();

  static const _items = [
    'Keluaran AI bersifat saran. Keputusan teknik diambil peninjau berwenang.',
    'Tidak ada fungsi kendali kereta, persinyalan, interlocking, atau dispatch.',
    'Tidak ada vonis otomatis “aman” atau “tidak aman” di seluruh sistem.',
    'Hanya data sintetis atau data yang disetujui KCIC yang boleh dipakai.',
  ];

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Batas keselamatan',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final item in _items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.shield_outlined,
                      size: 16, color: RvColors.success),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: RvColors.secondary,
                            height: 1.5,
                          ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
