import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

void main() {
  late FakeRepository repo;

  /// A 390x844 phone with a notch and a home indicator.
  const screen = Size(390, 844);
  const safeTop = 47.0;
  const safeBottom = 34.0;

  Future<void> pumpList(
    WidgetTester tester, {
    void Function(FakeRepository repo)? seed,
  }) async {
    tester.view
      ..devicePixelRatio = 3
      ..physicalSize = screen * 3
      ..padding = const FakeViewPadding(
        top: safeTop * 3,
        bottom: safeBottom * 3,
      );
    addTearDown(tester.view.reset);
    repo = FakeRepository();
    seed?.call(repo);
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('de'),
        home: BlocProvider(
          create: (_) =>
              ListCubit(repo, MemoryListCache(), userId: 'peter')..start(),
          child: const ShoppingList(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Finder field() => find.byKey(const ValueKey('add-item-field'));
  Finder content() => find.byKey(const ValueKey('add-sheet'));
  Finder row(int i) => find.byKey(ValueKey('suggestion-$i'));
  FocusNode focus(WidgetTester tester) =>
      tester.widget<TextField>(field()).focusNode!;
  String typed(WidgetTester tester) =>
      tester.widget<TextField>(field()).controller!.text;

  /// The sheet's background: what the user sees grow above the input.
  Rect surface(WidgetTester tester) =>
      tester.getRect(find.byKey(const ValueKey('add-sheet-surface')));

  /// The add bar's top edge, where the sheet stands.
  double barTop(WidgetTester tester) => tester
      .getRect(
        find.ancestor(of: field(), matching: find.byType(SafeArea)).first,
      )
      .top;

  Future<void> open(WidgetTester tester) async {
    await tester.tap(field());
    await tester.pumpAndSettle();
  }

  /// Types [text] and waits out the typing pause and the server's answer.
  Future<void> type(WidgetTester tester, String text) async {
    await tester.enterText(field(), text);
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();
  }

  List<Suggestion> rows(int n) => [
    for (var i = 0; i < n; i++)
      Suggestion(
        i == 0 ? SuggestionSource.typed : SuggestionSource.history,
        ParsedEntry(name: 'Wurst $i'),
      ),
  ];

  group('the sheet is as tall as its content, up to the screen top', () {
    for (final n in [0, 1, 2, 4]) {
      testWidgets('$n rows: no gap above the input', (tester) async {
        await pumpList(tester, seed: (r) => r.suggestions['wurst'] = rows(n));
        await open(tester);
        await type(tester, 'wurst');
        final sheet = surface(tester);
        expect(sheet.top, tester.getRect(content()).top);
        expect(sheet.height, tester.getRect(content()).height);
        final last = n == 0
            ? find.byKey(const ValueKey('add-sheet-empty'))
            : row(n - 1);
        expect(last, findsOneWidget);
        expect(
          barTop(tester) - tester.getRect(last).bottom,
          lessThanOrEqualTo(24),
          reason: 'the sheet ends at its last row, right above the input',
        );
        expect(sheet.bottom, closeTo(barTop(tester), 1));
      });
    }

    testWidgets('12 rows reach the top and scroll', (tester) async {
      await pumpList(tester, seed: (r) => r.suggestions['wurst'] = rows(12));
      await open(tester);
      await type(tester, 'wurst');
      expect(surface(tester).top, closeTo(safeTop + 28, 0.5));
      expect(row(11).hitTestable(), findsNothing, reason: 'below the fold');
      await tester.scrollUntilVisible(
        row(11),
        100,
        scrollable: find.descendant(
          of: find.byKey(const ValueKey('add-suggestions')),
          matching: find.byType(Scrollable),
        ),
      );
      expect(row(11).hitTestable(), findsOneWidget);
      expect(surface(tester).top, closeTo(safeTop + 28, 0.5));
    });

    testWidgets('the input never moves: closed, open, grown, closed again', (
      tester,
    ) async {
      await pumpList(tester, seed: (r) => r.suggestions['wurst'] = rows(8));
      final closed = tester.getRect(field());
      await open(tester);
      final opened = tester.getRect(field());
      await type(tester, 'wurst');
      final grown = tester.getRect(field());
      await tester.tap(find.byKey(const ValueKey('add-sheet-close')));
      await tester.pumpAndSettle();
      final after = tester.getRect(field());
      for (final (name, rect) in [
        ('open', opened),
        ('grown', grown),
        ('closed again', after),
      ]) {
        expect(rect.top, closeTo(closed.top, 2), reason: name);
        expect(rect.height, closeTo(closed.height, 2), reason: name);
      }
      expect(content(), findsNothing);
    });

    for (final still in [false, true]) {
      testWidgets(
        still
            ? 'with animations off it takes its size in one frame'
            : 'with animations on it grows over several frames',
        (tester) async {
          if (still) {
            tester.platformDispatcher.accessibilityFeaturesTestValue =
                const FakeAccessibilityFeatures(disableAnimations: true);
            addTearDown(
              tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
            );
          }
          await pumpList(tester, seed: (r) => r.suggestions['wurst'] = rows(4));
          await open(tester);
          final gate = repo.suggestGate = Completer<void>();
          await tester.enterText(field(), 'wurst');
          await tester.pump(const Duration(milliseconds: 200));
          await tester.pumpAndSettle();
          final before = surface(tester).height;
          gate.complete();
          await tester.pump();
          await tester.pump();
          final first = surface(tester).height;
          await tester.pumpAndSettle();
          final settled = surface(tester).height;
          expect(settled, greaterThan(before), reason: 'four rows came in');
          if (still) {
            expect(first, settled);
          } else {
            expect(first, lessThan(settled));
          }
        },
      );
    }
  });

  group('the chips apply to the row that is tapped', () {
    const milk = [
      Suggestion(SuggestionSource.typed, ParsedEntry(name: 'Milch')),
      Suggestion(
        SuggestionSource.history,
        ParsedEntry(
          name: 'Milch',
          brand: 'Weihenstephan',
          properties: 'laktosefrei, 1,5 %',
          storeId: 'dm',
          categoryId: 'chilled',
        ),
      ),
    ];

    Future<void> pick(WidgetTester tester, String chip, String option) async {
      await tester.tap(find.byKey(ValueKey(chip)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(ValueKey(option)));
      await tester.pumpAndSettle();
    }

    testWidgets('a picked store and category go with the second row', (
      tester,
    ) async {
      await pumpList(tester, seed: (r) => r.suggestions['milch'] = milk);
      await open(tester);
      await type(tester, 'milch');
      await pick(tester, 'chip-store', 'store-option-lidl');
      await pick(tester, 'chip-category', 'category-option-produce');
      await tester.tap(row(1));
      await tester.pumpAndSettle();
      final item = (repo.sent.single as AddItem).item;
      expect(
        (item.name, item.brand, item.properties, item.storeId, item.categoryId),
        ('Milch', 'Weihenstephan', 'laktosefrei, 1,5 %', 'lidl', 'produce'),
      );
    });

    testWidgets('without a pick the row keeps its own store', (tester) async {
      await pumpList(tester, seed: (r) => r.suggestions['milch'] = milk);
      await open(tester);
      await type(tester, 'milch');
      await tester.tap(row(1));
      await tester.pumpAndSettle();
      expect((repo.sent.single as AddItem).item.storeId, 'dm');
    });

    testWidgets('Ohne Laden adds, then clears the remembered store', (
      tester,
    ) async {
      await pumpList(tester, seed: (r) => r.suggestions['milch'] = milk);
      await open(tester);
      await type(tester, 'milch');
      await pick(tester, 'chip-store', 'store-option-none');
      await tester.tap(row(1));
      await tester.pumpAndSettle();
      expect(repo.sent, hasLength(2));
      final add = repo.sent.first as AddItem;
      expect((add.item.storeId, add.item.brand), (null, 'Weihenstephan'));
      final edit = repo.sent.last as EditItem;
      expect(edit.itemId, add.item.id);
      expect(edit.changes.toColumns(), {'store_id': null});
      expect(repo.rows.values.single.storeId, isNull);
    });
  });

  group('a typo finds what was bought before; a tap adds it', () {
    String label(WidgetTester tester, int i) =>
        tester.getSemantics(row(i)).label;

    /// Adds the second row, then checks the field is empty, focused and
    /// takes the next item straight away.
    Future<void> takeAndGoOn(WidgetTester tester) async {
      await tester.tap(row(1));
      await tester.pumpAndSettle();
      expect(find.text('✓ Hinzugefügt: Hafermilch'), findsOneWidget);
      expect(typed(tester), isEmpty);
      expect(focus(tester).hasFocus, isTrue);
      await tester.enterText(field(), 'Brot');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('✓ Hinzugefügt: Brot'), findsOneWidget);
      expect(focus(tester).hasFocus, isTrue);
    }

    testWidgets('from the server', (tester) async {
      await pumpList(
        tester,
        seed: (r) => r.suggestions['Hafermlch'] = const [
          Suggestion(SuggestionSource.typed, ParsedEntry(name: 'Hafermlch')),
          Suggestion(SuggestionSource.history, ParsedEntry(name: 'Hafermilch')),
        ],
      );
      await open(tester);
      await type(tester, 'Hafermlch');
      expect(label(tester, 1), 'Hafermilch, Schon mal gekauft');
      await takeAndGoOn(tester);
      expect(
        {for (final item in repo.rows.values) item.name},
        {'Hafermilch', 'Brot'},
      );
    });

    testWidgets('without the server, from the usuals on the device', (
      tester,
    ) async {
      await pumpList(
        tester,
        seed: (r) => r.usuals = [const Usual(name: 'Hafermilch', due: false)],
      );
      repo.online = false;
      await open(tester);
      await type(tester, 'Hafermlch');
      expect(label(tester, 0), 'Hafermlch, Wie getippt');
      expect(label(tester, 1), 'Hafermilch, Schon mal gekauft');
      await takeAndGoOn(tester);
    });

    testWidgets('part of a word, without the server', (tester) async {
      await pumpList(
        tester,
        seed: (r) => r.usuals = [const Usual(name: 'Hafermilch', due: false)],
      );
      repo.online = false;
      await open(tester);
      await type(tester, 'milch');
      expect(label(tester, 1), 'Hafermilch, Schon mal gekauft');
    });
  });

  testWidgets('the empty field offers what is due, then what was used lately', (
    tester,
  ) async {
    final now = DateTime.now();
    await pumpList(
      tester,
      seed: (r) => r.usuals = [
        const Usual(name: 'Milch', due: true),
        Usual(
          name: 'Hafermilch',
          due: false,
          lastUsed: now.subtract(const Duration(days: 2)),
        ),
        Usual(
          name: 'Mehl',
          due: false,
          lastUsed: now.subtract(const Duration(days: 40)),
        ),
      ],
    );
    await open(tester);
    expect(tester.getSemantics(row(0)).label, 'Milch, Wieder fällig');
    expect(tester.getSemantics(row(1)).label, 'Hafermilch, Zuletzt verwendet');
    expect(row(2), findsNothing, reason: 'Mehl was last used 40 days ago');
    expect(
      find.descendant(of: row(0), matching: find.byIcon(Icons.keyboard_return)),
      findsNothing,
      reason: 'Enter takes nothing while the field is empty',
    );
    await tester.ensureVisible(row(1));
    await tester.pumpAndSettle();
    await tester.tap(row(1));
    await tester.pumpAndSettle();
    expect(find.text('✓ Hinzugefügt: Hafermilch'), findsOneWidget);
    expect(focus(tester).hasFocus, isTrue);
  });

  group('Enter takes the first row', () {
    const eggs = [
      Suggestion(
        SuggestionSource.typed,
        ParsedEntry(name: 'Eier', quantity: '10', categoryId: 'chilled'),
      ),
      Suggestion(SuggestionSource.history, ParsedEntry(name: 'Eiernudeln')),
    ];

    testWidgets('and keeps typing going', (tester) async {
      await pumpList(tester, seed: (r) => r.suggestions['10 eier'] = eggs);
      await open(tester);
      await type(tester, '10 eier');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      final item = repo.rows.values.single;
      expect((item.name, item.quantity), ('Eier', '10'));
      expect(typed(tester), isEmpty);
      expect(focus(tester).hasFocus, isTrue);
      expect(content(), findsOneWidget, reason: 'the sheet stays open');
    });

    testWidgets('waiting for rows still loading', (tester) async {
      await pumpList(tester, seed: (r) => r.suggestions['10 eier'] = eggs);
      await open(tester);
      final gate = repo.suggestGate = Completer<void>();
      await tester.enterText(field(), '10 eier');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(repo.sent, isEmpty);
      gate.complete();
      await tester.pumpAndSettle();
      final item = repo.rows.values.single;
      expect((item.name, item.quantity), ('Eier', '10'));
      expect(repo.suggestCalls, ['10 eier'], reason: 'asked once');
      expect(typed(tester), isEmpty);
      expect(focus(tester).hasFocus, isTrue);
    });

    testWidgets('the note says what was added; Rückgängig removes it', (
      tester,
    ) async {
      await pumpList(
        tester,
        seed: (r) => r.suggestions['seife'] = const [
          Suggestion(
            SuggestionSource.typed,
            ParsedEntry(name: 'Seife', storeId: 'dm'),
          ),
        ],
      );
      await open(tester);
      await type(tester, 'seife');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('added-note')),
          matching: find.text('✓ Hinzugefügt: Seife → dm'),
        ),
        findsOneWidget,
      );
      expect(repo.rows, hasLength(1));
      await tester.tap(find.byKey(const ValueKey('added-undo')));
      await tester.pumpAndSettle();
      expect(repo.rows, isEmpty);
      expect(repo.sent.last, isA<DeleteItem>());
      expect(find.byKey(const ValueKey('added-note')), findsNothing);
    });

    testWidgets('an item already on the list is named, not added twice', (
      tester,
    ) async {
      await pumpList(tester, seed: (r) => r.remoteAdd('Seife'));
      await open(tester);
      await type(tester, 'Seife');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('Seife steht schon auf der Liste'), findsOneWidget);
      expect(find.byKey(const ValueKey('added-undo')), findsNothing);
      expect(repo.sent, isEmpty);
    });
  });

  testWidgets(
    'an answer still on its way when an item is added is not reused',
    (tester) async {
      await pumpList(tester, seed: (r) => r.suggestions['wurst'] = rows(4));
      await open(tester);
      final gate = repo.suggestGate = Completer<void>();
      await tester.enterText(field(), 'wurst');
      await tester.pump(const Duration(milliseconds: 200));
      await tester.tap(row(0));
      await tester.pump();
      gate.complete();
      await tester.pumpAndSettle();
      final asked = repo.suggestCalls.length;
      await type(tester, 'wurst');
      expect(
        repo.suggestCalls,
        hasLength(asked + 1),
        reason: 'the answer from before the add was not cached',
      );
    },
  );

  testWidgets('the sheet closes on the scrim, Schließen and Escape', (
    tester,
  ) async {
    await pumpList(tester);
    for (final close in <Future<void> Function()>[
      () => tester.tapAt(const Offset(195, 120)),
      () => tester.tap(find.byKey(const ValueKey('add-sheet-close'))),
      () => tester.sendKeyEvent(LogicalKeyboardKey.escape),
    ]) {
      await open(tester);
      expect(content(), findsOneWidget);
      await close();
      await tester.pumpAndSettle();
      expect(content(), findsNothing);
    }
  });

  // On the web a click on the field can reach the app as a semantics tap or
  // focus instead of pointer events; TextField then requests focus or the
  // keyboard but never calls onTap. After the user closed the sheet, the
  // field getting focus back opens it like a tap (seen in e2e list.spec,
  // "adds are grouped", on the third or fourth add).
  for (final action in [SemanticsAction.tap, SemanticsAction.focus]) {
    testWidgets('after closing, a semantics ${action.name} on the field '
        'opens the sheet again', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpList(tester);
      await open(tester);
      expect(content(), findsOne);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(content(), findsNothing);
      expect(focus(tester).hasFocus, isFalse);

      final node = find.semantics
          .byFlag(SemanticsFlag.isTextField)
          .evaluate()
          .single;
      node.owner!.performAction(node.id, action);
      await tester.pumpAndSettle();
      expect(content(), findsOne);
      expect(focus(tester).hasFocus, isTrue);
      semantics.dispose();
    });
  }

  testWidgets('the field focused at start leaves the sheet closed', (
    tester,
  ) async {
    await pumpList(tester);
    focus(tester).requestFocus();
    await tester.pumpAndSettle();
    expect(focus(tester).hasFocus, isTrue);
    expect(content(), findsNothing);
  });
}
