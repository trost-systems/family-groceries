import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';

import '../household/harness.dart' show TestSession;
import 'fakes.dart';

const home = InHousehold('peter', Household(id: 'home', name: 'Zuhause'));

/// The cubit as the app has it, answers settled; [open] opens the Lifetime
/// page.
Future<TestPurchases> started({
  Session session = home,
  FakePurchaseRepository? store,
  FakeClaimApi? api,
  FakeEntitlementsSource? rows,
  bool open = true,
}) async {
  final testSession = TestSession(session);
  addTearDown(testSession.close);
  final purchases = TestPurchases(
    session: testSession,
    store: store,
    api: api,
    source: rows,
  );
  addTearDown(purchases.close);
  await pumpEventQueue();
  if (open) {
    purchases.purchases.pageOpened();
    await pumpEventQueue();
  }
  return purchases;
}

void main() {
  group('the store is asked only on the page, only when locked', () {
    test('nothing before the page opens', () async {
      final p = await started(open: false);
      expect(p.repository.loads, isEmpty);
      expect(p.purchases.state.product, isNull);
      p.purchases.pageOpened();
      await pumpEventQueue();
      expect(p.repository.loads, ['home']);
      expect(
        p.purchases.state.product,
        isA<ProductLoaded>().having((l) => l.householdId, 'for', 'home'),
      );
    });

    test('never for an unlocked household', () async {
      final p = await started(rows: FakeEntitlementsSource(unlockedNow: true));
      await p.purchases.restore();
      await p.purchases.buy();
      expect(p.repository.loads, isEmpty);
      expect(p.repository.restores, isEmpty);
      expect(p.repository.buys, isEmpty);
    });

    test('not while the unlock is unknown; once it is known locked', () async {
      final rows = FakeEntitlementsSource()..offline = true;
      final p = await started(rows: rows);
      await p.purchases.restore();
      expect(p.repository.loads, isEmpty);
      expect(p.repository.restores, isEmpty);
      rows
        ..offline = false
        ..change();
      await pumpEventQueue();
      expect(p.repository.loads, ['home']);
    });

    test('once per household, again for the next one', () async {
      final p = await started();
      p.purchases
        ..pageClosed()
        ..pageOpened();
      await pumpEventQueue();
      expect(p.repository.loads, ['home']);
      await (p.session as TestSession).join('ABCD2345');
      await pumpEventQueue();
      expect(p.repository.loads, ['home', 'other']);
      expect(
        p.purchases.state.product,
        isA<ProductLoaded>().having((l) => l.householdId, 'for', 'other'),
      );
    });

    test('a build without a store answers without asking', () async {
      final p = await started(
        store: FakePurchaseRepository(withoutStore: const PurchasesNotYet()),
      );
      expect(p.repository.loads, isEmpty);
      expect(p.purchases.state.product, isA<PurchasesNotYet>());
    });

    test('retry loads it again once the store has it', () async {
      final store = FakePurchaseRepository(product: const ProductNotFound());
      final p = await started(store: store);
      store.product = null;
      p.purchases.retry();
      await pumpEventQueue();
      expect(p.purchases.state.product, isA<ProductLoaded>());
    });
  });

  group('buying', () {
    test('bought: unlocking until Supabase has the unlock', () async {
      final p = await started();
      await p.purchases.buy();
      expect(p.repository.buys, ['home']);
      expect(p.purchases.state.flow, isA<FlowUnlocking>());
      p.unlock();
      await pumpEventQueue();
      expect(p.entitlements.has(Entitlement.lifetime), isTrue);
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test(
      'the claim is sent once, with the store and the transaction',
      () async {
        final api = FakeClaimApi();
        final p = await started(
          api: api,
          store: FakePurchaseRepository(
            bought: const Bought(
              StoreTransactionRef(AppStore.google, 'GPA.3312-5'),
            ),
          ),
        );
        await p.purchases.buy();
        await pumpEventQueue();
        expect(api.calls, hasLength(1));
        expect(api.calls.single.store, AppStore.google);
        expect(api.calls.single.id, 'GPA.3312-5');
      },
    );

    test('a purchase without a transaction id claims nothing', () async {
      final api = FakeClaimApi();
      final p = await started(
        api: api,
        store: FakePurchaseRepository(bought: const Bought(null)),
      );
      await p.purchases.buy();
      await pumpEventQueue();
      expect(api.calls, isEmpty);
      expect(p.purchases.state.flow, isA<FlowUnlocking>());
    });

    test('a claim without answer is tried again, then given up', () {
      fakeAsync((async) {
        final api = FakeClaimApi(
          answers: const [ClaimFailed(ClaimProblem.offline, 'offline')],
        );
        late TestPurchases p;
        unawaited(started(api: api).then((value) => p = value));
        async.elapse(Duration.zero);
        unawaited(p.purchases.buy());
        async.flushMicrotasks();
        expect(api.calls, hasLength(1));
        async.elapse(const Duration(seconds: 2));
        expect(api.calls, hasLength(2));
        async.elapse(const Duration(minutes: 5));
        expect(api.calls, hasLength(1 + claimBackoff.length));
      });
    });

    test('a refused claim is not sent again', () {
      fakeAsync((async) {
        final api = FakeClaimApi(
          answers: const [ClaimFailed(ClaimProblem.refused, 'no_household')],
        );
        late TestPurchases p;
        unawaited(started(api: api).then((value) => p = value));
        async.elapse(Duration.zero);
        unawaited(p.purchases.buy());
        async.elapse(const Duration(minutes: 5));
        expect(api.calls, hasLength(1));
      });
    });

    test('a claim retried until the server answers, once more', () {
      fakeAsync((async) {
        final api = FakeClaimApi(
          answers: const [
            ClaimFailed(ClaimProblem.server, '502'),
            Claimed(ClaimStatus.waiting),
          ],
        );
        late TestPurchases p;
        unawaited(started(api: api).then((value) => p = value));
        async.elapse(Duration.zero);
        unawaited(p.purchases.buy());
        async.elapse(const Duration(minutes: 5));
        expect(api.calls, hasLength(2));
      });
    });

    test(
      "the server says the transaction is elsewhere's: used elsewhere",
      () async {
        final p = await started(
          api: FakeClaimApi(answers: const [Claimed(ClaimStatus.elsewhere)]),
        );
        await p.purchases.buy();
        await pumpEventQueue();
        expect(p.purchases.state.flow, isA<FlowUsedElsewhere>());
      },
    );

    test('no unlock in time: idle again', () {
      fakeAsync((async) {
        late TestPurchases p;
        unawaited(started().then((value) => p = value));
        async.elapse(Duration.zero);
        unawaited(p.purchases.buy());
        async.flushMicrotasks();
        expect(p.purchases.state.flow, isA<FlowUnlocking>());
        async.elapse(unlockWait);
        expect(p.purchases.state.flow, isA<FlowUnlockDelayed>());
        expect(p.purchases.state.busy, isTrue, reason: 'no second purchase');
      });
    });

    test('a second tap while buying starts nothing', () async {
      final store = FakePurchaseRepository()..hold = true;
      final p = await started(store: store);
      unawaited(p.purchases.buy());
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowBuying>());
      await p.purchases.buy();
      await p.purchases.restore();
      expect(store.buys, hasLength(1));
      expect(store.restores, isEmpty);
    });

    test('Ask to Buy waits, and Buy may ask again', () async {
      final p = await started(
        store: FakePurchaseRepository(bought: const Pending()),
      );
      await p.purchases.buy();
      expect(p.purchases.state.flow, isA<FlowAwaitingApproval>());
      await p.purchases.buy();
      expect(p.repository.buys, hasLength(2));
      p.unlock();
      await pumpEventQueue();
      expect(p.entitlements.has(Entitlement.lifetime), isTrue);
    });

    const outcomes = <BuyOutcome, Object>{
      Canceled(): FlowCanceled,
      BelongsElsewhere(): FlowUsedElsewhere,
      StoreFailed('storeProblemError'): FailureKind.store,
      StoreOffline(): FailureKind.offline,
    };
    for (final MapEntry(key: outcome, value: shown) in outcomes.entries) {
      test('$outcome shows $shown, claims nothing', () async {
        final api = FakeClaimApi();
        final p = await started(
          api: api,
          store: FakePurchaseRepository(bought: outcome),
        );
        await p.purchases.buy();
        expect(switch (p.purchases.state.flow) {
          FlowFailed(:final kind) => kind,
          final other => other.runtimeType,
        }, shown);
        expect(api.calls, isEmpty);
        await p.purchases.buy();
        expect(p.repository.buys, hasLength(2), reason: 'buy again');
      });
    }

    test('the store failure keeps its code', () async {
      final p = await started(
        store: FakePurchaseRepository(bought: const StoreFailed('E42')),
      );
      await p.purchases.buy();
      expect(
        p.purchases.state.flow,
        isA<FlowFailed>().having((f) => f.code, 'code', 'E42'),
      );
      p.purchases.retry();
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('a product loaded for another household buys nothing', () async {
      final store = FakePurchaseRepository(
        product: const ProductLoaded('other', lifetime),
      );
      final p = await started(store: store);
      await p.purchases.buy();
      expect(store.buys, isEmpty);
    });

    test('without a product there is nothing to buy', () async {
      final p = await started(
        store: FakePurchaseRepository(product: const ProductNotFound()),
      );
      await p.purchases.buy();
      expect(p.repository.buys, isEmpty);
    });
  });

  group('restoring', () {
    test('restored: unlocking until Supabase has it', () async {
      final p = await started(
        store: FakePurchaseRepository(restored: const Restored()),
      );
      await p.purchases.restore();
      expect(p.repository.restores, ['home']);
      expect(p.purchases.state.flow, isA<FlowUnlocking>());
      p.unlock();
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowIdle>());
      expect(p.server.calls, isEmpty, reason: 'a restore claims nothing');
    });

    const outcomes = <RestoreOutcome, Object>{
      NothingToRestore(): FlowNothingRestored,
      BelongsElsewhere(): FlowUsedElsewhere,
      StoreFailed('configurationError'): FailureKind.store,
      StoreOffline(): FailureKind.offline,
    };
    for (final MapEntry(key: outcome, value: shown) in outcomes.entries) {
      test('$outcome shows $shown', () async {
        final p = await started(
          store: FakePurchaseRepository(restored: outcome),
        );
        await p.purchases.restore();
        expect(switch (p.purchases.state.flow) {
          FlowFailed(:final kind) => kind,
          final other => other.runtimeType,
        }, shown);
      });
    }

    test('allowed while a purchase awaits approval', () async {
      final p = await started(
        store: FakePurchaseRepository(bought: const Pending()),
      );
      await p.purchases.buy();
      await p.purchases.restore();
      expect(p.repository.restores, hasLength(1));
    });
  });

  test('another household clears what the last one showed', () async {
    final p = await started(
      store: FakePurchaseRepository(bought: const BelongsElsewhere()),
    );
    await p.purchases.buy();
    expect(p.purchases.state.flow, isA<FlowUsedElsewhere>());
    await (p.session as TestSession).join('ABCD2345');
    await pumpEventQueue();
    expect(p.purchases.state.flow, isA<FlowIdle>());
  });
}
