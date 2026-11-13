import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/revenuecat_repository.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../household/harness.dart' show TestSession, inHome;
import 'fake_revenuecat.dart';
import 'fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeRevenueCat native;
  const peter = RevenueCatUserId('peter');
  const lea = RevenueCatUserId('lea');

  setUp(() {
    native = FakeRevenueCat();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('purchases_flutter'),
          native.handle,
        );
  });

  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('purchases_flutter'),
          null,
        ),
  );

  RevenueCatRepository repository() =>
      RevenueCatRepository('appl_public', native.noteCustomer);

  test('built, it talks to no one', () {
    repository();
    expect(native.calls, isEmpty);
    expect(native.notes, isEmpty);
  });

  test('Buy and Restore note the account on the server before any SDK '
      'call', () async {
    final store = repository();
    await store.buy(peter, PremiumPlan.lifetime);
    expect(native.notes, [0]);
    native.calls.clear();
    await store.restore(peter);
    expect(native.notes, [0, 0]);
  });

  test('without the note, RevenueCat never hears of the account', () async {
    final store = repository();
    native.noteFails = true;
    expect(await store.buy(peter, PremiumPlan.yearly), isA<StoreOffline>());
    native.noteFails = true;
    expect(await store.restore(peter), isA<StoreOffline>());
    expect(native.notes, [0, 0]);
    expect(native.calls, isEmpty);
    expect(await store.restore(peter), isA<NothingToRestore>());
    expect(native.methods, ['setupPurchases', 'restorePurchases']);
  });

  test('Buy: configured with the user and no device identifiers, then '
      'the product, then the purchase', () async {
    final bought = await repository().buy(peter, PremiumPlan.lifetime);
    expect(bought, isA<Bought>());
    expect(native.methods, [
      'setupPurchases',
      'getProductInfo',
      'purchaseProduct',
    ]);
    final setup = native.calls.first;
    expect(setup.arguments, containsPair('apiKey', 'appl_public'));
    expect(setup.arguments, containsPair('appUserId', 'peter'));
    expect(
      setup.arguments,
      containsPair('automaticDeviceIdentifierCollectionEnabled', false),
    );
    expect(setup.arguments, containsPair('diagnosticsEnabled', false));
    expect(
      native.calls[1].arguments,
      containsPair('type', 'nonSubscription'),
      reason: 'Lifetime is a one-time product on Play',
    );
  });

  test('Restore: configured with the user, then the restore', () async {
    await repository().restore(peter);
    expect(native.methods, ['setupPurchases', 'restorePurchases']);
    expect(native.calls.first.arguments, containsPair('appUserId', 'peter'));
  });

  test('restore on a new device: the same user finds their purchase', () async {
    await repository().buy(peter, PremiumPlan.yearly);
    native.calls.clear();
    // A new phone: a fresh app, the SDK configured anew, the same account.
    final newDevice = repository();
    expect(await newDevice.restore(peter), isA<Restored>());
    expect(native.methods, ['setupPurchases', 'restorePurchases']);
    expect(native.calls.first.arguments, containsPair('appUserId', 'peter'));
    expect(
      await repository().restore(lea),
      isA<NothingToRestore>(),
      reason: "Lea's phone finds nothing of Peter's purchase",
    );
  });

  test('another account on this device logs in as that user first', () async {
    final store = repository();
    await store.buy(peter, PremiumPlan.lifetime);
    await store.buy(peter, PremiumPlan.lifetime);
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
    native.calls.clear();
    await store.restore(lea);
    expect(native.methods, ['getAppUserID', 'logIn', 'restorePurchases']);
    expect(native.calls[1].arguments, {'appUserID': 'lea'});
    native.calls.clear();
    await store.buy(peter, PremiumPlan.lifetime);
    expect(native.methods, [
      'getAppUserID',
      'logIn',
      'getProductInfo',
      'purchaseProduct',
    ]);
  });

  test('two taps at once configure once', () async {
    final store = repository();
    await Future.wait([store.restore(peter), store.restore(peter)]);
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
  });

  test('a failed configure is tried again on the next tap', () async {
    final store = repository();
    native
      ..fail = 10
      ..failAt = 'setupPurchases';
    expect(await store.buy(peter, PremiumPlan.lifetime), isA<StoreOffline>());
    expect(await store.buy(peter, PremiumPlan.lifetime), isA<Bought>());
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(2));
  });

  const buyErrors = <int, Matcher>{
    1: TypeMatcher<Canceled>(),
    20: TypeMatcher<Pending>(),
    7: TypeMatcher<BelongsElsewhere>(),
    13: TypeMatcher<BelongsElsewhere>(),
    10: TypeMatcher<StoreOffline>(),
    35: TypeMatcher<StoreOffline>(),
  };
  for (final MapEntry(key: code, value: outcome) in buyErrors.entries) {
    test('a purchase failing with RevenueCat error $code', () async {
      native
        ..fail = code
        ..failAt = 'purchaseProduct';
      expect(await repository().buy(peter, PremiumPlan.lifetime), outcome);
    });
  }

  test('any other error keeps its name', () async {
    native
      ..fail = 2
      ..failAt = 'purchaseProduct';
    expect(
      await repository().buy(peter, PremiumPlan.lifetime),
      isA<StoreFailed>().having((f) => f.code, 'code', 'storeProblemError'),
    );
  });

  test('restore: the user has the purchase, or not', () async {
    final store = repository();
    expect(await store.restore(peter), isA<NothingToRestore>());
    native.owned['peter'] = [lifetimeProductId];
    expect(await store.restore(peter), isA<Restored>());
    native
      ..fail = 7
      ..failAt = 'restorePurchases';
    expect(await store.restore(peter), isA<BelongsElsewhere>());
  });

  test('the product offline or missing: no purchase sheet', () async {
    native
      ..fail = 10
      ..failAt = 'getProductInfo';
    expect(
      await repository().buy(peter, PremiumPlan.lifetime),
      isA<StoreOffline>(),
    );
    native
      ..fail = 23
      ..failAt = 'getProductInfo';
    expect(
      await repository().buy(peter, PremiumPlan.lifetime),
      isA<ProductMissing>(),
    );
    expect(native.methods, isNot(contains('purchaseProduct')));
  });

  test(
    'only these calls, never attributes, identifiers, logOut or sync',
    () async {
      final store = repository();
      await store.buy(peter, PremiumPlan.lifetime);
      await store.restore(lea);
      expect(native.methods.toSet(), {
        'setupPurchases',
        'getAppUserID',
        'logIn',
        'getProductInfo',
        'purchaseProduct',
        'restorePurchases',
      });
    },
  );

  group('the yearly plan (job 49)', () {
    test('loaded by id as a subscription, then bought', () async {
      expect(await repository().buy(peter, PremiumPlan.yearly), isA<Bought>());
      expect(native.methods, [
        'setupPurchases',
        'getProductInfo',
        'purchaseProduct',
      ]);
      expect(
        native.calls[1].arguments,
        containsPair('productIdentifiers', [yearlyProductId]),
      );
      expect(native.calls[1].arguments, containsPair('type', 'subscription'));
      expect(
        native.calls[2].arguments,
        containsPair('productIdentifier', yearlyProductId),
      );
    });

    test("Play's subscription:basePlan id is the yearly plan", () async {
      native.products = {'$yearlyProductId:$playBasePlanId'};
      expect(
        await RevenueCatRepository(
          'goog_public',
          native.noteCustomer,
        ).buy(peter, PremiumPlan.yearly),
        isA<Bought>(),
      );
      expect(native.calls.last.method, 'purchaseSubscriptionOption');
      expect(
        native.calls.last.arguments,
        containsPair('optionIdentifier', playBasePlanId),
      );
    });

    test('on Play the base plan, the price the page shows, never a trial '
        "RevenueCat's default option would pick", () async {
      native
        ..products = {'$yearlyProductId:$playBasePlanId'}
        ..trialOffer = true;
      expect(
        await RevenueCatRepository(
          'goog_public',
          native.noteCustomer,
        ).buy(peter, PremiumPlan.yearly),
        isA<Bought>(),
      );
      expect(native.calls.last.method, 'purchaseSubscriptionOption');
      expect(
        native.calls.last.arguments,
        allOf(
          containsPair('productIdentifier', yearlyProductId),
          containsPair('optionIdentifier', playBasePlanId),
        ),
      );
    });

    test('a storefront without Lifetime: the yearly plan still sells, Lifetime '
        'is missing without a crash', () async {
      native.products = {yearlyProductId};
      final store = repository();
      expect(
        await store.buy(peter, PremiumPlan.lifetime),
        isA<ProductMissing>(),
      );
      expect(await store.buy(peter, PremiumPlan.yearly), isA<Bought>());
    });

    test('restore finds a yearly plan too', () async {
      native.owned['peter'] = ['$yearlyProductId:$playBasePlanId'];
      expect(await repository().restore(peter), isA<Restored>());
    });

    test(
      'a lapsed yearly plan restores nothing: no unlock to wait for',
      () async {
        native.lapsed['peter'] = [
          '$yearlyProductId:$playBasePlanId',
          yearlyProductId,
        ];
        expect(await repository().restore(peter), isA<NothingToRestore>());
        native.owned['peter'] = [yearlyProductId];
        expect(await repository().restore(peter), isA<Restored>());
      },
    );

    test(
      'a yearly plan another account has (receipt in use): elsewhere',
      () async {
        native
          ..fail = 7
          ..failAt = 'purchaseProduct';
        expect(
          await repository().buy(peter, PremiumPlan.yearly),
          isA<BelongsElsewhere>(),
        );
      },
    );
  });

  test('one user in two households: Buy in one, Restore in the other, and '
      'RevenueCat knows only the user, configured once', () async {
    final session = TestSession(inHome);
    addTearDown(session.close);
    final p = TestPurchases(session: session, sdk: repository());
    addTearDown(p.close);
    expect(p.purchases.state.flow, isA<FlowIdle>());
    await pumpEventQueue();
    native
      ..fail = 1
      ..failAt = 'purchaseProduct';
    await p.purchases.buy(PremiumPlan.yearly);
    expect(
      p.purchases.state.flow,
      isA<FlowCanceled>(),
      reason: 'a purchase still unlocking would keep Restore off',
    );
    await session.join('ABCD2345');
    await pumpEventQueue();
    expect(p.entitlements.householdId, 'other');
    await p.purchases.restore();
    expect(native.methods, [
      'setupPurchases',
      'getProductInfo',
      'purchaseProduct',
      'getAppUserID',
      'restorePurchases',
    ], reason: 'no logIn: switching households is no account switch');
    expect(native.calls.first.arguments, containsPair('appUserId', 'peter'));
    expect(native.appUserId, 'peter');
  });
}
