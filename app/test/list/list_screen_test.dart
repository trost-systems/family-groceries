import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/list/list_view/dividers.dart';
import 'package:family_groceries/list/list_view/item_row.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visibility_detector/visibility_detector.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

void main() {
  late FakeRepository repo;
  late MemoryListCache cache;

  setUp(
    () => VisibilityDetectorController.instance.updateInterval = Duration.zero,
  );

  /// [keepCache] starts the list again on the same server and device, like
  /// an app restart.
  Future<void> pumpList(
    WidgetTester tester, {
    void Function(FakeRepository repo)? seed,
    bool keepCache = false,
  }) async {
    if (!keepCache) {
      repo = FakeRepository();
      cache = MemoryListCache();
    }
    seed?.call(repo);
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('de'),
        home: BlocProvider(
          key: UniqueKey(),
          create: (_) => ListCubit(repo, cache, userId: 'peter')..start(),
          child: const ShoppingList(
            household: Household(id: 'h', name: 'Trost'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Finder addField() => find.byKey(const ValueKey('add-item-field'));
  FocusNode fieldFocus(WidgetTester tester) =>
      tester.widget<TextField>(addField()).focusNode!;
  Finder sheet() => find.byKey(const ValueKey('add-sheet'));

  /// A sheet row by what a screen reader says for it.
  Finder sheetRow(String label) => find.descendant(
    of: sheet(),
    matching: find.byWidgetPredicate(
      (w) => w is Semantics && w.properties.label == label,
    ),
  );

  /// A 390x844 phone. The sheet's first height is half the screen, which
  /// on the test's default 800x600 is too short for its chips.
  void phone(WidgetTester tester) {
    tester.view
      ..devicePixelRatio = 3
      ..physicalSize = const Size(390 * 3, 844 * 3);
    addTearDown(tester.view.reset);
  }

  /// Waits out the typing pause and the server's answer.
  Future<void> settleRows(WidgetTester tester) async {
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();
  }

  Finder row(String name) =>
      find.byWidgetPredicate((w) => w is ItemRow && w.item.name == name);
  Finder storeDivider(String key) => find.byKey(ValueKey('store-$key'));

  /// The semantics nodes of a row and a store divider.
  Finder rowNode(String name) => find
      .descendant(
        of: row(name),
        matching: find.byWidgetPredicate(
          (w) => w is Semantics && (w.properties.button ?? false),
        ),
      )
      .first;
  Finder storeNode(String key) => find.descendant(
    of: storeDivider(key),
    matching: find.byType(StoreDivider),
  );
  Finder categoryDivider(String text) =>
      find.text(text.toUpperCase().replaceAll('ß', 'SS'));
  Item itemNamed(String name) =>
      repo.rows.values.firstWhere((i) => i.name == name);

  /// Rows top to bottom, then left to right.
  List<String> rowOrder(WidgetTester tester) {
    final rows = tester.widgetList<ItemRow>(find.byType(ItemRow)).toList()
      ..sort((a, b) {
        final pa = tester.getTopLeft(find.byWidget(a));
        final pb = tester.getTopLeft(find.byWidget(b));
        return pa.dx != pb.dx ? pa.dx.compareTo(pb.dx) : pa.dy.compareTo(pb.dy);
      });
    return [for (final r in rows) r.item.name];
  }

  /// Holds [from] past the hold delay, moves past the slop, then to [to]
  /// and lets go.
  Future<void> drag(WidgetTester tester, Offset from, Offset to) async {
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(from + const Offset(0, 12));
    await tester.pump();
    await gesture.moveTo(to);
    await tester.pump();
    await gesture.moveTo(to);
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
  }

  testWidgets('on a phone the add field waits for a tap; an empty list '
      'says so', (tester) async {
    phone(tester);
    await pumpList(tester);
    expect(
      fieldFocus(tester).hasFocus,
      isFalse,
      reason: 'phones get the keyboard only when asked',
    );
    expect(sheet(), findsNothing);
    expect(find.byType(ChoiceChip), findsNothing, reason: 'no store filter');
    expect(
      find.text('Die Liste ist leer. Tippe unten ein, was fehlt.'),
      findsOneWidget,
    );
    expect(find.text('🧺'), findsOneWidget);
    expect(find.byType(StoreDivider), findsNothing);

    await tester.tap(addField());
    await tester.pumpAndSettle();
    expect(fieldFocus(tester).hasFocus, isTrue);
    expect(sheet(), findsOneWidget, reason: 'a tap opens the add sheet');
    expect(find.text('Was brauchst du?'), findsOneWidget);
  });

  testWidgets('a category divider is its own node, outside the rows', (
    tester,
  ) async {
    phone(tester);
    await pumpList(tester);
    await tester.enterText(addField(), 'Vollmilch');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('add-sheet-close')));
    await tester.pumpAndSettle();
    expect(
      tester.getSemantics(categoryDivider('Kühlregal')),
      isSemantics(label: 'Kühlregal', isHeader: true),
    );
    expect(
      tester.getSemantics(rowNode('Vollmilch')),
      isSemantics(
        label: 'Vollmilch',
        isButton: true,
        hasTapAction: true,
        hasLongPressAction: true,
      ),
    );
  });

  testWidgets('enter adds under its category and keeps focus', (tester) async {
    phone(tester);
    await pumpList(tester);
    await tester.enterText(addField(), 'Vollmilch');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();

    expect(categoryDivider('Kühlregal'), findsOneWidget);
    expect(row('Vollmilch'), findsOneWidget);
    expect(tester.widget<TextField>(addField()).focusNode!.hasFocus, isTrue);
    expect(tester.widget<TextField>(addField()).controller!.text, isEmpty);
  });

  testWidgets('hardware enter adds once per press and keeps focus', (
    tester,
  ) async {
    phone(tester);
    await pumpList(tester);
    for (final name in ['Milch', 'Brot']) {
      await tester.enterText(addField(), name);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
    }
    expect(repo.rows.values.map((i) => i.name), ['Milch', 'Brot']);
    expect(tester.widget<TextField>(addField()).focusNode!.hasFocus, isTrue);
  });

  testWidgets('a long paste is capped at the server limit', (tester) async {
    phone(tester);
    await pumpList(tester);
    await tester.enterText(addField(), 'x' * 130);
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    expect(repo.rows.values.single.name, hasLength(120));
  });

  testWidgets('stores are sections in household order, then no store; '
      'each category one block in walk order', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Äpfel', categoryId: 'produce', storeId: 'lidl')
        ..remoteAdd('Milch', storeId: 'lidl')
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Brot')
        ..remoteAdd('Joghurt', categoryId: 'chilled', storeId: 'lidl'),
    );
    final dm = tester.getTopLeft(storeDivider('dm')).dy;
    final lidl = tester.getTopLeft(storeDivider('lidl')).dy;
    final none = tester.getTopLeft(storeDivider('none')).dy;
    expect(dm < lidl && lidl < none, isTrue, reason: 'dm, Lidl, Ohne Laden');
    // Lidl walks chilled before produce.
    expect(rowOrder(tester), ['Seife', 'Milch', 'Joghurt', 'Äpfel', 'Brot']);
    expect(categoryDivider('Kühlregal'), findsOneWidget);
    expect(
      tester.getSemantics(storeNode('lidl')),
      isSemantics(
        label: 'Lidl, 3 Artikel',
        hint: 'Zuklappen',
        isButton: true,
        hasExpandedState: true,
        isExpanded: true,
      ),
    );
    expect(find.text('Ohne Laden'), findsOneWidget);
  });

  testWidgets('a tap ticks with undo; undo puts it back in its place', (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Erbsen', categoryId: 'produce')
        ..remoteAdd('Bohnen', categoryId: 'produce')
        ..remoteAdd('Linsen', categoryId: 'produce'),
    );
    await tester.tap(row('Bohnen'));
    await tester.pump();
    expect(row('Bohnen'), findsOneWidget, reason: 'it leaves first');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Bohnen abgehakt'), findsOneWidget);
    expect(row('Bohnen'), findsNothing);
    expect(itemNamed('Bohnen').status, ItemStatus.bought);

    await tester.tap(find.text('Rückgängig'));
    await tester.pumpAndSettle();
    expect(rowOrder(tester), ['Erbsen', 'Bohnen', 'Linsen']);
  });

  testWidgets('with animations off a tap ticks at once', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Brot'));
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    await tester.pump();
    await tester.tap(row('Brot'));
    await tester.pump();
    expect(itemNamed('Brot').status, ItemStatus.bought);
    tester.platformDispatcher.clearAccessibilityFeaturesTestValue();
    await tester.pumpAndSettle();
  });

  testWidgets('a swipe to the left deletes, with undo', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Brot'));
    await tester.drag(row('Brot'), const Offset(-600, 0));
    await tester.pumpAndSettle();
    expect(repo.rows, isEmpty);
    expect(find.text('Brot gelöscht'), findsOneWidget);
    await tester.tap(find.text('Rückgängig'));
    await tester.pumpAndSettle();
    expect(row('Brot'), findsOneWidget);
  });

  testWidgets('a tap on a store folds it to its divider, across restarts', (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Milch', storeId: 'lidl'),
    );
    await tester.tap(storeDivider('dm'));
    await tester.pumpAndSettle();
    expect(row('Seife'), findsNothing);
    expect(categoryDivider('Sonstiges'), findsNothing);
    expect(row('Milch'), findsOneWidget);
    expect(
      tester.getSemantics(storeNode('dm')),
      isSemantics(
        label: 'dm, 1 Artikel',
        hint: 'Aufklappen',
        isExpanded: false,
      ),
    );
    expect(cache.prefs!.folded, {'dm'});

    await pumpList(tester, keepCache: true);
    expect(row('Seife'), findsNothing, reason: 'still folded');
    expect(storeDivider('dm'), findsOneWidget);
    await tester.tap(storeDivider('dm'));
    await tester.pumpAndSettle();
    expect(row('Seife'), findsOneWidget);
  });

  testWidgets('a stale folded store id is ignored', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Seife'));
    cache.prefs = const ListPrefs(folded: {'gone'});
    repo.remoteAdd('Shampoo', storeId: 'dm');
    await pumpList(tester, keepCache: true);
    expect(row('Seife'), findsOneWidget);
    expect(row('Shampoo'), findsOneWidget);
  });

  testWidgets('an item dropped on the upper or lower half of a row goes '
      'before or after it', (tester) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Erbsen', categoryId: 'produce')
        ..remoteAdd('Bohnen', categoryId: 'produce')
        ..remoteAdd('Linsen', categoryId: 'produce'),
    );
    final linsen = tester.getRect(row('Linsen'));
    final erbsen = tester.getRect(row('Erbsen'));
    await drag(tester, linsen.center, erbsen.topCenter + const Offset(0, 8));
    expect(repo.sent.last, isA<PlaceItem>());
    final place = repo.sent.last as PlaceItem;
    expect((place.anchorId, place.edge), (itemNamed('Erbsen').id, Edge.before));
    expect(rowOrder(tester), ['Linsen', 'Erbsen', 'Bohnen']);

    final bohnen = tester.getRect(row('Bohnen'));
    final first = tester.getRect(row('Linsen'));
    await drag(tester, first.center, bohnen.bottomCenter - const Offset(0, 8));
    expect((repo.sent.last as PlaceItem).edge, Edge.after);
    expect(rowOrder(tester), ['Erbsen', 'Bohnen', 'Linsen']);
    expect(find.byKey(const ValueKey('edit-sheet')), findsNothing);
  });

  testWidgets('dragging shows the insertion line at the hovered edge', (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Erbsen', categoryId: 'produce')
        ..remoteAdd('Bohnen', categoryId: 'produce'),
    );
    final from = tester.getCenter(row('Bohnen'));
    final target = tester.getRect(row('Erbsen'));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(from + const Offset(0, 12));
    await tester.pump();
    await gesture.moveTo(target.topCenter + const Offset(0, 6));
    await tester.pump();
    final id = itemNamed('Erbsen').id;
    final line = find.byKey(ValueKey('drop-line-$id'));
    expect(line, findsOneWidget);
    expect(tester.getRect(line).top, closeTo(target.top - 2, 0.5));
    await gesture.moveTo(target.bottomCenter - const Offset(0, 6));
    await tester.pump();
    expect(tester.getRect(line).bottom, closeTo(target.bottom + 2, 0.5));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(line, findsNothing);
  });

  testWidgets('an item dropped on a category divider goes to its end', (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Äpfel', categoryId: 'produce')
        ..remoteAdd('Milch'),
    );
    await drag(
      tester,
      tester.getCenter(row('Milch')),
      tester.getCenter(categoryDivider('Obst & Gemüse')),
    );
    final move = repo.sent.last as MoveItem;
    expect((move.categoryId, move.storeId), ('produce', null));
    expect(rowOrder(tester), ['Äpfel', 'Milch']);
  });

  testWidgets('an item dropped on a folded store goes there and keeps its '
      'category', (tester) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Milch'),
    );
    await tester.tap(storeDivider('dm'));
    await tester.pumpAndSettle();
    await drag(
      tester,
      tester.getCenter(row('Milch')),
      tester.getCenter(storeDivider('dm')),
    );
    final move = repo.sent.last as MoveItem;
    expect((move.categoryId, move.storeId), ('chilled', 'dm'));
    expect(itemNamed('Milch').storeId, 'dm');
    expect(row('Milch'), findsNothing, reason: 'dm is folded');
    expect(tester.getSemantics(storeNode('dm')).label, 'dm, 2 Artikel');
  });

  testWidgets('an empty store is a drop target too', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Milch'));
    expect(tester.getSemantics(storeNode('lidl')).label, 'Lidl, 0 Artikel');
    await drag(
      tester,
      tester.getCenter(row('Milch')),
      tester.getCenter(storeDivider('lidl')),
    );
    expect(itemNamed('Milch').storeId, 'lidl');
    expect(storeDivider('none'), findsNothing, reason: 'nothing left there');
  });

  testWidgets('dragging a store divider reorders the stores', (tester) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Milch', storeId: 'lidl'),
    );
    final from = tester.getCenter(storeDivider('lidl'));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(from - const Offset(0, 12));
    await tester.pump();
    expect(row('Seife'), findsNothing, reason: 'every store folds');
    final dm = tester.getRect(storeDivider('dm'));
    await gesture.moveTo(dm.topCenter + const Offset(0, 4));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(repo.catalogCalls, ['reorderStores(lidl, dm)']);
    expect(rowOrder(tester), ['Milch', 'Seife']);
  });

  testWidgets('dragging a category divider reorders it in its store', (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Milch', storeId: 'lidl')
        ..remoteAdd('Äpfel', categoryId: 'produce', storeId: 'lidl'),
    );
    expect(rowOrder(tester), ['Milch', 'Äpfel']);
    final from = tester.getCenter(categoryDivider('Obst & Gemüse'));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(from - const Offset(0, 12));
    await tester.pump();
    expect(row('Milch'), findsNothing, reason: 'its siblings fold');
    final chilled = tester.getRect(categoryDivider('Kühlregal'));
    await gesture.moveTo(chilled.topCenter + const Offset(0, 2));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(repo.catalogCalls, ['layout(lidl: other, produce, chilled; )']);
    expect(rowOrder(tester), ['Äpfel', 'Milch']);
  });

  testWidgets('a long press that stays put opens the edit sheet', (
    tester,
  ) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Milch'));
    final start = tester.getCenter(row('Milch'));
    final gesture = await tester.startGesture(start);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(start + const Offset(3, 2));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('edit-sheet')), findsOneWidget);
    expect(find.text('Bearbeiten: Milch'), findsOneWidget);
    expect(repo.sent, isEmpty);
  });

  testWidgets('a right click opens the edit sheet', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Milch'));
    await tester.tap(row('Milch'), buttons: kSecondaryButton);
    await tester.pumpAndSettle();
    expect(find.text('Bearbeiten: Milch'), findsOneWidget);
  });

  testWidgets('the edit sheet tags an item to a store', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Brot'));
    await tester.tap(row('Brot'), buttons: kSecondaryButton);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('chip-store')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('store-option-lidl')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('edit-done')));
    await tester.pumpAndSettle();
    expect(repo.rows.values.single.storeId, 'lidl');
    expect((repo.sent.last as EditItem).changes.toColumns(), {
      'store_id': 'lidl',
    });
  });

  testWidgets('a row: icon, quantity first, brand and properties under the '
      'name, no initial, a long name wrapped in full', (tester) async {
    const long =
        'Glutenfreie Dinkel-Vollkorn-Hafer-Kekse mit Zartbitterschokolade '
        'und Meersalz';
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Milch', brand: 'Weihenstephan', properties: '1,5 %')
        ..remoteAdd('Brot', quantity: '6')
        ..remoteAdd(long),
    );
    expect(
      find.descendant(
        of: row('Milch'),
        matching: find.text('Weihenstephan · 1,5 %'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(of: row('Brot'), matching: find.text('6× Brot')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: row('Milch'), matching: find.text('🥛')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: row('Milch'), matching: find.byType(CircleAvatar)),
      findsNothing,
    );
    final name = tester.widget<RichText>(
      find.descendant(of: row(long), matching: find.byType(RichText)).at(1),
    );
    expect(name.maxLines, isNull);
    expect(name.overflow, TextOverflow.clip);
    expect(name.softWrap, isTrue);
    final brot = tester.getSize(row('Brot')).height;
    expect(brot, greaterThanOrEqualTo(52));
    expect(tester.getSize(row(long)).height, greaterThan(brot + 20));
  });

  testWidgets('the explainer card is dismissed for good', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Brot'));
    expect(
      find.text(
        'Tippen hakt ab · Halten bearbeitet · Halten und ziehen verschiebt',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Verstanden'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('list-hint')), findsNothing);
    expect(cache.prefs!.hintDismissed, isTrue);
    await pumpList(tester, keepCache: true);
    expect(find.byKey(const ValueKey('list-hint')), findsNothing);
  });

  testWidgets("a store's menu moves it and opens its layout screen", (
    tester,
  ) async {
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Milch', storeId: 'lidl'),
    );
    await tester.tap(storeDivider('lidl'), buttons: kSecondaryButton);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('section-menu-down')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('section-menu-up')));
    await tester.pumpAndSettle();
    expect(repo.catalogCalls, ['reorderStores(lidl, dm)']);

    final start = tester.getCenter(storeDivider('dm'));
    final gesture = await tester.startGesture(start);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.up();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('section-menu-layout')));
    await tester.pumpAndSettle();
    expect(find.text('dm: Reihenfolge'), findsOneWidget);
    expect(
      find.byType(Switch),
      findsNothing,
      reason: 'H folds, it does not hide',
    );
  });

  testWidgets('a hold on the no-store divider opens its menu', (tester) async {
    await pumpList(tester, seed: (repo) => repo.remoteAdd('Brot'));
    await tester.longPress(storeDivider('none'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('section-menu-layout')), findsOneWidget);
    expect(row('Brot'), findsOneWidget, reason: 'not folded');
  });

  testWidgets('wide screens lay the stores out in columns', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1366, 1024));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpList(
      tester,
      seed: (repo) => repo
        ..remoteAdd('Seife', storeId: 'dm')
        ..remoteAdd('Shampoo', storeId: 'dm')
        ..remoteAdd('Milch', storeId: 'lidl')
        ..remoteAdd('Brot'),
    );
    final xs = {
      for (final key in ['dm', 'lidl', 'none'])
        tester.getTopLeft(storeDivider(key)).dx,
    };
    expect(xs, hasLength(3), reason: 'three columns from 1200 px');
    expect(tester.getSize(row('Milch')).width, lessThanOrEqualTo(560));

    Map<String, Offset> dividers() => {
      for (final key in ['dm', 'lidl', 'none'])
        key: tester.getTopLeft(storeDivider(key)),
    };
    final resting = dividers();
    final from = tester.getCenter(storeDivider('lidl'));
    final lift = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await lift.moveTo(from + const Offset(0, 12));
    await tester.pump();
    expect(
      dividers().map((k, v) => MapEntry(k, v.dx)),
      resting.map((k, v) => MapEntry(k, v.dx)),
      reason: 'no store changes column while one is dragged',
    );
    await lift.up();
    await tester.pumpAndSettle();

    await drag(
      tester,
      tester.getCenter(row('Brot')),
      tester.getCenter(storeDivider('dm')),
    );
    expect(itemNamed('Brot').storeId, 'dm', reason: 'across columns');

    await tester.binding.setSurfaceSize(const Size(900, 1024));
    await tester.pumpAndSettle();
    final two = {
      for (final key in ['dm', 'lidl']) tester.getTopLeft(storeDivider(key)).dx,
    };
    expect(two, hasLength(2));

    await tester.binding.setSurfaceSize(const Size(700, 1024));
    await tester.pumpAndSettle();
    final one = tester.getRect(row('Milch'));
    expect(one.width, 640);
    expect(one.left, 30, reason: 'one centred column');
  });

  group('who added what', () {
    String rowLabel(WidgetTester tester, String name) =>
        tester.getSemantics(rowNode(name)).label;

    testWidgets('a partner item carries no initial', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpList(tester, seed: (repo) => repo.remoteAdd('Milch'));
      expect(
        find.descendant(of: row('Milch'), matching: find.byType(CircleAvatar)),
        findsNothing,
      );
      expect(
        find.descendant(of: row('Milch'), matching: find.text('L')),
        findsNothing,
      );
      expect(rowLabel(tester, 'Milch'), isNot(contains('hinzugefügt')));
      expect(find.byKey(const ValueKey('new-items-subtitle')), findsNothing);
      handle.dispose();
    });

    testWidgets('live partner adds are new, named in the title', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await pumpList(tester);
      final tea = repo.remoteAdd('Tee');
      repo.emitItem!(tea);
      await tester.pump();
      await tester.pump();
      expect(find.byKey(ValueKey('new-${tea.id}')), findsOneWidget);
      expect(rowLabel(tester, 'Tee'), contains('Neu'));
      expect(find.text('1 neu von Lea'), findsOneWidget);
      expect(
        tester
            .widget<Text>(find.byKey(const ValueKey('new-items-subtitle')))
            .data,
        '1 neu von Lea',
      );

      repo.members = [
        ...repo.members,
        const Member(id: 'ana', displayName: 'Ana'),
      ];
      repo.emitItem!(repo.remoteAdd('Kaffee', addedBy: 'ana'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('2 neu'), findsOneWidget);
      expect(find.byKey(ValueKey('new-${tea.id}')), findsOneWidget);
      expect(
        tester
            .widget<Material>(
              find.descendant(of: row('Tee'), matching: find.byType(Material)),
            )
            .color,
        Theme.of(tester.element(row('Tee'))).colorScheme.tertiaryContainer,
      );
      handle.dispose();
      await tester.pump(const Duration(seconds: 4));
    });

    testWidgets('a new item clears after three seconds on screen', (
      tester,
    ) async {
      await pumpList(tester);
      await tester.showKeyboard(addField());
      final tea = repo.remoteAdd('Tee');
      repo.emitItem!(tea);
      await tester.pump();
      await tester.pump();
      final mark = find.byKey(ValueKey('new-${tea.id}'));
      await tester.pump(const Duration(seconds: 2));
      expect(mark, findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1100));
      await tester.pump();
      expect(mark, findsNothing);
      expect(find.byKey(const ValueKey('new-items-subtitle')), findsNothing);
      expect(tester.widget<TextField>(addField()).focusNode!.hasFocus, isTrue);
    });

    testWidgets('in the background the clock stops', (tester) async {
      await pumpList(tester);
      final tea = repo.remoteAdd('Tee');
      repo.emitItem!(tea);
      await tester.pump();
      await tester.pump();
      final mark = find.byKey(ValueKey('new-${tea.id}'));
      await tester.pump(const Duration(seconds: 2));
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 5));
      expect(mark, findsOneWidget);
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.hidden)
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(seconds: 2));
      expect(mark, findsOneWidget, reason: 'the three seconds start again');
      await tester.pump(const Duration(milliseconds: 1100));
      await tester.pump();
      expect(mark, findsNothing);
    });
  });

  group('usuals', () {
    void seedUsuals(FakeRepository repo) => repo.usuals = [
      const Usual(name: 'Gurken', quantity: '2', due: true),
      const Usual(name: 'Gurkensalat', due: false),
      const Usual(name: 'Brot', due: true),
    ];
    const typed = Suggestion(
      SuggestionSource.typed,
      ParsedEntry(name: 'Gurken'),
    );
    const salad = Suggestion(
      SuggestionSource.history,
      ParsedEntry(name: 'Gurkensalat'),
    );

    testWidgets('the empty open sheet offers what is due', (tester) async {
      phone(tester);
      await pumpList(tester, seed: seedUsuals);
      await tester.tap(addField());
      await tester.pumpAndSettle();
      expect(sheetRow('2× Gurken, Wieder fällig'), findsOneWidget);
      expect(sheetRow('Brot, Wieder fällig'), findsOneWidget);
      expect(
        find.descendant(of: sheet(), matching: find.textContaining('salat')),
        findsNothing,
        reason: 'Gurkensalat is not due',
      );
    });

    testWidgets('typing offers rows; a tap adds and typing goes on', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      phone(tester);
      await pumpList(
        tester,
        seed: (repo) {
          seedUsuals(repo);
          repo.suggestions['gur'] = const [
            Suggestion(SuggestionSource.typed, ParsedEntry(name: 'Gur')),
            Suggestion(
              SuggestionSource.history,
              ParsedEntry(name: 'Gurken', quantity: '2'),
            ),
            salad,
          ];
        },
      );
      await tester.tap(addField());
      await tester.enterText(addField(), 'gur');
      await settleRows(tester);
      expect(sheetRow('Gur, Wie getippt'), findsOneWidget);
      expect(sheetRow('Gurkensalat, Schon mal gekauft'), findsOneWidget);
      expect(sheetRow('Brot, Wieder fällig'), findsNothing);
      expect(
        find.bySemanticsLabel('2× Gurken, Schon mal gekauft'),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const ValueKey('suggestion-1')));
      await tester.pumpAndSettle();
      final row = repo.rows.values.single;
      expect((row.name, row.quantity), ('Gurken', '2'));
      expect(tester.widget<TextField>(addField()).controller!.text, isEmpty);
      expect(fieldFocus(tester).hasFocus, isTrue);
      expect(FocusManager.instance.primaryFocus, fieldFocus(tester));

      // Straight into the field's input connection: no tap that refocuses.
      tester.testTextInput.enterText('Brot');
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect([for (final i in repo.rows.values) i.name], ['Gurken', 'Brot']);
      expect(fieldFocus(tester).hasFocus, isTrue);
      handle.dispose();
    });

    testWidgets('picking a store or category hands focus back to the input', (
      tester,
    ) async {
      phone(tester);
      await pumpList(tester, seed: seedUsuals);
      await tester.tap(addField());
      await tester.enterText(addField(), 'Gurken');
      await settleRows(tester);
      for (final (chip, option) in [
        ('chip-store', 'store-option-lidl'),
        ('chip-category', 'category-option-produce'),
      ]) {
        await tester.tap(find.byKey(ValueKey(chip)));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(ValueKey(option)));
        await tester.pumpAndSettle();
        expect(
          FocusManager.instance.primaryFocus,
          fieldFocus(tester),
          reason: 'after $option',
        );
      }
      tester.testTextInput.enterText('Gurken!');
      await tester.pump();
      expect(tester.widget<TextField>(addField()).controller!.text, 'Gurken!');
    });

    testWidgets('a row goes once its item is on the list; the typed row '
        'stays', (tester) async {
      phone(tester);
      await pumpList(
        tester,
        seed: (repo) => repo.suggestions['gurken'] = const [typed, salad],
      );
      await tester.tap(addField());
      await tester.enterText(addField(), 'gurken');
      await settleRows(tester);
      expect(sheetRow('Gurkensalat, Schon mal gekauft'), findsOneWidget);
      repo
        ..emitItem!(repo.remoteAdd('Gurkensalat', addedBy: 'peter'))
        ..emitItem!(repo.remoteAdd('Gurken', addedBy: 'peter'));
      await tester.pump();
      await tester.pump();
      expect(sheetRow('Gurkensalat, Schon mal gekauft'), findsNothing);
      expect(sheetRow('Gurken, Wie getippt'), findsOneWidget);
    });
  });
}
