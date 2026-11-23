import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:railwayvision_mobile/services/api_client.dart';
import 'package:railwayvision_mobile/services/token_store.dart';

// Live check of the networking layer used by the field app.
// Runs only when SEED_PASSWORD is set; never prints tokens or passwords.
void main() {
  final password = Platform.environment['SEED_PASSWORD'] ?? '';
  final baseUrl =
      Platform.environment['API_BASE_URL'] ?? 'http://localhost:8000';

  test(
    'live API smoke: login, status, inspections, work orders, assets, logout',
    () async {
      final api = ApiClient(
        baseUrl: baseUrl,
        tokenStore: MemoryTokenStore(),
      );

      final user = await api.login(
        'inspector@sintetis.railwayvision.example',
        password,
      );
      expect(user.email, contains('inspector@'));
      expect(user.scope.name, isNotEmpty);
      expect(user.roles, isNotEmpty);

      final status = await api.fetchStatus();
      expect(status.readiness.isOperational, isTrue);
      expect(status.readiness.component('database'), 'ok');
      expect(status.readiness.component('redis'), 'ok');

      final page = await api.listInspections(mine: true);
      expect(page.total, greaterThanOrEqualTo(0));

      if (page.items.isNotEmpty) {
        final detail = await api.fetchInspection(page.items.first.id);
        expect(detail.summary.id, page.items.first.id);
        expect(detail.summary.reference, isNotEmpty);
        expect(
          detail.checklist == null || detail.checklist!.items.isNotEmpty,
          isTrue,
        );
      }

      final assets = await api.listAssets();
      expect(assets, isNotEmpty);

      if (user.can('work_orders:read')) {
        final orders = await api.listWorkOrders(mine: true);
        expect(orders.total, greaterThanOrEqualTo(0));
        if (orders.items.isNotEmpty) {
          final order = await api.fetchWorkOrder(orders.items.first.id);
          expect(order.reference, orders.items.first.reference);
          expect(order.finding.reference, isNotEmpty);
        }
      }

      await api.logout();
      expect(api.hasSession, isFalse);
    },
    skip: password.isEmpty
        ? 'SEED_PASSWORD not set; live smoke skipped.'
        : false,
  );
}
