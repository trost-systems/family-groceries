import 'dart:ui' show Tristate;

import 'package:family_groceries/app/router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';

/// Back goes where the user came from, across the app's real routes and
/// shell (job 78).
void main() {
  Finder key(String k) => find.byKey(ValueKey(k));

  /// The tab a screen reader announces as selected.
  int tab(WidgetTester tester) => ['tab-list', 'tab-more'].indexWhere(
    (tab) =>
        tester.getSemantics(key(tab)).flagsCollection.isSelected ==
        Tristate.isTrue,
  );

  setUpAll(fakeSupabase);

  Future<void> back(WidgetTester tester) async {
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
  }

  testWidgets('More, Anderem Haushalt beitreten, back: More again', (
    tester,
  ) async {
    final more = await pumpMore(tester, app: true);
    await tester.tap(key('more-join'));
    await tester.pumpAndSettle();
    expect(key('join-screen'), findsOneWidget);
    expect(more.router.state.uri.path, moreJoinPath);
    expect(tab(tester), 1, reason: 'inside the More tab');
    await back(tester);
    expect(key('join-screen'), findsNothing);
    expect(key('more-screen'), findsOneWidget);
    expect(tab(tester), 1);
    expect(more.router.state.uri.path, morePath);
  });

  testWidgets('List, Anpassen, a store, back, back: the list, its tab '
      'selected', (tester) async {
    final more = await pumpMore(tester, location: listPath, app: true);
    await tester.tap(find.widgetWithText(TextButton, 'Anpassen'));
    await tester.pumpAndSettle();
    expect(key('stores-screen'), findsOneWidget);
    expect(tab(tester), 0, reason: 'the tabs stay');
    await tester.tap(find.text('Lidl'));
    await tester.pumpAndSettle();
    expect(key('store-details'), findsOneWidget);
    expect(more.router.state.uri.path, '/edit/lidl');
    expect(more.screens.feedbackScreen, 'stores');

    await back(tester);
    expect(key('stores-screen'), findsOneWidget);
    await back(tester);
    expect(key('stores-screen'), findsNothing);
    expect(key('list-header'), findsOneWidget);
    expect(tab(tester), 0);
    expect(more.router.state.uri.path, listPath);
  });

  // Job 85: Rechtliches was a page; its rows sit on More now.
  testWidgets('the old link /more/legal opens More, its tab selected', (
    tester,
  ) async {
    final more = await pumpMore(tester, location: moreLegalPath, app: true);
    expect(more.router.state.uri.path, morePath);
    expect(key('more-screen'), findsOneWidget);
    await tester.scrollUntilVisible(key('more-imprint'), 200);
    expect(key('more-imprint'), findsOneWidget);
    expect(tab(tester), 1);
  });

  testWidgets('More and back keeps the List tab where it was', (tester) async {
    await pumpMore(tester, location: editPath, app: true);
    await tester.tap(key('tab-more'));
    await tester.pumpAndSettle();
    expect(key('more-screen'), findsOneWidget);
    await tester.tap(key('tab-list'));
    await tester.pumpAndSettle();
    expect(key('stores-screen'), findsOneWidget);
  });
}
