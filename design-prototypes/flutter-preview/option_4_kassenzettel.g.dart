// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
    required this.brand,
    required this.onBrand,
    required this.brandWash,
    required this.accent,
    required this.onAccent,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceSunken,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.borderStrong,
    required this.success,
    required this.onSuccess,
    required this.warning,
    required this.onWarning,
    required this.error,
    required this.onError,
  });

  final Color brand;
  final Color onBrand;
  final Color brandWash;
  final Color accent;
  final Color onAccent;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceSunken;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color borderStrong;
  final Color success;
  final Color onSuccess;
  final Color warning;
  final Color onWarning;
  final Color error;
  final Color onError;

  static const light = HummlistTokens(
    brand: Color(0xFFC4320A),
    onBrand: Color(0xFFFFFFFF),
    brandWash: Color(0xFFFBE6DA),
    accent: Color(0xFF141412),
    onAccent: Color(0xFFFDFCF8),
    surface: Color(0xFFF3F1EA),
    surfaceRaised: Color(0xFFFDFCF8),
    surfaceSunken: Color(0xFFE8E5DB),
    text: Color(0xFF141412),
    textMuted: Color(0xFF5C5A52),
    border: Color(0xFFCBC7BA),
    borderStrong: Color(0xFF7D796E),
    success: Color(0xFF2E7D32),
    onSuccess: Color(0xFFFFFFFF),
    warning: Color(0xFF8A5300),
    onWarning: Color(0xFFFFFFFF),
    error: Color(0xFFA3122A),
    onError: Color(0xFFFFFFFF),
  );

  static const dark = HummlistTokens(
    brand: Color(0xFFFF7A3D),
    onBrand: Color(0xFF1A0800),
    brandWash: Color(0xFF36190C),
    accent: Color(0xFFF2ECE0),
    onAccent: Color(0xFF0E0E0D),
    surface: Color(0xFF0E0E0D),
    surfaceRaised: Color(0xFF1A1918),
    surfaceSunken: Color(0xFF050505),
    text: Color(0xFFF2ECE0),
    textMuted: Color(0xFFB4AD9E),
    border: Color(0xFF3A3832),
    borderStrong: Color(0xFF7F7A6F),
    success: Color(0xFF7BD17F),
    onSuccess: Color(0xFF0A2A0C),
    warning: Color(0xFFF2B84B),
    onWarning: Color(0xFF231600),
    error: Color(0xFFFF8A9A),
    onError: Color(0xFF3A0410),
  );

  @override
  HummlistTokens copyWith() => this;

  @override
  HummlistTokens lerp(HummlistTokens? other, double t) {
    if (other == null) return this;
    return HummlistTokens(
      brand: Color.lerp(brand, other.brand, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      brandWash: Color.lerp(brandWash, other.brandWash, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      error: Color.lerp(error, other.error, t)!,
      onError: Color.lerp(onError, other.onError, t)!,
    );
  }
}

ColorScheme hummlistColorScheme(Brightness brightness) {
  final t = brightness == Brightness.light ? HummlistTokens.light : HummlistTokens.dark;
  return ColorScheme(
    brightness: brightness,
    primary: t.brand,
    onPrimary: t.onBrand,
    primaryContainer: t.brand,
    onPrimaryContainer: t.onBrand,
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
  static const display = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 80, fontWeight: FontWeight.w700, height: 0.98, letterSpacing: -2.8);
  static const headline = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 36, fontWeight: FontWeight.w700, height: 1.08, letterSpacing: -0.9);
  static const title = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 22, fontWeight: FontWeight.w700, fontVariations: [FontVariation('wght', 650)], height: 1.25, letterSpacing: -0.264);
  static const item = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 19, fontWeight: FontWeight.w600, height: 1.37, letterSpacing: -0.19);
  static const body = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 17, fontWeight: FontWeight.w400, height: 1.55, letterSpacing: 0);
  static const small = TextStyle(fontFamily: 'IBM Plex Sans Variable', fontSize: 14, fontWeight: FontWeight.w400, height: 1.4, letterSpacing: 0);
  static const figure = TextStyle(fontFamily: 'JetBrains Mono Variable', fontSize: 17, fontWeight: FontWeight.w800, height: 1.3, letterSpacing: -0.34);
  static const label = TextStyle(fontFamily: 'JetBrains Mono Variable', fontSize: 13, fontWeight: FontWeight.w600, height: 1.3, letterSpacing: 0.78);
  static const caption = TextStyle(fontFamily: 'JetBrains Mono Variable', fontSize: 12, fontWeight: FontWeight.w500, height: 1.4, letterSpacing: 0.96);
  static const wordmark = TextStyle(fontFamily: 'JetBrains Mono Variable', fontSize: 20, fontWeight: FontWeight.w800, height: 1, letterSpacing: -0.8);
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
  static const double space10 = 128;
}

abstract final class HummlistRadius {
  static const double none = 0;
  static const double xs = 2;
  static const double s = 4;
  static const double device = 40;
}

abstract final class HummlistMotion {
  static const instant = Duration(milliseconds: 90);
  static const short = Duration(milliseconds: 120);
  static const medium = Duration(milliseconds: 160);
  static const standard = Cubic(0.2, 0, 0, 1);
  static const linear = Cubic(0, 0, 1, 1);
  static const exit = Cubic(0.4, 0, 1, 1);
}
