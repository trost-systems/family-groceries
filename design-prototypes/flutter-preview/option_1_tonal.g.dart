// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
    required this.brand,
    required this.onBrand,
    required this.brandContainer,
    required this.onBrandContainer,
    required this.secondaryContainer,
    required this.onSecondaryContainer,
    required this.accent,
    required this.onAccent,
    required this.accentContainer,
    required this.onAccentContainer,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceContainerLow,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.surfaceContainerHighest,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.outline,
    required this.inverseSurface,
    required this.inverseOnSurface,
    required this.inverseBrand,
    required this.mark,
    required this.success,
    required this.onSuccess,
    required this.warning,
    required this.onWarning,
    required this.error,
    required this.onError,
    required this.errorContainer,
    required this.onErrorContainer,
    required this.deviceFrame,
  });

  final Color brand;
  final Color onBrand;
  final Color brandContainer;
  final Color onBrandContainer;
  final Color secondaryContainer;
  final Color onSecondaryContainer;
  final Color accent;
  final Color onAccent;
  final Color accentContainer;
  final Color onAccentContainer;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceContainerLow;
  final Color surfaceContainer;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color outline;
  final Color inverseSurface;
  final Color inverseOnSurface;
  final Color inverseBrand;
  final Color mark;
  final Color success;
  final Color onSuccess;
  final Color warning;
  final Color onWarning;
  final Color error;
  final Color onError;
  final Color errorContainer;
  final Color onErrorContainer;
  final Color deviceFrame;

  static const light = HummlistTokens(
    brand: Color(0xFF3C6939),
    onBrand: Color(0xFFFFFFFF),
    brandContainer: Color(0xFFBCF0B4),
    onBrandContainer: Color(0xFF245024),
    secondaryContainer: Color(0xFFD6E8CE),
    onSecondaryContainer: Color(0xFF3B4B38),
    accent: Color(0xFF38656A),
    onAccent: Color(0xFFFFFFFF),
    accentContainer: Color(0xFFBCEBF0),
    onAccentContainer: Color(0xFF1F4D52),
    surface: Color(0xFFF7FBF1),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceContainerLow: Color(0xFFF1F5EB),
    surfaceContainer: Color(0xFFECEFE6),
    surfaceContainerHigh: Color(0xFFE6E9E0),
    surfaceContainerHighest: Color(0xFFE0E4DB),
    text: Color(0xFF191D17),
    textMuted: Color(0xFF424940),
    border: Color(0xFFC2C9BD),
    outline: Color(0xFF72796F),
    inverseSurface: Color(0xFF2D322C),
    inverseOnSurface: Color(0xFFEFF2E9),
    inverseBrand: Color(0xFFA1D39A),
    mark: Color(0xFF2E7D32),
    success: Color(0xFF2E7D32),
    onSuccess: Color(0xFFFFFFFF),
    warning: Color(0xFF7A5900),
    onWarning: Color(0xFFFFFFFF),
    error: Color(0xFFBA1A1A),
    onError: Color(0xFFFFFFFF),
    errorContainer: Color(0xFFFFDAD6),
    onErrorContainer: Color(0xFF93000A),
    deviceFrame: Color(0xFF2D322C),
  );

  static const dark = HummlistTokens(
    brand: Color(0xFFA1D39A),
    onBrand: Color(0xFF0A390F),
    brandContainer: Color(0xFF245024),
    onBrandContainer: Color(0xFFBCF0B4),
    secondaryContainer: Color(0xFF3B4B38),
    onSecondaryContainer: Color(0xFFD6E8CE),
    accent: Color(0xFFA0CFD4),
    onAccent: Color(0xFF00363B),
    accentContainer: Color(0xFF1F4D52),
    onAccentContainer: Color(0xFFBCEBF0),
    surface: Color(0xFF10140F),
    surfaceRaised: Color(0xFF0B0F0A),
    surfaceContainerLow: Color(0xFF191D17),
    surfaceContainer: Color(0xFF1D211B),
    surfaceContainerHigh: Color(0xFF272B25),
    surfaceContainerHighest: Color(0xFF323630),
    text: Color(0xFFE0E4DB),
    textMuted: Color(0xFFC2C9BD),
    border: Color(0xFF424940),
    outline: Color(0xFF8C9388),
    inverseSurface: Color(0xFFE0E4DB),
    inverseOnSurface: Color(0xFF2D322C),
    inverseBrand: Color(0xFF3C6939),
    mark: Color(0xFF2E7D32),
    success: Color(0xFF2E7D32),
    onSuccess: Color(0xFFFFFFFF),
    warning: Color(0xFFF5BF57),
    onWarning: Color(0xFF412D00),
    error: Color(0xFFFFB4AB),
    onError: Color(0xFF690005),
    errorContainer: Color(0xFF93000A),
    onErrorContainer: Color(0xFFFFDAD6),
    deviceFrame: Color(0xFF323630),
  );

  @override
  HummlistTokens copyWith() => this;

  @override
  HummlistTokens lerp(HummlistTokens? other, double t) {
    if (other == null) return this;
    return HummlistTokens(
      brand: Color.lerp(brand, other.brand, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      brandContainer: Color.lerp(brandContainer, other.brandContainer, t)!,
      onBrandContainer: Color.lerp(onBrandContainer, other.onBrandContainer, t)!,
      secondaryContainer: Color.lerp(secondaryContainer, other.secondaryContainer, t)!,
      onSecondaryContainer: Color.lerp(onSecondaryContainer, other.onSecondaryContainer, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      accentContainer: Color.lerp(accentContainer, other.accentContainer, t)!,
      onAccentContainer: Color.lerp(onAccentContainer, other.onAccentContainer, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceContainerLow: Color.lerp(surfaceContainerLow, other.surfaceContainerLow, t)!,
      surfaceContainer: Color.lerp(surfaceContainer, other.surfaceContainer, t)!,
      surfaceContainerHigh: Color.lerp(surfaceContainerHigh, other.surfaceContainerHigh, t)!,
      surfaceContainerHighest: Color.lerp(surfaceContainerHighest, other.surfaceContainerHighest, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      outline: Color.lerp(outline, other.outline, t)!,
      inverseSurface: Color.lerp(inverseSurface, other.inverseSurface, t)!,
      inverseOnSurface: Color.lerp(inverseOnSurface, other.inverseOnSurface, t)!,
      inverseBrand: Color.lerp(inverseBrand, other.inverseBrand, t)!,
      mark: Color.lerp(mark, other.mark, t)!,
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      error: Color.lerp(error, other.error, t)!,
      onError: Color.lerp(onError, other.onError, t)!,
      errorContainer: Color.lerp(errorContainer, other.errorContainer, t)!,
      onErrorContainer: Color.lerp(onErrorContainer, other.onErrorContainer, t)!,
      deviceFrame: Color.lerp(deviceFrame, other.deviceFrame, t)!,
    );
  }
}

ColorScheme hummlistColorScheme(Brightness brightness) {
  final t = brightness == Brightness.light ? HummlistTokens.light : HummlistTokens.dark;
  return ColorScheme(
    brightness: brightness,
    primary: t.brand,
    onPrimary: t.onBrand,
    primaryContainer: t.brandContainer,
    onPrimaryContainer: t.onBrandContainer,
    secondary: t.accent,
    onSecondary: t.onAccent,
    tertiary: t.accent,
    onTertiary: t.onAccent,
    error: t.error,
    onError: t.onError,
    surface: t.surface,
    onSurface: t.text,
    onSurfaceVariant: t.textMuted,
    surfaceContainerLowest: t.surfaceRaised,
    outline: t.textMuted,
    outlineVariant: t.border,
  );
}

ThemeData hummlistTheme(Brightness brightness) => ThemeData(
  colorScheme: hummlistColorScheme(brightness),
  extensions: [if (brightness == Brightness.light) HummlistTokens.light else HummlistTokens.dark],
);

abstract final class HummlistType {
  static const display = TextStyle(fontFamily: 'Roboto Flex', fontSize: 57, fontWeight: FontWeight.w500, height: 1.123, letterSpacing: -1.14);
  static const displaySmall = TextStyle(fontFamily: 'Roboto Flex', fontSize: 36, fontWeight: FontWeight.w500, height: 1.222, letterSpacing: -0.54);
  static const headline = TextStyle(fontFamily: 'Roboto Flex', fontSize: 32, fontWeight: FontWeight.w500, height: 1.25, letterSpacing: -0.32);
  static const headlineSmall = TextStyle(fontFamily: 'Roboto Flex', fontSize: 24, fontWeight: FontWeight.w500, height: 1.333, letterSpacing: 0);
  static const title = TextStyle(fontFamily: 'Roboto Flex', fontSize: 22, fontWeight: FontWeight.w500, height: 1.273, letterSpacing: 0);
  static const titleMedium = TextStyle(fontFamily: 'Roboto Flex', fontSize: 16, fontWeight: FontWeight.w600, height: 1.5, letterSpacing: 0.16);
  static const body = TextStyle(fontFamily: 'Roboto Flex', fontSize: 17, fontWeight: FontWeight.w400, height: 1.53, letterSpacing: 0.085);
  static const bodyMedium = TextStyle(fontFamily: 'Roboto Flex', fontSize: 14, fontWeight: FontWeight.w400, height: 1.429, letterSpacing: 0.252);
  static const label = TextStyle(fontFamily: 'Roboto Flex', fontSize: 14, fontWeight: FontWeight.w600, height: 1.429, letterSpacing: 0.098);
  static const labelSmall = TextStyle(fontFamily: 'Roboto Flex', fontSize: 12, fontWeight: FontWeight.w700, height: 1.333, letterSpacing: 1.08);
}

abstract final class HummlistSpace {
  static const double space1 = 4;
  static const double space2 = 8;
  static const double space3 = 12;
  static const double space4 = 16;
  static const double space5 = 24;
  static const double space6 = 32;
  static const double space7 = 48;
  static const double space8 = 64;
  static const double space9 = 96;
}

abstract final class HummlistRadius {
  static const double xs = 4;
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 28;
  static const double full = 999;
}

abstract final class HummlistMotion {
  static const short2 = Duration(milliseconds: 100);
  static const short4 = Duration(milliseconds: 200);
  static const medium1 = Duration(milliseconds: 250);
  static const medium2 = Duration(milliseconds: 300);
  static const medium4 = Duration(milliseconds: 400);
  static const standard = Cubic(0.2, 0, 0, 1);
  static const standardDecelerate = Cubic(0, 0, 0, 1);
  static const standardAccelerate = Cubic(0.3, 0, 1, 1);
  static const emphasizedDecelerate = Cubic(0.05, 0.7, 0.1, 1);
  static const emphasizedAccelerate = Cubic(0.3, 0, 0.8, 0.15);
}
