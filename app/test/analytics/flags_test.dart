import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/flags.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  late NativePostHog native;
  late MemoryAnalyticsStore store;
  late Analytics analytics;

  setUp(() async {
    native = NativePostHog()
      ..install()
      ..served = {'new-thing': true, 'old-thing': false};
    store = MemoryAnalyticsStore();
    analytics = await loadedAnalytics(store);
  });

  tearDown(() => analytics.close());

  /// The native SDK telling Dart that flags arrived.
  Future<void> flagsArrive() async {
    await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
          'posthog_flutter',
          const StandardMethodCodec().encodeMethodCall(
            const MethodCall('onFeatureFlagsCallback'),
          ),
          (_) {},
        );
    await analytics.flush();
    await pumpEventQueue();
  }

  test('every flag is off before the yes, and none is asked for', () {
    analytics.setUser(customer);
    expect(analytics.flags.isOn('new-thing'), isFalse);
    expect(native.calls, isEmpty);
  });

  // Legal Review N-2 (2026-11-01): no flag lookup until the consent text
  // names the purpose and the yes carries that text's version.
  test('flag lookups are off', () => expect(flagLookups, isFalse));

  test('after the yes no flag is asked for and every flag stays off', () async {
    await analytics.decide(granted: true);
    await pumpEventQueue();
    expect(native.methods, contains('setup'));
    expect(native.setup['preloadFeatureFlags'], isFalse);
    expect(native.methods, isNot(contains('getAllFeatureFlags')));
    expect(native.methods, isNot(contains('reloadFeatureFlags')));
    expect(analytics.flags.isOn('new-thing'), isFalse);
    expect(analytics.flags.state, isEmpty);
  });

  test('flags the SDK reports anyway are not read', () async {
    await analytics.decide(granted: true);
    await flagsArrive();
    expect(native.methods, isNot(contains('getAllFeatureFlags')));
    expect(analytics.flags.isOn('new-thing'), isFalse);
  });

  test('a stored yes asks for no flags at the next start', () async {
    await analytics.decide(granted: true);
    final again = await loadedAnalytics(store);
    await pumpEventQueue();
    expect(native.methods, isNot(contains('getAllFeatureFlags')));
    expect(again.flags.isOn('new-thing'), isFalse);
    await again.close();
  });

  test('a no keeps every flag off', () async {
    await analytics.decide(granted: true);
    await analytics.decide(granted: false);
    await flagsArrive();
    expect(analytics.flags.isOn('new-thing'), isFalse);
  });

  test('offline, before any answer, every flag stays off', () async {
    native.served = {};
    await analytics.decide(granted: true);
    expect(analytics.flags.state, isEmpty);
    expect(analytics.flags.isOn('new-thing'), isFalse);
  });

  test('a build without a key has every flag off', () async {
    final off = Analytics.off(store);
    await off.load();
    await off.decide(granted: true);
    expect(off.flags.isOn('new-thing'), isFalse);
    await off.close();
  });
}
