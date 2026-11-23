import 'package:flutter_test/flutter_test.dart';

import 'package:railwayvision_mobile/app.dart';
import 'package:railwayvision_mobile/models/system_status.dart';
import 'package:railwayvision_mobile/services/api_client.dart';

class _FakeApiClient extends ApiClient {
  _FakeApiClient({this.snapshot, this.failure})
      : super(baseUrl: 'http://test.invalid');

  final SystemSnapshot? snapshot;
  final Object? failure;

  @override
  Future<SystemSnapshot> fetchStatus() async {
    if (failure != null) {
      throw failure!;
    }
    return snapshot!;
  }
}

SystemSnapshot _healthySnapshot() {
  return SystemSnapshot(
    readiness: const Readiness(
      status: 'ok',
      components: {'database': 'ok', 'redis': 'ok', 'worker': 'ok'},
    ),
    meta: const ServiceMeta(
      name: 'RailwayVision AI API',
      version: '0.1.0',
      environment: 'test',
      apiVersion: 'v1',
      aiDisclaimer: 'AI suggestions are advisory and require human review.',
    ),
    checkedAt: DateTime(2026, 11, 23, 10, 0),
  );
}

void main() {
  testWidgets('renders the foundation shell with live platform status',
      (tester) async {
    await tester.pumpWidget(
      RailwayVisionApp(apiClient: _FakeApiClient(snapshot: _healthySnapshot())),
    );
    await tester.pumpAndSettle();

    expect(find.text('RailwayVision AI'), findsOneWidget);
    expect(find.text('DEMO'), findsOneWidget);
    expect(find.text('All systems operational'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Inspections'), findsOneWidget);
    expect(find.text('Capture'), findsOneWidget);
  });

  testWidgets('shows a retry state when the API is unreachable', (tester) async {
    await tester.pumpWidget(
      RailwayVisionApp(
        apiClient: _FakeApiClient(failure: Exception('network down')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Unable to reach the API'), findsOneWidget);
    expect(find.text('Retry connection'), findsOneWidget);
  });
}
