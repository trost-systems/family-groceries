import 'dart:async';
import 'dart:ui';

import 'package:family_groceries/app/device_cache.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// The languages the app speaks. Anything else falls back to German.
enum AppLanguage(final String code) {
  de('de'),
  en('en');

  static AppLanguage? byCode(String? code) =>
      values.where((l) => l.code == code).firstOrNull;
}

/// The language picked under More, or null to follow the device.
class LanguageCubit(final DeviceCache _cache, super.initialState)
    extends Cubit<AppLanguage?> {
  void pick(AppLanguage? language) {
    emit(language);
    unawaited(_cache.saveLanguage(language?.code));
  }
}

/// German or English by the device's preferred languages, in order;
/// German when it prefers neither.
Locale resolveLocale(List<Locale>? preferred, AppLanguage? picked) {
  if (picked != null) {
    return Locale(picked.code);
  }
  for (final locale in preferred ?? const <Locale>[]) {
    if (AppLanguage.byCode(locale.languageCode) case final language?) {
      return Locale(language.code);
    }
  }
  return Locale(AppLanguage.de.code);
}
