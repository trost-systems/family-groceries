import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/revenuecat_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../analytics/fakes.dart';
import '../more/more_harness.dart';
import '../purchases/fake_revenuecat.dart';
import '../purchases/fakes.dart';

/// Job 50: the integration settings with the integration lock. The card and
/// its Buy button show only while the server enforces the lock and the
/// household is known to have no Hummlist Premium (Spec #4 AC3); existing
/// connections stay listed as paused; a purchase by any member hides it all
/// within one sync (AC4).
void main() {
  setUpAll(fakeSupabase);
  setUp(() {
    serverTokens
      ..clear()
      ..add({
        'id': 't1',
        'name': 'Kurzbefehl',
        'kind': 'pat',
        'token_hint': '1234',
        'created_at': '2026-10-02T10:00:00Z',
        'last_used_at': null,
      });
  });

  Finder key(String k) => find.byKey(ValueKey(k));

  Future<More> access(
    WidgetTester tester, {
    bool define = true,
    bool lock = true,
    bool offer = true,
    bool offerReadable = true,
    FakeEntitlementsSource? rows,
    NoSale? noSale,
    String language = 'de',
  }) => pumpMore(
    tester,
    location: accessPath,
    size: const Size(390, 1600),
    integrationLock: define,
    premium: FakePremiumServer(lock: lock, offer: offer)
      ..offerFails = !offerReadable,
    entitlements: rows,
    store: FakePurchaseRepository(withoutStore: noSale),
    device: [Locale(language)],
  );

  testWidgets('locked: what is included, Buy, and the token paused, not gone', (
    tester,
  ) async {
    final more = await access(tester);
    expect(key('integration-premium'), findsOneWidget);
    expect(find.text('Teil von Hummlist Premium'), findsOneWidget);
    expect(find.text('Siri auf dem iPhone'), findsOneWidget);
    expect(find.text('Alexa-Skill'), findsOneWidget);
    expect(
      find.text('KI-Assistenten wie ChatGPT oder Claude (MCP)'),
      findsOneWidget,
    );
    expect(key('integration-buy'), findsOneWidget);
    expect(find.text('Kurzbefehl'), findsOneWidget, reason: 'still listed');
    expect(key('access-paused'), findsOneWidget);
    expect(
      find.byTooltip('Kurzbefehl widerrufen'),
      findsOneWidget,
      reason: 'the usual actions only, nothing because of the lock',
    );
    expect(more.purchases.premium.calls, containsAll(['lock', 'offer']));
  });

  testWidgets('English', (tester) async {
    await access(tester, language: 'en');
    expect(find.text('Part of Hummlist Premium'), findsOneWidget);
    expect(find.text('Unlock Hummlist Premium'), findsOneWidget);
    expect(find.text('Paused: needs Hummlist Premium'), findsOneWidget);
  });

  testWidgets('Buy opens the Premium page, marked as from the integrations', (
    tester,
  ) async {
    final more = await access(tester);
    await tester.tap(key('integration-buy'));
    await tester.pumpAndSettle();
    expect(
      more.router.routerDelegate.currentConfiguration.uri.toString(),
      '$premiumPath?from=integrations',
    );
    expect(key('premium-buy-yearly'), findsOneWidget);
    expect(more.purchases.repository.calls, isEmpty, reason: 'no purchase');
  });

  testWidgets('a purchase by the partner hides the card and the pause within '
      'one sync, without leaving the page', (tester) async {
    final more = await access(tester);
    expect(key('integration-buy'), findsOneWidget);
    more.purchases.unlock();
    await tester.pumpAndSettle();
    expect(key('integration-premium'), findsNothing);
    expect(key('integration-buy'), findsNothing);
    expect(key('access-paused'), findsNothing);
    expect(find.text('Kurzbefehl'), findsOneWidget);
  });

  for (final (name, rows) in [
    (
      'a yearly plan',
      () =>
          FakeEntitlementsSource()..rowsNow = [yearlyRow(from: DateTime.now())],
    ),
    ('Lifetime', () => FakeEntitlementsSource(unlockedNow: true)),
    (
      "a tester's grant (RevenueCat promotional)",
      () => FakeEntitlementsSource()..rowsNow = [promotionalRow()],
    ),
    (
      'rows that cannot be read (offline)',
      () => FakeEntitlementsSource()..offline = true,
    ),
  ]) {
    testWidgets('unlocked or unknown ($name): no card, no Buy, no pause', (
      tester,
    ) async {
      await access(tester, rows: rows());
      expect(key('integration-premium'), findsNothing);
      expect(key('integration-buy'), findsNothing);
      expect(key('access-paused'), findsNothing);
    });
  }

  testWidgets('the define off: nothing shown, the switch not even read', (
    tester,
  ) async {
    final more = await access(tester, define: false);
    expect(key('integration-premium'), findsNothing);
    expect(key('access-paused'), findsNothing);
    expect(more.purchases.premium.calls, isNot(contains('lock')));
  });

  testWidgets('the server switch off: nothing shown', (tester) async {
    await access(tester, lock: false);
    expect(key('integration-premium'), findsNothing);
    expect(key('access-paused'), findsNothing);
  });

  testWidgets('REVENUECAT_PURCHASES off: what is included and "Bald '
      'verfügbar", no Buy', (tester) async {
    await access(tester, noSale: const PurchasesNotYet());
    expect(key('integration-premium'), findsOneWidget);
    expect(key('integration-soon'), findsOneWidget);
    expect(find.text('Bald verfügbar.'), findsOneWidget);
    expect(key('integration-buy'), findsNothing);
  });

  testWidgets('the premium_offer switch off: "Bald verfügbar", no Buy', (
    tester,
  ) async {
    await access(tester, offer: false);
    expect(key('integration-soon'), findsOneWidget);
    expect(key('integration-buy'), findsNothing);
  });

  testWidgets('the premium_offer switch unreadable (offline): not "Bald '
      'verfügbar"; Buy opens the page, which says unavailable', (tester) async {
    final more = await access(tester, offerReadable: false);
    expect(key('integration-soon'), findsNothing);
    expect(find.text('Bald verfügbar.'), findsNothing);
    await tester.tap(key('integration-buy'));
    await tester.pumpAndSettle();
    expect(
      find.text('Hummlist Premium ist gerade nicht verfügbar.'),
      findsOneWidget,
    );
    expect(key('premium-buy-yearly'), findsNothing);
    expect(more.purchases.storePrices.reads, 0);
  });

  testWidgets('the web app: bought in the iPhone or Android app, no Buy', (
    tester,
  ) async {
    await access(tester, noSale: const PurchasesUnsupported());
    expect(key('integration-in-the-apps'), findsOneWidget);
    expect(key('integration-buy'), findsNothing);
  });

  testWidgets('paywall_viewed from the integrations, once, without a price', (
    tester,
  ) async {
    final sink = NativePostHog()..install();
    final analytics = await loadedAnalytics(MemoryAnalyticsStore())
      ..setUser(customer);
    await analytics.decide(granted: true);
    final more = await pumpMore(
      tester,
      location: accessPath,
      size: const Size(390, 1600),
      integrationLock: true,
      premium: FakePremiumServer(lock: true),
      analytics: analytics,
    );
    await tester.tap(key('integration-buy'));
    await tester.pumpAndSettle();
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    await analytics.flush();
    final viewed = [
      for (final e in sink.events)
        if (e['event'] == 'paywall_viewed') propsOf(e),
    ];
    expect(viewed, hasLength(1));
    expect(viewed.single['entry_point'], 'integrations');
    expect(viewed.single.keys, isNot(contains('price')));

    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(premiumPath);
    await tester.pumpAndSettle();
    await analytics.flush();
    expect(
      [
        for (final e in sink.events)
          if (e['event'] == 'paywall_viewed') propsOf(e)['entry_point'],
      ],
      ['integrations', 'more'],
    );
  });

  testWidgets("paywall_viewed waits for the household's rows when the prices "
      'come first, then goes once', (tester) async {
    final sink = NativePostHog()..install();
    final analytics = await loadedAnalytics(MemoryAnalyticsStore())
      ..setUser(customer);
    await analytics.decide(granted: true);
    final rows = FakeEntitlementsSource()..offline = true;
    final more = await pumpMore(
      tester,
      location: premiumPath,
      size: const Size(390, 1600),
      analytics: analytics,
      entitlements: rows,
    );
    await analytics.flush();
    List<String> viewed() => [
      for (final e in sink.events)
        if (e['event'] == 'paywall_viewed')
          propsOf(e)['entry_point']! as String,
    ];
    expect(viewed(), isEmpty, reason: 'premium unknown: no paywall yet');
    rows.offline = false;
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    await analytics.flush();
    expect(viewed(), ['more']);
  });

  testWidgets('no RevenueCat call: opening the locked settings and tapping Buy '
      '(Legal Review H-67)', (tester) async {
    final native = FakeRevenueCat();
    mockRevenueCat(native);
    await pumpMore(
      tester,
      location: accessPath,
      size: const Size(390, 1600),
      integrationLock: true,
      premium: FakePremiumServer(lock: true),
      sdk: RevenueCatRepository(AppStore.apple, 'appl_public'),
    );
    expect(key('integration-buy'), findsOneWidget);
    await tester.tap(key('integration-buy'));
    await tester.pumpAndSettle();
    expect(native.calls, isEmpty);
  });

  /// Anything of the lock or a paywall a free screen must never show.
  void expectNoPremium(String where) {
    for (final k in [
      'integration-premium',
      'integration-buy',
      'integration-soon',
      'access-paused',
      'premium-buy-yearly',
      'premium-buy-lifetime',
    ]) {
      expect(key(k), findsNothing, reason: '$k on $where');
    }
    expect(find.text('Teil von Hummlist Premium'), findsNothing, reason: where);
  }

  // Spec #4 AC5: the list, sync, categories, stores, settings (theme, app
  // icon, language), account and invites stay free; only the integration
  // settings show the lock, for a locked household with the define on.
  for (final location in [
    listPath,
    morePath,
    appSettingsPath,
    languagePath,
    accountPath,
    invitesPath,
  ]) {
    testWidgets('locked, define on: $location shows no paywall', (
      tester,
    ) async {
      final more = await pumpMore(
        tester,
        location: location,
        size: const Size(390, 1600),
        integrationLock: true,
        premium: FakePremiumServer(lock: true),
        routes: [
          GoRoute(path: listPath, builder: (_, _) => const ListScreen()),
          ...moreTabRoutes(),
        ],
      );
      expect(
        more.purchases.entitlements.canOffer(
          Entitlement.premium,
          PremiumPlan.yearly,
        ),
        isTrue,
        reason: 'the household is locked',
      );
      expectNoPremium(location);
    });
  }

  for (final (row, title) in [
    ('more-categories', 'categories'),
    ('more-stores', 'stores'),
  ]) {
    testWidgets('locked, define on: $title show no paywall', (tester) async {
      await pumpMore(
        tester,
        size: const Size(390, 1600),
        integrationLock: true,
        premium: FakePremiumServer(lock: true),
      );
      await tester.tap(key(row));
      await tester.pumpAndSettle();
      expectNoPremium(title);
    });
  }
}
