import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/flags.dart';
import 'package:family_groceries/app/localizations.dart';
import 'package:family_groceries/app/notices.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/list/list_view/item_row.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/log/model.dart';
import 'package:family_groceries/log/trip_repository.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../list/fake_repository.dart';
import '../list/memory_cache.dart';
import 'fakes.dart';
import 'harness.dart' show Tracked;

typedef Shop = ({
  FakeRepository repo,
  ListCubit list,
  FakeTrips trips,
  Tracked analytics,
});

/// Job 199: the list offers to log a trip once a store's items are ticked
/// off (H2), one card per store (H3).
void main() {
  setUp(
    () => VisibilityDetectorController.instance.updateInterval = Duration.zero,
  );

  /// The List tab on a 390x844 phone, the flag `grocery-log` on unless
  /// [flagOn] is false, with what [seed] puts on the server.
  Future<Shop> pumpList(
    WidgetTester tester, {
    required void Function(FakeRepository repo) seed,
    bool flagOn = true,
  }) async {
    tester.view
      ..devicePixelRatio = 3
      ..physicalSize = const Size(390 * 3, 844 * 3);
    addTearDown(tester.view.reset);
    final repo = FakeRepository();
    seed(repo);
    final list = ListCubit(repo, MemoryListCache(), userId: 'peter')..start();
    addTearDown(list.close);
    final flags = Flags(forced: {if (flagOn) groceryLogFlag});
    addTearDown(flags.close);
    final trips = FakeTrips();
    final analytics = Tracked();
    final popups = Popups();
    addTearDown(popups.dispose);
    await tester.pumpWidget(
      MultiRepositoryProvider(
        providers: [
          RepositoryProvider<TripRepository>.value(value: trips),
          RepositoryProvider<Analytics>.value(value: analytics),
        ],
        child: MultiBlocProvider(
          providers: [
            BlocProvider.value(value: flags),
            BlocProvider.value(value: list),
          ],
          child: MaterialApp(
            localizationsDelegates: appLocalizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: const Locale('de'),
            navigatorObservers: [popups],
            builder: (context, child) =>
                NoticesHost(popups: popups, child: child!),
            home: const ShoppingList(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return (repo: repo, list: list, trips: trips, analytics: analytics);
  }

  Finder row(String name) =>
      find.byWidgetPredicate((w) => w is ItemRow && w.item.name == name);
  Finder card(String? store) =>
      find.byKey(ValueKey('trip-prompt-${store ?? 'none'}'));

  Future<void> tick(WidgetTester tester, String name) async {
    await tester.tap(row(name));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
  }

  /// Lea's phone ticks [item] off; the list hears it over realtime.
  Future<void> partnerTicks(Shop shop, Item item, WidgetTester tester) async {
    final bought = item.copyWith(
      status: ItemStatus.bought,
      boughtAt: () => DateTime.now().toUtc(),
    );
    shop.repo.rows[item.id] = bought;
    shop.repo.emitItem!(bought);
    await tester.pumpAndSettle();
  }

  testWidgets('no card on the first tick while Lidl has open items; the '
      'second empties it and offers logging there', (tester) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Milch', storeId: 'lidl', quantity: '2 l')
        ..remoteAdd('Brot', storeId: 'lidl')
        ..remoteAdd('Seife', storeId: 'dm'),
    );
    await tick(tester, 'Milch');
    expect(card('lidl'), findsNothing);
    await tick(tester, 'Brot');
    expect(card('lidl'), findsOneWidget);
    expect(find.text('Einkauf bei Lidl eintragen?'), findsOneWidget);
    expect(find.text('2 Artikel abgehakt: Milch, Brot'), findsOneWidget);
    expect(card('dm'), findsNothing, reason: 'Seife is still open');
    expect(row('Seife'), findsOneWidget);
  });

  testWidgets('two stores ticked off: two cards, in store order; an item '
      'without a store gets its own', (tester) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Milch', storeId: 'lidl')
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Tee'),
    );
    for (final name in ['Milch', 'Seife', 'Tee']) {
      await tick(tester, name);
    }
    expect(card('dm'), findsOneWidget);
    expect(card('lidl'), findsOneWidget);
    expect(card(null), findsOneWidget);
    expect(find.text('Einkauf eintragen?'), findsOneWidget);
    final ys = [
      for (final store in ['dm', 'lidl', null])
        tester.getTopLeft(card(store)).dy,
    ];
    expect(ys, [...ys]..sort());
  });

  testWidgets('an item put back before the store empties is not on its '
      'card', (tester) async {
    late Item milk;
    final shop = await pumpList(
      tester,
      seed: (repo) {
        milk = repo.remoteAdd('Milch', storeId: 'lidl');
        repo.remoteAdd('Brot', storeId: 'lidl');
      },
    );
    await tick(tester, 'Milch');
    shop.list.readd(milk.id);
    await tester.pumpAndSettle();
    await tick(tester, 'Brot');
    expect(card('lidl'), findsNothing, reason: 'Milch is open again');
    // Lea deletes the Milch: Lidl is done, with only the Brot ticked.
    shop.repo.rows.remove(milk.id);
    shop.repo.emitDelete!(milk.id);
    await tester.pumpAndSettle();
    expect(card('lidl'), findsOneWidget);
    expect(find.text('1 Artikel abgehakt: Brot'), findsOneWidget);
  });

  testWidgets("the partner's ticks never prompt", (tester) async {
    late Item milk;
    late Item bread;
    final shop = await pumpList(
      tester,
      seed: (repo) {
        milk = repo.remoteAdd('Milch', storeId: 'lidl');
        bread = repo.remoteAdd('Brot', storeId: 'lidl');
      },
    );
    await partnerTicks(shop, milk, tester);
    await partnerTicks(shop, bread, tester);
    expect(row('Milch'), findsNothing);
    expect(card('lidl'), findsNothing);
  });

  testWidgets('flag off: no card', (tester) async {
    await pumpList(
      tester,
      flagOn: false,
      seed: (repo) => repo.remoteAdd('Milch', storeId: 'lidl'),
    );
    await tick(tester, 'Milch');
    expect(row('Milch'), findsNothing);
    expect(card('lidl'), findsNothing);
  });

  testWidgets('Eintragen opens the trip sheet with Lidl, today and the '
      'ticked items; saving logs it and the card goes', (tester) async {
    final shop = await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Milch', storeId: 'lidl', quantity: '2 l')
        ..remoteAdd('Brot', storeId: 'lidl'),
    );
    await tick(tester, 'Milch');
    await tick(tester, 'Brot');
    await tester.tap(find.byKey(const ValueKey('trip-prompt-log')));
    await tester.pumpAndSettle();
    expect(find.text('Einkauf eintragen'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.widgetWithText(TextField, 'Milch'),
      ),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('trip-save')));
    await tester.pumpAndSettle();
    final [saved] = shop.trips.saved;
    final today = DateTime.now();
    expect(saved.storeId, 'lidl');
    expect(saved.day, DateTime(today.year, today.month, today.day));
    expect(saved.items, const [
      TripItem(name: 'Milch', quantity: '2 l'),
      TripItem(name: 'Brot'),
    ]);
    expect(
      [
        for (final (event, properties) in shop.analytics.events)
          if (event == 'trip_logged') properties,
      ],
      [
        {'source': 'prompt'},
      ],
    );
    expect(card('lidl'), findsNothing);
    expect(find.text('Einkauf eingetragen'), findsOneWidget);
  });

  testWidgets('a closed sheet keeps the card; Später removes it', (
    tester,
  ) async {
    final shop = await pumpList(
      tester,
      seed: (repo) => repo.remoteAdd('Milch', storeId: 'lidl'),
    );
    await tick(tester, 'Milch');
    await tester.tap(find.byKey(const ValueKey('trip-prompt-log')));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(195, 20));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
    expect(card('lidl'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('trip-prompt-later')));
    await tester.pumpAndSettle();
    expect(card('lidl'), findsNothing);
    expect(shop.trips.saved, isEmpty);
  });

  testWidgets('a second Eintragen after a lost answer writes the same trip', (
    tester,
  ) async {
    final shop = await pumpList(
      tester,
      seed: (repo) => repo..remoteAdd('Milch', storeId: 'lidl'),
    );
    await tick(tester, 'Milch');
    shop.trips.loseAnswer = true;
    await tester.tap(find.byKey(const ValueKey('trip-prompt-log')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('trip-save')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('trip-failure')), findsOneWidget);
    Navigator.of(tester.element(find.byKey(const ValueKey('trip-sheet'))))
        .pop();
    await tester.pumpAndSettle();
    expect(card('lidl'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('trip-prompt-log')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('trip-save')));
    await tester.pumpAndSettle();
    expect(card('lidl'), findsNothing);
    expect(shop.trips.saved, hasLength(2));
    expect(shop.trips.rows, hasLength(1));
  });
}
