import 'package:flutter/material.dart';

import '../widgets/planned_module.dart';

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlannedModule(
      icon: Icons.photo_camera_outlined,
      title: 'Capture evidence',
      phase: 'Phase 3 · Phase 6',
      description:
          'Field capture will open only after the asset register, upload validation, and evidence-integrity pipeline exist. Camera access is not requested in this foundation build.',
      deliverables: [
        'Asset identity confirmation before capture',
        'Camera or approved gallery evidence with preview and retake',
        'Server-issued private upload with integrity hash',
        'Upload progress, retry, and explicit offline warnings',
        'Original evidence preserved; annotations remain separate derivatives',
      ],
      securityNote:
          'Evidence storage is private. Files are validated server-side for type, signature, size, and checksum. Release builds require TLS and block cleartext traffic.',
    );
  }
}
