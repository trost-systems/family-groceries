import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';

import '../household/harness.dart' show TestSession;
import 'fakes.dart';

const home = InHousehold('peter', Household(id: 'home', name: 'Zuhause'));

/// The cubit as the app starts it, in [session], answers settled.
Future<TestPurchases> started({
  Session session = home,
  FakePurchaseRepository? store,
  FakePurchaseApi? api,
  FakeEntitlementsSource? rows,
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
  expect(purchases.purchases.state.flow, isA<FlowIdle>());
  await pumpEventQueue();
  return purchases;
}

void main() {
  group('the product', () {
    for (final load in const [
      ProductLoaded(lifetime),
      ProductNotFound(),
      StoreUnavailable(),
      PurchasesUnsupported(),
    ]) {
      test('${load.runtimeType} is what the store said', () async {
        final p = await started(store: FakePurchaseRepository(product: load));
        expect(p.purchases.state.product, same(load));
      });
    }

    test('retry loads it again once the store has it', () async {
      final store = FakePurchaseRepository(product: const ProductNotFound());
      final p = await started(store: store);
      store.product = const ProductLoaded(lifetime);
      await p.purchases.retry();
      expect(p.purchases.state.product, isA<ProductLoaded>());
    });
  });

  group('buying', () {
    test('a granted purchase is finished and unlocks the household', () async {
      final rows = FakeEntitlementsSource();
      final api = FakePurchaseApi()..onGrant = () => rows.unlockedNow = true;
      final p = await started(api: api, rows: rows);
      expect(p.entitlements.isUnlocked, isFalse);
      await p.purchases.buy();
      expect(p.purchases.state.flow, isA<FlowBuying>());
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(api.calls.single.$1.data, 'jws-1');
      expect(api.calls.single.$2, PurchaseSource.purchase);
      expect(p.repository.finished.map((f) => f.data), ['jws-1']);
      expect(p.entitlements.isUnlocked, isTrue);
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('a second tap while buying starts nothing', () async {
      final p = await started();
      await p.purchases.buy();
      await p.purchases.buy();
      expect(p.repository.buys, 1);
    });

    test('a tap while verifying starts nothing', () async {
      final api = FakePurchaseApi()..hold = true;
      final p = await started(api: api);
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowVerifying>());
      await p.purchases.buy();
      expect(p.repository.buys, 0);
    });

    test('Ask to Buy waits, then the approved purchase verifies', () async {
      final p = await started();
      await p.purchases.buy();
      p.repository.send(const StorePending());
      expect(p.purchases.state.flow, isA<FlowAwaitingApproval>());
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(p.repository.finished, hasLength(1));
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('canceled in the store sheet', () async {
      final p = await started();
      await p.purchases.buy();
      p.repository.send(const StoreCanceled());
      expect(p.purchases.state.flow, isA<FlowCanceled>());
      await p.purchases.buy();
      expect(p.repository.buys, 2, reason: 'buy again after a cancel');
    });

    test('the store fails the purchase', () async {
      final p = await started();
      await p.purchases.buy();
      p.repository.send(const StoreFailed('E42'));
      expect(
        p.purchases.state.flow,
        isA<FlowFailed>()
            .having((f) => f.kind, 'kind', FailureKind.store)
            .having((f) => f.code, 'code', 'E42'),
      );
    });

    test('the store refuses to start', () async {
      final store = FakePurchaseRepository()
        ..refuse = const StoreError('storekit_duplicate_product_object');
      final p = await started(store: store);
      await p.purchases.buy();
      expect(
        p.purchases.state.flow,
        isA<FlowFailed>().having(
          (f) => f.code,
          'code',
          'storekit_duplicate_product_object',
        ),
      );
    });

    test('without a product there is nothing to buy', () async {
      final p = await started(
        store: FakePurchaseRepository(product: const ProductNotFound()),
      );
      await p.purchases.buy();
      expect(p.repository.buys, 0);
    });
  });

  group('finished only after the final word', () {
    const definitive = {
      VerifyOutcome.granted: FlowIdle,
      VerifyOutcome.restored: FlowIdle,
      VerifyOutcome.usedElsewhere: FlowUsedElsewhere,
      VerifyOutcome.revoked: FlowRefunded,
      VerifyOutcome.refunded: FlowRefunded,
    };
    for (final MapEntry(key: outcome, value: flow) in definitive.entries) {
      test('${outcome.wire}: finished, $flow', () async {
        final p = await started(
          api: FakePurchaseApi(answer: Verified(outcome)),
        );
        p.repository.send(paid('jws-1'));
        await pumpEventQueue();
        expect(p.repository.finished, hasLength(1));
        expect(p.purchases.state.flow.runtimeType, flow);
      });
    }

    const open = <Verification, Object>{
      VerificationPending(): FlowAwaitingApproval,
      VerificationFailed(VerifyProblem.offline, 'offline'): FailureKind.offline,
      VerificationFailed(VerifyProblem.rateLimited, 'rate_limited'):
          FailureKind.rateLimited,
      VerificationFailed(VerifyProblem.server, 'store_unavailable'):
          FailureKind.server,
      VerificationFailed(VerifyProblem.server, 'not_configured'):
          FailureKind.server,
      VerificationFailed(VerifyProblem.session, 'invalid_token'):
          FailureKind.server,
    };
    for (final MapEntry(key: answer, value: shown) in open.entries) {
      test('$answer: unfinished, verified again on retry', () async {
        final api = FakePurchaseApi(answer: answer);
        final p = await started(api: api);
        p.repository.send(paid('jws-1'));
        await pumpEventQueue();
        expect(p.repository.finished, isEmpty);
        expect(switch (p.purchases.state.flow) {
          FlowFailed(:final kind) => kind,
          final other => other.runtimeType,
        }, shown);
        api.answer = const Verified(VerifyOutcome.granted);
        await p.purchases.retry();
        expect(api.calls, hasLength(2));
        expect(p.repository.finished, hasLength(1));
        expect(p.purchases.state.flow, isA<FlowIdle>());
        await p.purchases.retry();
        expect(api.calls, hasLength(2), reason: 'nothing left to verify');
      });
    }

    test('a transaction handed over twice is verified as one', () async {
      final api = FakePurchaseApi()..hold = true;
      final p = await started(api: api);
      p.repository
        ..send(paid('jws-1'))
        ..send(paid('jws-1'));
      await pumpEventQueue();
      api.pending.single.complete(const Verified(VerifyOutcome.granted));
      await pumpEventQueue();
      expect(api.calls, hasLength(1));
      expect(p.repository.finished, hasLength(1));
    });
  });

  group('a refused proof', () {
    test('is finished, not accepted, and never sent again', () async {
      final api = FakePurchaseApi(
        answer: const VerificationRefused('bad_signature'),
      );
      final p = await started(session: const NeedsHousehold('peter'), api: api);
      p.repository.send(paid('jws-1'));
      await (p.session as TestSession).createHousehold('Zuhause');
      await pumpEventQueue();
      expect(api.calls, hasLength(1));
      expect(p.repository.finished.map((f) => f.data), ['jws-1']);
      expect(
        p.purchases.state.flow,
        isA<FlowNotAccepted>().having((f) => f.code, 'code', 'bad_signature'),
      );
      api.answer = const Verified(VerifyOutcome.granted);
      await p.purchases.retry();
      await (p.session as TestSession).join('ABC123');
      await pumpEventQueue();
      expect(api.calls, hasLength(1), reason: 'the answer stays the same');
      expect(p.purchases.state.flow, isA<FlowNotAccepted>());
    });

    test('next to an offline one: only the offline one goes again', () async {
      final api = FakePurchaseApi()..hold = true;
      final p = await started(api: api);
      p.repository
        ..send(paid('jws-refused'))
        ..send(paid('jws-offline'));
      await pumpEventQueue();
      api.pending.removeAt(0).complete(const VerificationRefused('wrong_app'));
      await pumpEventQueue();
      api.pending
          .removeAt(0)
          .complete(const VerificationFailed(VerifyProblem.offline, 'offline'));
      await pumpEventQueue();
      expect(p.repository.finished.map((f) => f.data), ['jws-refused']);
      api.hold = false;
      await p.purchases.retry();
      expect(api.calls.map((c) => c.$1.data), [
        'jws-refused',
        'jws-offline',
        'jws-offline',
      ]);
      expect(p.repository.finished.map((f) => f.data), [
        'jws-refused',
        'jws-offline',
      ]);
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('a restore sends it again, and a grant then unlocks', () async {
      // Finishing a refused proof never loses a purchase that verifies
      // later, e.g. once the server accepts another environment.
      final rows = FakeEntitlementsSource();
      final api = FakePurchaseApi(
        answer: const VerificationRefused('wrong_environment'),
      )..onGrant = () => rows.unlockedNow = true;
      final p = await started(api: api, rows: rows);
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowNotAccepted>());
      api.answer = const Verified(VerifyOutcome.restored);
      p.repository.owned = [
        paid('jws-1', source: PurchaseSource.restore, alreadyFinished: true),
      ];
      await p.purchases.restore();
      await pumpEventQueue();
      expect(api.calls.map((c) => (c.$1.data, c.$2)), [
        ('jws-1', PurchaseSource.purchase),
        ('jws-1', PurchaseSource.restore),
      ]);
      expect(p.entitlements.isUnlocked, isTrue);
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('is not handed over again at the next start', () async {
      final ledger = MemoryLedger();
      final api = FakePurchaseApi(
        answer: const VerificationRefused('wrong_environment'),
      );
      final session = TestSession(home);
      addTearDown(session.close);
      Future<PurchaseCubit> launch() async {
        final entitlements = Entitlements(FakeEntitlementsSource(), session);
        final cubit = PurchaseCubit(
          FakeStore(FakeStoreMode.ok, sign: fakeSign, ledger: ledger),
          api,
          entitlements,
          session,
        );
        addTearDown(entitlements.close);
        addTearDown(cubit.close);
        await pumpEventQueue();
        return cubit;
      }

      final first = await launch();
      await first.buy();
      await pumpEventQueue();
      expect(first.state.flow, isA<FlowNotAccepted>());
      await first.close();
      await launch();
      expect(api.calls, hasLength(1), reason: 'the store kept it finished');
    });

    test('is not sent again when the store fails to finish it', () async {
      final store = FakePurchaseRepository()
        ..failFinish = Exception('channel closed');
      final api = FakePurchaseApi(answer: const VerificationRefused('forged'));
      final p = await started(store: store, api: api);
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowNotAccepted>());
      await p.purchases.retry();
      expect(api.calls, hasLength(1));
    });
  });

  group('at start', () {
    test('an unfinished purchase of an earlier session is granted', () async {
      final rows = FakeEntitlementsSource();
      final api = FakePurchaseApi()..onGrant = () => rows.unlockedNow = true;
      final p = await started(api: api, rows: rows);
      p.repository.send(paid('jws-killed'));
      await pumpEventQueue();
      expect(p.repository.finished.single.data, 'jws-killed');
      expect(p.entitlements.isUnlocked, isTrue);
    });

    test('without a household purchases wait unverified for one', () async {
      final api = FakePurchaseApi();
      final p = await started(session: const NeedsHousehold('peter'), api: api);
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(api.calls, isEmpty);
      expect(p.repository.finished, isEmpty);
      expect(p.repository.recoveries, 0);
      await (p.session as TestSession).createHousehold('Zuhause');
      await pumpEventQueue();
      expect(api.calls, hasLength(1));
      expect(p.repository.finished, hasLength(1));
    });

    test(
      'recovers unfinished store transactions once, in a household',
      () async {
        final p = await started();
        expect(p.repository.recoveries, 1);
      },
    );

    test('a recovery skips purchases the store already completed', () async {
      final api = FakePurchaseApi();
      final p = await started(api: api);
      p.repository
        ..send(
          paid('acked', source: PurchaseSource.restore, alreadyFinished: true),
        )
        ..send(paid('unacked', source: PurchaseSource.restore));
      await pumpEventQueue();
      expect(api.calls.map((c) => c.$1.data), ['unacked']);
    });
  });

  group('restoring', () {
    test('restores an earlier purchase', () async {
      final api = FakePurchaseApi(
        answer: const Verified(VerifyOutcome.restored),
      );
      final store = FakePurchaseRepository()
        ..owned = [
          paid(
            'jws-old',
            source: PurchaseSource.restore,
            alreadyFinished: true,
          ),
        ];
      final p = await started(api: api, store: store);
      await p.purchases.restore();
      await pumpEventQueue();
      expect(api.calls.single.$2, PurchaseSource.restore);
      expect(p.purchases.state.flow, isA<FlowIdle>());
    });

    test('says so when there is nothing to restore', () {
      fakeAsync((async) {
        late TestPurchases p;
        unawaited(started().then((value) => p = value));
        async.elapse(Duration.zero);
        unawaited(p.purchases.restore());
        async.flushMicrotasks();
        expect(p.purchases.state.flow, isA<FlowRestoring>());
        async.elapse(restoreGrace);
        expect(p.purchases.state.flow, isA<FlowNothingRestored>());
      });
    });

    test('a store error ends the restore', () async {
      final store = FakePurchaseRepository()
        ..refuse = const StoreError('restore_failed');
      final p = await started(store: store);
      await p.purchases.restore();
      expect(p.purchases.state.flow, isA<FlowFailed>());
    });

    test(
      'allowed while a purchase awaits approval, not while buying',
      () async {
        final p = await started();
        await p.purchases.buy();
        await p.purchases.restore();
        expect(p.repository.restores, 0);
        p.repository.send(const StorePending());
        await p.purchases.restore();
        expect(p.repository.restores, 1);
      },
    );
  });

  test('a purchase awaiting approval can be asked for again', () async {
    // iOS never reports a declined Ask to Buy request.
    final p = await started();
    await p.purchases.buy();
    p.repository.send(const StorePending());
    await Future<void>.value();
    expect(p.purchases.state.flow, isA<FlowAwaitingApproval>());
    await p.purchases.buy();
    expect(p.repository.buys, 2);
  });

  test(
    'a store that fails to finish does not leave the page verifying',
    () async {
      final store = FakePurchaseRepository()
        ..failFinish = Exception('channel closed');
      final p = await started(store: store);
      p.repository.send(paid('jws-1'));
      await pumpEventQueue();
      expect(p.purchases.state.flow, isA<FlowIdle>());
      expect(
        p.repository.finished,
        isEmpty,
        reason: 'unfinished: the store resends it',
      );
      await p.purchases.buy();
      expect(p.repository.buys, 1, reason: 'Buy works again');
    },
  );
}
