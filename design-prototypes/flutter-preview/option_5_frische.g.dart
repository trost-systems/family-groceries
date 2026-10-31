// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
    required this.brand,
    required this.onBrand,
    required this.brandField,
    required this.onBrandField,
    required this.brandContainer,
    required this.onBrandContainer,
    required this.accent,
    required this.onAccent,
    required this.mint,
    required this.onMint,
    required this.lemon,
    required this.onLemon,
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceSunken,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.inverseSurface,
    required this.inverseText,
    required this.inverseBrand,
    required this.success,
    required this.onSuccess,
    required this.warning,
    required this.onWarning,
    required this.error,
    required this.onError,
    required this.catObst,
    required this.catBrot,
    required this.catKuehl,
    required this.catFleisch,
    required this.catVorrat,
    required this.catSuess,
    required this.catGetraenke,
    required this.catTiefkuehl,
    required this.catHaushalt,
    required this.catDrogerie,
  });

  final Color brand;
  final Color onBrand;
  final Color brandField;
  final Color onBrandField;
  final Color brandContainer;
  final Color onBrandContainer;
  final Color accent;
  final Color onAccent;
  final Color mint;
  final Color onMint;
  final Color lemon;
  final Color onLemon;
  final Color surface;
  final Color surfaceRaised;
  final Color surfaceSunken;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color inverseSurface;
  final Color inverseText;
  final Color inverseBrand;
  final Color success;
  final Color onSuccess;
  final Color warning;
  final Color onWarning;
  final Color error;
  final Color onError;
  final Color catObst;
  final Color catBrot;
  final Color catKuehl;
  final Color catFleisch;
  final Color catVorrat;
  final Color catSuess;
  final Color catGetraenke;
  final Color catTiefkuehl;
  final Color catHaushalt;
  final Color catDrogerie;

  static const light = HummlistTokens(
    brand: Color(0xFF1B3FAE),
    onBrand: Color(0xFFFFFFFF),
    brandField: Color(0xFF1B3FAE),
    onBrandField: Color(0xFFFFFFFF),
    brandContainer: Color(0xFFE1E8FF),
    onBrandContainer: Color(0xFF132F86),
    accent: Color(0xFFFF5B3A),
    onAccent: Color(0xFF0F1530),
    mint: Color(0xFF7FE3B8),
    onMint: Color(0xFF0F1530),
    lemon: Color(0xFFFFE24A),
    onLemon: Color(0xFF0F1530),
    surface: Color(0xFFF7F7F2),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceSunken: Color(0xFFECEFF6),
    text: Color(0xFF0F1530),
    textMuted: Color(0xFF4B536C),
    border: Color(0xFFD3D8E6),
    inverseSurface: Color(0xFF0F1530),
    inverseText: Color(0xFFF3F6FF),
    inverseBrand: Color(0xFFA9BDFF),
    success: Color(0xFF0D7A4E),
    onSuccess: Color(0xFFFFFFFF),
    warning: Color(0xFF8A5300),
    onWarning: Color(0xFFFFFFFF),
    error: Color(0xFFC4280F),
    onError: Color(0xFFFFFFFF),
    catObst: Color(0xFF2FBF71),
    catBrot: Color(0xFFE39B2D),
    catKuehl: Color(0xFF3D9BFF),
    catFleisch: Color(0xFFFF5B3A),
    catVorrat: Color(0xFFA8783A),
    catSuess: Color(0xFFFF6FAE),
    catGetraenke: Color(0xFF14B3B3),
    catTiefkuehl: Color(0xFF86C9FF),
    catHaushalt: Color(0xFF8D6BFF),
    catDrogerie: Color(0xFFD94FC8),
  );

  static const dark = HummlistTokens(
    brand: Color(0xFF9FB6FF),
    onBrand: Color(0xFF0B1024),
    brandField: Color(0xFF2448C0),
    onBrandField: Color(0xFFFFFFFF),
    brandContainer: Color(0xFF1D2B66),
    onBrandContainer: Color(0xFFE1E8FF),
    accent: Color(0xFFF0603F),
    onAccent: Color(0xFF0B1024),
    mint: Color(0xFF62C99D),
    onMint: Color(0xFF0B1024),
    lemon: Color(0xFFE8CB3C),
    onLemon: Color(0xFF0B1024),
    surface: Color(0xFF0B1024),
    surfaceRaised: Color(0xFF151C3A),
    surfaceSunken: Color(0xFF111735),
    text: Color(0xFFEFF3FF),
    textMuted: Color(0xFFB0B9D8),
    border: Color(0xFF2F3A66),
    inverseSurface: Color(0xFFE4EAFF),
    inverseText: Color(0xFF0F1530),
    inverseBrand: Color(0xFF1B3FAE),
    success: Color(0xFF62C99D),
    onSuccess: Color(0xFF0B1024),
    warning: Color(0xFFE8CB3C),
    onWarning: Color(0xFF0B1024),
    error: Color(0xFFFF8A73),
    onError: Color(0xFF0B1024),
    catObst: Color(0xFF3FAE74),
    catBrot: Color(0xFFD19A45),
    catKuehl: Color(0xFF5A9BE0),
    catFleisch: Color(0xFFE8664A),
    catVorrat: Color(0xFFB08A57),
    catSuess: Color(0xFFE57AA8),
    catGetraenke: Color(0xFF3AAEAE),
    catTiefkuehl: Color(0xFF8CBFE6),
    catHaushalt: Color(0xFF9A82F0),
    catDrogerie: Color(0xFFCC6CC0),
  );

  @override
  HummlistTokens copyWith() => this;

  @override
  HummlistTokens lerp(HummlistTokens? other, double t) {
    if (other == null) return this;
    return HummlistTokens(
      brand: Color.lerp(brand, other.brand, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      brandField: Color.lerp(brandField, other.brandField, t)!,
      onBrandField: Color.lerp(onBrandField, other.onBrandField, t)!,
      brandContainer: Color.lerp(brandContainer, other.brandContainer, t)!,
      onBrandContainer: Color.lerp(onBrandContainer, other.onBrandContainer, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      mint: Color.lerp(mint, other.mint, t)!,
      onMint: Color.lerp(onMint, other.onMint, t)!,
      lemon: Color.lerp(lemon, other.lemon, t)!,
      onLemon: Color.lerp(onLemon, other.onLemon, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      inverseSurface: Color.lerp(inverseSurface, other.inverseSurface, t)!,
      inverseText: Color.lerp(inverseText, other.inverseText, t)!,
      inverseBrand: Color.lerp(inverseBrand, other.inverseBrand, t)!,
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      error: Color.lerp(error, other.error, t)!,
      onError: Color.lerp(onError, other.onError, t)!,
      catObst: Color.lerp(catObst, other.catObst, t)!,
      catBrot: Color.lerp(catBrot, other.catBrot, t)!,
      catKuehl: Color.lerp(catKuehl, other.catKuehl, t)!,
      catFleisch: Color.lerp(catFleisch, other.catFleisch, t)!,
      catVorrat: Color.lerp(catVorrat, other.catVorrat, t)!,
      catSuess: Color.lerp(catSuess, other.catSuess, t)!,
      catGetraenke: Color.lerp(catGetraenke, other.catGetraenke, t)!,
      catTiefkuehl: Color.lerp(catTiefkuehl, other.catTiefkuehl, t)!,
      catHaushalt: Color.lerp(catHaushalt, other.catHaushalt, t)!,
      catDrogerie: Color.lerp(catDrogerie, other.catDrogerie, t)!,
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
  static const mega = TextStyle(fontFamily: 'Bricolage Grotesque', fontSize: 112, fontWeight: FontWeight.w800, height: 0.88, letterSpacing: -5.04);
  static const display = TextStyle(fontFamily: 'Bricolage Grotesque', fontSize: 52, fontWeight: FontWeight.w800, height: 0.92, letterSpacing: -2.08);
  static const headline = TextStyle(fontFamily: 'Bricolage Grotesque', fontSize: 36, fontWeight: FontWeight.w800, height: 0.98, letterSpacing: -1.26);
  static const title = TextStyle(fontFamily: 'Bricolage Grotesque', fontSize: 22, fontWeight: FontWeight.w700, height: 1.1, letterSpacing: -0.44);
  static const bodyLg = TextStyle(fontFamily: 'Inter', fontSize: 19, fontWeight: FontWeight.w400, height: 1.5, letterSpacing: -0.114);
  static const body = TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w400, height: 1.55, letterSpacing: 0);
  static const label = TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700, fontVariations: [FontVariation('wght', 650)], height: 1.2, letterSpacing: 0);
  static const caption = TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, height: 1.3, letterSpacing: 0);
  static const appStore = TextStyle(fontFamily: 'Bricolage Grotesque', fontSize: 20, fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -0.5);
  static const appItem = TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w600, height: 1.4, letterSpacing: -0.204);
  static const appMeta = TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w500, fontVariations: [FontVariation('wght', 450)], height: 1.3, letterSpacing: 0);
  static const appCategory = TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w700, height: 1.2, letterSpacing: 0.99);
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
  static const double xs = 6;
  static const double s = 12;
  static const double m = 20;
  static const double l = 28;
  static const double xl = 40;
  static const double full = 999;
}

abstract final class HummlistMotion {
  static const fast = Duration(milliseconds: 150);
  static const base = Duration(milliseconds: 220);
  static const slow = Duration(milliseconds: 300);
  static const outValue = Cubic(0.16, 1, 0.3, 1);
  static const inValue = Cubic(0.7, 0, 0.84, 0);
  static const standard = Cubic(0.2, 0, 0, 1);
}
