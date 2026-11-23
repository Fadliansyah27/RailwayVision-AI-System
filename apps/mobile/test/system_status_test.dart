import 'package:flutter_test/flutter_test.dart';

import 'package:railwayvision_mobile/models/system_status.dart';

void main() {
  test('summarizes fully healthy dependencies', () {
    const readiness = Readiness(
      status: 'ok',
      components: {'database': 'ok', 'redis': 'ok', 'worker': 'ok'},
    );

    final summary = summarizeReadiness(readiness);

    expect(summary.tone, HealthTone.success);
    expect(summary.label, 'All systems operational');
  });

  test('warns when only the asynchronous worker is unavailable', () {
    const readiness = Readiness(
      status: 'ok',
      components: {'database': 'ok', 'redis': 'ok', 'worker': 'error'},
    );

    final summary = summarizeReadiness(readiness);

    expect(summary.tone, HealthTone.warning);
    expect(summary.label, contains('AI worker offline'));
  });

  test('reports degraded service when a required dependency fails', () {
    const readiness = Readiness(
      status: 'degraded',
      components: {'database': 'ok', 'redis': 'error', 'worker': 'ok'},
    );

    final summary = summarizeReadiness(readiness);

    expect(summary.tone, HealthTone.critical);
  });

  test('parses readiness and metadata payloads', () {
    final readiness = Readiness.fromJson({
      'status': 'ok',
      'components': {'database': 'ok', 'redis': 'ok', 'worker': 'ok'},
    });
    final meta = ServiceMeta.fromJson({
      'name': 'RailwayVision AI API',
      'version': '0.1.0',
      'environment': 'local',
      'api_version': 'v1',
      'ai_disclaimer': 'Advisory only.',
    });

    expect(readiness.isOperational, isTrue);
    expect(readiness.component('database'), 'ok');
    expect(meta.environment, 'local');
    expect(meta.aiDisclaimer, 'Advisory only.');
  });
}
