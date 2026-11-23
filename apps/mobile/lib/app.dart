import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'screens/root_shell.dart';
import 'services/api_client.dart';

class RailwayVisionApp extends StatelessWidget {
  const RailwayVisionApp({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RailwayVision AI',
      debugShowCheckedModeBanner: false,
      theme: buildRailwayVisionTheme(),
      home: RootShell(apiClient: apiClient ?? ApiClient()),
    );
  }
}
