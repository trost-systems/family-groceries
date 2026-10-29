import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fake_repository.dart';

void main() {
  late FakeRepository repo;

  /// Categories live under More now.
  Future<void> openCategories(WidgetTester tester) async {
    repo = (await pumpMore(tester)).repo;
    await tester.tap(find.byKey(const ValueKey('more-categories')));
    await tester.pumpAndSettle();
    expect(find.text('Kategorien'), findsOneWidget);
  }

  List<String> names() => [for (final c in repo.categories) c.name];

  Future<void> enterName(WidgetTester tester, String name) async {
    await tester.enterText(find.widgetWithText(TextField, 'Name'), name);
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pumpAndSettle();
  }

  testWidgets('a row is named by its category; its drag handle apart', (
    tester,
  ) async {
    await openCategories(tester);
    expect(
      tester.getSemantics(find.text('Kühlregal')),
      isSemantics(label: 'Kühlregal', isButton: true),
    );
    expect(find.bySemanticsLabel('Kühlregal verschieben'), findsOneWidget);
  });

  testWidgets('tapping a category renames it', (tester) async {
    await openCategories(tester);
    await tester.tap(find.text('Kühlregal'));
    await tester.pumpAndSettle();
    await enterName(tester, 'Kühlung');
    expect(names(), ['Obst & Gemüse', 'Kühlung', 'Sonstiges']);
    expect(find.text('Kühlung'), findsOneWidget);
  });

  testWidgets('a new category is added; a taken name is refused', (
    tester,
  ) async {
    await openCategories(tester);
    await tester.tap(find.text('Kategorie hinzufügen'));
    await tester.pumpAndSettle();
    await enterName(tester, 'Tiernahrung');
    expect(names(), contains('Tiernahrung'));
    expect(find.text('Tiernahrung'), findsOneWidget);

    await tester.tap(find.text('Kategorie hinzufügen'));
    await tester.pumpAndSettle();
    await enterName(tester, 'Sonstiges');
    expect(names().where((n) => n == 'Sonstiges'), hasLength(1));
  });

  testWidgets('a taken name says so on the categories screen', (tester) async {
    await openCategories(tester);
    await tester.tap(find.text('Kategorie hinzufügen'));
    await tester.pumpAndSettle();
    await enterName(tester, 'Sonstiges');
    expect(
      find.text('Eine Kategorie „Sonstiges“ gibt es schon.'),
      findsOneWidget,
    );
  });

  testWidgets('deleting moves the items to the fallback by default', (
    tester,
  ) async {
    await openCategories(tester);
    final milk = repo.remoteAdd('Milch');
    expect(find.byTooltip('Sonstiges löschen'), findsNothing);

    await tester.tap(find.byTooltip('Kühlregal löschen'));
    await tester.pumpAndSettle();
    expect(find.text('Artikel verschieben nach'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Löschen'));
    await tester.pumpAndSettle();

    expect(names(), ['Obst & Gemüse', 'Sonstiges']);
    expect(repo.rows[milk.id]!.categoryId, 'other');
    expect(find.text('Kühlregal'), findsNothing);
  });
}
