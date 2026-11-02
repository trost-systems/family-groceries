// Job 79: what every More prototype promises. Menu rows only (the
// usage-data switch lives on the Privacy page), no stores or categories,
// the update card only on top and only when up, the version last.
import 'package:family_groceries/design/hex_switch.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../analytics/fakes.dart';
import 'more_harness.dart';

void main() {
  setUpAll(fakeSupabase);
  tearDown(() => menuPreview.value = null);

  final version = find.byKey(const ValueKey('more-version'));
  final card = find.byKey(const ValueKey('menu-update-card'));
  final rows = find.byWidgetPredicate(
    (w) =>
        w.key is ValueKey<String> &&
        (w.key! as ValueKey<String>).value.startsWith('menu-row-'),
  );

  Future<void> pump(WidgetTester tester, MenuPreview preview) async {
    final analytics = await loadedAnalytics(MemoryAnalyticsStore());
    menuPreview.value = preview;
    await pumpMore(tester, analytics: analytics, size: const Size(390, 2400));
  }

  for (final p in MenuPrototype.values) {
    testWidgets('${p.name}: rows only, no stores, version last', (
      tester,
    ) async {
      await pump(tester, (prototype: p, updateCard: false));
      expect(find.byKey(ValueKey('menu-${p.name}')), findsOneWidget);
      expect(find.byType(HexSwitchTile), findsNothing);
      expect(find.byType(Switch), findsNothing);
      expect(card, findsNothing);
      expect(find.byKey(const ValueKey('more-stores')), findsNothing);
      expect(find.byKey(const ValueKey('more-categories')), findsNothing);
      expect(find.text('Läden'), findsNothing);
      expect(find.textContaining('Kategorien'), findsNothing);
      expect(rows, findsAtLeast(8));
      final versionTop = tester.getTopLeft(version).dy;
      for (final row in rows.evaluate()) {
        expect(
          tester.getBottomLeft(find.byWidget(row.widget)).dy,
          lessThanOrEqualTo(versionTop),
        );
      }
    });

    testWidgets('${p.name}: the update card sits above every row', (
      tester,
    ) async {
      await pump(tester, (prototype: p, updateCard: true));
      expect(card, findsOneWidget);
      final cardBottom = tester.getBottomLeft(card).dy;
      for (final row in rows.evaluate()) {
        expect(
          tester.getTopLeft(find.byWidget(row.widget)).dy,
          greaterThan(cardBottom),
        );
      }
      await tester.tap(find.byKey(const ValueKey('menu-update-later')));
      await tester.pumpAndSettle();
      expect(card, findsNothing);
    });

    testWidgets('${p.name}: the usage-data switch is on the Privacy page', (
      tester,
    ) async {
      await pump(tester, (prototype: p, updateCard: false));
      await tester.tap(find.byKey(const ValueKey('menu-row-privacy')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('menu-page-privacy')), findsOneWidget);
      expect(find.byKey(const ValueKey('more-analytics')), findsOneWidget);
      expect(find.text('Datenschutzerklärung'), findsOneWidget);
    });
  }

  testWidgets('the debug switcher swaps the menu and back', (tester) async {
    await pumpMore(tester);
    await tester.tap(find.byKey(const ValueKey('menu-prototypes')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('menu-prototype-p3')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('menu-p3')), findsOneWidget);
    await tester.tap(find.text('Heutiges Menü'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('more-screen')), findsOneWidget);
  });
}
