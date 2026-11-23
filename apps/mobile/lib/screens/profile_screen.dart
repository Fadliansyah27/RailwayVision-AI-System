import 'package:flutter/material.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../services/session_controller.dart';
import '../widgets/section_card.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.session,
    required this.apiBaseUrl,
  });

  final SessionController session;
  final String apiBaseUrl;

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari sesi?'),
        content: const Text(
          'Sesi akan dicabut di server. Bukti yang masih di antrean luring '
          'tetap tersimpan di perangkat ini.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await session.signOut();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = session.user;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          title: 'Identitas sesi',
          description: 'Divalidasi server pada setiap permintaan.',
          child: user == null
              ? const Text('Tidak ada sesi aktif.')
              : Column(
                  children: [
                    _InfoRow(label: 'Nama', value: user.fullName),
                    const Divider(height: 18),
                    _InfoRow(label: 'Email', value: user.email),
                    const Divider(height: 18),
                    _InfoRow(label: 'Peran', value: user.roleSummary),
                    const Divider(height: 18),
                    _InfoRow(
                      label: 'Cakupan',
                      value: user.scope.name,
                      hint: user.scope.code,
                    ),
                    const Divider(height: 18),
                    _InfoRow(
                      label: 'Izin',
                      value: '${user.permissions.length} izin aktif',
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Aplikasi',
          child: Column(
            children: [
              const _InfoRow(label: 'Produk', value: 'RailwayVision AI'),
              const Divider(height: 18),
              const _InfoRow(label: 'Build', value: AppConfig.appVersion),
              const Divider(height: 18),
              _InfoRow(label: 'API', value: apiBaseUrl),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Privasi dan data',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              _Bullet(
                'Build ini tidak memuat data operasional KCIC. Semua catatan '
                'bertanda SINTETIS merupakan data sintetis.',
              ),
              _Bullet(
                'Bukti disimpan privat dan hanya dapat dibaca melalui API yang '
                'berwenang; setiap pembacaan diaudit.',
              ),
              _Bullet(
                'Token sesi disimpan pada penyimpanan aman platform, bukan pada '
                'preferensi biasa.',
              ),
              _Bullet(
                'Build rilis mewajibkan TLS. Akses cleartext hanya untuk alat '
                'pengembangan lokal.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        InfoBanner(
          icon: Icons.shield_outlined,
          title: 'Hanya pendukung keputusan.',
          message:
              'Keluaran AI bersifat saran dan memerlukan verifikasi manusia '
              'berwenang. Aplikasi ini tidak dapat mengendalikan kereta, '
              'persinyalan, atau sistem interlocking.',
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => _confirmSignOut(context),
          icon: const Icon(Icons.logout),
          label: const Text('Keluar'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.hint});

  final String label;
  final String value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 92,
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: RvColors.secondary,
                ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              if (hint != null)
                Text(
                  hint!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: RvColors.secondary,
                      ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.chevron_right, size: 16, color: RvColors.primary),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: RvColors.secondary,
                    height: 1.5,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
