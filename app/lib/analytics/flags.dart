import 'package:flutter_bloc/flutter_bloc.dart';

/// PostHog feature flags, the app's runtime toggles (job 44,
/// docs/ANALYTICS.md "Feature flags"). Read a toggle with [isOn] wherever it
/// matters; nothing else in the app reads PostHog flags.
///
/// Every flag is off until PostHog turned it on for this install: before
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
