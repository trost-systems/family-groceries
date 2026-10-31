// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
    required this.brand,
    required this.onBrand,
    required this.honey,
    required this.onHoney,
    required this.honeySoft,
    required this.accent,
    required this.onAccent,
    required this.accentSoft,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceSunken,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.divider,
    required this.ink,
    required this.success,
    required this.onSuccess,
    required this.successSoft,
    required this.warning,
    required this.onWarning,
    required this.error,
    required this.onError,
  });

  final Color brand;
  final Color onBrand;
  final Color honey;
  final Color onHoney;
  final Color honeySoft;
  final Color accent;
  final Color onAccent;
  final Color accentSoft;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceSunken;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color divider;
  final Color ink;
  final Color success;
  final Color onSuccess;
  final Color successSoft;
  final Color warning;
  final Color onWarning;
  final Color error;
  final Color onError;

  static const light = HummlistTokens(
    brand: Color(0xFF8A5800),
    onBrand: Color(0xFFFFFFFF),
    honey: Color(0xFFFFC72C),
    onHoney: Color(0xFF1C1A17),
    honeySoft: Color(0xFFFDE7A6),
    accent: Color(0xFF5A3FAE),
    onAccent: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFE5DCFF),
    surface: Color(0xFFFFF8E6),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceSunken: Color(0xFFFBEEC8),
    text: Color(0xFF1C1A17),
    textMuted: Color(0xFF5E5548),
    border: Color(0xFF1C1A17),
    divider: Color(0xFFEADFC2),
    ink: Color(0xFF1C1A17),
    success: Color(0xFF23793A),
    onSuccess: Color(0xFFFFFFFF),
    successSoft: Color(0xFFCDEEC8),
    warning: Color(0xFFA34700),
    onWarning: Color(0xFFFFFFFF),
    error: Color(0xFFC0262D),
    onError: Color(0xFFFFFFFF),
  );

  static const dark = HummlistTokens(
    brand: Color(0xFFFFC72C),
    onBrand: Color(0xFF16131F),
    honey: Color(0xFFFFC72C),
    onHoney: Color(0xFF16131F),
    honeySoft: Color(0xFF3B2F0E),
    accent: Color(0xFFC7B6FF),
    onAccent: Color(0xFF16131F),
    accentSoft: Color(0xFF2E2650),
    surface: Color(0xFF16131F),
    surfaceRaised: Color(0xFF221E2E),
    surfaceSunken: Color(0xFF0F0D16),
    text: Color(0xFFFDF6E3),
    textMuted: Color(0xFFC9C0DC),
    border: Color(0xFF8E86A8),
    divider: Color(0xFF332D45),
    ink: Color(0xFF000000),
    success: Color(0xFF7FD98A),
    onSuccess: Color(0xFF16131F),
    successSoft: Color(0xFF1D3A24),
    warning: Color(0xFFFFB067),
    onWarning: Color(0xFF16131F),
    error: Color(0xFFFF8F88),
    onError: Color(0xFF16131F),
  );

  @override
  HummlistTokens copyWith() => this;

  @override
  HummlistTokens lerp(HummlistTokens? other, double t) {
    if (other == null) return this;
    return HummlistTokens(
      brand: Color.lerp(brand, other.brand, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      honey: Color.lerp(honey, other.honey, t)!,
      onHoney: Color.lerp(onHoney, other.onHoney, t)!,
      honeySoft: Color.lerp(honeySoft, other.honeySoft, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
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
  static const display = TextStyle(fontFamily: 'Baloo 2', fontSize: 56, fontWeight: FontWeight.w800, height: 1.02, letterSpacing: -0.84);
  static const headlineL = TextStyle(fontFamily: 'Baloo 2', fontSize: 40, fontWeight: FontWeight.w800, height: 1.05, letterSpacing: -0.4);
  static const headline = TextStyle(fontFamily: 'Baloo 2', fontSize: 32, fontWeight: FontWeight.w700, height: 1.1, letterSpacing: -0.16);
  static const title = TextStyle(fontFamily: 'Nunito', fontSize: 20, fontWeight: FontWeight.w800, height: 1.3, letterSpacing: 0);
  static const bodyL = TextStyle(fontFamily: 'Nunito', fontSize: 19, fontWeight: FontWeight.w500, height: 1.55, letterSpacing: 0);
  static const body = TextStyle(fontFamily: 'Nunito', fontSize: 17, fontWeight: FontWeight.w500, height: 1.6, letterSpacing: 0);
  static const label = TextStyle(fontFamily: 'Nunito', fontSize: 15, fontWeight: FontWeight.w800, height: 1.25, letterSpacing: 0.15);
  static const caption = TextStyle(fontFamily: 'Nunito', fontSize: 12, fontWeight: FontWeight.w800, height: 1.3, letterSpacing: 1.2);
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
  static const double s = 12;
  static const double m = 20;
  static const double l = 28;
  static const double xl = 36;
  static const double full = 999;
}

abstract final class HummlistMotion {
  static const short = Duration(milliseconds: 180);
  static const medium = Duration(milliseconds: 260);
  static const long = Duration(milliseconds: 360);
  static const bounce = Cubic(0.34, 1.56, 0.64, 1);
  static const standard = Cubic(0.2, 0, 0, 1);
  static const exit = Cubic(0.4, 0, 1, 1);
}
