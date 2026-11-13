// Job 138: PR screenshots of More's feedback row and the form with the
// shake hint, as a phone shows them (the web build has no hint). Skipped
// unless SCREENSHOT_DIR is set:
//   SCREENSHOT_DIR=/tmp/shots flutter test --update-goldens \
//     test/feedback/feedback_screenshots_test.dart
import 'dart:io';

import 'package:family_groceries/app/language.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../design/fonts.dart';
import '../more/more_harness.dart';

final _dir = Platform.environment['SCREENSHOT_DIR'];

void main() {
  setUpAll(() async {
    await fakeSupabase();
    if (_dir != null) {
      await loadAppFonts();
      WidgetsApp.debugAllowBannerOverride = false;
    }
  });

  Finder key(String k) => find.byKey(ValueKey(k));

  for (final (lang, language) in [
    ('de', AppLanguage.de),
    ('en', AppLanguage.en),
  ]) {
    testWidgets(
      'feedback $lang',
      skip: _dir == null,
      variant: const TargetPlatformVariant({
        TargetPlatform.android,
        TargetPlatform.iOS,
      }),
      (tester) async {
        final name = '${defaultTargetPlatform.name.toLowerCase()}-$lang';
        tester.view.physicalSize = const Size(390, 844) * 2;
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);
        await pumpMore(tester, language: language);
        await tester.scrollUntilVisible(
          key('more-feedback'),
          200,
          scrollable: find.descendant(
            of: key('more-screen'),
            matching: find.byType(Scrollable),
          ),
        );
        await tester.pumpAndSettle();
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_dir/job138-more-row-$name.png'),
        );
        await tester.tap(key('more-feedback'));
        await tester.pumpAndSettle();
        expect(key('feedback-shake-hint'), findsOneWidget);
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_dir/job138-form-$name.png'),
        );
      },
    );
  }
}
