import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'more_harness.dart';

void main() {
  setUpAll(fakeSupabase);
  setUp(serverTokens.clear);

  /// Enough tokens to fill a phone screen, were they on the account page.
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
      'more-feedback',
      'more-settings',
    ]) {
      // In order, top to bottom: the list is taller than a phone.
      await tester.scrollUntilVisible(key(row), 200);
      expect(key(row), findsOneWidget, reason: row);
    }
    expect(find.text('MCP-Server'), findsNothing, reason: 'no second pane');
    await tester.scrollUntilVisible(key('more-version'), 200);
    await tester.pumpAndSettle();
    expect(find.text('Version 1.2.3 (45)'), findsOneWidget);
  });

  String path(More more) =>
      more.router.routerDelegate.currentConfiguration.uri.toString();

  testWidgets('Zugänge opens its own page; back returns to More', (
    tester,
  ) async {
    final more = await pumpMore(tester);
    await tapKey(tester, 'more-access');
    expect(path(more), '/more/access');
    expect(find.text('Zugänge'), findsOneWidget, reason: 'the page title');
    expect(find.text('MCP-Server'), findsOneWidget);
    expect(find.text('Verbundene Apps'), findsOneWidget);
    expect(key('account-delete'), findsNothing, reason: 'Konto is apart');
    expect(key('account-export'), findsNothing);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(path(more), '/more');
    expect(key('more-screen'), findsOneWidget);
  });

  testWidgets('Konto opens its own page; back returns to More', (tester) async {
    manyTokens();
    final more = await pumpMore(tester);
    await tapKey(tester, 'menu-account');
    expect(path(more), '/more/account');
    expect(find.text('Konto'), findsOneWidget, reason: 'the page title');
    expect(find.text('peter@fg.test'), findsOneWidget);
    expect(onScreen(tester, 'account-export'), isTrue);
    expect(onScreen(tester, 'account-delete'), isTrue);
    expect(find.text('MCP-Server'), findsNothing, reason: 'Zugänge is apart');
    expect(find.text('Token 0'), findsNothing);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(path(more), '/more');
    expect(key('more-screen'), findsOneWidget);
  });

  testWidgets('the system back pops a page to More', (tester) async {
    final more = await pumpMore(tester);
    await tapKey(tester, 'menu-account');
    expect(await tester.binding.handlePopRoute(), isTrue);
    await tester.pumpAndSettle();
    expect(path(more), '/more');
    expect(key('more-screen'), findsOneWidget);
  });

  for (final (link, shown, title, absent) in const [
    ('/more/access', '/more/access', 'Zugänge', 'account-delete'),
    ('/more/account', '/more/account', 'Konto', 'access-screen'),
    ('/settings', '/more/access', 'Zugänge', 'account-delete'),
    ('/settings?section=account', '/more/account', 'Konto', 'access-screen'),
    ('/settings?section=other', '/more/access', 'Zugänge', 'account-delete'),
  ]) {
    testWidgets('the link $link opens $shown; back goes to More', (
      tester,
    ) async {
      final more = await pumpMore(tester, location: link);
      expect(path(more), shown);
      expect(find.text(title), findsOneWidget);
      expect(key(absent), findsNothing);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(path(more), '/more');
      expect(key('more-screen'), findsOneWidget);
    });
  }

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

    testWidgets('Konto and Zugänge switch the right pane; no back arrow', (
      tester,
    ) async {
      manyTokens();
      final more = await pumpMore(tester, size: const Size(1024, 600));
      expect(find.byType(BackButton), findsNothing);
      Future<void> reveal(String row) => tester.scrollUntilVisible(
        key(row),
        100,
        scrollable: find.descendant(
          of: key('more-screen'),
          matching: find.byType(Scrollable),
        ),
      );
      await reveal('menu-account');
      await tapKey(tester, 'menu-account');
      expect(path(more), '/more/account');
      expect(key('more-screen'), findsOneWidget, reason: 'the list stays');
      expect(onScreen(tester, 'account-delete'), isTrue);
      expect(find.text('MCP-Server'), findsNothing);
      expect(find.byType(BackButton), findsNothing, reason: 'nothing to pop');
      await reveal('menu-account');
      expect(selected(tester, 'menu-account'), isTrue);
      expect(selected(tester, 'more-access'), isFalse);

      await reveal('more-access');
      await tapKey(tester, 'more-access');
      expect(path(more), '/more/access');
      expect(find.text('MCP-Server'), findsOneWidget);
      expect(key('account-delete'), findsNothing);
      expect(selected(tester, 'more-access'), isTrue);
    });
  });
}
