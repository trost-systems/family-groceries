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
    'lifetime-verifying',
    'lifetime-unavailable',
    'lifetime-offline',
    'lifetime-error',
    'lifetime-not-accepted',
    'lifetime-canceled',
    'lifetime-used-elsewhere',
    'lifetime-nothing-restored',
    'lifetime-refunded',
    'lifetime-web',
    'lifetime-retry',
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
    FakePurchaseApi? api,
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
    await openLifetime(tester);
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
    shows({});
  });

  testWidgets('the price is whatever the store says', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(
        product: const ProductLoaded(
          Product(id: lifetimeProductId, price: 'CHF 10.00'),
        ),
      ),
    );
    expect(find.text('Für CHF 10.00 kaufen'), findsOneWidget);
  });

  testWidgets('buy, verify, unlocked for the household', (tester) async {
    final rows = FakeEntitlementsSource();
    final api = FakePurchaseApi()..hold = true;
    final more = await openLifetime(tester, api: api, entitlements: rows);
    await tester.tap(key('lifetime-buy'));
    await tester.pump();
    expect(more.purchases.repository.buys, 1);
    expect(enabled(tester, 'lifetime-buy'), isFalse);
    await tester.tap(key('lifetime-buy'), warnIfMissed: false);
    expect(more.purchases.repository.buys, 1, reason: 'no second purchase');

    more.purchases.repository.send(paid('jws-1'));
    await tester.pump();
    shows({'lifetime-verifying'});

    rows.unlockedNow = true;
    api.pending.single.complete(const Verified(VerifyOutcome.granted));
    await tester.pumpAndSettle();
    shows({'lifetime-unlocked'});
    expect(find.text('Freigeschaltet'), findsOneWidget);
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsOneWidget);
  });

  testWidgets('Ask to Buy: waiting for approval', (tester) async {
    final more = await openLifetime(tester);
    await tester.tap(key('lifetime-buy'));
    more.purchases.repository.send(const StorePending());
    await tester.pump();
    shows({'lifetime-pending'});
    expect(find.text('Wartet auf Bestätigung'), findsOneWidget);
    // iOS never reports a declined request: Buy asks again.
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    expect(enabled(tester, 'lifetime-restore'), isTrue);
    await tester.tap(key('lifetime-buy'));
    expect(more.purchases.repository.buys, 2);
  });

  testWidgets('canceled quietly, buy again', (tester) async {
    final more = await openLifetime(tester);
    await tester.tap(key('lifetime-buy'));
    more.purchases.repository.send(const StoreCanceled());
    await tester.pump();
    shows({'lifetime-canceled'});
    expect(enabled(tester, 'lifetime-buy'), isTrue);
  });

  testWidgets('a verification without answer: error, retry verifies', (
    tester,
  ) async {
    final api = FakePurchaseApi(
      answer: const VerificationFailed(VerifyProblem.server, 'not_configured'),
    );
    final more = await openLifetime(tester, api: api);
    more.purchases.repository.send(paid('jws-1'));
    await tester.pumpAndSettle();
    shows({'lifetime-error', 'lifetime-retry'});
    expect(find.textContaining('not_configured'), findsOneWidget);
    expect(more.purchases.repository.finished, isEmpty);

    api.answer = const Verified(VerifyOutcome.granted);
    await tester.tap(key('lifetime-retry'));
    await tester.pumpAndSettle();
    expect(more.purchases.repository.finished, hasLength(1));
    expect(key('lifetime-error'), findsNothing);
  });

  testWidgets('offline verification says the purchase is kept', (tester) async {
    final more = await openLifetime(
      tester,
      api: FakePurchaseApi(
        answer: const VerificationFailed(VerifyProblem.offline, 'offline'),
      ),
    );
    more.purchases.repository.send(paid('jws-1'));
    await tester.pumpAndSettle();
    shows({'lifetime-error', 'lifetime-retry'});
    expect(find.textContaining('bleibt gespeichert'), findsOneWidget);
  });

  testWidgets('not in the store yet: coming soon, retry', (tester) async {
    final store = FakePurchaseRepository(product: const ProductNotFound());
    await openLifetime(tester, store: store);
    shows({'lifetime-unavailable', 'lifetime-retry'});
    expect(find.text('Hummlist Lifetime ist bald verfügbar.'), findsOneWidget);
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsOneWidget);

    store.product = const ProductLoaded(lifetime);
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

  testWidgets('a refused proof: not accepted, restore later, no retry', (
    tester,
  ) async {
    final more = await openLifetime(
      tester,
      api: FakePurchaseApi(answer: const VerificationRefused('bad_signature')),
    );
    more.purchases.repository.send(paid('jws-1'));
    await tester.pumpAndSettle();
    shows({'lifetime-not-accepted'});
    expect(
      find.text(
        'Der Beleg des Stores wurde nicht angenommen (bad_signature). Falls '
        'du Hummlist Lifetime gekauft hast, tippe später auf „Käufe '
        'wiederherstellen“.',
      ),
      findsOneWidget,
    );
    expect(enabled(tester, 'lifetime-buy'), isTrue);
    expect(enabled(tester, 'lifetime-restore'), isTrue);
  });

  testWidgets('used in another household', (tester) async {
    final more = await openLifetime(
      tester,
      api: FakePurchaseApi(answer: const Verified(VerifyOutcome.usedElsewhere)),
    );
    more.purchases.repository.send(paid('jws-1'));
    await tester.pumpAndSettle();
    shows({'lifetime-used-elsewhere'});
    expect(
      find.text(
        'Dieser Kauf ist schon in einem anderen Haushalt freigeschaltet.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('refunded', (tester) async {
    final more = await openLifetime(
      tester,
      api: FakePurchaseApi(answer: const Verified(VerifyOutcome.refunded)),
    );
    more.purchases.repository.send(paid('jws-1'));
    await tester.pumpAndSettle();
    shows({'lifetime-refunded'});
  });

  testWidgets('restore finds nothing', (tester) async {
    await openLifetime(tester);
    await tester.tap(key('lifetime-restore'));
    await tester.pump();
    expect(enabled(tester, 'lifetime-restore'), isFalse);
    await tester.pump(restoreGrace);
    shows({'lifetime-nothing-restored'});
    expect(find.text('Kein früherer Kauf gefunden.'), findsOneWidget);
  });

  testWidgets('restore unlocks an earlier purchase', (tester) async {
    final rows = FakeEntitlementsSource();
    final store = FakePurchaseRepository()
      ..owned = [
        paid('jws-old', source: PurchaseSource.restore, alreadyFinished: true),
      ];
    await openLifetime(
      tester,
      store: store,
      entitlements: rows,
      api: FakePurchaseApi(answer: const Verified(VerifyOutcome.restored))
        ..onGrant = () => rows.unlockedNow = true,
    );
    await tester.tap(key('lifetime-restore'));
    await tester.pumpAndSettle();
    await tester.pump(restoreGrace);
    shows({'lifetime-unlocked'});
  });

  testWidgets('the store refuses: error with its code, retry', (tester) async {
    final more = await openLifetime(tester);
    await tester.tap(key('lifetime-buy'));
    more.purchases.repository.send(const StoreFailed('E42'));
    await tester.pump();
    shows({'lifetime-error', 'lifetime-retry'});
    expect(find.textContaining('E42'), findsOneWidget);
  });

  testWidgets('the web app sells nothing, says where to buy', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(product: const PurchasesUnsupported()),
    );
    shows({'lifetime-web'});
    expect(
      find.text('Hummlist Lifetime gibt es in der iOS- und Android-App.'),
      findsOneWidget,
    );
    expect(key('lifetime-buy'), findsNothing);
    expect(key('lifetime-restore'), findsNothing);
  });

  testWidgets('the web app shows the unlock the household has', (tester) async {
    await openLifetime(
      tester,
      store: FakePurchaseRepository(product: const PurchasesUnsupported()),
      entitlements: FakeEntitlementsSource(unlockedNow: true),
    );
    shows({'lifetime-web', 'lifetime-unlocked'});
  });

  testWidgets('English', (tester) async {
    final more = await openLifetime(tester, language: AppLanguage.en);
    expect(find.text('Hummlist Lifetime'), findsOneWidget);
    expect(find.text('Buy for 9,99 €'), findsOneWidget);
    expect(find.text('Restore purchases'), findsOneWidget);
    await tester.tap(key('lifetime-buy'));
    more.purchases.repository.send(const StorePending());
    await tester.pump();
    expect(find.text('Waiting for approval'), findsOneWidget);
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
