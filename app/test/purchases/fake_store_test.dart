import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  /// The events the local stack's RevenueCat stand-in got.
  late List<(String, String)> events;
  Future<void> send({
    required String appUserId,
    required String transactionId,
  }) async => events.add((appUserId, transactionId));

  setUp(() => events = []);

  FakeStore open(
    FakeStoreMode mode,
    MemoryLedger ledger, {
    SendTestEvent? sender,
  }) => FakeStore(mode, send: sender ?? send, ledger: ledger);

  test('sells for the household, sending the event', () async {
    final store = open(FakeStoreMode.ok, MemoryLedger());
    final bought = await store.buy('home');
    final transaction = (bought as Bought).transaction!;
    expect(transaction.store, AppStore.apple);
    expect(transaction.id, startsWith('fake-'));
    expect(events, [('home', transaction.id)]);
  });

  test('restores in its household, across starts', () async {
    final ledger = MemoryLedger();
    final bought = await open(FakeStoreMode.ok, ledger).buy('home');
    final id = (bought as Bought).transaction!.id;
    events.clear();
    final next = open(FakeStoreMode.ok, ledger);
    expect(await next.restore('home'), isA<Restored>());
    expect(events, [('home', id)], reason: 'the event again');
  });

  test("another household's purchase belongs elsewhere", () async {
    final ledger = MemoryLedger();
    await open(FakeStoreMode.ok, ledger).buy('home');
    events.clear();
    expect(
      await open(FakeStoreMode.ok, ledger).restore('other'),
      isA<BelongsElsewhere>(),
    );
    expect(events, isEmpty);
  });

  test('nothing bought, nothing to restore', () async {
    expect(
      await open(FakeStoreMode.ok, MemoryLedger()).restore('home'),
      isA<NothingToRestore>(),
    );
  });

  test('Ask to Buy: pending, then sold after the approval', () {
    fakeAsync((async) {
      final store = open(FakeStoreMode.pending, MemoryLedger());
      BuyOutcome? outcome;
      unawaited(store.buy('home').then((o) => outcome = o));
      async.flushMicrotasks();
      expect(outcome, isA<Pending>());
      async.elapse(const Duration(seconds: 7));
      expect(events, isEmpty);
      async.elapse(const Duration(seconds: 1));
      expect(events.single.$1, 'home');
    });
  });

  test('cancel, error and offline modes', () async {
    expect(
      await open(FakeStoreMode.cancel, MemoryLedger()).buy('home'),
      isA<Canceled>(),
    );
    expect(
      await open(FakeStoreMode.error, MemoryLedger()).buy('home'),
      isA<StoreFailed>(),
    );
    expect(
      await open(FakeStoreMode.offline, MemoryLedger()).restore('home'),
      isA<StoreOffline>(),
    );
    expect(events, isEmpty);
  });

  test('unavailable and offline modes sell nothing', () async {
    expect(
      await open(FakeStoreMode.unavailable, MemoryLedger()).buy('h'),
      isA<ProductMissing>(),
    );
    expect(
      await open(FakeStoreMode.offline, MemoryLedger()).buy('h'),
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
        sender: ({required appUserId, required transactionId}) async =>
            throw Exception('404'),
      );
      expect(await failing.buy('home'), isA<StoreFailed>());
      expect(
        await open(FakeStoreMode.ok, ledger).restore('home'),
        isA<Restored>(),
      );
      expect(events, hasLength(1));
    },
  );

  test("an earlier build's ledger reads as empty", () async {
    final ledger = MemoryLedger()
      ..contents = '{"owned":["fake-1"],"unfinished":[]}';
    expect(
      await open(FakeStoreMode.ok, ledger).restore('home'),
      isA<NothingToRestore>(),
    );
  });
}
