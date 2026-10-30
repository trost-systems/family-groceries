import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  ({FakeStore store, List<StoreUpdate> seen}) open(
    FakeStoreMode mode,
    MemoryLedger ledger, {
    SignTransaction signer = fakeSign,
  }) {
    final store = FakeStore(mode, sign: signer, ledger: ledger);
    final seen = <StoreUpdate>[];
    final subscription = store.updates.listen(seen.add);
    addTearDown(subscription.cancel);
    return (store: store, seen: seen);
  }

  test('sells a signed StoreKit 2 transaction at the fake price', () async {
    final (:store, :seen) = open(FakeStoreMode.ok, MemoryLedger());
    final load = await store.loadProduct();
    expect(
      load,
      isA<ProductLoaded>().having((l) => l.product.price, 'price', '9,99 €'),
    );
    await store.buy((load as ProductLoaded).product);
    await pumpEventQueue();
    final sold = seen.single as StorePurchased;
    expect(sold.proof.store, AppStore.apple);
    expect(sold.proof.productId, lifetimeProductId);
    expect(sold.proof.data, startsWith('signed:fake-'));
    expect(sold.source, PurchaseSource.purchase);
  });

  test('an unfinished purchase comes back at the next start', () async {
    final ledger = MemoryLedger();
    final first = open(FakeStoreMode.ok, ledger);
    await first.store.buy(lifetimeProduct);
    await pumpEventQueue();
    final sold = first.seen.single as StorePurchased;

    final second = open(FakeStoreMode.ok, ledger);
    await pumpEventQueue();
    expect(second.seen, hasLength(1));
    expect((second.seen.single as StorePurchased).proof.data, sold.proof.data);

    await second.store.finish(second.seen.single as StorePurchased);
    final third = open(FakeStoreMode.ok, ledger);
    await pumpEventQueue();
    expect(third.seen, isEmpty, reason: 'finished, not handed over again');
  });

  test('restores what it sold, the same transaction', () async {
    final ledger = MemoryLedger();
    final (:store, :seen) = open(FakeStoreMode.ok, ledger);
    await store.restore();
    await pumpEventQueue();
    expect(seen, isEmpty, reason: 'nothing sold yet');
    await store.buy(lifetimeProduct);
    await pumpEventQueue();
    final sold = seen.single as StorePurchased;
    await store.finish(sold);
    await store.restore();
    await pumpEventQueue();
    final restored = seen.last as StorePurchased;
    expect(restored.source, PurchaseSource.restore);
    expect(restored.proof.data, sold.proof.data);
    expect(restored.alreadyFinished, isTrue);
  });

  test('Ask to Buy: pending, then sold after the approval', () {
    fakeAsync((async) {
      final (:store, :seen) = open(FakeStoreMode.pending, MemoryLedger());
      unawaited(store.buy(lifetimeProduct));
      async.flushMicrotasks();
      expect(seen.single, isA<StorePending>());
      async.elapse(const Duration(seconds: 7));
      expect(seen, hasLength(1));
      async.elapse(const Duration(seconds: 1));
      expect(seen.last, isA<StorePurchased>());
    });
  });

  test('cancel and error modes', () async {
    final canceled = open(FakeStoreMode.cancel, MemoryLedger());
    await canceled.store.buy(lifetimeProduct);
    await pumpEventQueue();
    expect(canceled.seen.single, isA<StoreCanceled>());
    final failed = open(FakeStoreMode.error, MemoryLedger());
    await failed.store.buy(lifetimeProduct);
    await pumpEventQueue();
    expect(failed.seen.single, isA<StoreFailed>());
  });

  test('unavailable and offline modes load no product', () async {
    expect(
      await open(FakeStoreMode.unavailable, MemoryLedger()).store.loadProduct(),
      isA<ProductNotFound>(),
    );
    expect(
      await open(FakeStoreMode.offline, MemoryLedger()).store.loadProduct(),
      isA<StoreUnavailable>(),
    );
  });

  test('without the local signer the purchase fails, kept for later', () async {
    final ledger = MemoryLedger();
    final (:store, :seen) = open(
      FakeStoreMode.ok,
      ledger,
      signer: (_) async => throw Exception('404'),
    );
    await store.buy(lifetimeProduct);
    await pumpEventQueue();
    expect(seen.single, isA<StoreFailed>());
    final next = open(FakeStoreMode.ok, ledger);
    await pumpEventQueue();
    expect(next.seen.single, isA<StorePurchased>());
  });
}

const lifetimeProduct = Product(id: lifetimeProductId, price: '9,99 €');
