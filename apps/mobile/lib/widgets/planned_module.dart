import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'section_card.dart';

class PlannedModule extends StatelessWidget {
  const PlannedModule({
    super.key,
    required this.icon,
    required this.title,
    required this.phase,
    required this.description,
    required this.deliverables,
    this.securityNote,
  });

  final IconData icon;
  final String title;
  final String phase;
  final String description;
  final List<String> deliverables;
  final String? securityNote;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: RvColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: RvColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: RvColors.primarySoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: RvColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: RvColors.canvas,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: RvColors.border),
                    ),
                    child: Text(
                      phase,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: RvColors.secondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                description,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: RvColors.secondary,
                      height: 1.5,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Planned in this module',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final item in deliverables)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.check_circle_outline,
                        size: 16,
                        color: RvColors.success,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    height: 1.5,
                                    color: RvColors.ink,
                                  ),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 2),
              Text(
                'This module is intentionally not simulated. It becomes available only after its backend, authorization, and acceptance tests pass.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: RvColors.secondary,
                      fontStyle: FontStyle.italic,
                      height: 1.5,
                    ),
              ),
            ],
          ),
        ),
        if (securityNote != null) ...[
          const SizedBox(height: 12),
          InfoBanner(
            icon: Icons.shield_outlined,
            title: 'Security note:',
            message: securityNote!,
          ),
        ],
      ],
    );
  }
}
