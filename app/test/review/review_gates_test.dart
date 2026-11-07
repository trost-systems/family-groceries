import 'package:family_groceries/review/review_counters.dart';
import 'package:family_groceries/review/review_gates.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime(2026, 11, 6, 18);
  final due = ReviewCounters(
    firstLaunch: now.subtract(const Duration(days: 7)),
    activeDays: 3,
    completedTrips: 2,
    itemsAdded: 25,
    sessionStart: now.subtract(const Duration(minutes: 5)),
    previousSessionStart: now.subtract(const Duration(days: 2)),
  );

  ReviewGate? gate(
    ReviewCounters c, {
    String version = '1.4.0',
    BuildChannel channel = BuildChannel.store,
  }) => failingGate(c, now: now, version: version, channel: channel);

  ReviewRequest daysAgo(int days, [String version = '1.3.0']) =>
      ReviewRequest(now.subtract(Duration(days: days)), version);

  test('a store build at every threshold passes', () {
    expect(gate(due), isNull);
  });

  test('the channel: an iPhone release is a store build, elsewhere only '
      'with STORE_RELEASE', () {
    BuildChannel of({
      bool release = true,
      bool storeRelease = false,
      bool web = false,
      TargetPlatform platform = TargetPlatform.iOS,
    }) => BuildChannel.of(
      release: release,
      storeRelease: storeRelease,
      web: web,
      platform: platform,
    );
    expect(of(), BuildChannel.store);
    expect(of(release: false), BuildChannel.debug);
    expect(of(release: false, storeRelease: true), BuildChannel.debug);
    expect(of(platform: TargetPlatform.android), BuildChannel.beta);
    expect(
      of(platform: TargetPlatform.android, storeRelease: true),
      BuildChannel.store,
    );
    expect(of(web: true), BuildChannel.beta);
  });

  test('beta and debug builds never pass', () {
    expect(gate(due, channel: BuildChannel.beta), ReviewGate.storeBuild);
    expect(gate(due, channel: BuildChannel.debug), ReviewGate.storeBuild);
  });

  test('the first launch must be a week ago', () {
    expect(
      gate(
        due.copyWith(
          firstLaunch: now.subtract(const Duration(days: 7, seconds: -1)),
        ),
      ),
      ReviewGate.firstLaunchAge,
    );
    expect(gate(const ReviewCounters()), ReviewGate.firstLaunchAge);
  });

  test('3 active days, 2 completed trips and 25 added items', () {
    expect(gate(due.copyWith(activeDays: 2)), ReviewGate.activeDays);
    expect(gate(due.copyWith(completedTrips: 1)), ReviewGate.completedTrips);
    expect(gate(due.copyWith(itemsAdded: 24)), ReviewGate.itemsAdded);
  });

  group('an error', () {
    test('in this session blocks', () {
      expect(
        gate(
          due.copyWith(lastErrorAt: now.subtract(const Duration(minutes: 1))),
        ),
        ReviewGate.noRecentError,
      );
    });

    test('in the last session blocks, also days ago', () {
      final c = due.copyWith(
        previousSessionStart: now.subtract(const Duration(days: 5)),
        sessionStart: now.subtract(const Duration(minutes: 5)),
        lastErrorAt: now.subtract(const Duration(days: 4)),
      );
      expect(gate(c), ReviewGate.noRecentError);
    });

    test('in the last 24 hours blocks', () {
      final c = due.copyWith(
        previousSessionStart: now.subtract(const Duration(hours: 2)),
        lastErrorAt: now.subtract(const Duration(hours: 23)),
      );
      expect(gate(c), ReviewGate.noRecentError);
    });

    test('older than the last session and a day passes', () {
      final c = due.copyWith(
        lastErrorAt: now.subtract(const Duration(days: 2, minutes: 1)),
      );
      expect(gate(c), isNull);
    });
  });

  test('a request 119 days ago blocks, 120 days ago does not', () {
    expect(gate(due.copyWith(requests: [daysAgo(119)])), ReviewGate.cooldown);
    expect(gate(due.copyWith(requests: [daysAgo(120)])), isNull);
  });

  test('two requests in this version block, two in an older one do not', () {
    expect(
      gate(
        due.copyWith(requests: [daysAgo(300, '1.4.0'), daysAgo(150, '1.4.0')]),
      ),
      ReviewGate.versionCap,
    );
    expect(gate(due.copyWith(requests: [daysAgo(300), daysAgo(150)])), isNull);
  });

  test('three requests in 365 days block', () {
    expect(
      gate(
        due.copyWith(
          requests: [
            daysAgo(364, '1.1.0'),
            daysAgo(244, '1.2.0'),
            daysAgo(124),
          ],
        ),
      ),
      ReviewGate.yearCap,
    );
    expect(
      gate(
        due.copyWith(
          requests: [
            daysAgo(365, '1.1.0'),
            daysAgo(244, '1.2.0'),
            daysAgo(124),
          ],
        ),
      ),
      isNull,
    );
  });
}
