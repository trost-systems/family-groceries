import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/design/field_border.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../list/fake_repository.dart';
import '../list/memory_cache.dart';

void main() {
  const t = HummlistColors.light;

  Future<void> pumpField(WidgetTester tester, Widget field) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.light),
        home: Scaffold(
          body: Center(child: SizedBox(width: 240, child: field)),
        ),
      ),
    );
    await tester.pump();
  }

  Finder decorator() => find.byType(InputDecorator);

  // Near the top-left corner: inside a rounded rectangle, outside the hex,
  // whose left side slants in towards the top.
  const corner = Offset(5, 5);

  testWidgets('a single-line field is a hex with the 2 px contour', (
    tester,
  ) async {
    await pumpField(
      tester,
      const TextField(decoration: InputDecoration(labelText: 'E-Mail')),
    );
    expect(
      decorator(),
      paints
        // The face, then the contour.
        ..path()
        ..path(
          style: PaintingStyle.stroke,
          strokeWidth: HlBorder.width,
          color: t.border,
          includes: [const Offset(120, 28)],
          excludes: [corner],
        ),
    );
  });

  testWidgets('focused, the contour turns cobalt and gets the focus ring', (
    tester,
  ) async {
    await pumpField(
      tester,
      const TextField(
        autofocus: true,
        decoration: InputDecoration(labelText: 'E-Mail'),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      decorator(),
      paints
        ..path()
        ..path(
          style: PaintingStyle.stroke,
          strokeWidth: HlBorder.width,
          color: t.brand,
        )
        ..path(
          style: PaintingStyle.stroke,
          strokeWidth: HlFocus.ringWidth,
          color: t.accent,
        ),
    );
  });

  testWidgets('an error turns the contour to the error colour', (tester) async {
    await pumpField(
      tester,
      const TextField(
        decoration: InputDecoration(labelText: 'E-Mail', errorText: 'Nein'),
      ),
    );
    expect(
      decorator(),
      paints
        // The face, then the contour.
        ..path()
        ..path(
          style: PaintingStyle.stroke,
          strokeWidth: HlBorder.width,
          color: t.error,
        ),
    );
  });

  testWidgets('a multi-line field keeps the rounded contour', (tester) async {
    await pumpField(
      tester,
      const RoundedFields(
        child: TextField(
          minLines: 3,
          maxLines: 6,
          decoration: InputDecoration(labelText: 'Nachricht'),
        ),
      ),
    );
    expect(
      decorator(),
      paints
        // The face, then the contour.
        ..path()
        ..path(
          style: PaintingStyle.stroke,
          strokeWidth: HlBorder.width,
          color: t.border,
          includes: [corner],
        ),
    );
  });

  for (final (name, field) in [
    ('hint only', const TextField(decoration: InputDecoration(hintText: 'x'))),
    ('labelled', const TextField(decoration: InputDecoration(labelText: 'x'))),
    (
      'multi-line',
      const RoundedFields(child: TextField(minLines: 2, maxLines: 4)),
    ),
  ]) {
    testWidgets('$name field is at least 48 dp tall', (tester) async {
      await pumpField(tester, field);
      expect(
        tester.getSize(decorator()).height,
        greaterThanOrEqualTo(HlSize.target),
      );
    });
  }

  group('the add field', () {
    final addField = find.byKey(const ValueKey('add-item-field'));

    /// The list with [theme], the add field tapped, so focused: where the
    /// field and its text sit.
    Future<(Rect, Rect)> focusedField(
      WidgetTester tester,
      ThemeData theme,
    ) async {
      tester.view
        ..devicePixelRatio = 1
        ..physicalSize = const Size(390, 844);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('de'),
          home: BlocProvider(
            create: (_) =>
                ListCubit(FakeRepository(), MemoryListCache(), userId: 'peter')
                  ..start(),
            child: const ShoppingList(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(addField);
      await tester.pumpAndSettle();
      Rect rect(Type type) => tester.getRect(
        find.descendant(of: addField, matching: find.byType(type)),
      );
      return (rect(InputDecorator), rect(EditableText));
    }

    // Job 52, DECISIONS item 7: a field theme that reached this field grew
    // the add sheet and broke e2e add-sheet.spec.ts:61 and list.spec.ts:12.
    testWidgets('draws no contour of its own and keeps its geometry', (
      tester,
    ) async {
      final app = appTheme(Brightness.light);
      final withoutFieldTheme = await focusedField(
        tester,
        app.copyWith(inputDecorationTheme: const InputDecorationThemeData()),
      );
      final themed = await focusedField(tester, app);
      expect(themed, withoutFieldTheme);
      expect(
        find.descendant(of: addField, matching: decorator()),
        isNot(paints..path()),
      );
    });
  });
}
