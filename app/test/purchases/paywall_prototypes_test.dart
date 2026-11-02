import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/paywall_prototypes.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

const _yearly = '9,99 € / Jahr';
const _lifetime = '29,99 € einmalig';

/// [amount] with "inkl. MwSt." after it, on its line or under it.
Matcher _withVat(String amount) => predicate<String>(
  (_) =>
      find.text('$amount inkl. MwSt.').evaluate().length == 1 ||
      find.text(amount).evaluate().length == 1 &&
          find.text('inkl. MwSt.').evaluate().isNotEmpty,
  '$amount inkl. MwSt.',
);

void main() {
  setUpAll(fakeSupabase);
  tearDown(() => paywallPrototype.value = null);

  Future<More> openPremium(
    WidgetTester tester, {
    FakePurchaseRepository? store,
  }) => pumpMore(
    tester,
    location: premiumPath,
    size: const Size(390, 2400),
    store: store,
  );

  testWidgets("the debug switch puts a prototype in the page's place", (
    tester,
  ) async {
    showPaywallPrototypeSwitch = true;
    addTearDown(() => showPaywallPrototypeSwitch = false);
    await openPremium(tester);
    expect(find.byKey(const ValueKey('lifetime-screen')), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<PaywallPrototype?>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('PW-P3 Vergleich').last);
    await tester.pumpAndSettle();

    expect(paywallPrototype.value, PaywallPrototype.p3);
    expect(find.byKey(const ValueKey('paywall-p3')), findsOneWidget);
    expect(find.byKey(const ValueKey('lifetime-screen')), findsNothing);
  });

  for (final p in PaywallPrototype.values) {
    testWidgets('${p.name}: both store prices with VAT, the disclosures, '
        'restore and the legal links; buying buys nothing', (tester) async {
      paywallPrototype.value = p;
      final store = FakePurchaseRepository();
      await openPremium(tester, store: store);

      expect(find.byKey(ValueKey('paywall-${p.name}')), findsOneWidget);
      expect(_yearly, _withVat(_yearly));
      expect(
        find.byKey(const ValueKey('paywall-terms-yearly')),
        findsOneWidget,
        reason: 'the yearly disclosures show while yearly is picked',
      );
      if (p == PaywallPrototype.p3) {
        expect(find.textContaining(_lifetime), findsNothing);
        await tester.tap(find.byKey(const ValueKey('paywall-plan-lifetime')));
        await tester.pumpAndSettle();
      }
      expect(_lifetime, _withVat(_lifetime));
      for (final key in [
        'paywall-restore',
        'paywall-terms-link',
        'paywall-privacy-link',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }

      final buy = find.byKey(
        ValueKey(
          p == PaywallPrototype.p2 ? 'paywall-buy-lifetime' : 'paywall-buy',
        ),
      );
      await tester.ensureVisible(buy);
      await tester.tap(buy);
      await tester.pump();
      expect(find.text('Prototyp: Hier wird nichts gekauft.'), findsOneWidget);
      expect(store.calls, isEmpty);
    });
  }

  testWidgets('picking Lifetime swaps the yearly disclosures for its value '
      'line', (tester) async {
    paywallPrototype.value = PaywallPrototype.p1;
    await openPremium(tester);

    await tester.tap(find.byKey(const ValueKey('paywall-plan-lifetime')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('paywall-terms-yearly')), findsNothing);
    expect(
      find.byKey(const ValueKey('paywall-terms-lifetime')),
      findsOneWidget,
    );
  });

  testWidgets('a plan the store did not price shows the marked placeholder', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('de'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: appTheme(Brightness.light),
        home: const Scaffold(
          body: PaywallPrototypeView(
            prototype: PaywallPrototype.p4,
            prices: {PremiumPlan.yearly: StorePrice('9,99 €', 'EUR')},
          ),
        ),
      ),
    );

    expect(_yearly, _withVat(_yearly));
    expect('€X,XX einmalig', _withVat('€X,XX einmalig'));
  });

  testWidgets('with PW-P5 picked, the integration lock opens it as a sheet '
      'that "Später" closes', (tester) async {
    paywallPrototype.value = PaywallPrototype.p5;
    await pumpMore(
      tester,
      location: accessPath,
      size: const Size(390, 1400),
      integrationLock: true,
      premium: FakePremiumServer(lock: true),
    );

    await tester.tap(find.byKey(const ValueKey('integration-buy')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('paywall-p5-sheet')), findsOneWidget);
    expect(_yearly, _withVat(_yearly));
    expect(find.text('Alexa bleibt kostenlos.'), findsOneWidget);
    expect(find.byKey(const ValueKey('access-screen')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('paywall-later')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('paywall-p5-sheet')), findsNothing);
  });
}
