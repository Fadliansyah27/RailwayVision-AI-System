import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../services/api_client.dart';
import '../services/session_controller.dart';
import '../widgets/section_card.dart';

const _demoAccounts = [
  'admin@demo.railwayvision.example',
  'inspector@demo.railwayvision.example',
  'reviewer@demo.railwayvision.example',
  'supervisor@demo.railwayvision.example',
  'ai@demo.railwayvision.example',
  'auditor@demo.railwayvision.example',
];

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.session,
    required this.apiBaseUrl,
  });

  final SessionController session;
  final String apiBaseUrl;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.session.signIn(
        _emailController.text,
        _passwordController.text,
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = switch (error.statusCode) {
          401 => 'Email atau kata sandi tidak valid.',
          429 => error.message,
          _ => error.message,
        };
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: RvColors.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _HeroPanel(),
                  const SizedBox(height: 18),
                  _form(context),
                  const SizedBox(height: 14),
                  _DemoAccounts(
                    onSelected: (email) {
                      _emailController.text = email;
                      _passwordController.clear();
                    },
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Prototipe pendukung keputusan. Keluaran AI bersifat saran dan '
                    'memerlukan verifikasi manusia berwenang. Aplikasi ini tidak '
                    'mengendalikan kereta, persinyalan, atau interlocking.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: RvColors.secondary,
                          height: 1.5,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _form(BuildContext context) {
    final restoreError = widget.session.restoreError;
    return SectionCard(
      title: 'Masuk ke ruang kerja',
      description:
          'Gunakan akun DEMO yang diberikan administrator proyek. Peran dan '
          'cakupan ditegakkan oleh server.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (restoreError != null) ...[
              _ErrorBox(
                message: restoreError,
                onRetry: widget.session.restore,
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _emailController,
              enabled: !_submitting,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.username],
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.alternate_email),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                final email = value?.trim() ?? '';
                if (email.isEmpty) {
                  return 'Email wajib diisi.';
                }
                if (!email.contains('@')) {
                  return 'Format email tidak valid.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _passwordController,
              enabled: !_submitting,
              obscureText: _obscure,
              autofillHints: const [AutofillHints.password],
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Kata sandi',
                prefixIcon: const Icon(Icons.lock_outline),
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  tooltip: _obscure ? 'Tampilkan kata sandi' : 'Sembunyikan',
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off,
                  ),
                ),
              ),
              validator: (value) =>
                  (value == null || value.isEmpty) ? 'Kata sandi wajib diisi.' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              _ErrorBox(message: _error!),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.login),
              label: Text(_submitting ? 'Memverifikasi…' : 'Masuk'),
            ),
            const SizedBox(height: 10),
            Text(
              'API: ${widget.apiBaseUrl}',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: RvColors.secondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [RvColors.primary, RvColors.primaryStrong],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: RvColors.primary.withValues(alpha: 0.28),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'RV',
                  style: TextStyle(
                    color: RvColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'RailwayVision AI',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Inspeksi infrastruktur · pendukung keputusan',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const DemoBadge(onBrand: true),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'Akses lapangan yang tertaut ke API, cakupan organisasi, dan '
            'riwayat aktivitas server.',
            style: TextStyle(color: Colors.white, height: 1.5, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: RvColors.criticalSoft,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: RvColors.critical.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: RvColors.critical),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    height: 1.5,
                  ),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              child: const Text('Coba lagi'),
            ),
        ],
      ),
    );
  }
}

class _DemoAccounts extends StatelessWidget {
  const _DemoAccounts({required this.onSelected});

  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Akun DEMO',
      description:
          'Kata sandi diambil dari DEMO_SEED_PASSWORD pada konfigurasi lokal. '
          'Jangan aktifkan seed demo di lingkungan yang dapat diakses publik.',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final email in _demoAccounts)
            ActionChip(
              avatar: const Icon(Icons.person_outline, size: 16),
              label: Text(
                email.split('@').first,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              onPressed: () => onSelected(email),
            ),
        ],
      ),
    );
  }
}
