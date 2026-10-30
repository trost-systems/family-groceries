import 'dart:async';

import 'package:family_groceries/app/device_cache.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Design H's seed. Every colour of the app is a role of the tonal-spot
/// scheme Material 3 builds from it, in light and in dark (design SPEC
/// 2), except the store badges (`store_badge.dart`).
const seedColor = Color(0xFF2E7D32);

/// The app's theme in [brightness]: both come from [seedColor], so a screen
/// that uses `ColorScheme` roles is right in both.
ThemeData appTheme(Brightness brightness) =>
    ThemeData(colorSchemeSeed: seedColor, brightness: brightness);

/// How a stored theme choice reads: `light`, `dark`, or anything else for
/// the device's setting.
ThemeMode themeModeOf(String? name) => switch (name) {
  'light' => ThemeMode.light,
  'dark' => ThemeMode.dark,
  _ => ThemeMode.system,
};

/// Light, dark or the device's setting, picked under More's Einstellungen
/// and kept on the device. The device's setting by default.
class ThemeCubit(final DeviceCache _cache, super.initialState)
    extends Cubit<ThemeMode> {
  void pick(ThemeMode mode) {
    emit(mode);
    unawaited(_cache.saveTheme(mode == ThemeMode.system ? null : mode.name));
  }
}

/// The WCAG 2 contrast ratio of two opaque colours, 1 to 21. AA asks 4.5
/// for text, 3 for large text and for the parts of a control.
double contrastRatio(Color a, Color b) {
  final (la, lb) = (a.computeLuminance(), b.computeLuminance());
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}
