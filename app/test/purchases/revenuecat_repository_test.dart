import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/revenuecat_repository.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_revenuecat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeRevenueCat native;

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
      RevenueCatRepository(AppStore.apple, 'appl_public');

  test('built, it talks to no one', () {
    repository();
    expect(native.calls, isEmpty);
  });

  test('Buy: configured with the household and no device identifiers, then '
      'the product, then the purchase', () async {
    final bought = await repository().buy('home');
    expect(bought, isA<Bought>());
    expect(native.methods, [
      'setupPurchases',
      'getProductInfo',
      'purchaseProduct',
    ]);
    final setup = native.calls.first;
    expect(setup.arguments, containsPair('apiKey', 'appl_public'));
    expect(setup.arguments, containsPair('appUserId', 'home'));
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

  test('Restore: configured with the household, then the restore', () async {
    await repository().restore('home');
    expect(native.methods, ['setupPurchases', 'restorePurchases']);
    expect(native.calls.first.arguments, containsPair('appUserId', 'home'));
  });

  test('another household logs in as that household first', () async {
    final store = repository();
    await store.buy('home');
    await store.buy('home');
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
    native.calls.clear();
    await store.restore('other');
    expect(native.methods, ['getAppUserID', 'logIn', 'restorePurchases']);
    expect(native.calls[1].arguments, {'appUserID': 'other'});
    native.calls.clear();
    await store.buy('home');
    expect(native.methods, [
      'getAppUserID',
      'logIn',
      'getProductInfo',
      'purchaseProduct',
    ]);
  });

  test('two taps at once configure once', () async {
    final store = repository();
    await Future.wait([store.restore('home'), store.restore('home')]);
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
  });

  test('a failed configure is tried again on the next tap', () async {
    final store = repository();
    native
      ..fail = 10
      ..failAt = 'setupPurchases';
    expect(await store.buy('home'), isA<StoreOffline>());
    expect(await store.buy('home'), isA<Bought>());
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(2));
  });

  test('bought: the store transaction the webhook names', () async {
    expect(
      await repository().buy('home'),
      isA<Bought>()
          .having((b) => b.transaction?.store, 'store', AppStore.apple)
          .having((b) => b.transaction?.id, 'id', '2000000123'),
    );
  });

  test('bought without a transaction id: nothing to claim', () async {
    native.transactionId = '';
    expect(
      await repository().buy('home'),
      isA<Bought>().having((b) => b.transaction, 'transaction', isNull),
    );
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
      expect(await repository().buy('home'), outcome);
    });
  }

  test('any other error keeps its name', () async {
    native
      ..fail = 2
      ..failAt = 'purchaseProduct';
    expect(
      await repository().buy('home'),
      isA<StoreFailed>().having((f) => f.code, 'code', 'storeProblemError'),
    );
  });

  test('restore: the household has the purchase, or not', () async {
    final store = repository();
    expect(await store.restore('home'), isA<NothingToRestore>());
    native.owned = [lifetimeProductId];
    expect(await store.restore('home'), isA<Restored>());
    native
      ..fail = 7
      ..failAt = 'restorePurchases';
    expect(await store.restore('home'), isA<BelongsElsewhere>());
  });

  test('the product offline or missing: no purchase sheet', () async {
    native
      ..fail = 10
      ..failAt = 'getProductInfo';
    expect(await repository().buy('home'), isA<StoreOffline>());
    native
      ..fail = 23
      ..failAt = 'getProductInfo';
    expect(await repository().buy('home'), isA<ProductMissing>());
    expect(native.methods, isNot(contains('purchaseProduct')));
  });

  test(
    'only these calls, never attributes, identifiers, logOut or sync',
    () async {
      final store = repository();
      await store.buy('home');
      await store.restore('other');
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
}
