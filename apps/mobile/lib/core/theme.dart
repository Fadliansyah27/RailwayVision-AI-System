import 'package:flutter/material.dart';

abstract final class RvColors {
  static const canvas = Color(0xFFF8F9FB);
  static const surface = Colors.white;
  static const ink = Color(0xFF101820);
  static const secondary = Color(0xFF667085);
  static const border = Color(0xFFE5E7EB);
  static const primary = Color(0xFFC61F33);
  static const primaryStrong = Color(0xFFA8192D);
  static const primarySoft = Color(0xFFFCECEF);
  static const success = Color(0xFF16845B);
  static const successSoft = Color(0xFFE9F6F1);
  static const warning = Color(0xFFB7791F);
  static const warningSoft = Color(0xFFFDF5E6);
  static const critical = Color(0xFFB42318);
  static const criticalSoft = Color(0xFFFDEEEC);
  static const ai = Color(0xFFA8192D);
  static const aiSoft = Color(0xFFFCECEF);
  static const sidebar = Color(0xFF0F1720);
}

ThemeData buildRailwayVisionTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: RvColors.primary,
    brightness: Brightness.light,
  ).copyWith(
    primary: RvColors.primary,
    onPrimary: Colors.white,
    primaryContainer: RvColors.primarySoft,
    onPrimaryContainer: RvColors.primaryStrong,
    secondary: RvColors.ink,
    onSecondary: Colors.white,
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
      backgroundColor: RvColors.primary,
      surfaceTintColor: Colors.transparent,
      foregroundColor: Colors.white,
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      iconTheme: IconThemeData(color: Colors.white),
      actionsIconTheme: IconThemeData(color: Colors.white),
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
      indicatorColor: RvColors.primary.withValues(alpha: 0.12),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      height: 68,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        return IconThemeData(
          color: states.contains(WidgetState.selected)
              ? RvColors.primary
              : RvColors.secondary,
        );
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? RvColors.primary : RvColors.secondary,
        );
      }),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: RvColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: RvColors.primary.withValues(alpha: 0.35),
        disabledForegroundColor: Colors.white,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: RvColors.primary),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: RvColors.primary,
        side: const BorderSide(color: RvColors.primary),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: RvColors.primary,
      foregroundColor: Colors.white,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: RvColors.primary,
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: RvColors.primaryStrong,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
