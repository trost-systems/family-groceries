import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  /// The events the local stack's RevenueCat stand-in got.
  late List<(String, String)> events;
  const peter = RevenueCatUserId('peter');
  const lea = RevenueCatUserId('lea');
  late List<PremiumPlan> plans;
  Future<void> send({
    required String appUserId,
    required String transactionId,
    required PremiumPlan plan,
  }) async {
    events.add((appUserId, transactionId));
    plans.add(plan);
  }

  setUp(() {
    events = [];
    plans = [];
  });

  FakeStore open(
    FakeStoreMode mode,
    MemoryLedger ledger, {
    SendTestEvent? sender,
  }) => FakeStore(mode, send: sender ?? send, ledger: ledger);

  test('sells for the user, sending the event with their id', () async {
    final store = open(FakeStoreMode.ok, MemoryLedger());
    expect(await store.buy(peter, PremiumPlan.lifetime), isA<Bought>());
    expect(events.single.$1, 'peter');
    expect(events.single.$2, startsWith('fake-'));
  });

  test("restores the user's purchase, across starts", () async {
    final ledger = MemoryLedger();
    await open(FakeStoreMode.ok, ledger).buy(peter, PremiumPlan.lifetime);
    final id = events.single.$2;
    events.clear();
    final next = open(FakeStoreMode.ok, ledger);
    expect(await next.restore(peter), isA<Restored>());
    expect(events, [('peter', id)], reason: 'the event again');
  });

  test("another user's purchase belongs elsewhere", () async {
    final ledger = MemoryLedger();
    await open(FakeStoreMode.ok, ledger).buy(peter, PremiumPlan.lifetime);
    events.clear();
    expect(
      await open(FakeStoreMode.ok, ledger).restore(lea),
      isA<BelongsElsewhere>(),
    );
    expect(events, isEmpty);
  });

  test('nothing bought, nothing to restore', () async {
    expect(
      await open(FakeStoreMode.ok, MemoryLedger()).restore(peter),
      isA<NothingToRestore>(),
    );
  });

  test('Ask to Buy: pending, then sold after the approval', () {
    fakeAsync((async) {
      final store = open(FakeStoreMode.pending, MemoryLedger());
      BuyOutcome? outcome;
      unawaited(
        store.buy(peter, PremiumPlan.lifetime).then((o) => outcome = o),
      );
      async.flushMicrotasks();
      expect(outcome, isA<Pending>());
      async.elapse(const Duration(seconds: 7));
      expect(events, isEmpty);
      async.elapse(const Duration(seconds: 1));
      expect(events.single.$1, 'peter');
    });
  });

  test('cancel, error and offline modes', () async {
    expect(
      await open(
        FakeStoreMode.cancel,
        MemoryLedger(),
      ).buy(peter, PremiumPlan.lifetime),
      isA<Canceled>(),
    );
    expect(
      await open(
        FakeStoreMode.error,
        MemoryLedger(),
      ).buy(peter, PremiumPlan.lifetime),
      isA<StoreFailed>(),
    );
    expect(
      await open(FakeStoreMode.offline, MemoryLedger()).restore(peter),
      isA<StoreOffline>(),
    );
    expect(events, isEmpty);
  });

  test('unavailable and offline modes sell nothing', () async {
    expect(
      await open(
        FakeStoreMode.unavailable,
        MemoryLedger(),
      ).buy(peter, PremiumPlan.lifetime),
      isA<ProductMissing>(),
    );
    expect(
      await open(
        FakeStoreMode.offline,
        MemoryLedger(),
      ).buy(peter, PremiumPlan.lifetime),
      isA<StoreOffline>(),
    );
    expect(events, isEmpty);
  });

  test(
    'without the local stand-in the sale fails, a restore sends it',
    () async {
      final ledger = MemoryLedger();
      final failing = open(
        FakeStoreMode.ok,
        ledger,
        sender: ({
          required appUserId,
          required transactionId,
          required plan,
        }) async => throw Exception('404'),
      );
      expect(
        await failing.buy(peter, PremiumPlan.lifetime),
        isA<StoreFailed>(),
      );
      expect(
        await open(FakeStoreMode.ok, ledger).restore(peter),
        isA<Restored>(),
      );
      expect(events, hasLength(1));
    },
  );

  test("an earlier build's ledger reads as empty", () async {
    final ledger = MemoryLedger()
      ..contents = '{"owned":["fake-1"],"unfinished":[]}';
    expect(
      await open(FakeStoreMode.ok, ledger).restore(peter),
      isA<NothingToRestore>(),
    );
  });

  test('the yearly plan goes out as the yearly product', () async {
    final store = open(FakeStoreMode.ok, MemoryLedger());
    await store.buy(peter, PremiumPlan.yearly);
    await store.buy(peter, PremiumPlan.lifetime);
    expect(plans, [PremiumPlan.yearly, PremiumPlan.lifetime]);
  });
}
