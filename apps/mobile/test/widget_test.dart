import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:railwayvision_mobile/app.dart';
import 'package:railwayvision_mobile/models/session.dart';
import 'package:railwayvision_mobile/models/system_status.dart';
import 'package:railwayvision_mobile/services/api_client.dart';
import 'package:railwayvision_mobile/services/draft_store.dart';
import 'package:railwayvision_mobile/services/pending_upload.dart';

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    this.snapshot,
    this.failure,
    this.inspectionTotal = 0,
  }) : super(baseUrl: 'http://test.invalid');

  final SystemSnapshot? snapshot;
  final Object? failure;
  final int inspectionTotal;

  SessionUser? signedInUser;

  @override
  Future<SessionUser?> restoreSession() async {
    if (failure != null) {
      throw failure!;
    }
    return null;
  }

  @override
  Future<SessionUser> login(String email, String password) async {
    final user = _user(email: email);
    signedInUser = user;
    return user;
  }

  @override
  Future<void> logout() async {
    signedInUser = null;
  }

  @override
  Future<SystemSnapshot> fetchStatus() async {
    if (failure != null) {
      throw failure!;
    }
    return snapshot!;
  }

  @override
  Future<InspectionPage> listInspections({
    bool mine = true,
    String? status,
    int page = 1,
    int pageSize = 50,
  }) async {
    if (failure != null) {
      throw failure!;
    }
    return InspectionPage(items: const [], total: inspectionTotal);
  }

  SessionUser _user({String email = 'inspector@sintetis.railwayvision.example'}) {
    return SessionUser(
      id: '00000000-0000-0000-0000-000000000001',
      email: email,
      fullName: 'Budi Santoso',
      scope: const SessionScope(
        id: '00000000-0000-0000-0000-000000000002',
        code: 'SINTETIS-HSR',
        name: 'Koridor SINTETIS Halim–Tegalluar',
        path: '/SINTETIS-HSR',
      ),
      roles: const [SessionRole(code: 'inspector', name: 'Inspektur Lapangan')],
      permissions: const {'inspections:read', 'inspections:write'},
    );
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
      version: '0.8.0',
      environment: 'test',
      apiVersion: 'v1',
      aiDisclaimer: 'Saran AI bersifat advisori dan wajib ditinjau manusia.',
    ),
    checkedAt: DateTime(2026, 11, 23, 10, 0),
  );
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('id_ID');
  });

  testWidgets('shows the login gate when no stored session exists',
      (tester) async {
    await tester.pumpWidget(
      RailwayVisionApp(
        apiClient: _FakeApiClient(snapshot: _healthySnapshot()),
        draftStore: MemoryDraftStore(),
        uploadStore: MemoryPendingUploadStore(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Masuk ke ruang kerja'), findsOneWidget);
    expect(find.text('Masuk'), findsOneWidget);
    expect(find.text('SINTETIS'), findsOneWidget);
    expect(find.text('Beranda'), findsNothing);
  });

  testWidgets('signs in and renders the Indonesian workspace shell',
      (tester) async {
    final api = _FakeApiClient(
      snapshot: _healthySnapshot(),
      inspectionTotal: 2,
    );
    await tester.pumpWidget(
      RailwayVisionApp(
        apiClient: api,
        draftStore: MemoryDraftStore(),
        uploadStore: MemoryPendingUploadStore(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
        find.byType(TextField).at(0), 'inspector@sintetis.railwayvision.example');
    await tester.enterText(find.byType(TextField).at(1), 'Secret123!');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pumpAndSettle();

    expect(api.signedInUser, isNotNull);
    expect(find.text('Selamat bertugas, Budi'), findsOneWidget);
    expect(find.text('Seluruh sistem beroperasi'), findsOneWidget);
    expect(find.text('Beranda'), findsOneWidget);
    expect(find.text('Inspeksi'), findsOneWidget);
    expect(find.text('Bukti'), findsOneWidget);
    expect(find.text('Pekerjaan'), findsOneWidget);
    expect(find.text('Profil'), findsOneWidget);

    await tester.drag(find.byType(ListView).first, const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(find.text('Beban tugas saya'), findsOneWidget);
  });

  testWidgets('shows a retry state when the API is unreachable',
      (tester) async {
    await tester.pumpWidget(
      RailwayVisionApp(
        apiClient: _FakeApiClient(failure: ApiException('Tidak dapat menghubungi API.')),
        draftStore: MemoryDraftStore(),
        uploadStore: MemoryPendingUploadStore(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('API tidak terjangkau'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);
  });
}
