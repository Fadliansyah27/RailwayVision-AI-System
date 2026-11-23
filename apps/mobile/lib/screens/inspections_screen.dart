import 'package:flutter/material.dart';

import '../widgets/planned_module.dart';

class InspectionsScreen extends StatelessWidget {
  const InspectionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlannedModule(
      icon: Icons.checklist_rtl,
      title: 'My inspections',
      phase: 'Phase 3',
      description:
          'Assigned inspections, draft submissions, upload status, and AI processing state will be available here after the inspection and secure-media modules are delivered.',
      deliverables: [
        'Assigned inspection list filtered by your organizational scope',
        'Draft inspection submission with recoverable upload failures',
        'Processing states: uploaded, queued, processing, ready for review',
        'Clear distinction between AI suggestions and human review outcomes',
      ],
    );
  }
}
