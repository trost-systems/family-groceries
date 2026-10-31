import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';

import '../household/harness.dart' show TestSession;
import 'fakes.dart';

void main() {
  Future<(Entitlements, TestSession)> follow(
    FakeEntitlementsSource rows, {
    Session session = const InHousehold(
      'peter',
      Household(id: 'home', name: 'Zuhause'),
    ),
  }) async {
    final testSession = TestSession(session);
    addTearDown(testSession.close);
    final entitlements = Entitlements(rows, testSession);
    addTearDown(entitlements.close);
    await pumpEventQueue();
    return (entitlements, testSession);
  }

  test('without a household nothing is known or watched', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, _) = await follow(
      rows,
      session: const NeedsHousehold('peter'),
    );
    expect(entitlements.state, isA<EntitlementsUnknown>());
    expect(entitlements.has(Entitlement.lifetime), isFalse);
    expect(rows.watching, isEmpty);
  });

  test("reads the household's rows and follows them", () async {
    final rows = FakeEntitlementsSource();
    final (entitlements, _) = await follow(rows);
    expect(
      entitlements.state,
      isA<EntitlementsKnown>()
          .having((s) => s.householdId, 'household', 'home')
          .having((s) => s.unlocks.kinds, 'kinds', isEmpty),
    );
    expect(rows.watching, {'home'});
    rows
      ..unlockedNow = true
      ..change();
    await pumpEventQueue();
    expect(entitlements.has(Entitlement.lifetime), isTrue);
  });

  test('offline it stays unknown until a reconnect reads', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true)..offline = true;
    final (entitlements, _) = await follow(rows);
    expect(entitlements.state, isA<EntitlementsUnknown>());
    rows
      ..offline = false
      ..change();
    await pumpEventQueue();
    expect(entitlements.has(Entitlement.lifetime), isTrue);
  });

  test('offline later keeps what it knew', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, _) = await follow(rows);
    rows.offline = true;
    await entitlements.refresh();
    expect(entitlements.has(Entitlement.lifetime), isTrue);
  });

  test("another household's unlock is not this one's", () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, session) = await follow(rows);
    expect(entitlements.has(Entitlement.lifetime), isTrue);
    rows.unlockedNow = false;
    await session.join('ABCD2345');
    await pumpEventQueue();
    expect(rows.watching, {'other'});
    expect(
      entitlements.state,
      isA<EntitlementsKnown>()
          .having((s) => s.householdId, 'id', 'other')
          .having((s) => s.unlocks.kinds, 'kinds', isEmpty),
    );
  });

  test(
    'Buy may be offered only once the household is known to lack it',
    () async {
      final rows = FakeEntitlementsSource()..offline = true;
      final (entitlements, _) = await follow(rows);
      expect(
        entitlements.canOffer(Entitlement.lifetime),
        isFalse,
        reason: 'unknown',
      );
      rows
        ..offline = false
        ..change();
      await pumpEventQueue();
      expect(
        entitlements.canOffer(Entitlement.lifetime),
        isTrue,
        reason: 'known, locked',
      );
      rows
        ..unlockedNow = true
        ..change();
      await pumpEventQueue();
      expect(
        entitlements.canOffer(Entitlement.lifetime),
        isFalse,
        reason: 'unlocked',
      );
    },
  );

  test('a kind this build does not know unlocks nothing', () async {
    final rows = FakeEntitlementsSource()
      ..rowsNow = [
        {'kind': 'plus', 'source': 'purchase'},
      ];
    final (entitlements, _) = await follow(rows);
    expect(entitlements.has(Entitlement.lifetime), isFalse);
    expect(entitlements.canOffer(Entitlement.lifetime), isTrue);
  });

  test("a tester's grant unlocks Lifetime and is marked", () async {
    final rows = FakeEntitlementsSource()
      ..rowsNow = [
        {'kind': 'lifetime', 'source': 'tester'},
      ];
    final (entitlements, _) = await follow(rows);
    expect(entitlements.has(Entitlement.lifetime), isTrue);
    expect(
      entitlements.state,
      isA<EntitlementsKnown>().having(
        (s) => s.unlocks.tester,
        'tester',
        isTrue,
      ),
    );
  });

  test(
    'two Lifetime purchases: bought twice; a tester grant does not count',
    () async {
      final rows = FakeEntitlementsSource()
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          {'kind': 'lifetime', 'source': 'tester'},
        ];
      final (entitlements, _) = await follow(rows);
      expect(entitlements.boughtLifetimeTwice, isFalse);
      rows
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          {'kind': 'lifetime', 'source': 'purchase'},
        ]
        ..change();
      await pumpEventQueue();
      expect(entitlements.boughtLifetimeTwice, isTrue);
      expect(
        entitlements.state,
        isA<EntitlementsKnown>().having(
          (s) => s.unlocks.lifetimePurchases,
          'purchases',
          2,
        ),
      );
    },
  );

  test('signing out forgets and stops watching', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, session) = await follow(rows);
    await session.signOut();
    await pumpEventQueue();
    expect(entitlements.state, isA<EntitlementsUnknown>());
    expect(rows.watching, isEmpty);
  });
}
