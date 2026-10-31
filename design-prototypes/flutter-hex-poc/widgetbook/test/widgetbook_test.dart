import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hummel_hex_widgetbook/catalog.dart';
import 'package:widgetbook/test.dart';

Future<void> main() async {
  setUpAll(loadHexFonts);

  // One snapshot per scenario under build/.widgetbook; each scenario must
  // also pass the PoC's accessibility guidelines in the state it shows.
  await testWidgetbook(
    catalogConfig(
      tearDown: (tester, scenario) async {
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        // At the snapshot's pixel ratio of 2 the contrast guideline samples
        // the wrong pixels for text far from the origin (the Gallery's badges
        // read as backdrop); at 1, as in the PoC's own tests, it is exact.
        tester.view.devicePixelRatio = 1;
        await tester.pump();
        await expectLater(tester, meetsGuideline(textContrastGuideline));
      },
    ),
  );

  test('every scenario wrote a snapshot', () {
    final config = catalogConfig();
    final scenarios = [
      for (final component in config.components)
        for (final story in component.stories) ...story.allScenarios(config),
    ];
    final snapshots = Directory('build/.widgetbook')
        .listSync(recursive: true)
        .where((file) => file.path.endsWith('.png'));
    expect(scenarios, hasLength(greaterThan(100)));
    expect(snapshots, hasLength(scenarios.length));
  });
}
