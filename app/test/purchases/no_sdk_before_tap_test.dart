import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/revenuecat_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fake_revenuecat.dart';
import 'fakes.dart';

/// Legal Review H-67: RevenueCat's SDK (configure, logIn, products, customer
/// info) starts only on a tap on Buy or Restore. The real repository over
/// the SDK's mocked platform channel, which records every call.
void main() {
  setUpAll(fakeSupabase);

  Finder key(String k) => find.byKey(ValueKey(k));

  late FakeRevenueCat native;
  setUp(() => native = FakeRevenueCat());

  Future<More> start(WidgetTester tester, {String location = morePath}) {
    mockRevenueCat(native);
    return pumpMore(
      tester,
      location: location,
      sdk: RevenueCatRepository(AppStore.apple, 'appl_public'),
    );
  }

  testWidgets('app start and the More tab make no SDK call', (tester) async {
    final more = await start(tester);
    await tester.pumpAndSettle();
    expect(key('more-screen'), findsOneWidget);
    expect(more.purchases.entitlements.canOffer(Entitlement.lifetime), isTrue);
    expect(native.calls, isEmpty);
  });

  testWidgets('opening, rebuilding, leaving and coming back to the Lifetime '
      'page make no SDK call', (tester) async {
    final more = await start(tester, location: lifetimePath);
    await tester.pumpAndSettle();
    expect(key('lifetime-buy'), findsOneWidget);
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(lifetimePath);
    await tester.pumpAndSettle();
    expect(key('lifetime-buy'), findsOneWidget);
    expect(native.calls, isEmpty);
  });

  testWidgets('Buy configures with the household, then loads the product, '
      'then opens the purchase', (tester) async {
    await start(tester, location: lifetimePath);
    await tester.pumpAndSettle();
    await tester.tap(key('lifetime-buy'));
    await tester.pumpAndSettle();
    expect(native.methods, [
      'setupPurchases',
      'getProductInfo',
      'purchaseProduct',
    ]);
    expect(native.calls.first.arguments, containsPair('appUserId', 'home'));
    // "Unlocking" waits for an unlock that never comes here.
    await tester.pump(unlockWait);
  });

  testWidgets('Restore configures with the household, then restores', (
    tester,
  ) async {
    await start(tester, location: lifetimePath);
    await tester.pumpAndSettle();
    await tester.tap(key('lifetime-restore'));
    await tester.pumpAndSettle();
    expect(native.methods, ['setupPurchases', 'restorePurchases']);
    expect(native.calls.first.arguments, containsPair('appUserId', 'home'));
  });

  testWidgets('an unlocked household never reaches the SDK', (tester) async {
    mockRevenueCat(native);
    await pumpMore(
      tester,
      location: lifetimePath,
      sdk: RevenueCatRepository(AppStore.apple, 'appl_public'),
      entitlements: FakeEntitlementsSource(unlockedNow: true),
    );
    await tester.pumpAndSettle();
    expect(key('lifetime-buy'), findsNothing);
    expect(native.calls, isEmpty);
  });
}
