import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/legal_links.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
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
  }) => pumpMore(
    tester,
    location: lifetimePath,
    store: store,
    api: api,
    entitlements: entitlements,
    language: language,
  );

  testWidgets('offers Buy and Restore without asking the store (H-67)', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    expect(key('lifetime-screen'), findsOneWidget);
    expect(find.text('Hummlist Lifetime'), findsOneWidget);
    expect(
      find.textContaining('Ein Kauf, für euren ganzen Haushalt'),
      findsOneWidget,
    );
    expect(find.text('Weiter zum Kauf'), findsOneWidget);
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    expect(find.text('Kauf wiederherstellen'), findsOneWidget);
    expect(
      tester.widget<Text>(key('lifetime-price-note')).data,
      'Den Preis zeigen dir der App Store oder Google Play, bevor du kaufst.',
    );
    expect(find.textContaining('€'), findsNothing, reason: 'no price');
    expect(more.purchases.repository.calls, isEmpty);
    shows({});
  });

  testWidgets('buy, unlocking, unlocked for the household', (tester) async {
    final store = FakePurchaseRepository()..hold = true;
    final more = await openLifetime(tester, store: store);
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    expect(store.buys, ['home']);
    expect(enabled(tester, 'lifetime-buy'), isFalse);
    await tester.tap(key('lifetime-buy'), warnIfMissed: false);
    expect(store.buys, hasLength(1), reason: 'no second purchase');

    store.held.single.complete(
      const Bought(StoreTransactionRef(AppStore.apple, '2000000123')),
    );
    await tester.pump();
    shows({'lifetime-unlocking'});
    expect(find.text('Wird freigeschaltet …'), findsOneWidget);
    expect(enabled(tester, 'lifetime-buy'), isFalse);
    expect(more.purchases.server.calls.single.id, '2000000123');

    more.purchases.unlock();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(find.text('Freigeschaltet'), findsOneWidget);
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
  });

  testWidgets('Ask to Buy: waiting for approval', (tester) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const Pending()),
    );
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-pending'});
    expect(find.text('Wartet auf Bestätigung'), findsOneWidget);
    // iOS never reports a declined request: Buy asks again.
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    expect(enabled(tester, 'lifetime-restore'), isTrue);
    await tester.tap(key('lifetime-buy'));
    expect(more.purchases.repository.buys, hasLength(2));
    expect(more.purchases.server.calls, isEmpty);
  });

  testWidgets('canceled quietly, buy again', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const Canceled()),
    );
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-canceled'});
    expect(enabled(tester, 'lifetime-buy'), isTrue);
  });

  testWidgets('the store refuses: error with its code, Buy tries again', (
    tester,
  ) async {
    final more = await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreFailed('E42')),
    );
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-error'});
    expect(find.text('Der Kauf hat nicht geklappt (E42).'), findsOneWidget);
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    expect(more.purchases.repository.buys, hasLength(2));
  });

  testWidgets('the store is offline: says so after the tap', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreOffline()),
    );
    shows({});
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-offline'});
    expect(
      find.text('Der Store ist gerade nicht erreichbar. Prüfe die Verbindung.'),
      findsOneWidget,
    );
    expect(enabled(tester, 'lifetime-buy'), isTrue);
  });

  testWidgets('not in the store yet: coming soon after the tap', (
    tester,
  ) async {
    final store = FakePurchaseRepository(bought: const ProductMissing());
    await openLifetime(tester, store: store);
    shows({});
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-unavailable'});
    expect(find.text('Hummlist Lifetime ist bald verfügbar.'), findsOneWidget);
    expect(key('lifetime-restore'), findsOneWidget);
    store.bought = const Canceled();
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-canceled'});
  });

  testWidgets('the purchase define off: coming soon, no Buy, no Restore', (
    tester,
  ) async {
    final store = FakePurchaseRepository(withoutStore: const PurchasesNotYet());
    await openLifetime(tester, store: store);
    shows({'lifetime-unavailable'});
    expect(find.text('Hummlist Lifetime ist bald verfügbar.'), findsOneWidget);
    expect(key('lifetime-buy'), findsNothing);
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
        key(what == 'bought' ? 'lifetime-buy' : 'lifetime-restore'),
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
    await tester.tap(key('lifetime-buy'));
    await tester.pumpAndSettle();
    shows({'lifetime-used-elsewhere'});
  });

  testWidgets('while the unlock is unknown there is no Buy and no Restore', (
    tester,
  ) async {
    final rows = FakeEntitlementsSource(unlockedNow: true)..offline = true;
    final more = await openLifetime(tester, entitlements: rows);
    shows({'lifetime-checking'});
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
    rows
      ..offline = false
      ..change();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(key('lifetime-buy'), findsNothing, reason: 'the partner bought');
    expect(more.purchases.repository.calls, isEmpty);
  });

  testWidgets('a member who did not buy never sees Buy once unlocked', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    expect(key('lifetime-buy'), findsOneWidget);
    // The partner's purchase arrives over Realtime.
    more.purchases.unlock();
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(key('lifetime-buy'), findsNothing);
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

  testWidgets('a tester grant and a purchase are not bought twice', (
    tester,
  ) async {
    await openLifetime(
      tester,
      entitlements: FakeEntitlementsSource()
        ..rowsNow = [
          {'kind': 'lifetime', 'source': 'purchase'},
          {'kind': 'lifetime', 'source': 'tester'},
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
        'Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. '
        'Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet.',
      ),
      findsOneWidget,
    );
    expect(key('lifetime-buy'), findsNothing);
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
        "You can buy Hummlist Lifetime in the iPhone or Android app. It's "
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
    expect(find.text('Hummlist Lifetime'), findsOneWidget);
    expect(find.text('Continue to purchase'), findsOneWidget);
    expect(find.text('Restore purchase'), findsOneWidget);
    expect(
      find.text(
        'The App Store or Google Play shows you the price before you buy.',
      ),
      findsOneWidget,
    );
    await tester.tap(key('lifetime-buy'));
    store.held.single.complete(const Bought(null));
    await tester.pump();
    expect(find.text('Unlocking …'), findsOneWidget);
    await tester.pump(unlockWait);
    expect(find.textContaining('takes longer than usual'), findsOneWidget);
    expect(
      tester.widget<ButtonStyleButton>(key('lifetime-buy')).onPressed,
      isNull,
      reason: 'a late unlock never invites a second purchase',
    );
  });

  testWidgets('opening, rebuilding, leaving and coming back ask no store', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    more.purchases.rows.change();
    await tester.pumpAndSettle();
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(lifetimePath);
    await tester.pumpAndSettle();
    expect(more.purchases.repository.calls, isEmpty);
    expect(key('lifetime-buy'), findsOneWidget);
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    expect(more.purchases.repository.calls, ['restore home', 'buy home']);
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
          matching: find.text('Hummlist unterstützen'),
        ),
        findsOneWidget,
      );
      await tester.tap(key('more-lifetime'));
      await tester.pumpAndSettle();
      expect(key('lifetime-screen'), findsOneWidget);
      expect(
        more.router.routerDelegate.currentConfiguration.uri.path,
        lifetimePath,
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
      expect(find.text('Hummlist unterstützen'), findsNothing);
      expect(find.text('Freigeschaltet'), findsNothing);
    });

    testWidgets('wide: the page beside the list, its row selected', (
      tester,
    ) async {
      await pumpMore(
        tester,
        location: lifetimePath,
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
}
