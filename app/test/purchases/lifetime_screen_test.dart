import 'package:family_groceries/app/language.dart';
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
    'lifetime-loading',
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
    'lifetime-retry',
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

  testWidgets('offers the purchase at the store price, and restore', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    expect(key('lifetime-screen'), findsOneWidget);
    expect(find.text('Hummlist Lifetime'), findsOneWidget);
    expect(
      find.textContaining('Ein Kauf, für euren ganzen Haushalt'),
      findsOneWidget,
    );
    expect(
      tester.widget<Text>(key('lifetime-price')).data,
      'Für 9,99 € kaufen',
    );
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    expect(find.text('Käufe wiederherstellen'), findsOneWidget);
    expect(more.purchases.repository.loads, ['home']);
    shows({});
  });

  testWidgets('the price is whatever the store says', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(
        product: const ProductLoaded(
          'home',
          Product(id: lifetimeProductId, price: 'CHF 10.00'),
        ),
      ),
    );
    expect(find.text('Für CHF 10.00 kaufen'), findsOneWidget);
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

  testWidgets('the store refuses: error with its code, retry', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreFailed('E42')),
    );
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-error', 'lifetime-retry'});
    expect(find.text('Der Kauf hat nicht geklappt (E42).'), findsOneWidget);
    await tester.tap(key('lifetime-retry'));
    await tester.pump();
    shows({});
  });

  testWidgets('the store is offline while buying', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(bought: const StoreOffline()),
    );
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    shows({'lifetime-error', 'lifetime-retry'});
    expect(
      find.text('Der Store ist gerade nicht erreichbar. Prüfe die Verbindung.'),
      findsOneWidget,
    );
  });

  testWidgets('not in the store yet: coming soon, retry', (tester) async {
    final store = FakePurchaseRepository(product: const ProductNotFound());
    await openLifetime(tester, store: store);
    shows({'lifetime-unavailable', 'lifetime-retry'});
    expect(find.text('Hummlist Lifetime ist bald verfügbar.'), findsOneWidget);
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsOneWidget);

    store.product = null;
    await tester.tap(key('lifetime-retry'));
    await tester.pumpAndSettle();
    shows({});
    expect(key('lifetime-buy'), findsOneWidget);
  });

  testWidgets('store unreachable: offline, retry', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(product: const StoreUnavailable()),
    );
    shows({'lifetime-offline', 'lifetime-retry'});
    expect(key('lifetime-buy'), findsNothing);
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
    expect(store.loads, isEmpty, reason: 'no store is asked');
  });

  testWidgets('a product loaded for another household offers no Buy', (
    tester,
  ) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(
        product: const ProductLoaded('other', lifetime),
      ),
    );
    expect(key('lifetime-buy'), findsNothing);
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
    expect(more.purchases.repository.loads, isEmpty);
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
    expect(more.purchases.repository.loads, isEmpty);
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
        'der Käufe können Apple oder Google erstatten.',
      ),
      findsOneWidget,
    );
    await tester.tap(key('lifetime-refund-help'));
    await tester.pumpAndSettle();
    expect(key('refund-help'), findsOneWidget);
    expect(find.text('Kauf zurückfordern'), findsOneWidget);
    expect(
      find.textContaining('Erstatten können wir selbst nichts'),
      findsOneWidget,
    );
    expect(find.textContaining('reportaproblem.apple.com'), findsOneWidget);
    expect(find.textContaining('„Problem melden“'), findsOneWidget);
    expect(
      find.textContaining('Mein Haushalt war schon freigeschaltet'),
      findsOneWidget,
    );
    expect(key('refund-apple'), findsOneWidget);
    expect(key('refund-google'), findsOneWidget);
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
        'Your household bought Hummlist Lifetime more than once. Apple or '
        'Google can refund one of the purchases.',
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
      find.textContaining("We can't refund purchases ourselves"),
      findsOneWidget,
    );
    expect(find.text('Ask Apple'), findsOneWidget);
    expect(find.text('Ask Google'), findsOneWidget);
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
    expect(store.loads, isEmpty);
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
    expect(find.text('Buy for 9,99 €'), findsOneWidget);
    expect(find.text('Restore purchases'), findsOneWidget);
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

  testWidgets('leaving the page and coming back asks the store once', (
    tester,
  ) async {
    final more = await openLifetime(tester);
    more.router.go(morePath);
    await tester.pumpAndSettle();
    more.router.go(lifetimePath);
    await tester.pumpAndSettle();
    expect(more.purchases.repository.loads, ['home']);
    expect(key('lifetime-buy'), findsOneWidget);
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
