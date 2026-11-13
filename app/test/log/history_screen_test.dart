import 'dart:ui' show Tristate;

import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/list/foldout_chips.dart' show OptionChip;
import 'package:family_groceries/log/model.dart';
import 'package:family_groceries/log/store_dot.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'fakes.dart';
import 'harness.dart';

/// Job 199: the Verlauf tab, G1 (journal under a month calendar) and G2
/// (by store), one button cycling them. Today is Thursday 12 November 2026.
void main() {
  Finder key(String k) => find.byKey(ValueKey(k));
  Finder dot(String day, int i) => key('log-dot-$day-$i');
  Finder dayCell(String day) => key('log-day-$day');
  const toggle = ValueKey('log-view-toggle');

  String tooltipOf(WidgetTester tester) =>
      tester.widget<IconButton>(find.byKey(toggle)).tooltip!;

  double top(WidgetTester tester, Finder finder) =>
      tester.getTopLeft(finder).dy;

  group('the view toggle', () {
    testWidgets('without a saved choice: the journal under the calendar, the '
        'button offering the view by store', (tester) async {
      await pumpHistory(tester, trips: [trip(2026, 11, 10, store: 'lidl')]);
      expect(key('log-journal'), findsOneWidget);
      expect(key('log-calendar'), findsOneWidget);
      expect(key('log-stores'), findsNothing);
      expect(tooltipOf(tester), 'Nach Laden anzeigen');
    });

    testWidgets('cycles journal, stores, journal and is kept across a '
        'restart', (tester) async {
      final trips = [trip(2026, 11, 10, store: 'lidl')];
      final first = await pumpHistory(tester, trips: trips);
      await tester.tap(find.byKey(toggle));
      await tester.pumpAndSettle();
      expect(key('log-stores'), findsOneWidget);
      expect(key('log-calendar'), findsNothing, reason: 'G2 has no calendar');
      expect(tooltipOf(tester), 'Nach Datum anzeigen');

      // A restart: the screen gone, then built again on the same device.
      await tester.pumpWidget(const SizedBox());
      await pumpHistory(tester, trips: trips, cache: first.cache);
      expect(key('log-stores'), findsOneWidget);

      await tester.tap(find.byKey(toggle));
      await tester.pumpAndSettle();
      expect(key('log-journal'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await pumpHistory(tester, trips: trips, cache: first.cache);
      expect(key('log-journal'), findsOneWidget);
    });
  });

  testWidgets('a trip saved while the tab was behind another shows once it '
      'is back', (tester) async {
    final shown = ValueNotifier(true);
    addTearDown(shown.dispose);
    final history = await pumpHistory(tester, shown: shown);
    expect(key('log-empty'), findsOneWidget);
    shown.value = false;
    await tester.pumpAndSettle();
    final logged = trip(2026, 11, 12, store: 'lidl', items: ['Brot']);
    history.trips.rows[logged.id] = logged;
    await tester.pumpAndSettle();
    expect(find.text('Brot'), findsNothing);
    shown.value = true;
    await tester.pumpAndSettle();
    expect(key('log-empty'), findsNothing);
    expect(find.text('Brot'), findsOneWidget);
  });

  testWidgets("a screen reader's headers are the month and each store's "
      'name alone, not the days or the + under them', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpHistory(tester, trips: [trip(2026, 11, 10, store: 'lidl')]);
    void isLoneHeader(String text) {
      final node = tester.getSemantics(find.text(text));
      expect(node.flagsCollection.isHeader, isTrue, reason: text);
      expect(node.label, text);
      expect(node.childrenCount, 0, reason: '$text holds nothing else');
    }

    isLoneHeader('November 2026');
    await tester.tap(find.byKey(toggle));
    await tester.pumpAndSettle();
    isLoneHeader('Lidl');
    semantics.dispose();
  });

  testWidgets('G1: this week, last week, then each month, newest first', (
    tester,
  ) async {
    final thu = trip(2026, 11, 12, store: 'lidl', items: ['Milch']);
    final mon = trip(2026, 11, 9, store: 'rewe', items: ['Brot']);
    final lastWeek = trip(2026, 11, 4, store: 'dm', items: ['Seife']);
    final october = trip(2026, 10, 20, store: 'lidl', items: ['Kaffee']);
    await pumpHistory(tester, trips: [october, mon, lastWeek, thu]);
    final labels = [
      find.text('DIESE WOCHE'),
      key('log-trip-${thu.id}'),
      key('log-trip-${mon.id}'),
      find.text('LETZTE WOCHE'),
      key('log-trip-${lastWeek.id}'),
    ];
    final ys = [for (final f in labels) top(tester, f)];
    expect(ys, [...ys]..sort(), reason: 'in this order, top to bottom');
    await tester.scrollUntilVisible(key('log-trip-${october.id}'), 200);
    expect(find.text('OKTOBER 2026'), findsOneWidget);
    expect(
      top(tester, find.text('OKTOBER 2026')),
      lessThan(top(tester, key('log-trip-${october.id}'))),
    );
    // Heute, the store, the items.
    await tester.scrollUntilVisible(key('log-trip-${thu.id}'), -200);
    expect(
      find.descendant(
        of: key('log-trip-${thu.id}'),
        matching: find.textContaining('Lidl'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Heute'), findsOneWidget);
  });

  testWidgets('a trip card: the first three items and how many more', (
    tester,
  ) async {
    final big = trip(
      2026,
      11,
      10,
      store: 'rewe',
      items: ['Milch', 'Eier', 'Äpfel', 'Brot'],
    );
    await pumpHistory(tester, trips: [big]);
    expect(find.text('Milch, Eier, Äpfel und 1 mehr'), findsOneWidget);
    expect(find.text('4 Artikel'), findsOneWidget);
    expect(find.textContaining('Di., 10. Nov.'), findsOneWidget);
  });

  testWidgets('G2: every store in household order, empty ones too, then a '
      "gone store's trips by their saved name, then Ohne Laden", (
    tester,
  ) async {
    final lidlTrip = trip(2026, 11, 10, store: 'lidl');
    final gone = trip(2026, 11, 8, storeName: 'Edeka');
    final none = trip(2026, 11, 6);
    final cache = emptyCache();
    await cache.saveLogView('stores');
    await pumpHistory(tester, trips: [none, gone, lidlTrip], cache: cache);
    expect(key('log-stores'), findsOneWidget);
    final blocks = [
      'log-store-lidl',
      'log-store-rewe',
      'log-store-dm',
      'log-store-Edeka',
      'log-store-none',
    ];
    for (final b in blocks) {
      await tester.scrollUntilVisible(key(b), 200);
    }
    await tester.scrollUntilVisible(key('log-store-lidl'), -400);
    final ys = <double>[];
    for (final b in blocks) {
      await tester.scrollUntilVisible(key(b), 200);
      ys.add(tester.getTopLeft(key(b)).dy);
    }
    expect(find.text('Edeka'), findsOneWidget);
    expect(
      key('log-store-add-Edeka'),
      findsNothing,
      reason: 'a gone store cannot be picked',
    );
    await tester.scrollUntilVisible(key('log-store-lidl'), -400);
    expect(
      tester.getTopLeft(key('log-trip-${lidlTrip.id}')).dy,
      greaterThan(tester.getTopLeft(key('log-store-lidl')).dy),
    );
    expect(
      find.text('Noch kein Einkauf'),
      findsNWidgets(2),
      reason: 'Rewe and dm',
    );
  });

  group('the calendar', () {
    final day12 = [
      trip(2026, 11, 12, store: 'lidl'),
      trip(2026, 11, 12, store: 'rewe'),
      trip(2026, 11, 12, store: 'lidl'),
    ];
    final five = [for (var i = 0; i < 5; i++) trip(2026, 11, 5, store: 'dm')];
    final trips = [
      ...day12,
      trip(2026, 11, 10, store: 'lidl'),
      trip(2026, 11, 9, store: 'rewe'),
      trip(2026, 11, 9),
      ...five,
    ];

    testWidgets('one overlapping dot per trip, at most three, no +N', (
      tester,
    ) async {
      await pumpHistory(tester, trips: trips);
      int dots(String day) => [
        for (var i = 0; i < 6; i++)
          if (tester.any(dot(day, i))) i,
      ].length;
      expect(dots('2026-11-11'), 0);
      expect(dots('2026-11-10'), 1);
      expect(dots('2026-11-09'), 2);
      expect(dots('2026-11-12'), 3, reason: 'Lidl twice and Rewe once');
      expect(dots('2026-11-05'), 3, reason: 'five trips: still three');
      expect(
        find.descendant(
          of: dayCell('2026-11-05'),
          matching: find.textContaining('+'),
        ),
        findsNothing,
      );
      // They overlap: each starts before the one left of it ends.
      final a = tester.getRect(dot('2026-11-12', 0));
      final b = tester.getRect(dot('2026-11-12', 1));
      expect(b.left, lessThan(a.right));
      expect(b.left, greaterThan(a.left));
      expect(
        tester.getSemantics(dayCell('2026-11-05')).label,
        'Donnerstag, 5. November, 5 Einkäufe',
      );
      expect(
        tester.getSemantics(dayCell('2026-11-12')).label,
        'Donnerstag, 12. November, 3 Einkäufe',
      );
    });

    testWidgets('the newest dot lies on top of the pile', (tester) async {
      await pumpHistory(tester, trips: trips);

      /// Of [dots] overlapping at [point], the one painted on top: a
      /// Stack hit-tests its children top first and stops at the first.
      int topmost(Offset point, List<int> dots) {
        final path = tester.hitTestOnBinding(point).path.map((e) => e.target);
        return dots.singleWhere(
          (i) => path.contains(tester.renderObject(dot('2026-11-12', i))),
        );
      }

      for (final (under, over) in [(1, 0), (2, 1)]) {
        final overlap = tester
            .getRect(dot('2026-11-12', over))
            .intersect(tester.getRect(dot('2026-11-12', under)));
        expect(overlap.width, greaterThan(0));
        expect(topmost(overlap.center, [over, under]), over);
      }
      expect(
        tester.getRect(dot('2026-11-12', 0)).left,
        lessThan(tester.getRect(dot('2026-11-12', 1)).left),
        reason: 'newest still leftmost',
      );
    });

    testWidgets("dots take the trip's store colour, newest first; no store "
        'is neutral', (tester) async {
      await pumpHistory(tester, trips: trips);
      Color colour(String day, int i) =>
          tester.widget<StoreDot>(dot(day, i)).color;
      const t = SnacklistColors.light;
      expect(
        [for (var i = 0; i < 3; i++) colour('2026-11-12', i)],
        [t.brand, t.tomato, t.brand],
        reason: 'Lidl (newest), Rewe, Lidl',
      );
      expect(colour('2026-11-09', 0), t.divider, reason: 'no store');
      expect(colour('2026-11-09', 1), t.tomato);
    });

    testWidgets('a future day is no button; tapping it does nothing', (
      tester,
    ) async {
      await pumpHistory(tester, trips: trips);
      final tomorrow = tester.getSemantics(dayCell('2026-11-13'));
      expect(tomorrow.flagsCollection.isButton, isFalse);
      expect(tomorrow.getSemanticsData().hasAction(SemanticsAction.tap), false);
      final today = tester.getSemantics(dayCell('2026-11-12'));
      expect(today.flagsCollection.isButton, isTrue);
      await tester.tap(dayCell('2026-11-13'));
      await tester.pumpAndSettle();
      expect(key('log-day-filter'), findsNothing);
    });

    testWidgets("a day's tap shows only its trips; a second tap shows all "
        'again, as does the clear button', (tester) async {
      await pumpHistory(tester, trips: trips);
      await tester.tap(dayCell('2026-11-09'));
      await tester.pumpAndSettle();
      expect(find.text('Einkäufe am 9. November'), findsOneWidget);
      final shown = find.byWidgetPredicate(
        (w) =>
            w.key is ValueKey<String> &&
            (w.key! as ValueKey<String>).value.startsWith('log-trip-'),
      );
      expect(shown, findsNWidgets(2));
      expect(find.text('DIESE WOCHE'), findsNothing);

      await tester.tap(dayCell('2026-11-09'));
      await tester.pumpAndSettle();
      expect(key('log-day-filter'), findsNothing);
      expect(find.text('DIESE WOCHE'), findsOneWidget);

      await tester.tap(dayCell('2026-11-10'));
      await tester.pumpAndSettle();
      expect(shown, findsOneWidget);
      await tester.tap(key('log-day-clear'));
      await tester.pumpAndSettle();
      expect(key('log-day-filter'), findsNothing);
    });

    testWidgets('a past day without trips offers to log one on that day', (
      tester,
    ) async {
      final history = await pumpHistory(tester, trips: trips);
      await tester.tap(dayCell('2026-11-06'));
      await tester.pumpAndSettle();
      expect(find.text('Keine Einkäufe an diesem Tag'), findsOneWidget);
      await tester.tap(key('log-day-add'));
      await tester.pumpAndSettle();
      expect(key('trip-sheet'), findsOneWidget);
      expect(find.text('Fr., 6. Nov.'), findsOneWidget);
      await tester.tap(key('trip-store-lidl'));
      await tester.enterText(key('trip-item-name-0'), 'Kaffee');
      await tester.pump();
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(history.trips.saved.single.day, DateTime(2026, 11, 6));
      expect(dot('2026-11-06', 0), findsOneWidget, reason: 'refreshed');
    });

    testWidgets("the month goes back to the oldest trip's; next stops at "
        'this month', (tester) async {
      await pumpHistory(tester, trips: [...trips, trip(2026, 10, 20)]);
      expect(find.text('November 2026'), findsOneWidget);
      expect(
        tester.widget<IconButton>(key('log-month-next')).onPressed,
        isNull,
      );
      await tester.tap(key('log-month-previous'));
      await tester.pumpAndSettle();
      expect(find.text('Oktober 2026'), findsOneWidget);
      expect(dayCell('2026-10-31'), findsOneWidget);
      expect(
        tester.widget<IconButton>(key('log-month-previous')).onPressed,
        isNull,
        reason: 'no trip before October',
      );
      await tester.tap(key('log-month-next'));
      await tester.pumpAndSettle();
      expect(find.text('November 2026'), findsOneWidget);
    });
  });

  group('the sheet', () {
    testWidgets('logs a new trip: the store, today, the items as typed', (
      tester,
    ) async {
      final history = await pumpHistory(tester, trips: [trip(2026, 11, 2)]);
      await tester.tap(key('log-add'));
      await tester.pumpAndSettle();
      expect(find.text('Einkauf eintragen'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(key('trip-save')).onPressed,
        isNull,
        reason: 'no item yet',
      );
      await tester.tap(key('trip-store-rewe'));
      await tester.enterText(key('trip-item-name-0'), ' Milch ');
      await tester.pump();
      await tester.enterText(key('trip-item-quantity-0'), '2 l');
      await tester.pump();
      await tester.tap(key('trip-item-add'));
      await tester.pumpAndSettle();
      await tester.enterText(key('trip-item-name-1'), 'Brot');
      await tester.pump();
      await tester.tap(key('trip-item-add'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(key('trip-sheet'), findsNothing);
      final saved = history.trips.saved.single;
      expect(saved.storeId, 'rewe');
      expect(saved.day, DateTime(2026, 11, 12));
      expect(saved.items, const [
        TripItem(name: 'Milch', quantity: '2 l'),
        TripItem(name: 'Brot'),
      ], reason: 'trimmed, the empty row left out');
      expect(
        [for (final (e, p) in history.analytics.events) '$e $p'],
        ['trip_logged {source: manual}'],
      );
      expect(key('log-trip-${saved.id}'), findsOneWidget);
    });

    bool picked(WidgetTester tester, String chip) =>
        tester.getSemantics(key(chip)).flagsCollection.isSelected ==
        Tristate.isTrue;

    for (final (from, opener) in [
      ('the header', 'log-add'),
      ('the empty state', 'log-empty-add'),
    ]) {
      testWidgets('from $from a new trip starts with no store chosen; a save '
          'without one says so under the chips and saves nothing; „Ohne '
          'Laden“ is a choice', (tester) async {
        final handle = tester.ensureSemantics();
        final history = await pumpHistory(
          tester,
          trips: opener == 'log-add' ? [trip(2026, 11, 2)] : const [],
        );
        await tester.tap(key(opener));
        await tester.pumpAndSettle();
        for (final chip in [
          'trip-store-lidl',
          'trip-store-rewe',
          'trip-store-dm',
          'trip-store-none',
        ]) {
          expect(picked(tester, chip), isFalse, reason: chip);
        }
        await tester.enterText(key('trip-item-name-0'), 'Milch');
        await tester.pump();
        await tester.tap(key('trip-save'));
        await tester.pumpAndSettle();
        expect(history.trips.saved, isEmpty);
        expect(key('trip-sheet'), findsOneWidget);
        final missing = key('trip-store-missing');
        expect(find.text('Wähle einen Laden.'), findsOneWidget);
        expect(
          find.ancestor(of: missing, matching: find.byType(OptionChip)),
          findsNothing,
          reason: 'outside any pill',
        );
        expect(
          tester.getTopLeft(missing).dy,
          greaterThanOrEqualTo(tester.getBottomLeft(key('trip-store-none')).dy),
          reason: 'below the chips',
        );

        await tester.tap(key('trip-store-none'));
        await tester.pumpAndSettle();
        expect(missing, findsNothing);
        expect(picked(tester, 'trip-store-none'), isTrue);
        await tester.tap(key('trip-save'));
        await tester.pumpAndSettle();
        final saved = history.trips.saved.single;
        expect(saved.storeId, isNull);
        expect(saved.storeName, isNull);
        handle.dispose();
      });
    }

    testWidgets('a household without stores starts at „Ohne Laden“', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final history = await pumpHistory(tester, stores: const []);
      await tester.tap(key('log-empty-add'));
      await tester.pumpAndSettle();
      expect(picked(tester, 'trip-store-none'), isTrue);
      await tester.enterText(key('trip-item-name-0'), 'Milch');
      await tester.pump();
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(history.trips.saved.single.storeId, isNull);
      handle.dispose();
    });

    testWidgets("G2's „Ohne Laden“ button starts the trip at „Ohne Laden“", (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final cache = emptyCache();
      await cache.saveLogView('stores');
      final history = await pumpHistory(
        tester,
        trips: [trip(2026, 11, 2)],
        cache: cache,
      );
      await tester.scrollUntilVisible(key('log-store-add-none'), 100);
      await tester.tap(key('log-store-add-none'));
      await tester.pumpAndSettle();
      expect(picked(tester, 'trip-store-none'), isTrue);
      await tester.enterText(key('trip-item-name-0'), 'Brot');
      await tester.pump();
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(history.trips.saved.single.storeId, isNull);
      handle.dispose();
    });

    testWidgets('edits a trip under its id; no trip_logged', (tester) async {
      final old = trip(2026, 11, 10, store: 'lidl', items: ['Milch', 'Brot']);
      final history = await pumpHistory(tester, trips: [old]);
      await tester.tap(key('log-trip-${old.id}'));
      await tester.pumpAndSettle();
      expect(find.text('Einkauf bearbeiten'), findsOneWidget);
      expect(find.text('Di., 10. Nov.'), findsOneWidget);
      await tester.tap(key('trip-item-remove-1'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-day-yesterday'));
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      final saved = history.trips.saved.single;
      expect(saved.id, old.id);
      expect(saved.storeId, 'lidl');
      expect(saved.day, DateTime(2026, 11, 11));
      expect(saved.items, const [TripItem(name: 'Milch')]);
      expect(history.analytics.events, isEmpty);
    });

    testWidgets("a trip whose store was deleted keeps the store's name: "
        'picked, marked deleted, saved unchanged with it', (tester) async {
      final gone = trip(2026, 11, 10, storeName: 'Kaufland');
      final history = await pumpHistory(tester, trips: [gone]);
      await tester.tap(key('log-trip-${gone.id}'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: key('trip-store-gone'),
          matching: find.text('Kaufland'),
        ),
        findsOneWidget,
      );
      expect(key('trip-store-none'), findsNothing);
      expect(find.text('Ohne Laden'), findsNothing);
      expect(
        tester.getSemantics(key('trip-store-gone')).flagsCollection.isSelected,
        Tristate.isTrue,
      );
      expect(find.text('Dieser Laden wurde gelöscht.'), findsOneWidget);
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      final saved = history.trips.saved.single;
      expect(saved.storeId, isNull);
      expect(saved.storeName, 'Kaufland');
      expect(key('log-trip-${gone.id}'), findsOneWidget);
      expect(
        find.descendant(
          of: key('log-trip-${gone.id}'),
          matching: find.textContaining('Kaufland'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('deletes a trip after asking', (tester) async {
      final old = trip(2026, 11, 10, store: 'lidl');
      final history = await pumpHistory(tester, trips: [old]);
      await tester.tap(key('log-trip-${old.id}'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(key('trip-delete'));
      await tester.tap(key('trip-delete'));
      await tester.pumpAndSettle();
      expect(find.text('Einkauf löschen?'), findsOneWidget);
      await tester.tap(key('trip-delete-confirm'));
      await tester.pumpAndSettle();
      expect(history.trips.deleted, [old.id]);
      expect(key('trip-sheet'), findsNothing);
      expect(key('log-empty'), findsOneWidget);
    });

    testWidgets('a failed delete is told in the sheet, which stays', (
      tester,
    ) async {
      final old = trip(2026, 11, 2);
      final history = await pumpHistory(tester, trips: [old]);
      await tester.tap(key('log-trip-${old.id}'));
      await tester.pumpAndSettle();
      history.trips.fail = true;
      await tester.tap(key('trip-delete'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-delete-confirm'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: key('trip-sheet'),
          matching: find.byKey(const ValueKey('trip-failure')),
        ),
        findsOneWidget,
      );
      expect(history.trips.rows, hasLength(1));
    });

    testWidgets('a save whose answer was lost shows once the sheet closes', (
      tester,
    ) async {
      final history = await pumpHistory(tester, trips: [trip(2026, 11, 2)]);
      await tester.tap(key('log-add'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-store-lidl'));
      await tester.enterText(key('trip-item-name-0'), 'Kakao');
      await tester.pump();
      history.trips.loseAnswer = true;
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      Navigator.of(tester.element(key('trip-sheet'))).pop();
      await tester.pumpAndSettle();
      expect(find.textContaining('Kakao'), findsOneWidget);
    });

    testWidgets('a failed save is told and keeps the sheet and its items', (
      tester,
    ) async {
      final history = await pumpHistory(tester, trips: [trip(2026, 11, 2)]);
      await tester.tap(key('log-add'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-store-lidl'));
      await tester.enterText(key('trip-item-name-0'), 'Milch');
      await tester.pump();
      history.trips.fail = true;
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: key('trip-sheet'),
          matching: find.text(
            'Der Einkauf konnte nicht gespeichert werden. Versuch es noch mal.',
          ),
        ),
        findsOneWidget,
      );
      expect(key('trip-save').hitTestable(), findsOneWidget);
      expect(
        find.descendant(of: key('trip-sheet'), matching: find.text('Milch')),
        findsOneWidget,
      );
      expect(history.analytics.events, isEmpty);
    });

    testWidgets('a retry after a lost answer saves the same trip, counted '
        'once', (tester) async {
      final history = await pumpHistory(tester, trips: [trip(2026, 11, 2)]);
      await tester.tap(key('log-add'));
      await tester.pumpAndSettle();
      await tester.tap(key('trip-store-lidl'));
      await tester.enterText(key('trip-item-name-0'), 'Milch');
      await tester.pump();
      history.trips.loseAnswer = true;
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(key('trip-sheet'), findsOneWidget);
      expect(history.analytics.events, isEmpty);
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(key('trip-sheet'), findsNothing);
      expect(history.trips.saved, hasLength(2));
      expect(history.trips.saved.map((t) => t.id).toSet(), hasLength(1));
      expect(history.trips.rows, hasLength(2));
      expect(
        [for (final (e, _) in history.analytics.events) e],
        ['trip_logged'],
      );
    });

    testWidgets("G2's store button starts the trip at that store", (
      tester,
    ) async {
      final cache = emptyCache();
      await cache.saveLogView('stores');
      final history = await pumpHistory(
        tester,
        trips: [trip(2026, 11, 2, store: 'lidl')],
        cache: cache,
      );
      await tester.tap(key('log-store-add-rewe'));
      await tester.pumpAndSettle();
      await tester.enterText(key('trip-item-name-0'), 'Brot');
      await tester.pump();
      await tester.tap(key('trip-save'));
      await tester.pumpAndSettle();
      expect(history.trips.saved.single.storeId, 'rewe');
    });
  });

  testWidgets('no trips: a calm empty state that offers the first, without '
      'promising anything is free', (tester) async {
    await pumpHistory(tester);
    expect(key('log-empty'), findsOneWidget);
    expect(find.text('Noch keine Einkäufe'), findsOneWidget);
    expect(find.textContaining('kostenlos'), findsNothing);
    expect(find.textContaining('gratis'), findsNothing);
    await tester.tap(key('log-empty-add'));
    await tester.pumpAndSettle();
    expect(key('trip-sheet'), findsOneWidget);
  });

  testWidgets('a failed load offers a retry', (tester) async {
    final server = FakeTrips([trip(2026, 11, 2, store: 'lidl')])..fail = true;
    await pumpHistory(tester, server: server);
    expect(key('log-retry'), findsOneWidget);
    server.fail = false;
    await tester.tap(key('log-retry'));
    await tester.pumpAndSettle();
    expect(key('log-journal'), findsOneWidget);
  });

  for (final brightness in Brightness.values) {
    testWidgets('fits 358 px with large text, ${brightness.name}', (
      tester,
    ) async {
      final trips = [
        for (var d = 1; d <= 12; d++)
          trip(
            2026,
            11,
            d,
            store: ['lidl', 'rewe', 'dm', null][d % 4],
            storeName: d % 4 == 3 ? 'Wochenmarkt am Rathausplatz' : null,
            items: ['Haferflocken', 'Passierte Tomaten', 'Bergkäse', 'Milch'],
          ),
        trip(2026, 11, 12, store: 'rewe'),
        trip(2026, 11, 12, store: 'dm'),
      ];
      await pumpHistory(
        tester,
        trips: trips,
        brightness: brightness,
        textScale: 2,
      );
      expect(tester.takeException(), isNull, reason: 'G1');
      await tester.tap(find.byKey(toggle));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'G2');
      await tester.tap(find.byKey(toggle));
      await tester.pumpAndSettle();
      await tester.tap(key('log-add'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'the sheet');
    });
  }
}
