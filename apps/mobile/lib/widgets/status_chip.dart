import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (tone) {
      Tone.success => (RvColors.successSoft, RvColors.success),
      Tone.warning => (RvColors.warningSoft, RvColors.warning),
      Tone.critical => (RvColors.criticalSoft, RvColors.critical),
      Tone.ai => (RvColors.aiSoft, RvColors.ai),
      Tone.neutral => (RvColors.canvas, RvColors.secondary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foreground.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class InspectionStatusChip extends StatelessWidget {
  const InspectionStatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return StatusChip(
      label: inspectionStatusLabel(status),
      tone: inspectionStatusTone(status),
    );
  }
}
