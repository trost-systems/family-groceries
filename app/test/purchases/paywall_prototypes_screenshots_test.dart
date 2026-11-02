// Job 81: screenshots of the paywall prototypes for the review page
// (site/public/internal/paywall-prototypes). Each page at 390 px, as tall as
// its content; PW-P5 as the sheet over the locked integration settings, one
// phone tall. The app's theme and fonts, the fake store's launch prices.
// Skipped unless SCREENSHOT_DIR is set:
//   SCREENSHOT_DIR=/tmp/paywall flutter test --update-goldens \
//     test/purchases/paywall_prototypes_screenshots_test.dart
import 'dart:io';

import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/purchases/paywall_prototypes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../design/fonts.dart';
import '../more/more_harness.dart';
import 'fakes.dart';

final _dir = Platform.environment['SCREENSHOT_DIR'];

void main() {
  setUpAll(() async {
    await fakeSupabase();
    if (_dir != null) {
      await loadAppFonts();
      WidgetsApp.debugAllowBannerOverride = false;
    }
  });
  tearDown(() => paywallPrototype.value = null);

  Future<void> shoot(WidgetTester tester, String name) async {
    // Asset images decode off the fake clock: the brand mark.
    for (final element in find.byType(Image).evaluate()) {
      final image = element.widget as Image;
      await tester.runAsync(() => precacheImage(image.image, element));
    }
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(Uri.file('$_dir/$name.png')),
    );
  }

  final shots = [
    for (final (lang, theme) in [
      ('de', ThemeMode.light),
      ('de', ThemeMode.dark),
      ('en', ThemeMode.light),
    ])
      (lang: lang, theme: theme),
  ];

  for (final p in [null, ...PaywallPrototype.values]) {
    for (final (:lang, :theme) in shots) {
      final name = '${p?.name ?? 'now'}-$lang-${theme.name}';
      testWidgets(name, skip: _dir == null, (tester) async {
        paywallPrototype.value = p;
        await pumpMore(
          tester,
          location: premiumPath,
          size: const Size(390, 2400),
          language: AppLanguage.byCode(lang),
          theme: theme,
        );
        // As tall as the page: its last line plus the list's padding.
        final last = find.byKey(
          ValueKey(p == null ? 'lifetime-refund-help' : 'paywall-privacy-link'),
        );
        final bottom = tester.getBottomLeft(last).dy;
        tester.view
          ..physicalSize = Size(390, (bottom + 24).ceilToDouble()) * 2
          ..devicePixelRatio = 2;
        await tester.pumpAndSettle();
        await shoot(tester, name);
      });
    }
  }

  for (final (:lang, :theme) in shots) {
    final name = 'p5-sheet-$lang-${theme.name}';
    testWidgets(name, skip: _dir == null, (tester) async {
      paywallPrototype.value = PaywallPrototype.p5;
      await pumpMore(
        tester,
        location: accessPath,
        language: AppLanguage.byCode(lang),
        theme: theme,
        integrationLock: true,
        premium: FakePremiumServer(lock: true),
      );
      tester.view
        ..physicalSize = const Size(390, 844) * 2
        ..devicePixelRatio = 2;
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('integration-buy')));
      await tester.pumpAndSettle();
      await shoot(tester, name);
    });
  }
}
