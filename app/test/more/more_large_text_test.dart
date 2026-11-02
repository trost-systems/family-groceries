import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'more_harness.dart';

/// The app doesn't clamp the text scale; an overflow fails the test on its
/// own.
void main() {
  setUpAll(fakeSupabase);

  for (final scale in [2.0, 3.0]) {
    for (final size in [const Size(360, 640), const Size(320, 568)]) {
      testWidgets('at text scale $scale every Mehr row fits '
          '(${size.width.toInt()}x${size.height.toInt()})', (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await pumpMore(tester, size: size);
        for (final row in [
          'more-invite',
          'more-join',
          'more-access',
          'menu-account',
          'more-sign-out',
          'more-feedback',
          'more-settings',
          'more-version',
        ]) {
          await tester.scrollUntilVisible(find.byKey(ValueKey(row)), 200);
          await tester.pumpAndSettle();
        }
      });
    }
  }
}
