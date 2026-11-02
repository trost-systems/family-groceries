// Job 79: screenshots of the More prototypes for the review page
// (site/public/internal/menu-prototypes). Each menu at 390 px, as tall as
// its content; the app's theme and fonts. Skipped unless SCREENSHOT_DIR is
// set:
//   SCREENSHOT_DIR=/tmp/menu flutter test --update-goldens \
//     test/more/menu_prototypes_screenshots_test.dart
import 'dart:io';

import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../analytics/fakes.dart';
import '../design/fonts.dart';
import 'more_harness.dart';

final _dir = Platform.environment['SCREENSHOT_DIR'];

void main() {
  setUpAll(() async {
    await fakeSupabase();
    if (_dir != null) {
      await loadAppFonts();
      WidgetsApp.debugAllowBannerOverride = false;
    }
    showMenuPrototypeSwitch = false;
  });
  tearDown(() => menuPreview.value = null);

  final version = find.byKey(const ValueKey('more-version'));

  Future<void> shoot(
    WidgetTester tester,
    String name, {
    required MenuPreview? preview,
    required String lang,
    required ThemeMode theme,
    String? open,
  }) async {
    NativePostHog().install();
    final analytics = await loadedAnalytics(MemoryAnalyticsStore());
    await analytics.decide(granted: true);
    menuPreview.value = preview;
    await pumpMore(
      tester,
      analytics: analytics,
      size: const Size(390, 2400),
      language: AppLanguage.byCode(lang),
      theme: theme,
    );
    if (open != null) {
      await tester.tap(find.byKey(ValueKey(open)));
      await tester.pumpAndSettle();
      tester.view.physicalSize = const Size(390, 844) * 2;
    } else {
      // As tall as the menu: the version's line plus the list's padding.
      final bottom = tester.getBottomLeft(version).dy;
      tester.view.physicalSize = Size(390, (bottom + 24).ceilToDouble()) * 2;
    }
    tester.view.devicePixelRatio = 2;
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(Uri.file('$_dir/$name.png')),
    );
  }

  final menus = <String, MenuPrototype?>{
    'now': null,
    for (final p in MenuPrototype.values) p.name: p,
  };
  for (final MapEntry(key: id, value: p) in menus.entries) {
    for (final card in [false, if (p != null) true]) {
      for (final (lang, theme) in [
        ('de', ThemeMode.light),
        ('de', ThemeMode.dark),
        if (card) ('en', ThemeMode.light),
      ]) {
        final name = '$id-$lang-${theme.name}${card ? '-update' : ''}';
        testWidgets(name, skip: _dir == null, (tester) async {
          await shoot(
            tester,
            name,
            preview: p == null ? null : (prototype: p, updateCard: card),
            lang: lang,
            theme: theme,
          );
        });
      }
    }
    if (p != null) {
      for (final theme in [ThemeMode.light, ThemeMode.dark]) {
        final name = '$id-de-${theme.name}-privacy';
        testWidgets(name, skip: _dir == null, (tester) async {
          await shoot(
            tester,
            name,
            preview: (prototype: p, updateCard: false),
            lang: 'de',
            theme: theme,
            open: 'menu-row-privacy',
          );
        });
      }
    }
  }
}
