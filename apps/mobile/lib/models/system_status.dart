enum HealthTone { success, warning, critical, neutral }

class Readiness {
  const Readiness({required this.status, required this.components});

  final String status;
  final Map<String, String> components;

  bool get isOperational => status == 'ok';

  String component(String name) => components[name] ?? 'unknown';

  factory Readiness.fromJson(Map<String, dynamic> json) {
    final rawComponents = json['components'];
    final components = <String, String>{};
    if (rawComponents is Map) {
      rawComponents.forEach((key, value) {
        components[key.toString()] = value?.toString() ?? 'unknown';
      });
    }
    return Readiness(
      status: json['status']?.toString() ?? 'unknown',
      components: components,
    );
  }
}

class ServiceMeta {
  const ServiceMeta({
    required this.name,
    required this.version,
    required this.environment,
    required this.apiVersion,
    required this.aiDisclaimer,
  });

  final String name;
  final String version;
  final String environment;
  final String apiVersion;
  final String aiDisclaimer;

  factory ServiceMeta.fromJson(Map<String, dynamic> json) {
    return ServiceMeta(
      name: json['name']?.toString() ?? 'RailwayVision AI API',
      version: json['version']?.toString() ?? 'unknown',
      environment: json['environment']?.toString() ?? 'unknown',
      apiVersion: json['api_version']?.toString() ?? 'unknown',
      aiDisclaimer: json['ai_disclaimer']?.toString() ?? _fallbackDisclaimer,
    );
  }
}

const _fallbackDisclaimer =
    'AI-generated suggestions are advisory and preliminary. They must be verified by an '
    'authorized reviewer. This system does not declare any infrastructure safe or unsafe.';

class SystemSnapshot {
  const SystemSnapshot({
    required this.readiness,
    required this.meta,
    required this.checkedAt,
  });

  final Readiness readiness;
  final ServiceMeta? meta;
  final DateTime checkedAt;
}

class ReadinessSummary {
  const ReadinessSummary({
    required this.label,
    required this.detail,
    required this.tone,
  });

  final String label;
  final String detail;
  final HealthTone tone;
}

ReadinessSummary summarizeReadiness(Readiness readiness) {
  if (!readiness.isOperational) {
    return const ReadinessSummary(
      label: 'Service degraded',
      detail: 'A required dependency (database or queue) is unavailable.',
      tone: HealthTone.critical,
    );
  }
  if (readiness.component('worker') != 'ok') {
    return const ReadinessSummary(
      label: 'Operational — AI worker offline',
      detail:
          'The API is serving requests. AI jobs will queue until the worker heartbeat resumes.',
      tone: HealthTone.warning,
    );
  }
  return const ReadinessSummary(
    label: 'All systems operational',
    detail: 'API, PostgreSQL, Redis, and the AI worker heartbeat are healthy.',
    tone: HealthTone.success,
  );
}
