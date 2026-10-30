import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  late RecordingSink sink;
  late MemoryAnalyticsStore store;
  late Analytics analytics;

  setUp(() async {
    sink = RecordingSink();
    store = MemoryAnalyticsStore();
    analytics = await loadedAnalytics(sink, store);
  });

  tearDown(() => analytics.close());

  group('consent', () {
    test('a fresh install has not decided and is asked', () {
      expect(analytics.state.consent, isNull);
      expect(analytics.asksConsent, isTrue);
      expect(store.id, matches(uuidPattern));
    });

    test('before the decision nothing is queued or sent', () async {
      analytics
        ..setUser(customer)
        ..track('item_ticked')
        ..captureException(StateError('boom'), StackTrace.current);
      await analytics.flush();
      expect(analytics.queued, isEmpty);
      expect(sink.batches, isEmpty);
    });

    test('yes sends exactly one first_open per install id', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      await analytics.decide(granted: true);
      await analytics.flush();
      expect(sink.names, ['first_open']);
      expect(store.firstOpen, store.id);

      // The next start of the same install sends none.
      final again = await loadedAnalytics(sink, store);
      again.setUser(customer);
      await again.decide(granted: true);
      await again.flush();
      expect(sink.names, ['first_open']);
      expect(again.asksConsent, isFalse);
      await again.close();
    });

    test('no sends nothing, now or later', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: false);
      analytics
        ..track('item_added', {'source': 'typed'})
        ..captureException(StateError('boom'), null);
      await analytics.flush();
      expect(sink.batches, isEmpty);
      expect(store.decided, isFalse);
      expect(store.firstOpen, isNull);
      expect(analytics.asksConsent, isFalse);
    });

    test('turning it off drops what waits and stops at once', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      await analytics.flush();
      analytics
        ..track('item_ticked')
        ..track('item_ticked');
      expect(analytics.queued, hasLength(2));

      await analytics.decide(granted: false);
      expect(analytics.queued, isEmpty);
      analytics.track('item_ticked');
      await analytics.flush();
      expect(sink.names, ['first_open']);
    });

    test(
      'a no during a send drops the failed batch instead of keeping it',
      () async {
        analytics.setUser(customer);
        await analytics.decide(granted: true);
        sink.fail = true;
        final sending = analytics.flush();
        await analytics.decide(granted: false);
        await sending;
        expect(analytics.queued, isEmpty);
      },
    );

    test('a later yes from More sends first_open then', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: false);
      await analytics.decide(granted: true);
      await analytics.flush();
      expect(sink.names, ['first_open']);
    });

    test('a build without a key never asks and never sends', () async {
      final off = Analytics.off(store);
      await off.load();
      off.setUser(customer);
      expect(off.enabled, isFalse);
      expect(off.asksConsent, isFalse);
      await off.decide(granted: true);
      off.track('item_ticked');
      await off.flush();
      expect(off.queued, isEmpty);
      await off.close();
    });
  });

  group('signed out', () {
    test('nothing is captured without a user, not even errors', () async {
      await analytics.decide(granted: true);
      analytics
        ..track('item_ticked')
        ..captureException(StateError('login screen'), StackTrace.current);
      await analytics.flush();
      expect(sink.batches, isEmpty);
    });

    test('signing out drops the queue', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      analytics
        ..track('item_ticked')
        ..setUser(null);
      expect(analytics.queued, isEmpty);
    });
  });

  group('payload', () {
    late Map<String, Object?> event;

    setUp(() async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      analytics.track('item_ticked', {
        'actor_role': 'owner',
        'household_size': 2,
      });
      await analytics.flush();
      event = sink.events.last;
    });

    test('carries the context and nothing else', () {
      final properties = event['properties']! as Map<String, Object?>;
      expect(properties.keys.toSet(), {
        'actor_role',
        'household_size',
        'distinct_id',
        'event_id',
        'install_id',
        'household_id',
        'platform',
        'app_version',
        'is_internal',
        r'$geoip_disable',
        r'$process_person_profile',
        r'$lib',
        r'$lib_version',
      });
      expect(properties[r'$geoip_disable'], isTrue);
      expect(properties, isNot(contains(r'$ip')));
      expect(properties['distinct_id'], store.id);
      expect(properties['install_id'], store.id);
      expect(properties['household_id'], householdA);
      expect(properties['is_internal'], isFalse);
      expect(properties['platform'], 'web');
      expect(properties['app_version'], '0.1.0+7');
    });

    test('the PostHog uuid is the event_id, for dedup', () {
      final properties = event['properties']! as Map<String, Object?>;
      expect(event['uuid'], properties['event_id']);
      expect(event['uuid'], matches(uuidPattern));
      expect(DateTime.parse(event['timestamp']! as String).isUtc, isTrue);
    });

    test('no household yet sends household_id null', () async {
      analytics
        ..setUser(const AnalyticsUser(email: 'neu@gmail.com'))
        ..track('household_created');
      await analytics.flush();
      final properties = sink.events.last['properties']! as Map;
      expect(properties.containsKey('household_id'), isTrue);
      expect(properties['household_id'], isNull);
    });

    test('the household group goes only with its flag', () async {
      final grouped = await loadedAnalytics(
        sink,
        store,
        config: const AnalyticsConfig(
          releaseBuild: true,
          platform: 'ios',
          appVersion: '1.0.0+2',
          householdGroups: true,
        ),
      );
      grouped.setUser(customer);
      await grouped.decide(granted: true);
      grouped.track('store_reordered');
      await grouped.flush();
      final properties = sink.events.last['properties']! as Map;
      expect(properties[r'$groups'], {'household': householdA});
      await grouped.close();
    });
  });

  group('the allow-list at the door', () {
    setUp(() async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      await analytics.flush();
    });

    test('an unknown event is dropped', () {
      analytics.track('item_name_typed', {'source': 'typed'});
      expect(analytics.queued, isEmpty);
    });

    test('an item name in a property is dropped', () {
      analytics
        ..track('item_added', {'source': 'Hafermilch'})
        ..track('item_ticked', {'name': 'Hafermilch'});
      expect(analytics.queued, isEmpty);
    });
  });

  group('is_internal', () {
    Future<bool> internalFor(
      AnalyticsUser user, {
      AnalyticsConfig config = releaseConfig,
      bool install = false,
    }) async {
      final s = RecordingSink();
      final a = await loadedAnalytics(s, store, config: config);
      await a.markInternalInstall(internal: install);
      a.setUser(user);
      await a.decide(granted: true);
      a.track('store_reordered');
      await a.flush();
      await a.close();
      return (s.events.last['properties']! as Map)['is_internal']! as bool;
    }

    test('a customer in a release build is not internal', () async {
      expect(await internalFor(customer), isFalse);
    });

    test('a debug or profile build is internal', () async {
      expect(
        await internalFor(
          customer,
          config: const AnalyticsConfig(
            releaseBuild: false,
            householdGroups: false,
            platform: 'web',
            appVersion: '0.1.0',
          ),
        ),
        isTrue,
      );
    });

    test('a test account is internal', () async {
      for (final email in [
        'peter@fg.test',
        'lea@fg-test.invalid',
        'e2e-1234@example.test',
      ]) {
        expect(
          await internalFor(
            AnalyticsUser(email: email, householdId: householdA),
          ),
          isTrue,
          reason: email,
        );
      }
    });

    test('a listed household is internal', () async {
      expect(
        await internalFor(
          customer,
          config: const AnalyticsConfig(
            releaseBuild: true,
            householdGroups: false,
            platform: 'web',
            appVersion: '0.1.0',
            internalHouseholds: {householdA},
          ),
        ),
        isTrue,
      );
    });

    test('an install marked under More is internal', () async {
      expect(await internalFor(customer, install: true), isTrue);
      expect(store.internal, isTrue);
    });
  });

  group('sending', () {
    test('batches go out after the flush interval', () {
      fakeAsync((async) {
        late Analytics a;
        unawaited(loadedAnalytics(sink, store).then((loaded) => a = loaded));
        async.flushMicrotasks();
        a.setUser(customer);
        unawaited(a.decide(granted: true));
        async.flushMicrotasks();
        expect(sink.batches, isEmpty);
        async.elapse(const Duration(seconds: 5));
        expect(sink.names, ['first_open']);
        unawaited(a.close());
      });
    });

    test('a failed batch is sent again with the same uuids', () async {
      analytics.setUser(customer);
      await analytics.decide(granted: true);
      sink.fail = true;
      await analytics.flush();
      final uuid = analytics.queued.single['uuid'];
      sink.fail = false;
      await analytics.flush();
      expect(sink.events.single['uuid'], uuid);
    });

    test('a full queue drops the oldest', () async {
      final small = await loadedAnalytics(
        sink,
        store,
        config: const AnalyticsConfig(
          releaseBuild: true,
          householdGroups: false,
          platform: 'web',
          appVersion: '0.1.0',
          maxQueue: 3,
          flushAt: 100,
        ),
      );
      small.setUser(customer);
      await small.decide(granted: true);
      sink.fail = true;
      for (var i = 0; i < 5; i++) {
        small.track('item_ticked');
      }
      expect(small.queued, hasLength(3));
      expect(small.queued.map((e) => e['event']), everyElement('item_ticked'));
      await small.close();
    });
  });

  test('checkContext refuses an unknown or malformed property', () {
    expect(
      () => checkContext({r'$ip': '1.2.3.4'}),
      throwsA(isA<RefusedEvent>()),
    );
    expect(
      () => checkContext({'household_id': 'Familie Trost'}),
      throwsA(isA<RefusedEvent>()),
    );
    expect(
      () => checkContext({'app_version': 'Milch'}),
      throwsA(isA<RefusedEvent>()),
    );
    expect(
      () => checkContext({r'$geoip_disable': false}),
      throwsA(isA<RefusedEvent>()),
    );
  });

  test('two quick yeses send one first_open', () async {
    analytics.setUser(customer);
    await Future.wait([
      analytics.decide(granted: true),
      analytics.decide(granted: true),
    ]);
    await analytics.flush();
    expect(sink.names, ['first_open']);
  });

  test('a flush during a send waits for it, then sends the rest', () async {
    final slow = _SlowSink();
    final a = await loadedAnalytics(RecordingSink(), store);
    final b = Analytics(slow, store, releaseConfig);
    await b.load();
    await a.close();
    b.setUser(customer);
    await b.decide(granted: true);
    final first = b.flush();
    b.track('item_ticked');
    final second = b.flush();
    expect(b.queued, hasLength(1), reason: 'not dropped while one is sent');
    slow.release();
    await first;
    await second;
    expect(slow.names, ['first_open', 'item_ticked']);
    await b.close();
  });
}

class _SlowSink() extends RecordingSink {
  final _gate = Completer<void>();

  void release() => _gate.complete();

  @override
  Future<void> send(List<Map<String, Object?>> batch) async {
    await _gate.future;
    await super.send(batch);
  }
}
