import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../models/session.dart';
import '../services/api_client.dart';
import '../services/draft_store.dart';
import '../services/evidence_uploader.dart';
import '../services/inspection_edit_service.dart';
import '../services/session_controller.dart';
import '../services/upload_queue.dart';
import '../widgets/section_card.dart';
import 'capture_screen.dart';
import 'home_screen.dart';
import 'inspections_screen.dart';
import 'login_screen.dart';
import 'profile_screen.dart';
import 'work_screen.dart';

class RootShell extends StatefulWidget {
  const RootShell({
    super.key,
    required this.api,
    required this.session,
    this.draftStore,
    this.uploadStore,
  });

  final ApiClient api;
  final SessionController session;
  final DraftStore? draftStore;
  final PendingUploadStore? uploadStore;

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  late final DraftStore _draftStore =
      widget.draftStore ?? SharedPreferencesDraftStore();
  late final PendingUploadStore _uploadStore =
      widget.uploadStore ?? createPendingUploadStore();
  late final EvidenceUploader _uploader =
      EvidenceUploader(api: widget.api, store: _uploadStore);
  late final InspectionEditService _editor = InspectionEditService(widget.api);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.session,
      builder: (context, _) {
        switch (widget.session.status) {
          case SessionStatus.checking:
            return const _Splash();
          case SessionStatus.signedOut:
            return LoginScreen(
              session: widget.session,
              apiBaseUrl: widget.api.baseUrl,
            );
          case SessionStatus.signedIn:
            return _workspace(context, widget.session.user!);
        }
      },
    );
  }

  Widget _workspace(BuildContext context, SessionUser user) {
    final screens = [
      HomeScreen(
        api: widget.api,
        user: user,
        onUnauthorized: widget.session.handleUnauthorized,
        onOpenInspections: () => setState(() => _index = 1),
      ),
      InspectionsScreen(
        api: widget.api,
        user: user,
        onUnauthorized: widget.session.handleUnauthorized,
        draftStore: _draftStore,
        editor: _editor,
        uploader: _uploader,
      ),
      CaptureScreen(
        api: widget.api,
        onUnauthorized: widget.session.handleUnauthorized,
        draftStore: _draftStore,
        editor: _editor,
        uploader: _uploader,
      ),
      WorkScreen(
        api: widget.api,
        user: user,
        onUnauthorized: widget.session.handleUnauthorized,
      ),
      ProfileScreen(
        session: widget.session,
        apiBaseUrl: widget.api.baseUrl,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'RV',
                style: TextStyle(
                  color: RvColors.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'RailwayVision AI',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        actions: const [
          SyntheticBadge(onBrand: true),
          SizedBox(width: 16),
        ],
      ),
      body: SafeArea(
        child: IndexedStack(index: _index, children: screens),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_outlined),
            selectedIcon: Icon(Icons.checklist),
            label: 'Inspeksi',
          ),
          NavigationDestination(
            icon: Icon(Icons.photo_camera_outlined),
            selectedIcon: Icon(Icons.photo_camera),
            label: 'Bukti',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment),
            label: 'Pekerjaan',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: RvColors.primary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Text(
                'RV',
                style: TextStyle(
                  color: RvColors.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                ),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'RailwayVision AI',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Memulihkan sesi aman…',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
