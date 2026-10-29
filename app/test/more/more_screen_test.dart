import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'more_harness.dart';

void main() {
  setUpAll(fakeSupabase);
  setUp(serverTokens.clear);

  /// Enough tokens to push the account section below a phone screen.
  void manyTokens() => serverTokens.addAll([
    for (var i = 0; i < 12; i++)
      {
        'id': 't$i',
        'name': 'Token $i',
        'token_hint': '000$i',
        'created_at': '2026-10-02T10:00:00Z',
        'last_used_at': null,
      },
  ]);

  Finder key(String k) => find.byKey(ValueKey(k));

  bool onScreen(WidgetTester tester, String k) {
    final finder = key(k);
    final height =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    return finder.evaluate().isNotEmpty &&
        tester.getRect(finder).top >= 0 &&
        tester.getRect(finder).bottom <= height;
  }

  bool selected(WidgetTester tester, String k) => tester
      .widget<ListTile>(
        find.descendant(of: key(k), matching: find.byType(ListTile)),
      )
      .selected;

  Future<void> tapKey(WidgetTester tester, String k) async {
    await tester.ensureVisible(key(k));
    await tester.pumpAndSettle();
    await tester.tap(key(k));
    await tester.pumpAndSettle();
  }

  testWidgets('a phone shows the list alone, with the version at the end', (
    tester,
  ) async {
    await pumpMore(tester);
    expect(key('more-screen'), findsOneWidget);
    expect(find.text('Mehr'), findsOneWidget);
    for (final row in [
      'more-invite',
      'more-join',
      'more-categories',
      'more-stores',
      'more-access',
      'menu-account',
      'more-sign-out',
      'more-language',
    ]) {
      expect(key(row), findsOneWidget, reason: row);
    }
    expect(find.text('MCP-Server'), findsNothing, reason: 'no second pane');
    await tester.scrollUntilVisible(key('more-version'), 200);
    await tester.pumpAndSettle();
    expect(find.text('Version 1.2.3 (45)'), findsOneWidget);
  });

  testWidgets('Konto opens the access page scrolled to the account section; '
      'back returns to More', (tester) async {
    manyTokens();
    await pumpMore(tester);
    await tapKey(tester, 'menu-account');
    expect(find.text('Zugänge'), findsOneWidget, reason: 'the page title');
    expect(onScreen(tester, 'account-delete'), isTrue);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(key('more-screen'), findsOneWidget);
  });

  testWidgets('Zugänge starts at the top', (tester) async {
    manyTokens();
    await pumpMore(tester);
    await tapKey(tester, 'more-access');
    expect(find.text('MCP-Server'), findsOneWidget);
    expect(onScreen(tester, 'account-delete'), isFalse);
  });

  testWidgets('the account link /settings?section=account scrolls there', (
    tester,
  ) async {
    manyTokens();
    await pumpMore(tester, location: '/settings?section=account');
    expect(onScreen(tester, 'account-delete'), isTrue);
  });

  testWidgets('Datenschutz shows the draft while none is published', (
    tester,
  ) async {
    await pumpMore(tester);
    await tester.scrollUntilVisible(key('more-privacy'), 200);
    await tapKey(tester, 'more-privacy');
    expect(key('privacy-draft'), findsOneWidget);
    expect(find.text('Entwurf'), findsOneWidget);
  });

  group('from 840 px', () {
    testWidgets('More shows the list beside the access page', (tester) async {
      await pumpMore(tester, size: const Size(1024, 768));
      expect(key('more-screen'), findsOneWidget);
      expect(find.text('MCP-Server'), findsOneWidget);
      expect(find.text('Zugänge'), findsWidgets);
      final list = tester.getRect(key('more-screen'));
      final page = tester.getRect(find.text('MCP-Server'));
      expect(page.left, greaterThan(list.right), reason: 'two panes');
      expect(
        selected(tester, 'more-access'),
        isTrue,
        reason: 'the shown page is marked in the list',
      );
    });

    testWidgets('Konto switches the right pane to the account section', (
      tester,
    ) async {
      manyTokens();
      await pumpMore(tester, size: const Size(1024, 600));
      expect(onScreen(tester, 'account-delete'), isFalse);
      Future<void> revealAccountRow() => tester.scrollUntilVisible(
        key('menu-account'),
        100,
        scrollable: find.descendant(
          of: key('more-screen'),
          matching: find.byType(Scrollable),
        ),
      );
      await revealAccountRow();
      await tapKey(tester, 'menu-account');
      expect(key('more-screen'), findsOneWidget, reason: 'the list stays');
      expect(onScreen(tester, 'account-delete'), isTrue);
      await revealAccountRow();
      expect(selected(tester, 'menu-account'), isTrue);
    });
  });
}
