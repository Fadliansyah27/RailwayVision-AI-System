import 'package:flutter/material.dart';

abstract final class RvColors {
  static const canvas = Color(0xFFF5F7FA);
  static const surface = Colors.white;
  static const ink = Color(0xFF17212B);
  static const secondary = Color(0xFF667085);
  static const border = Color(0xFFE4E7EC);
  static const primary = Color(0xFFC61F33);
  static const primaryStrong = Color(0xFFA3182A);
  static const primarySoft = Color(0xFFFBECED);
  static const success = Color(0xFF16845B);
  static const successSoft = Color(0xFFE9F6F1);
  static const warning = Color(0xFFB7791F);
  static const warningSoft = Color(0xFFFDF5E6);
  static const critical = Color(0xFFB42318);
  static const criticalSoft = Color(0xFFFDEEEC);
  static const ai = Color(0xFF6D5BD0);
  static const aiSoft = Color(0xFFF0EDFB);
  static const sidebar = Color(0xFF111A23);
}

ThemeData buildRailwayVisionTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: RvColors.primary,
    brightness: Brightness.light,
  ).copyWith(
    primary: RvColors.primary,
    onPrimary: Colors.white,
    surface: RvColors.surface,
    onSurface: RvColors.ink,
    error: RvColors.critical,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: RvColors.canvas,
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: RvColors.ink,
      displayColor: RvColors.ink,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: RvColors.surface,
      surfaceTintColor: Colors.transparent,
      foregroundColor: RvColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    dividerTheme: const DividerThemeData(
      color: RvColors.border,
      thickness: 1,
      space: 1,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: RvColors.surface,
      indicatorColor: RvColors.primary.withValues(alpha: 0.10),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      height: 68,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: RvColors.ink,
        foregroundColor: Colors.white,
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: RvColors.ink,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
