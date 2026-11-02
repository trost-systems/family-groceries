import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/legal_links.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/purchases/premium_server.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

void main() {
  setUpAll(fakeSupabase);

  Finder key(String k) => find.byKey(ValueKey(k));

  /// Every state key the page can show; each test names the ones it expects.
  const stateKeys = {
    'lifetime-unlocked',
    'lifetime-pending',
    'lifetime-unlocking',
    'lifetime-unavailable',
    'lifetime-offline',
    'lifetime-error',
    'lifetime-canceled',
    'lifetime-used-elsewhere',
    'lifetime-nothing-restored',
    'lifetime-web',
    'lifetime-checking',
    'lifetime-bought-twice',
    'premium-unavailable',
    'premium-billing-issue',
    'premium-lifetime-while-yearly',
    'premium-two-yearly',
  };

  void shows(Set<String> expected) {
    for (final k in stateKeys) {
      expect(
        key(k),
        expected.contains(k) ? findsOneWidget : findsNothing,
        reason: k,
      );
    }
  }

  bool enabled(WidgetTester tester, String k) =>
      tester.widget<ButtonStyleButton>(key(k)).onPressed != null;

  Future<More> openLifetime(
    WidgetTester tester, {
    FakePurchaseRepository? store,
    FakeClaimApi? api,
    FakeEntitlementsSource? entitlements,
    AppLanguage? language,
    FakePremiumServer? premium,
    FakeStorePrices? prices,
  }) => pumpMore(
    tester,
    location: premiumPath,
    // Tall enough that the page's lazy list builds every block.
    size: const Size(390, 2600),
    premium: premium,
    prices: prices,
    store: store,
    api: api,
    entitlements: entitlements,
    language: language,
  );

  testWidgets('offers both plans with the store prices, asking RevenueCat '
      'nothing (H-67)', (tester) async {
    final more = await openLifetime(tester);
    expect(key('lifetime-screen'), findsOneWidget);
    expect(
      find.descendant(
        of: key('lifetime-screen'),
        matching: find.text('Hummlist Premium'),
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining('Siri, Alexa und KI-Assistenten (MCP)'),
      findsOneWidget,
    );
    expect(enabled(tester, 'premium-buy-yearly'), isTrue);
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
    expect(
      tester.getTopLeft(key('premium-card-yearly')).dy,
      lessThan(tester.getTopLeft(key('premium-card-lifetime')).dy),
      reason: 'yearly first',
    );
    expect(find.text('Kauf wiederherstellen'), findsOneWidget);
    expect(more.purchases.repository.calls, isEmpty);
    expect(more.purchases.storePrices.reads, 1, reason: 'one store query');
    shows({});
  });

  testWidgets('buy, unlocking, unlocked for the household', (tester) async {
    final store = FakePurchaseRepository()..hold = true;
    final more = await openLifetime(tester, store: store);
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    expect(store.buys, ['home']);
    expect(enabled(tester, 'premium-buy-lifetime'), isFalse);
    await tester.tap(key('premium-buy-lifetime'), warnIfMissed: false);
    expect(store.buys, hasLength(1), reason: 'no second purchase');

    store.held.single.complete(
      const Bought(StoreTransactionRef(AppStore.apple, '2000000123')),
    );
    await tester.pump();
    shows({'lifetime-unlocking'});
    expect(find.text('Wird freigeschaltet …'), findsOneWidget);
    expect(enabled(tester, 'premium-buy-lifetime'), isFalse);
    expect(more.purchases.server.calls.single.id, '2000000123');

    more.purchases.unlock();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(find.text('Hummlist Premium Lifetime'), findsOneWidget);
    expect(key('premium-buy-lifetime'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
  });

  testWidgets('Ask to Buy: waiting for approval', (tester) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const Pending()),
    );
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-pending'});
    expect(find.text('Wartet auf Bestätigung'), findsOneWidget);
    // iOS never reports a declined request: Buy asks again.
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
    expect(enabled(tester, 'lifetime-restore'), isTrue);
    await tester.tap(key('premium-buy-lifetime'));
    expect(more.purchases.repository.buys, hasLength(2));
    expect(more.purchases.server.calls, isEmpty);
  });

  testWidgets('canceled quietly, buy again', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const Canceled()),
    );
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-canceled'});
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
  });

  testWidgets('the store refuses: error with its code, Buy tries again', (
    tester,
  ) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreFailed('E42')),
    );
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-error'});
    expect(find.text('Der Kauf hat nicht geklappt (E42).'), findsOneWidget);
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    expect(more.purchases.repository.buys, hasLength(2));
  });

  testWidgets('the store is offline: says so after the tap', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreOffline()),
    );
    shows({});
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-offline'});
    expect(
      find.text('Der Store ist gerade nicht erreichbar. Prüfe die Verbindung.'),
      findsOneWidget,
    );
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
  });

  testWidgets('not in the store yet: coming soon after the tap', (
    tester,
  ) async {
    final store = FakePurchaseRepository(bought: const ProductMissing());
    await openLifetime(tester, store: store);
    shows({});
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-unavailable'});
    expect(
      find.text('Hummlist Premium ist gerade nicht verfügbar.'),
      findsOneWidget,
    );
    expect(key('lifetime-restore'), findsOneWidget);
    store.bought = const Canceled();
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-canceled'});
  });

  testWidgets('the purchase define off: coming soon, no Buy, no Restore', (
    tester,
  ) async {
    final store = FakePurchaseRepository(withoutStore: const PurchasesNotYet());
    await openLifetime(tester, store: store);
    shows({'lifetime-unavailable'});
    expect(find.text('Hummlist Premium ist bald verfügbar.'), findsOneWidget);
    expect(key('premium-buy-lifetime'), findsNothing);
    expect(key('premium-buy-yearly'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
    expect(store.calls, isEmpty, reason: 'no store is asked');
  });

  for (final (what, store) in [
    ('bought', FakePurchaseRepository(bought: const BelongsElsewhere())),
    ('restored', FakePurchaseRepository(restored: const BelongsElsewhere())),
  ]) {
    testWidgets('$what in another household: says so, refund help', (
      tester,
    ) async {
      await openLifetime(tester, store: store);
      await tester.tap(
        key(what == 'bought' ? 'premium-buy-lifetime' : 'lifetime-restore'),
      );
      await tester.pumpAndSettle();
      shows({'lifetime-used-elsewhere'});
      expect(
        find.text(
          'Dieser Kauf gehört zu einem anderen, früheren Haushalt und bleibt '
          'dort. Hier schaltet er nichts frei.',
        ),
        findsOneWidget,
      );
      expect(key('lifetime-refund-help'), findsOneWidget);
    });
  }

  testWidgets("the claim says the purchase is elsewhere's", (tester) async {
    await openLifetime(
      tester,
      api: FakeClaimApi(answers: const [Claimed(ClaimStatus.elsewhere)]),
    );
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pumpAndSettle();
    shows({'lifetime-used-elsewhere'});
  });

  testWidgets('while the unlock is unknown there is no Buy and no Restore', (
    tester,
  ) async {
    final rows = FakeEntitlementsSource(unlockedNow: true)..offline = true;
    final more = await openLifetime(tester, entitlements: rows);
    shows({'lifetime-checking'});
    expect(key('premium-buy-lifetime'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
    rows
      ..offline = false
      ..change();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(
      key('premium-buy-lifetime'),
      findsNothing,
      reason: 'the partner bought',
    );
    expect(more.purchases.repository.calls, isEmpty);
  });

  testWidgets('a member who did not buy never sees Buy once unlocked', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    expect(key('premium-buy-lifetime'), findsOneWidget);
    // The partner's purchase arrives over Realtime.
    more.purchases.unlock();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(key('premium-buy-lifetime'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
  });

  testWidgets('an unlocked household never asks the store', (tester) async {
    final more = await openLifetime(
      tester,
      entitlements: FakeEntitlementsSource(unlockedNow: true),
    );
    shows({'lifetime-unlocked'});
    expect(more.purchases.repository.calls, isEmpty);
  });

  testWidgets('bought twice: a note, and the refund help', (tester) async {
    await openLifetime(
      tester,
      entitlements: FakeEntitlementsSource()
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          {'kind': 'lifetime', 'source': 'purchase'},
        ],
    );
    shows({'lifetime-unlocked', 'lifetime-bought-twice'});
    expect(
      find.text(
        'Euer Haushalt hat Hummlist Lifetime mehr als einmal gekauft. Einen '
        'der Käufe kannst du dir erstatten lassen.',
      ),
      findsOneWidget,
    );
    await tester.tap(key('lifetime-refund-help'));
    await tester.pumpAndSettle();
    expect(key('refund-help'), findsOneWidget);
    expect(find.text('Kauf zurückfordern'), findsOneWidget);
    expect(
      find.text(
        'Hummlist Lifetime gehört immer zu dem Haushalt, in dem es gekauft '
        'wurde. Käufe im App Store erstattet nur Apple. Bei Google Play '
        'beantragst du die Erstattung in den ersten 48 Stunden bei Google; '
        'danach schreib uns an support@hummlist.com, wir prüfen jede Anfrage '
        'einzeln. Deine gesetzlichen Rechte bleiben unberührt.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Erstatten können wir'), findsNothing);
    expect(find.textContaining('reportaproblem.apple.com'), findsOneWidget);
    expect(
      find.text(
        'Android, in den ersten 48 Stunden: Öffne Google Play, tippe auf dein '
        'Profilbild, dann „Zahlungen und Abos“, „Budget und '
        'Bestellverlauf“, wähle Hummlist Lifetime und „Problem melden“. '
        'Danach schreib uns mit der Bestellnummer (beginnt mit „GPA.“) oder '
        'der E-Mail-Adresse deines Google-Kontos.',
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining('Mein Haushalt war schon freigeschaltet'),
      findsOneWidget,
    );
    expect(key('refund-apple'), findsOneWidget);
    expect(key('refund-google'), findsOneWidget);
    expect(find.text('Mehr in den häufigen Fragen'), findsOneWidget);
    expect(
      tester.widget<LegalLink>(key('refund-faq')).url,
      Uri.parse('https://hummlist.com/support'),
    );
  });

  testWidgets('a promotional grant and a purchase are not bought twice', (
    tester,
  ) async {
    await openLifetime(
      tester,
      entitlements: FakeEntitlementsSource()
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          promotionalRow(),
        ],
    );
    shows({'lifetime-unlocked'});
  });

  testWidgets('bought twice in English', (tester) async {
    await openLifetime(
      tester,
      language: AppLanguage.en,
      entitlements: FakeEntitlementsSource()
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          {'kind': 'lifetime', 'source': 'purchase'},
        ],
    );
    expect(
      find.text(
        'Your household bought Hummlist Lifetime more than once. One of the '
        'purchases can be refunded.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('the refund help in English', (tester) async {
    await openLifetime(tester, language: AppLanguage.en);
    await tester.tap(key('lifetime-refund-help'));
    await tester.pumpAndSettle();
    expect(find.text('Request a refund'), findsOneWidget);
    expect(
      find.text(
        'Hummlist Lifetime always belongs to the household it was bought in. '
        'Only Apple refunds App Store purchases. For Google Play, ask Google '
        'within 48 hours of buying; after that, email us at '
        "support@hummlist.com and we'll look at your request. Your statutory "
        'rights are not affected.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Android, within 48 hours: open Google Play, tap your profile picture, '
        'then “Payments & subscriptions”, “Budget & order history”, choose '
        'Hummlist Lifetime and “Report a problem”. After that, email us with '
        "the order number (it starts with “GPA.”) or your Google account's "
        'email address.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining("We can't refund"), findsNothing);
    expect(find.text('Ask Apple'), findsOneWidget);
    expect(find.text('Ask Google'), findsOneWidget);
    expect(find.text('More in the FAQ'), findsOneWidget);
    expect(
      tester.widget<LegalLink>(key('refund-faq')).url,
      Uri.parse('https://hummlist.com/en/support'),
    );
  });

  testWidgets('restore finds nothing', (tester) async {
    await openLifetime(tester);
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    shows({'lifetime-nothing-restored'});
    expect(find.text('Kein früherer Kauf gefunden.'), findsOneWidget);
  });

  testWidgets('restore unlocks an earlier purchase', (tester) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(restored: const Restored()),
    );
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    shows({'lifetime-unlocking'});
    expect(more.purchases.repository.restores, ['home']);
    more.purchases.unlock();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
  });

  testWidgets('the web app sells nothing, says where to buy', (tester) async {
    final store = FakePurchaseRepository(
      withoutStore: const PurchasesUnsupported(),
    );
    await openLifetime(tester, store: store);
    shows({'lifetime-web'});
    expect(
      find.text(
        'Hummlist Premium kaufst du in der iPhone- oder Android-App. Danach '
        'ist es auch hier für deinen ganzen Haushalt freigeschaltet.',
      ),
      findsOneWidget,
    );
    expect(key('premium-buy-lifetime'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
    expect(store.calls, isEmpty);
  });

  testWidgets('the web app in English says where to buy', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(withoutStore: const PurchasesUnsupported()),
      language: AppLanguage.en,
    );
    expect(
      find.text(
        'You can buy Hummlist Premium in the iPhone or Android app. It is '
        'then unlocked here too, for your whole household.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('the web app shows the unlock the household has', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(withoutStore: const PurchasesUnsupported()),
      entitlements: FakeEntitlementsSource(unlockedNow: true),
    );
    shows({'lifetime-web', 'lifetime-unlocked'});
  });

  testWidgets('English', (tester) async {
    final store = FakePurchaseRepository()..hold = true;
    await openLifetime(tester, language: AppLanguage.en, store: store);
    expect(
      find.descendant(
        of: key('lifetime-screen'),
        matching: find.text('Hummlist Premium'),
      ),
      findsOneWidget,
    );
    expect(find.text('Subscribe yearly'), findsOneWidget);
    expect(find.text('Buy Lifetime'), findsOneWidget);
    expect(find.text('Restore purchase'), findsOneWidget);
    await tester.tap(key('premium-buy-lifetime'));
    store.held.single.complete(const Bought(null));
    await tester.pump();
    expect(find.text('Unlocking …'), findsOneWidget);
    await tester.pump(unlockWait);
    expect(find.textContaining('takes longer than usual'), findsOneWidget);
    expect(
      tester.widget<ButtonStyleButton>(key('premium-buy-lifetime')).onPressed,
      isNull,
      reason: 'a late unlock never invites a second purchase',
    );
  });

  testWidgets('leave and come back: the last note is gone, Buy is there', (
    tester,
  ) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const Canceled()),
    );
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    shows({'lifetime-canceled'});
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(premiumPath);
    await tester.pumpAndSettle();
    shows({});
    expect(enabled(tester, 'premium-buy-lifetime'), isTrue);
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    shows({'lifetime-nothing-restored'});
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(premiumPath);
    await tester.pumpAndSettle();
    shows({});
  });

  testWidgets('opening, rebuilding, leaving and coming back ask no store', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(premiumPath);
    await tester.pumpAndSettle();
    expect(more.purchases.repository.calls, isEmpty);
    expect(key('premium-buy-lifetime'), findsOneWidget);
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    await tester.tap(key('premium-buy-lifetime'));
    await tester.pump();
    expect(more.purchases.repository.calls, [
      'restore home',
      'buy home lifetime',
    ]);
    // "Unlocking" waits for an unlock that never comes here.
    await tester.pump(unlockWait);
  });

  group('More', () {
    Future<void> showRow(WidgetTester tester) async {
      await tester.scrollUntilVisible(
        key('more-lifetime'),
        200,
        scrollable: find.descendant(
          of: key('more-screen'),
          matching: find.byType(Scrollable),
        ),
      );
    }

    testWidgets('a row opens the page', (tester) async {
      final more = await pumpMore(tester);
      await showRow(tester);
      expect(
        find.descendant(
          of: key('more-lifetime'),
          matching: find.text('Siri, Alexa und KI-Assistenten'),
        ),
        findsOneWidget,
      );
      await tester.tap(key('more-lifetime'));
      await tester.pumpAndSettle();
      expect(key('lifetime-screen'), findsOneWidget);
      expect(
        more.router.routerDelegate.currentConfiguration.uri.path,
        premiumPath,
      );
    });

    testWidgets('the row says when the household has it', (tester) async {
      await pumpMore(
        tester,
        entitlements: FakeEntitlementsSource(unlockedNow: true),
      );
      await showRow(tester);
      expect(
        find.descendant(
          of: key('more-lifetime'),
          matching: find.text('Freigeschaltet'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('the row asks for nothing while the unlock is unknown', (
      tester,
    ) async {
      await pumpMore(
        tester,
        entitlements: FakeEntitlementsSource()..offline = true,
      );
      await showRow(tester);
      expect(find.text('Siri, Alexa und KI-Assistenten'), findsNothing);
      expect(find.text('Freigeschaltet'), findsNothing);
    });

    testWidgets('wide: the page beside the list, its row selected', (
      tester,
    ) async {
      await pumpMore(
        tester,
        location: premiumPath,
        size: const Size(1200, 900),
      );
      expect(key('more-screen'), findsOneWidget);
      expect(key('lifetime-screen'), findsOneWidget);
      expect(
        tester
            .widget<ListTile>(
              find.descendant(
                of: key('more-lifetime'),
                matching: find.byType(ListTile),
              ),
            )
            .selected,
        isTrue,
      );
    });
  });

  group('Hummlist Premium: prices, disclosures, the offer (job 49)', () {
    String priceOf(WidgetTester tester, PremiumPlan plan) =>
        tester.widget<Text>(key('premium-price-${plan.name}')).data!;

    testWidgets('euro prices exactly as the store sends them, with VAT', (
      tester,
    ) async {
      await openLifetime(tester);
      expect(priceOf(tester, PremiumPlan.yearly), '9,99 € / Jahr inkl. MwSt.');
      expect(
        priceOf(tester, PremiumPlan.lifetime),
        '29,99 € einmalig inkl. MwSt.',
      );
      expect(
        find.text('Einmal zahlen, für immer: so viel wie drei Jahre.'),
        findsOneWidget,
      );
      expect(
        find.textContaining('mindestens 24 Stunden vor Ende der Laufzeit'),
        findsOneWidget,
      );
      expect(
        find.textContaining(
          'bei der Bestätigung des Kaufs und bei jeder '
          'Verlängerung',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('kann abweichen'), findsNothing);
      expect(
        tester.widget<LegalLink>(key('premium-privacy')).url,
        Uri.parse('https://hummlist.com/datenschutz'),
      );
      expect(find.text('Nutzungsbedingungen (EULA)'), findsOneWidget);
    });

    for (final (currency, yearly, lifetime) in [
      ('USD', r'$9.99', r'$29.99'),
      ('GBP', '£8.99', '£24.99'),
      ('CHF', 'CHF 10.00', 'CHF 30.00'),
    ]) {
      testWidgets('$currency: as returned, no VAT line (EN)', (tester) async {
        await openLifetime(
          tester,
          language: AppLanguage.en,
          prices: FakeStorePrices(
            PricesRead({
              PremiumPlan.yearly: StorePrice(yearly, currency),
              PremiumPlan.lifetime: StorePrice(lifetime, currency),
            }),
          ),
        );
        expect(priceOf(tester, PremiumPlan.yearly), '$yearly per year');
        expect(priceOf(tester, PremiumPlan.lifetime), '$lifetime one-time');
        expect(find.textContaining('VAT'), findsNothing);
        expect(
          find.textContaining('at least 24 hours before the end of the period'),
          findsOneWidget,
        );
      });
    }

    testWidgets('a yearly-only storefront: no Lifetime card, no error', (
      tester,
    ) async {
      final more = await openLifetime(
        tester,
        prices: FakeStorePrices(
          const PricesRead({
            PremiumPlan.yearly: StorePrice(r'R$ 29,90', 'BRL'),
          }),
        ),
      );
      expect(priceOf(tester, PremiumPlan.yearly), r'R$ 29,90 / Jahr');
      expect(key('premium-card-lifetime'), findsNothing);
      shows({});
      expect(more.purchases.repository.calls, isEmpty);
      await tester.tap(key('premium-buy-yearly'));
      await tester.pump();
      expect(more.purchases.repository.calls, ['buy home yearly']);
      // "Unlocking" waits for an unlock that never comes here.
      await tester.pump(unlockWait);
    });

    testWidgets('a yearly-only storefront with yearly running: no Lifetime '
        'entry, no warning', (tester) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now())],
        prices: FakeStorePrices(
          const PricesRead({PremiumPlan.yearly: StorePrice(r'$9.99', 'USD')}),
        ),
      );
      expect(key('premium-card-lifetime'), findsNothing);
      expect(key('premium-card-yearly'), findsNothing);
      expect(key('premium-lifetime-warning'), findsNothing);
      shows({'lifetime-unlocked', 'premium-unavailable'});
    });

    for (final (what, answer) in [
      ('unreadable', const PricesUnavailable()),
      ('empty', const PricesRead({})),
    ]) {
      testWidgets('store prices $what: no purchase without a price', (
        tester,
      ) async {
        final more = await openLifetime(
          tester,
          prices: FakeStorePrices(answer),
        );
        expect(key('premium-buy-yearly'), findsNothing);
        expect(key('premium-buy-lifetime'), findsNothing);
        expect(key('lifetime-restore'), findsNothing);
        shows({'premium-unavailable'});
        expect(
          find.text('Hummlist Premium ist gerade nicht verfügbar.'),
          findsOneWidget,
        );
        expect(more.purchases.repository.calls, isEmpty);
      });
    }

    testWidgets('the server switch off: no purchase UI, no store asked', (
      tester,
    ) async {
      final more = await openLifetime(
        tester,
        premium: FakePremiumServer(offer: false),
      );
      expect(key('premium-buy-yearly'), findsNothing);
      expect(key('premium-buy-lifetime'), findsNothing);
      shows({'lifetime-unavailable'});
      expect(more.purchases.storePrices.reads, 0);
      expect(more.purchases.repository.calls, isEmpty);
    });

    testWidgets('switch unreadable: unavailable, no price query', (
      tester,
    ) async {
      final more = await openLifetime(
        tester,
        premium: FakePremiumServer()..offerFails = true,
      );
      expect(key('premium-buy-yearly'), findsNothing);
      expect(key('premium-buy-lifetime'), findsNothing);
      shows({'premium-unavailable'});
      expect(
        find.text('Hummlist Premium ist gerade nicht verfügbar.'),
        findsOneWidget,
      );
      expect(find.textContaining('bald verfügbar'), findsNothing);
      expect(more.purchases.storePrices.reads, 0);
      expect(more.purchases.repository.calls, isEmpty);
    });

    testWidgets('a yearly plan running: no yearly card, Lifetime offered, the '
        'status and the manage row', (tester) async {
      final now = DateTime.now();
      final more = await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: now)],
        prices: FakeStorePrices(fakeStorePrices, manages: true),
      );
      expect(key('premium-card-yearly'), findsNothing);
      expect(key('premium-card-lifetime'), findsOneWidget);
      expect(
        find.textContaining(
          'Hummlist Premium aktiv (jährlich, verlängert '
          'sich am',
        ),
        findsOneWidget,
      );
      await tester.tap(key('premium-manage'));
      await tester.pump();
      expect(more.purchases.storePrices.manageCalls, 1);
      expect(find.text('Abo verwalten oder kündigen'), findsOneWidget);
    });

    testWidgets('Lifetime while a yearly plan runs: the warning before the '
        "store's sheet; RevenueCat only on Buy anyway", (tester) async {
      final more = await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now())],
        store: FakePurchaseRepository(bought: const Canceled()),
      );
      await tester.tap(key('premium-buy-lifetime'));
      await tester.pumpAndSettle();
      expect(key('premium-lifetime-warning'), findsOneWidget);
      expect(
        find.text(
          'Euer Haushalt hat schon ein Jahresabo. Es läuft nach dem '
          'Einmalkauf weiter und wird weiter abgerechnet, bis es gekündigt '
          'wird; das restliche Abojahr wird nicht automatisch erstattet. '
          'Kündigen kann nur, wer das Abo abgeschlossen hat, unter Abos '
          'verwalten. Hummlist kann das Abo nicht kündigen.',
          findRichText: true,
        ),
        findsOneWidget,
        reason: 'word for word, the link without its brackets',
      );
      expect(
        find.textContaining('[Abos verwalten]', findRichText: true),
        findsNothing,
      );
      expect(more.purchases.repository.calls, isEmpty);
      await tester.tap(key('premium-lifetime-warning-cancel'));
      await tester.pumpAndSettle();
      expect(more.purchases.repository.calls, isEmpty);
      await tester.tap(key('premium-buy-lifetime'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Trotzdem kaufen'));
      await tester.pumpAndSettle();
      expect(more.purchases.repository.calls, ['buy home lifetime']);
    });

    testWidgets('the subscriber gets their own warning (EN)', (tester) async {
      await openLifetime(
        tester,
        language: AppLanguage.en,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now())],
        premium: FakePremiumServer(
          mine: const MyYearlyPlan(subscriber: true, renewing: true),
        ),
      );
      await tester.tap(key('premium-buy-lifetime'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          'You can cancel it in Manage subscription. Hummlist',
          findRichText: true,
        ),
        findsOneWidget,
      );
      expect(find.text('Buy anyway'), findsOneWidget);
    });

    testWidgets('no warning when the yearly plan no longer renews', (
      tester,
    ) async {
      final more = await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now(), renews: false)],
        store: FakePurchaseRepository(bought: const Canceled()),
      );
      expect(
        find.textContaining('Hummlist Premium aktiv (jährlich, läuft am'),
        findsOneWidget,
      );
      await tester.tap(key('premium-buy-lifetime'));
      await tester.pumpAndSettle();
      expect(key('premium-lifetime-warning'), findsNothing);
      expect(more.purchases.repository.calls, ['buy home lifetime']);
    });

    testWidgets('after Lifetime the yearly plan still bills: the note and its '
        'link', (tester) async {
      final more = await openLifetime(
        tester,
        prices: FakeStorePrices(fakeStorePrices, manages: true),
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [
            yearlyRow(from: DateTime.now()),
            {
              'kind': 'premium',
              'source': 'purchase',
              'premium_source': 'lifetime',
            },
          ],
      );
      shows({'lifetime-unlocked', 'premium-lifetime-while-yearly'});
      expect(find.text('Hummlist Premium Lifetime'), findsOneWidget);
      await tester.tapOnText(find.textRange.ofSubstring('Abos verwalten'));
      await tester.pump();
      expect(
        more.purchases.storePrices.manageCalls,
        1,
        reason: 'the link in the sentence opens the store',
      );
      expect(key('premium-lifetime-while-yearly-manage'), findsOneWidget);
      expect(key('premium-manage'), findsOneWidget);
      expect(key('premium-card-lifetime'), findsNothing);
      expect(key('premium-card-yearly'), findsNothing);
    });

    testWidgets('a lapsed yearly plan: both plans again', (tester) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now(), days: -2)],
      );
      expect(key('premium-card-yearly'), findsOneWidget);
      expect(key('premium-card-lifetime'), findsOneWidget);
      expect(key('premium-manage'), findsNothing);
      shows({});
    });

    testWidgets('a promotional grant: its status and end, nothing to buy', (
      tester,
    ) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [promotionalRow(from: DateTime.now(), days: 60)],
      );
      expect(
        find.textContaining('Hummlist Premium geschenkt bis '),
        findsOneWidget,
      );
      expect(key('premium-card-lifetime'), findsNothing);
      expect(key('premium-card-yearly'), findsNothing);
      expect(key('premium-manage'), findsNothing);
    });

    testWidgets('a promotional grant without end', (tester) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()..rowsNow = [promotionalRow()],
      );
      expect(find.text('Hummlist Premium geschenkt'), findsOneWidget);
      expect(key('premium-card-lifetime'), findsNothing);
    });

    testWidgets('a failed renewal: only the subscriber is told', (
      tester,
    ) async {
      final rows = [yearlyRow(from: DateTime.now(), days: 10)];
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()..rowsNow = rows,
        premium: FakePremiumServer(
          mine: MyYearlyPlan(
            subscriber: true,
            renewing: true,
            billingIssue: true,
            until: DateTime.utc(2026, 11, 14, 12),
          ),
        ),
      );
      expect(
        find.text(
          'Apple bzw. Google konnten dein Jahresabo nicht abbuchen. Premium '
          'läuft noch bis 14. November 2026. Prüfe deine Zahlungsmethode im '
          'Store.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('a failed renewal: other members only see the end', (
      tester,
    ) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: DateTime.now(), days: 10)],
      );
      shows({'lifetime-unlocked'});
    });

    testWidgets('two yearly plans: a note and the manage row', (tester) async {
      final now = DateTime.now();
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()
          ..rowsNow = [yearlyRow(from: now), yearlyRow(from: now, days: 30)],
      );
      shows({'lifetime-unlocked', 'premium-two-yearly'});
      expect(key('premium-manage'), findsOneWidget);
    });

    testWidgets('while the rows are unknown: no card, no price query result '
        'shown', (tester) async {
      await openLifetime(
        tester,
        entitlements: FakeEntitlementsSource()..offline = true,
      );
      expect(key('premium-card-yearly'), findsNothing);
      expect(key('premium-card-lifetime'), findsNothing);
      shows({'lifetime-checking'});
    });
  });

  testWidgets("on iOS the terms are Apple's standard EULA", (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    await openLifetime(tester);
    expect(
      tester.widget<LegalLink>(key('premium-terms')).url,
      Uri.parse(
        'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
      ),
    );
    debugDefaultTargetPlatformOverride = null;
  });
}
