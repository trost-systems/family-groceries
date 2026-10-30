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
    expect(entitlements.isUnlocked, isFalse);
    expect(rows.watching, isEmpty);
  });

  test("reads the household's rows and follows them", () async {
    final rows = FakeEntitlementsSource();
    final (entitlements, _) = await follow(rows);
    expect(
      entitlements.state,
      isA<EntitlementsKnown>()
          .having((s) => s.householdId, 'household', 'home')
          .having((s) => s.unlocked, 'unlocked', false),
    );
    expect(rows.watching, {'home'});
    rows
      ..unlockedNow = true
      ..change();
    await pumpEventQueue();
    expect(entitlements.isUnlocked, isTrue);
  });

  test('offline it stays unknown until a reconnect reads', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true)..offline = true;
    final (entitlements, _) = await follow(rows);
    expect(entitlements.state, isA<EntitlementsUnknown>());
    rows
      ..offline = false
      ..change();
    await pumpEventQueue();
    expect(entitlements.isUnlocked, isTrue);
  });

  test('offline later keeps what it knew', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, _) = await follow(rows);
    rows.offline = true;
    await entitlements.refresh();
    expect(entitlements.isUnlocked, isTrue);
  });

  test("another household's unlock is not this one's", () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, session) = await follow(rows);
    expect(entitlements.isUnlocked, isTrue);
    rows.unlockedNow = false;
    await session.join('ABCD2345');
    await pumpEventQueue();
    expect(rows.watching, {'other'});
    expect(
      entitlements.state,
      isA<EntitlementsKnown>()
          .having((s) => s.householdId, 'id', 'other')
          .having((s) => s.unlocked, 'unlocked', false),
    );
  });

  test('signing out forgets and stops watching', () async {
    final rows = FakeEntitlementsSource(unlockedNow: true);
    final (entitlements, session) = await follow(rows);
    await session.signOut();
    await pumpEventQueue();
    expect(entitlements.state, isA<EntitlementsUnknown>());
    expect(rows.watching, isEmpty);
  });
}
