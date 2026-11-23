import 'package:flutter/material.dart';

import '../widgets/planned_module.dart';

class WorkScreen extends StatelessWidget {
  const WorkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlannedModule(
      icon: Icons.assignment_outlined,
      title: 'Assigned work',
      phase: 'Phase 7',
      description:
          'Corrective actions and verification steps appear here after the findings and work-order workflows are implemented and authorization-tested.',
      deliverables: [
        'Work orders assigned to you and your team',
        'Progress updates with timestamped evidence',
        'Awaiting-verification and closure states under authorized roles',
        'Full activity history for every finding and work order',
      ],
    );
  }
}
