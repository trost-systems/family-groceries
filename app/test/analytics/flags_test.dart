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

  test('after the yes a flag is what PostHog served', () async {
    await analytics.decide(granted: true);
    await pumpEventQueue();
    expect(analytics.flags.isOn('new-thing'), isTrue);
    expect(analytics.flags.isOn('old-thing'), isFalse);
    expect(analytics.flags.isOn('unknown'), isFalse);
  });

  test('flags that arrive later replace the ones read at start', () async {
    await analytics.decide(granted: true);
    native.served = {'new-thing': false, 'later-thing': true};
    await flagsArrive();
    expect(analytics.flags.isOn('new-thing'), isFalse);
    expect(analytics.flags.isOn('later-thing'), isTrue);
  });

  test('a no turns every flag off', () async {
    await analytics.decide(granted: true);
    await analytics.decide(granted: false);
    expect(analytics.flags.isOn('new-thing'), isFalse);
    await flagsArrive();
    expect(analytics.flags.isOn('new-thing'), isFalse);
  });

  test('a stored yes reads the flags at the next start', () async {
    await analytics.decide(granted: true);
    final again = await loadedAnalytics(store);
    await pumpEventQueue();
    expect(again.flags.isOn('new-thing'), isTrue);
    await again.close();
  });

  test('offline, before any answer, every flag stays off', () async {
    native.served = {};
    await analytics.decide(granted: true);
    expect(analytics.flags.state, isEmpty);
    expect(analytics.flags.isOn('new-thing'), isFalse);
  });

  group('targeting by is_internal', () {
    setUp(
      () => native.targeting = (properties) => {
        'internal-only': properties['is_internal'] == true,
      },
    );

    List<Object?> sent() => [
      for (final c in native.calls)
        if (c.method == 'setPersonPropertiesForFlags')
          (c.arguments as Map)['userProperties'],
    ];

    test('after the yes PostHog evaluates flags with is_internal, as a '
        'flag property only', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      await pumpEventQueue();
      expect(sent(), [
        {'is_internal': false},
      ]);
      expect(analytics.flags.isOn('internal-only'), isFalse);
      expect(native.methods, isNot(contains('setPersonProperties')));
      expect(native.methods, isNot(contains('identify')));
    });

    test('marked internal: sent again once, and the flags follow', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      await pumpEventQueue();
      await analytics.markInternalInstall(internal: true);
      await pumpEventQueue();
      expect(analytics.flags.isOn('internal-only'), isTrue);
      // Context registered again without a change sends nothing new.
      analytics.testerHousehold = null;
      await pumpEventQueue();
      await analytics.markInternalInstall(internal: false);
      await pumpEventQueue();
      expect(sent(), [
        {'is_internal': false},
        {'is_internal': true},
        {'is_internal': false},
      ]);
      expect(analytics.flags.isOn('internal-only'), isFalse);
    });

    test('a no clears it; the next yes sends it again', () async {
      await analytics.markInternalInstall(internal: true);
      await analytics.decide(granted: true);
      await pumpEventQueue();
      await analytics.decide(granted: false);
      await pumpEventQueue();
      expect(native.methods, contains('resetPersonPropertiesForFlags'));
      expect(native.flagProperties, isEmpty);
      expect(analytics.flags.isOn('internal-only'), isFalse);
      await analytics.decide(granted: true);
      await pumpEventQueue();
      expect(native.flagProperties, {'is_internal': true});
      expect(analytics.flags.isOn('internal-only'), isTrue);
    });
  });

  test('a build without a key has every flag off', () async {
    final off = Analytics.off(store);
    await off.load();
    await off.decide(granted: true);
    expect(off.flags.isOn('new-thing'), isFalse);
    await off.close();
  });

  test('a forced flag is on whatever PostHog serves', () async {
    final flags = Flags(forced: {'public-api'});
    expect(flags.isOn('public-api'), isTrue);
    flags.replace({'public-api': false, 'other': true});
    expect(flags.isOn('public-api'), isTrue);
    expect(flags.isOn('other'), isTrue);
    flags.clear();
    expect(flags.isOn('public-api'), isTrue);
    expect(flags.isOn('other'), isFalse);
    await flags.close();
  });
}
