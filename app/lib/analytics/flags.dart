import 'package:flutter_bloc/flutter_bloc.dart';

/// Whether the app may ask PostHog for feature flags at all. Off on every
/// platform: Legal Review N-2 (sweep 2026-11-01) allows no `/flags` request
/// until the consent text names the purpose ("neue Funktionen schrittweise
/// freischalten") and the yes is stored with that text's version, so a yes
/// given under the old text never leads to a flag lookup. Turn this on only
/// together with that consent-version gate (docs/ANALYTICS.md, "Feature
/// flags").
const flagLookups = false;

/// PostHog feature flags, the app's runtime toggles (job 44,
/// docs/ANALYTICS.md "Feature flags"). Read a toggle with [isOn] wherever it
/// matters; nothing else in the app reads PostHog flags.
///
/// While [flagLookups] is off, every flag is off and no flag request is
/// made, after a yes too. Otherwise every flag is off until PostHog turned
/// it on for this install: before
/// the analytics yes (the SDK does not run, so no flag request is made),
/// after a no, in a build without a project key, and offline until a first
/// answer. Later the SDK serves the values it last received, also offline.
/// Changelog and release holds stay in `releases/flags.json`, not here.
class Flags() extends Cubit<Map<String, bool>> {
  this : super(const {});

  /// Whether the flag [key] is on for this install; off when unknown.
  bool isOn(String key) => state[key] ?? false;

  /// The values PostHog served; `Analytics` only.
  void replace(Map<String, bool> values) => emit(Map.unmodifiable(values));

  /// Every flag back to off; `Analytics` only.
  void clear() => emit(const {});
}
