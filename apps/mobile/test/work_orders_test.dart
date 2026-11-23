import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:railwayvision_mobile/core/theme.dart';
import 'package:railwayvision_mobile/models/inspection.dart';
import 'package:railwayvision_mobile/models/session.dart';
import 'package:railwayvision_mobile/models/work_order.dart';
import 'package:railwayvision_mobile/screens/work_order_detail_screen.dart';
import 'package:railwayvision_mobile/screens/work_screen.dart';
import 'package:railwayvision_mobile/services/api_client.dart';

class _FakeApi extends ApiClient {
  _FakeApi({required this.items}) : super(baseUrl: 'http://test.invalid');

  List<WorkOrder> items;
  int listCalls = 0;
  int startCalls = 0;
  int completeCalls = 0;
  WorkOrder? _current;

  @override
  Future<WorkOrderPage> listWorkOrders({
    bool mine = false,
    String? status,
    int page = 1,
    int pageSize = 50,
  }) async {
    listCalls += 1;
    final filtered = items
        .where((order) => status == null || order.status == status)
        .toList(growable: false);
    return WorkOrderPage(items: filtered, total: filtered.length);
  }

  @override
  Future<WorkOrder> fetchWorkOrder(String workOrderId) async {
    _current = items.firstWhere((order) => order.id == workOrderId);
    return _current!;
  }

  @override
  Future<WorkOrder> startWorkOrder(String workOrderId) async {
    startCalls += 1;
    _current = _copy(_current!, status: 'in_progress');
    items = [_current!];
    return _current!;
  }

  @override
  Future<WorkOrder> completeWorkOrder(
    String workOrderId, {
    required String notes,
  }) async {
    completeCalls += 1;
    _current = _copy(_current!, status: 'awaiting_verification');
    items = [_current!];
    return _current!;
  }
}

WorkOrder _order({String status = 'open'}) {
  return WorkOrder(
    id: 'wo-1',
    reference: 'WO-20261123-ABC123',
    title: 'Perbaikan baut pengencang jalur',
    instructions: 'Periksa dan kencangkan baut pada segmen yang ditandai.',
    status: status,
    completionNotes: '',
    verificationNotes: '',
    version: 1,
    finding: const FindingBrief(
      id: 'finding-1',
      reference: 'FND-20261123-DEF456',
      title: 'Baut pengencang longgar',
      status: 'assigned',
      priority: 'high',
    ),
    asset: const AssetOption(
      id: 'asset-1',
      code: 'DEMO-TRK-001',
      name: 'Jalur DEMO KM 12',
    ),
    scopeName: 'Koridor DEMO Halim–Tegalluar',
    assigneeId: 'user-1',
    assigneeName: 'Rina Pratiwi',
    createdByName: 'Supervisor Demo',
    completedAt: null,
    verifiedAt: null,
    createdAt: DateTime.utc(2026, 11, 23, 2, 0),
    updatedAt: DateTime.utc(2026, 11, 23, 3, 0),
  );
}

WorkOrder _copy(WorkOrder order, {required String status}) {
  return WorkOrder(
    id: order.id,
    reference: order.reference,
    title: order.title,
    instructions: order.instructions,
    status: status,
    completionNotes: order.completionNotes,
    verificationNotes: order.verificationNotes,
    version: order.version + 1,
    finding: order.finding,
    asset: order.asset,
    scopeName: order.scopeName,
    assigneeId: order.assigneeId,
    assigneeName: order.assigneeName,
    createdByName: order.createdByName,
    completedAt: order.completedAt,
    verifiedAt: order.verifiedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  );
}

SessionUser _supervisor() {
  return const SessionUser(
    id: 'user-1',
    email: 'supervisor@demo.railwayvision.example',
    fullName: 'Rina Pratiwi',
    scope: SessionScope(
      id: 'scope-1',
      code: 'DEMO-HSR',
      name: 'Koridor DEMO Halim–Tegalluar',
      path: '/DEMO-HSR',
    ),
    roles: [SessionRole(code: 'supervisor', name: 'Supervisor')],
    permissions: {
      'work_orders:read',
      'work_orders:write',
      'work_orders:verify',
    },
  );
}

Widget _screen(Widget child) {
  return MaterialApp(theme: buildRailwayVisionTheme(), home: child);
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('id_ID');
  });

  testWidgets('lists work orders in the assigned filter', (tester) async {
    final api = _FakeApi(items: [_order()]);
    await tester.pumpWidget(
      _screen(
        Scaffold(
          body: WorkScreen(
            api: api,
            user: _supervisor(),
            onUnauthorized: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(api.listCalls, 1);
    expect(find.text('WO-20261123-ABC123'), findsOneWidget);
    expect(find.text('Terbuka'), findsWidgets);
    expect(find.textContaining('Jalur DEMO KM 12'), findsOneWidget);
    expect(find.text('Ditugaskan ke saya'), findsOneWidget);
  });

  testWidgets('shows an honest empty state when no work orders exist',
      (tester) async {
    final api = _FakeApi(items: const []);
    await tester.pumpWidget(
      _screen(
        Scaffold(
          body: WorkScreen(
            api: api,
            user: _supervisor(),
            onUnauthorized: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Belum ada perintah kerja'), findsOneWidget);
    expect(find.textContaining('Tidak ada perintah kerja yang ditugaskan'),
        findsOneWidget);
  });

  testWidgets('does not call the API without work-order permission',
      (tester) async {
    final api = _FakeApi(items: [_order()]);
    const limitedUser = SessionUser(
      id: 'user-9',
      email: 'auditor@demo.railwayvision.example',
      fullName: 'Auditor Demo',
      scope: SessionScope(
        id: 'scope-1',
        code: 'DEMO-HSR',
        name: 'Koridor DEMO Halim–Tegalluar',
        path: '/DEMO-HSR',
      ),
      roles: [SessionRole(code: 'guest', name: 'Tamu')],
      permissions: {'inspections:read'},
    );
    await tester.pumpWidget(
      _screen(
        Scaffold(
          body: WorkScreen(
            api: api,
            user: limitedUser,
            onUnauthorized: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(api.listCalls, 0);
    expect(find.text('Akses perintah kerja'), findsOneWidget);
  });

  testWidgets('starts an assigned work order and requires notes to complete',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _FakeApi(items: [_order()]);
    await tester.pumpWidget(
      _screen(
        WorkOrderDetailScreen(
          api: api,
          workOrderId: 'wo-1',
          user: _supervisor(),
          onUnauthorized: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    final startButton =
        find.widgetWithText(FilledButton, 'Mulai pekerjaan');
    await tester.scrollUntilVisible(
      startButton,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(startButton);
    await tester.pumpAndSettle();

    expect(find.text('Ya, lanjutkan'), findsOneWidget);
    await tester.tap(find.text('Ya, lanjutkan'));
    await tester.pumpAndSettle();

    expect(api.startCalls, 1);
    expect(find.text('Sedang Dikerjakan'), findsOneWidget);
    expect(find.text('Mulai pekerjaan tercatat.'), findsOneWidget);

    final completeButton =
        find.widgetWithText(FilledButton, 'Laporkan selesai');
    await tester.scrollUntilVisible(
      completeButton,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(completeButton);
    await tester.pumpAndSettle();

    expect(api.completeCalls, 0);
    expect(
      find.text('Masukkan catatan minimal 5 karakter untuk tindakan ini.'),
      findsOneWidget,
    );
  });
}
