import 'package:flutter/material.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../services/api_client.dart';
import '../widgets/section_card.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.apiClient});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          title: 'Application',
          child: Column(
            children: [
              _InfoRow(label: 'Product', value: 'RailwayVision AI'),
              const Divider(height: 20),
              _InfoRow(label: 'Build', value: AppConfig.appVersion),
              const Divider(height: 20),
              _InfoRow(label: 'API base URL', value: apiClient.baseUrl),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Session and identity',
          description: 'Authentication is delivered in Phase 2.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InfoRow(label: 'Signed in', value: 'No active session'),
              const Divider(height: 20),
              _InfoRow(label: 'Role and scope', value: 'Not assigned yet'),
              const SizedBox(height: 12),
              Text(
                'Roles and organizational scopes will be enforced by the backend. Navigation and actions will adapt to your assigned permissions; the app will not trust locally stored role claims.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: RvColors.secondary,
                      height: 1.5,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Privacy and data handling',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              _Bullet(
                'This build contains no KCIC operational data. Demonstration records will be labelled DEMO.',
              ),
              _Bullet(
                'Inspection imagery will be stored privately and served through short-lived authorized links.',
              ),
              _Bullet(
                'Sign-in tokens will use platform secure storage. They are never stored in plain preferences.',
              ),
              _Bullet(
                'Release builds require TLS; local cleartext access is restricted to development tooling.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        InfoBanner(
          title: 'Decision support only.',
          message:
              'AI output is advisory and requires authorized human review. This app cannot control trains, signalling, or dispatch systems.',
          icon: Icons.shield_outlined,
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: RvColors.secondary,
                ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
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
          const Icon(Icons.chevron_right, size: 16, color: RvColors.secondary),
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
