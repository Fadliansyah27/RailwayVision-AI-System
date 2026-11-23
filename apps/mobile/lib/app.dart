import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'screens/root_shell.dart';
import 'services/api_client.dart';
import 'services/draft_store.dart';
import 'services/pending_upload.dart';
import 'services/session_controller.dart';
import 'services/token_store.dart';

class RailwayVisionApp extends StatefulWidget {
  const RailwayVisionApp({
    super.key,
    this.apiClient,
    this.sessionController,
    this.tokenStore,
    this.draftStore,
    this.uploadStore,
    this.autoRestore = true,
  });

  final ApiClient? apiClient;
  final SessionController? sessionController;
  final TokenStore? tokenStore;
  final DraftStore? draftStore;
  final PendingUploadStore? uploadStore;
  final bool autoRestore;

  @override
  State<RailwayVisionApp> createState() => _RailwayVisionAppState();
}

class _RailwayVisionAppState extends State<RailwayVisionApp> {
  late final ApiClient _api;
  late final SessionController _session;

  @override
  void initState() {
    super.initState();
    _api = widget.apiClient ??
        ApiClient(tokenStore: widget.tokenStore ?? SecureTokenStore());
    _session = widget.sessionController ?? SessionController(_api);
    if (widget.autoRestore && widget.sessionController == null) {
      _session.restore();
    }
  }

  @override
  void dispose() {
    if (widget.sessionController == null) {
      _session.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RailwayVision AI',
      debugShowCheckedModeBanner: false,
      theme: buildRailwayVisionTheme(),
      home: RootShell(
        api: _api,
        session: _session,
        draftStore: widget.draftStore,
        uploadStore: widget.uploadStore,
      ),
    );
  }
}
