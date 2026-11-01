import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// RevenueCat's SDK as its platform channel sees it: the calls the app makes
/// and the answers of the native side. The SDK itself is not imported here
/// (rule purchases-flutter-only-in-revenuecat-repository).
class FakeRevenueCat() {
  final calls = <MethodCall>[];
  var appUserId = '';

  /// Thrown by the next call to [failAt], as RevenueCat's error code.
  int? fail;
  var failAt = '';
  var transactionId = '2000000123';
  var owned = <String>[];

  /// The products the store has in this storefront (a yearly-only one has
  /// no Lifetime), by the id the SDK reports: Play adds the base plan.
  var products = <String>{lifetimeProductId, yearlyProductId};

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
    if (fail case final code? when call.method == failAt) {
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
        final wanted = (args!['productIdentifiers']! as List).cast<String>();
        return [
          for (final id in products)
            if (wanted.any((w) => id == w || id.startsWith('$w:')))
              {
                'identifier': id,
                'description': 'Hummlist Premium',
                'title': 'Hummlist Premium',
                'price': id == lifetimeProductId ? 29.99 : 9.99,
                'priceString': id == lifetimeProductId ? '29,99 €' : '9,99 €',
                'currencyCode': 'EUR',
                'productCategory': id == lifetimeProductId
                    ? 'NON_SUBSCRIPTION'
                    : 'SUBSCRIPTION',
              },
        ];
      case 'purchaseProduct':
        return {
          'customerInfo': customerInfo,
          'transaction': {
            'transactionIdentifier': transactionId,
            'productIdentifier': args!['productIdentifier'],
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

/// Puts [native] on RevenueCat's platform channel for the test.
void mockRevenueCat(FakeRevenueCat native) {
  const channel = MethodChannel('purchases_flutter');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        ..setMockMethodCallHandler(channel, native.handle);
  addTearDown(() => messenger.setMockMethodCallHandler(channel, null));
}
