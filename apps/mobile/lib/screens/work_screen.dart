import 'package:flutter/material.dart';

import '../widgets/planned_module.dart';

class WorkScreen extends StatelessWidget {
  const WorkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlannedModule(
      icon: Icons.assignment_outlined,
      title: 'Perintah kerja',
      phase: 'Fase C',
      description:
          'Daftar perintah kerja lapangan akan tersedia setelah modul laporan AI '
          'dan work order dirilis. Belum ada data atau aksi yang disimulasikan '
          'pada build ini.',
      deliverables: [
        'Perintah kerja yang ditugaskan ke Anda beserta prioritasnya',
        'Tautan ke temuan dan inspeksi sumber yang telah ditinjau manusia',
        'Pencatatan progres pekerjaan dan bukti penyelesaian',
        'Verifikasi supervisor sebelum perintah kerja ditutup',
      ],
      securityNote:
          'AI bersifat saran. Perintah kerja hanya dibuat dari temuan yang '
          'dikonfirmasi manusia berwenang, dan seluruh aksi tercatat pada '
          'riwayat aktivitas server.',
    );
  }
}
