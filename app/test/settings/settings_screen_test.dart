import 'dart:ui' show CheckedState;

import 'package:family_groceries/app/language.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';

void main() {
  setUpAll(fakeSupabase);

  Finder key(String k) => find.byKey(ValueKey(k));

  Future<void> tapKey(WidgetTester tester, String k) async {
    await tester.ensureVisible(key(k));
    await tester.pumpAndSettle();
    await tester.tap(key(k));
    await tester.pumpAndSettle();
  }

  String path(More more) =>
      more.router.routerDelegate.currentConfiguration.uri.toString();

  bool checked(WidgetTester tester, String k) =>
      tester
          .getSemantics(key(k))
          .getSemanticsData()
          .flagsCollection
          .isChecked ==
      CheckedState.isTrue;

  Brightness shownBrightness(WidgetTester tester) =>
      Theme.of(tester.element(find.byType(Scaffold).first)).brightness;

  /// The last line of text in a row.
  String subtitle(WidgetTester tester, String k) => tester
      .widget<Text>(
        find.descendant(of: key(k), matching: find.byType(Text)).last,
      )
      .data!;

  testWidgets('More has one Einstellungen row; it opens the page', (
    tester,
  ) async {
    final more = await pumpMore(tester);
    expect(key('more-language'), findsNothing, reason: 'no segments in More');
    // Below the fold on a phone, and not built until scrolled to.
    await tester.scrollUntilVisible(key('more-settings'), 200);
    expect(find.text('Darstellung und Sprache'), findsOneWidget);
    await tapKey(tester, 'more-settings');
    expect(path(more), '/more/settings');
    expect(find.text('Einstellungen'), findsOneWidget, reason: 'the title');
    expect(find.text('Darstellung'), findsOneWidget);
    for (final row in ['theme-system', 'theme-light', 'theme-dark']) {
      expect(key(row), findsOneWidget, reason: row);
    }
    expect(subtitle(tester, 'settings-language'), 'Wie Gerät (Deutsch)');
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(path(more), '/more');
  });

  group('the theme', () {
    testWidgets('follows the device by default', (tester) async {
      await pumpMore(
        tester,
        location: '/more/settings',
        deviceBrightness: Brightness.dark,
      );
      expect(checked(tester, 'theme-system'), isTrue);
      expect(checked(tester, 'theme-dark'), isFalse);
      expect(shownBrightness(tester), Brightness.dark);
    });

    testWidgets('switches at once and is kept on the device', (tester) async {
      final more = await pumpMore(tester, location: '/more/settings');
      expect(shownBrightness(tester), Brightness.light);

      await tapKey(tester, 'theme-dark');
      expect(shownBrightness(tester), Brightness.dark);
      expect(checked(tester, 'theme-dark'), isTrue);
      expect(checked(tester, 'theme-system'), isFalse);
      expect(await more.cache.theme(), 'dark');

      await tapKey(tester, 'theme-light');
      expect(shownBrightness(tester), Brightness.light);
      expect(await more.cache.theme(), 'light');

      await tapKey(tester, 'theme-system');
      expect(await more.cache.theme(), isNull, reason: 'the default again');
    });

    testWidgets('light overrides a dark device, dark a light one', (
      tester,
    ) async {
      await pumpMore(
        tester,
        location: '/more/settings',
        theme: ThemeMode.light,
        deviceBrightness: Brightness.dark,
      );
      expect(shownBrightness(tester), Brightness.light);
      expect(checked(tester, 'theme-light'), isTrue);
    });

    testWidgets('the dark theme dresses More itself', (tester) async {
      await pumpMore(tester, theme: ThemeMode.dark);
      final scaffold = tester.widget<Material>(
        find
            .descendant(
              of: find.byType(Scaffold).first,
              matching: find.byType(Material),
            )
            .first,
      );
      expect(
        scaffold.color!.computeLuminance(),
        lessThan(0.05),
        reason: 'a dark surface, not white',
      );
    });
  });

  group('the language list', () {
    testWidgets('lists the device option and each language in its own name', (
      tester,
    ) async {
      final more = await pumpMore(tester, location: '/more/settings');
      await tapKey(tester, 'settings-language');
      expect(path(more), '/more/settings/language');
      expect(key('language-screen'), findsOneWidget);
      expect(find.text('Wie Gerät'), findsOneWidget);
      expect(find.text('Gerade Deutsch'), findsOneWidget);
      for (final language in AppLanguage.values) {
        expect(
          find.descendant(
            of: key('language-${language.code}'),
            matching: find.text(language.nativeName),
          ),
          findsOneWidget,
        );
      }
      expect(checked(tester, 'language-system'), isTrue);
    });

    testWidgets('a pick switches the strings at once and is kept', (
      tester,
    ) async {
      final more = await pumpMore(
        tester,
        location: '/more/settings/language',
        device: const [Locale('en', 'GB')],
      );
      expect(find.text('Language'), findsOneWidget, reason: 'follows device');
      expect(find.text('Currently English'), findsOneWidget);

      await tapKey(tester, 'language-de');
      expect(find.text('Sprache'), findsOneWidget, reason: 'the title, live');
      expect(find.text('Gerade English'), findsOneWidget);
      expect(checked(tester, 'language-de'), isTrue);
      expect(await more.cache.language(), 'de');
      expect(path(more), '/more/settings/language', reason: 'stays put');

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(path(more), '/more/settings', reason: 'back pops to Settings');
      expect(subtitle(tester, 'settings-language'), 'Deutsch');

      await tapKey(tester, 'settings-language');
      await tapKey(tester, 'language-system');
      expect(find.text('Language'), findsOneWidget);
      expect(await more.cache.language(), isNull);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(subtitle(tester, 'settings-language'), 'Device (English)');

      await tapKey(tester, 'settings-language');
      await tapKey(tester, 'language-en');
      expect(more.language.state, AppLanguage.en);
      expect(await more.cache.language(), 'en');
    });

    testWidgets('a device in neither language follows as German', (
      tester,
    ) async {
      await pumpMore(
        tester,
        location: '/more/settings/language',
        device: const [Locale('fr', 'FR')],
      );
      expect(find.text('Gerade Deutsch'), findsOneWidget);
    });

    testWidgets('a pick read at start overrides a German device', (
      tester,
    ) async {
      await pumpMore(tester, language: AppLanguage.en);
      expect(find.text('More'), findsOneWidget);
    });
  });

  group('from 840 px', () {
    testWidgets('the language list sits beside More, back goes to Settings', (
      tester,
    ) async {
      final more = await pumpMore(
        tester,
        location: '/more/settings',
        size: const Size(1024, 768),
      );
      expect(key('more-screen'), findsOneWidget);
      expect(key('settings-screen'), findsOneWidget);
      await tapKey(tester, 'settings-language');
      expect(path(more), '/more/settings/language');
      expect(key('more-screen'), findsOneWidget, reason: 'the list stays');
      await tester.scrollUntilVisible(
        key('more-settings'),
        100,
        scrollable: find.descendant(
          of: key('more-screen'),
          matching: find.byType(Scrollable),
        ),
      );
      expect(
        tester
            .widget<ListTile>(
              find.descendant(
                of: key('more-settings'),
                matching: find.byType(ListTile),
              ),
            )
            .selected,
        isTrue,
      );
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(path(more), '/more/settings');
      expect(key('settings-screen'), findsOneWidget);
      expect(find.byType(BackButton), findsNothing);
    });
  });
}
