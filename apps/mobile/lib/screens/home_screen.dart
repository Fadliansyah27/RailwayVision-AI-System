import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../models/system_status.dart';
import '../services/api_client.dart';
import '../widgets/section_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.apiClient});

  final ApiClient apiClient;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  SystemSnapshot? _snapshot;
  String? _error;
  bool _loading = true;

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
      final snapshot = await widget.apiClient.fetchStatus();
      if (!mounted) {
        return;
      }
      setState(() {
        _snapshot = snapshot;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error =
            'Unable to reach the API at ${widget.apiClient.baseUrl}. Check that the API container is running and that the device can reach it.';
        _loading = false;
      });
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
            title: 'Foundation build (Phase 1).',
            message:
                'Only platform health is live today. Sign-in, inspections, AI analysis, and work orders arrive in later phases. No operational data is simulated.',
          ),
          const SizedBox(height: 12),
          SectionCard(
            title: 'Platform status',
            description: 'Queried directly from the API and its dependencies.',
            trailing: IconButton(
              tooltip: 'Refresh status',
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
          const _WorkloadCard(),
          const SizedBox(height: 12),
          const _SafetyBoundaryCard(),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Decision-support prototype. Not a train-control or safety-clearance system.',
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const LinearProgressIndicator(minHeight: 3),
          const SizedBox(height: 12),
          Text(
            'Checking API, PostgreSQL, Redis, and AI worker…',
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
                          color: RvColors.ink,
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
            label: const Text('Retry connection'),
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
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(
            'Showing the last known status. The most recent refresh failed.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.warning,
                ),
          ),
        ],
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
                name: 'Redis queue',
                state: snapshot.readiness.component('redis'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ServiceTile(
                icon: Icons.bolt_outlined,
                name: 'AI worker',
                state: snapshot.readiness.component('worker'),
                note: 'Informational',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'API ${snapshot.meta?.version ?? 'unknown'} · '
          '${snapshot.meta?.environment ?? 'unknown'} environment · '
          'checked ${TimeOfDay.fromDateTime(snapshot.checkedAt).format(context)}',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: RvColors.secondary,
              ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: RvColors.aiSoft,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: RvColors.ai.withValues(alpha: 0.2)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.verified_user_outlined,
                  size: 16, color: RvColors.ai),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  snapshot.meta?.aiDisclaimer ??
                      'AI-generated suggestions are advisory and preliminary. They must be verified by an authorized reviewer.',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.ink,
                        height: 1.5,
                      ),
                ),
              ),
            ],
          ),
        ),
      ],
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
                        color: RvColors.ink,
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
    final label = healthy ? 'Healthy' : 'Unavailable';
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

class _WorkloadCard extends StatelessWidget {
  const _WorkloadCard();

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Your workload',
      description: 'Personal workload appears after authentication (Phase 2).',
      child: Column(
        children: [
          _WorkloadRow(label: 'Assigned inspections', hint: 'Phase 3'),
          const Divider(height: 20),
          _WorkloadRow(label: 'Open work items', hint: 'Phase 7'),
        ],
      ),
    );
  }
}

class _WorkloadRow extends StatelessWidget {
  const _WorkloadRow({required this.label, required this.hint});

  final String label;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        Text(
          '—',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: RvColors.secondary.withValues(alpha: 0.5),
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(width: 8),
        Text(
          hint,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: RvColors.secondary,
              ),
        ),
      ],
    );
  }
}

class _SafetyBoundaryCard extends StatelessWidget {
  const _SafetyBoundaryCard();

  static const _items = [
    'AI output is advisory. Authorized reviewers make every engineering decision.',
    'No train-control, signalling, interlocking, dispatch, or safety-clearance functions.',
    'No automated “safe” or “unsafe” verdict exists anywhere in the system.',
    'Synthetic or explicitly authorized data only until KCIC approves datasets.',
  ];

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Safety boundary',
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
