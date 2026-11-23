import 'package:flutter/foundation.dart';

abstract final class AppConfig {
  static const String _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static const String appVersion = '0.1.0 · Phase 1 foundation';

  /// Local development defaults:
  /// - Android emulator reaches the host through 10.0.2.2.
  /// - Web and other targets use localhost.
  /// Override with: flutter run --dart-define=API_BASE_URL=https://...
  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) {
      return _configuredApiBaseUrl;
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000';
    }
    return 'http://localhost:8000';
  }
}
