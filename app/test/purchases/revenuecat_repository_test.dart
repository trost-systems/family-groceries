import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/revenuecat_repository.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// RevenueCat's SDK as its platform channel sees it: the calls the app makes
/// and the answers of the native side. The SDK itself is not imported here
/// (rule purchases-flutter-only-in-revenuecat-repository).
class FakeRevenueCat() {
  final calls = <MethodCall>[];
  var appUserId = '';

  /// Thrown by the next purchase or restore, as RevenueCat's error code.
  int? fail;
  var transactionId = '2000000123';
  var owned = <String>[];

  Map<String, Object?> get customerInfo => {
    'entitlements': {'all': <String, Object?>{}, 'active': <String, Object?>{}},
    'allPurchaseDates': <String, Object?>{},
    'activeSubscriptions': <Object?>[],
    'allPurchasedProductIdentifiers': owned,
    'nonSubscriptionTransactions': <Object?>[],
    'firstSeen': '2026-10-31T12:00:00Z',
    'originalAppUserId': appUserId,
    'allExpirationDates': <String, Object?>{},
    'requestDate': '2026-10-31T12:00:00Z',
  };

  Future<Object?> handle(MethodCall call) async {
    calls.add(call);
    final args = call.arguments as Map<Object?, Object?>?;
    if (fail case final code? when call.method != 'getAppUserID') {
      fail = null;
      throw PlatformException(code: '$code', message: 'RevenueCat error');
    }
    switch (call.method) {
      case 'setupPurchases':
        appUserId = args!['appUserId']! as String;
        return null;
      case 'getAppUserID':
        return appUserId;
      case 'logIn':
        appUserId = args!['appUserID']! as String;
        return {'customerInfo': customerInfo, 'created': false};
      case 'getProductInfo':
        return [
          {
            'identifier': lifetimeProductId,
            'description': 'Hummlist Lifetime',
            'title': 'Hummlist Lifetime',
            'price': 9.99,
            'priceString': '9,99 €',
            'currencyCode': 'EUR',
            'productCategory': 'NON_SUBSCRIPTION',
          },
        ];
      case 'purchaseProduct':
        return {
          'customerInfo': customerInfo,
          'transaction': {
            'transactionIdentifier': transactionId,
            'productIdentifier': lifetimeProductId,
            'purchaseDate': '2026-10-31T12:00:00Z',
          },
        };
      case 'restorePurchases':
        return customerInfo;
    }
    throw MissingPluginException(call.method);
  }

  List<String> get methods => [for (final c in calls) c.method];
}

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

  test('configured on the first call, with the household and no device '
      'identifiers', () async {
    final load = await repository().loadProduct('home');
    expect(
      load,
      isA<ProductLoaded>()
          .having((l) => l.householdId, 'for', 'home')
          .having((l) => l.product.price, 'price', '9,99 €'),
    );
    final setup = native.calls.first;
    expect(setup.method, 'setupPurchases');
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

  test('another household logs in as that household first', () async {
    final store = repository();
    await store.loadProduct('home');
    await store.loadProduct('home');
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
    await store.restore('other');
    final logIn = native.calls.singleWhere((c) => c.method == 'logIn');
    expect(logIn.arguments, {'appUserID': 'other'});
    expect(
      native.methods.indexOf('logIn'),
      lessThan(native.methods.indexOf('restorePurchases')),
    );
  });

  test('two loads at once configure once', () async {
    final store = repository();
    await Future.wait([store.loadProduct('home'), store.loadProduct('home')]);
    expect(native.methods.where((m) => m == 'setupPurchases'), hasLength(1));
    expect(native.methods, isNot(contains('logIn')));
  });

  test('bought: the store transaction the webhook names', () async {
    final store = repository();
    final load = await store.loadProduct('home') as ProductLoaded;
    final bought = await store.buy('home', load.product);
    expect(
      bought,
      isA<Bought>()
          .having((b) => b.transaction?.store, 'store', AppStore.apple)
          .having((b) => b.transaction?.id, 'id', '2000000123'),
    );
  });

  test('bought without a transaction id: nothing to claim', () async {
    native.transactionId = '';
    final store = repository();
    final load = await store.loadProduct('home') as ProductLoaded;
    expect(
      await store.buy('home', load.product),
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
      final store = repository();
      final load = await store.loadProduct('home') as ProductLoaded;
      native.fail = code;
      expect(await store.buy('home', load.product), outcome);
    });
  }

  test('any other error keeps its name', () async {
    final store = repository();
    final load = await store.loadProduct('home') as ProductLoaded;
    native.fail = 2;
    expect(
      await store.buy('home', load.product),
      isA<StoreFailed>().having((f) => f.code, 'code', 'storeProblemError'),
    );
  });

  test('restore: the household has the purchase, or not', () async {
    final store = repository();
    expect(await store.restore('home'), isA<NothingToRestore>());
    native.owned = [lifetimeProductId];
    expect(await store.restore('home'), isA<Restored>());
    native.fail = 7;
    expect(await store.restore('home'), isA<BelongsElsewhere>());
  });

  test('the product offline or missing', () async {
    native.fail = 10;
    expect(await repository().loadProduct('home'), isA<StoreUnavailable>());
    native.fail = 23;
    expect(await repository().loadProduct('home'), isA<ProductNotFound>());
  });

  test(
    'only these calls, never attributes, identifiers, logOut or sync',
    () async {
      final store = repository();
      final load = await store.loadProduct('home') as ProductLoaded;
      await store.buy('home', load.product);
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
