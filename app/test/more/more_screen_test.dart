import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

import '../app/fake_launcher.dart';
import '../purchases/fakes.dart';
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
    expect(find.text('MCP-SERVER'), findsNothing, reason: 'no second pane');
    await tester.scrollUntilVisible(key('more-version'), 200);
    await tester.pumpAndSettle();
    expect(find.text('Version 1.2.3 (45)'), findsOneWidget);
  });

  String path(More more) =>
      more.router.routerDelegate.currentConfiguration.uri.toString();

  testWidgets('Partner einladen opens Einladungen; back returns to More', (
    tester,
  ) async {
    final more = await pumpMore(tester);
    await tapKey(tester, 'more-invite');
    expect(path(more), '/more/invites');
    expect(find.text('Einladungen'), findsOneWidget);
    expect(key('invite-new'), findsOneWidget);
    expect(find.text('Keine offenen Einladungen.'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(path(more), '/more');
  });

  testWidgets('wide, Einladungen sits beside the list', (tester) async {
    await pumpMore(
      tester,
      location: '/more/invites',
      size: const Size(1366, 1024),
    );
    expect(key('more-screen'), findsOneWidget);
    expect(key('invites-page'), findsOneWidget);
  });

  testWidgets('Zugänge opens its own page; back returns to More', (
    tester,
  ) async {
    final more = await pumpMore(tester);
    await tapKey(tester, 'more-access');
    expect(path(more), '/more/access');
    expect(find.text('Zugänge'), findsOneWidget, reason: 'the page title');
    expect(find.text('MCP-SERVER'), findsOneWidget);
    expect(find.text('VERBUNDENE APPS'), findsOneWidget);
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
    expect(find.text('MCP-SERVER'), findsNothing, reason: 'Zugänge is apart');
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

  for (final (device, privacy, imprint) in [
    (
      const Locale('de', 'DE'),
      'https://hummlist.com/datenschutz',
      'https://hummlist.com/impressum',
    ),
    (
      const Locale('en', 'US'),
      'https://hummlist.com/en/privacy',
      'https://hummlist.com/en/imprint',
    ),
  ]) {
    testWidgets('$device: the legal rows open the site in the browser', (
      tester,
    ) async {
      final launcher = fakeLauncher();
      await pumpMore(tester, device: [device]);
      await tester.scrollUntilVisible(key('more-licenses'), 200);
      await tapKey(tester, 'more-privacy');
      await tapKey(tester, 'more-imprint');
      expect(launcher.opened, [
        (privacy, PreferredLaunchMode.externalApplication),
        (imprint, PreferredLaunchMode.externalApplication),
      ]);
      expect(key('more-screen'), findsOneWidget, reason: 'More stays open');
    });
  }

  // Job 64: before the launch nobody sees Hummlist Premium in More.
  group('Hummlist Premium', () {
    Future<bool> listed(
      WidgetTester tester, {
      required bool offer,
      NoSale? noSale,
      bool unlocked = false,
    }) async {
      await pumpMore(
        tester,
        premium: FakePremiumServer(offer: offer),
        store: FakePurchaseRepository(withoutStore: noSale),
        entitlements: FakeEntitlementsSource(unlockedNow: unlocked),
      );
      return find.text('Hummlist Premium').evaluate().isNotEmpty;
    }

    testWidgets('is not listed while the server switch is off', (tester) async {
      expect(await listed(tester, offer: false), isFalse);
    });

    testWidgets('is not listed in an app build that does not sell yet', (
      tester,
    ) async {
      expect(
        await listed(tester, offer: true, noSale: const PurchasesNotYet()),
        isFalse,
      );
    });

    testWidgets('is listed once offered, with its hint', (tester) async {
      expect(await listed(tester, offer: true), isTrue);
      expect(find.text('Siri, Alexa und KI-Assistenten'), findsOneWidget);
    });

    testWidgets('is listed on the web once offered: bought in the apps', (
      tester,
    ) async {
      expect(
        await listed(tester, offer: true, noSale: const PurchasesUnsupported()),
        isTrue,
      );
    });

    testWidgets('stays listed for a household that has it', (tester) async {
      expect(
        await listed(
          tester,
          offer: false,
          noSale: const PurchasesNotYet(),
          unlocked: true,
        ),
        isTrue,
      );
      expect(find.text('Freigeschaltet'), findsOneWidget);
    });
  });

  group('Hilfe & Kontakt (job 24)', () {
    for (final (device, url) in const [
      (Locale('de', 'DE'), 'https://hummlist.com/support'),
      (Locale('en', 'US'), 'https://hummlist.com/en/support'),
    ]) {
      testWidgets('opens the ${device.languageCode} page in the browser', (
        tester,
      ) async {
        final launcher = fakeLauncher();
        final more = await pumpMore(tester, device: [device]);
        await tester.scrollUntilVisible(key('more-help'), 200);
        expect(
          find.text(
            device.languageCode == 'de' ? 'Hilfe & Kontakt' : 'Help & contact',
          ),
          findsOneWidget,
        );
        await tapKey(tester, 'more-help');
        expect(launcher.opened, [
          (url, PreferredLaunchMode.externalApplication),
        ]);
        expect(path(more), morePath, reason: 'not the app router');
      });
    }

    testWidgets('is shown in every build once published, hidden when not', (
      tester,
    ) async {
      // Peter approved the page on 2026-10-30, so release builds show it too.
      expect(supportPagePublished, isTrue, reason: 'Peter approved');
      expect(supportLinkShown, isTrue);
      expect(Environment.legalDrafts, kDebugMode);
      // Unpublished, the link is hidden: More without the help entry.
      await pumpMore(
        tester,
        routes: [
          GoRoute(
            path: morePath,
            builder: (_, _) => const MoreScreen(showHelp: false),
          ),
        ],
      );
      await tester.scrollUntilVisible(key('more-version'), 200);
      expect(key('more-feedback'), findsOneWidget);
      expect(key('more-help'), findsNothing);
      expect(find.text('Hilfe & Kontakt'), findsNothing);
    });
  });

  group('from 840 px', () {
    testWidgets('More shows the list beside the access page', (tester) async {
      await pumpMore(tester, size: const Size(1024, 768));
      expect(key('more-screen'), findsOneWidget);
      expect(find.text('MCP-SERVER'), findsOneWidget);
      expect(find.text('Zugänge'), findsWidgets);
      final list = tester.getRect(key('more-screen'));
      final page = tester.getRect(find.text('MCP-SERVER'));
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
      expect(find.text('MCP-SERVER'), findsNothing);
      expect(find.byType(BackButton), findsNothing, reason: 'nothing to pop');
      await reveal('menu-account');
      expect(selected(tester, 'menu-account'), isTrue);
      expect(selected(tester, 'more-access'), isFalse);

      await reveal('more-access');
      await tapKey(tester, 'more-access');
      expect(path(more), '/more/access');
      expect(find.text('MCP-SERVER'), findsOneWidget);
      expect(key('account-delete'), findsNothing);
      expect(selected(tester, 'more-access'), isTrue);
    });
  });
}
