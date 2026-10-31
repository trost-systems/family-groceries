// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
    required this.brand,
    required this.onBrand,
    required this.brandContainer,
    required this.onBrandContainer,
    required this.accent,
    required this.onAccent,
    required this.highlight,
    required this.onHighlight,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceSunken,
    required this.kraft,
    required this.onKraft,
    required this.chalk,
    required this.onChalk,
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
  final Color brandContainer;
  final Color onBrandContainer;
  final Color accent;
  final Color onAccent;
  final Color highlight;
  final Color onHighlight;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceSunken;
  final Color kraft;
  final Color onKraft;
  final Color chalk;
  final Color onChalk;
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
    brand: Color(0xFF34552A),
    onBrand: Color(0xFFFBF6EC),
    brandContainer: Color(0xFFE1E5CC),
    onBrandContainer: Color(0xFF2A4320),
    accent: Color(0xFF7C2948),
    onAccent: Color(0xFFFBF2F4),
    highlight: Color(0xFFE8B847),
    onHighlight: Color(0xFF2A2119),
    surface: Color(0xFFF5EFE3),
    surfaceRaised: Color(0xFFFFFBF4),
    surfaceSunken: Color(0xFFECE3D2),
    kraft: Color(0xFFDCC49C),
    onKraft: Color(0xFF3B2D1D),
    chalk: Color(0xFF27322A),
    onChalk: Color(0xFFF2EAD9),
    text: Color(0xFF2A2119),
    textMuted: Color(0xFF66594A),
    border: Color(0xFFDDD0BB),
    borderStrong: Color(0xFF8C7B65),
    success: Color(0xFF3C6A2C),
    onSuccess: Color(0xFFFBF6EC),
    warning: Color(0xFF8A5A00),
    onWarning: Color(0xFFFFFAF2),
    error: Color(0xFFA8321E),
    onError: Color(0xFFFFFAF2),
  );

  static const dark = HummlistTokens(
    brand: Color(0xFFB3C98F),
    onBrand: Color(0xFF1C2812),
    brandContainer: Color(0xFF334425),
    onBrandContainer: Color(0xFFD6E3BF),
    accent: Color(0xFFE7A1BB),
    onAccent: Color(0xFF2B0B17),
    highlight: Color(0xFFE3B64C),
    onHighlight: Color(0xFF241A08),
    surface: Color(0xFF1C1712),
    surfaceRaised: Color(0xFF272019),
    surfaceSunken: Color(0xFF14100C),
    kraft: Color(0xFF3D3123),
    onKraft: Color(0xFFECD9B8),
    chalk: Color(0xFF232C25),
    onChalk: Color(0xFFEFE6D4),
    text: Color(0xFFF2E9DA),
    textMuted: Color(0xFFC1B29C),
    border: Color(0xFF463B2F),
    borderStrong: Color(0xFF8F806C),
    success: Color(0xFFB3C98F),
    onSuccess: Color(0xFF1C2812),
    warning: Color(0xFFE3B64C),
    onWarning: Color(0xFF241A08),
    error: Color(0xFFF2A08C),
    onError: Color(0xFF3A0F06),
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
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      highlight: Color.lerp(highlight, other.highlight, t)!,
      onHighlight: Color.lerp(onHighlight, other.onHighlight, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      kraft: Color.lerp(kraft, other.kraft, t)!,
      onKraft: Color.lerp(onKraft, other.onKraft, t)!,
      chalk: Color.lerp(chalk, other.chalk, t)!,
      onChalk: Color.lerp(onChalk, other.onChalk, t)!,
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
  static const display = TextStyle(fontFamily: 'Fraunces Variable', fontSize: 80, fontWeight: FontWeight.w400, fontVariations: [FontVariation('wght', 360)], height: 1, letterSpacing: -2);
  static const headline = TextStyle(fontFamily: 'Fraunces Variable', fontSize: 38, fontWeight: FontWeight.w400, height: 1.08, letterSpacing: -0.684);
  static const title = TextStyle(fontFamily: 'Fraunces Variable', fontSize: 24, fontWeight: FontWeight.w500, fontVariations: [FontVariation('wght', 480)], height: 1.2, letterSpacing: -0.24);
  static const lead = TextStyle(fontFamily: 'Figtree Variable', fontSize: 20, fontWeight: FontWeight.w400, height: 1.5, letterSpacing: -0.1);
  static const body = TextStyle(fontFamily: 'Figtree Variable', fontSize: 17, fontWeight: FontWeight.w400, height: 1.6, letterSpacing: 0);
  static const row = TextStyle(fontFamily: 'Figtree Variable', fontSize: 18, fontWeight: FontWeight.w500, height: 1.3, letterSpacing: -0.09);
  static const label = TextStyle(fontFamily: 'Figtree Variable', fontSize: 15, fontWeight: FontWeight.w600, height: 1.25, letterSpacing: 0.075);
  static const overline = TextStyle(fontFamily: 'Figtree Variable', fontSize: 12, fontWeight: FontWeight.w700, height: 1.2, letterSpacing: 1.68);
  static const caption = TextStyle(fontFamily: 'Figtree Variable', fontSize: 13, fontWeight: FontWeight.w500, fontVariations: [FontVariation('wght', 450)], height: 1.45, letterSpacing: 0.13);
}

abstract final class HummlistSpace {
  static const double space0 = 2;
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
  static const double xs = 4;
  static const double s = 6;
  static const double m = 10;
  static const double l = 14;
  static const double phone = 38;
  static const double full = 999;
}

abstract final class HummlistMotion {
  static const quick = Duration(milliseconds: 220);
  static const calm = Duration(milliseconds: 320);
  static const slow = Duration(milliseconds: 420);
  static const settle = Cubic(0.22, 0.61, 0.36, 1);
  static const glide = Cubic(0.33, 0, 0.15, 1);
  static const exit = Cubic(0.5, 0, 0.75, 0.2);
}
