import 'dart:convert';
import 'dart:io';

import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hummlist_widgetbook/catalog.dart';
import 'package:hummlist_widgetbook/src/addons.dart';
import 'package:hummlist_widgetbook/src/tokens.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:widgetbook/test.dart';
import 'package:widgetbook/widgetbook.dart';

/// Lets the stories' synthetic hover, focus and press land and the faces
/// move; a busy story's spinner never settles, so this pumps a fixed time.
Future<void> _settle(WidgetTester tester, Scenario _) async {
  await tester.pump(kPressTimeout);
  await tester.pump(const Duration(milliseconds: 400));
}

Map<String, dynamic> _tokens() => jsonDecode(
  File('../../design/tokens/hummlist.tokens.json').readAsStringSync(),
) as Map<String, dynamic>;

Future<void> main() async {
  setUpAll(() async {
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
    await loadAppFonts();
  });

  // One snapshot per scenario under build/.widgetbook; a story that throws
  // fails its test.
  await testWidgetbook(catalogConfig(setUp: _settle));

  test('every story renders in light and dark, each with a snapshot', () {
    final config = catalogConfig();
    final scenarios = [
      for (final component in config.components)
        for (final story in component.stories) ...story.allScenarios(config),
    ];
    for (final component in config.components) {
      for (final story in component.stories) {
        expect(story.allScenarios(config).map((s) => s.name), [
          'Hell',
          'Dunkel',
        ], reason: story.path);
      }
    }
    final snapshots = Directory('build/.widgetbook')
        .listSync(recursive: true)
        .where((file) => file.path.endsWith('.png'));
    expect(scenarios, hasLength(greaterThan(150)));
    expect(snapshots, hasLength(scenarios.length));
  });

  group('the colour pages show the token file', () {
    final tokens = _tokens();
    final colors = tokens['color'] as Map<String, dynamic>;
    for (final brightness in Brightness.values) {
      test('${brightness.name}: every colour token, with its hex', () {
        final file = {
          for (final MapEntry(:key, :value)
              in (colors[brightness.name] as Map<String, dynamic>).entries)
            if (!key.startsWith(r'$'))
              key:
                  ((value as Map<String, dynamic>)[r'$value']
                          as Map<String, dynamic>)['hex']
                      as String,
        };
        final shown = {
          for (final token in colorTokens)
            token.name: hex(token.of(HummlistColors.of(brightness))),
        };
        expect(shown, file);
      });
    }

    test('every contrast pair', () {
      final rules =
          (tokens[r'$extensions'] as Map<String, dynamic>)['com.hummlist']
              as Map<String, dynamic>;
      final file = [
        for (final pair in rules['contrastPairs'] as List<dynamic>)
          (pair as List<dynamic>).join(' '),
      ];
      final shown = [
        for (final pair in contrastPairs)
          [
            pair.fg,
            pair.bg,
            if (pair.min == pair.min.roundToDouble())
              pair.min.round()
            else
              pair.min,
            ?pair.only?.name,
          ].join(' '),
      ];
      expect(shown, file);
    });
  });

  group('a press in the playground', () {
    final config = catalogConfig();
    final playground = config.components
        .firstWhere((c) => c.name == 'FilledButton')
        .stories
        .firstWhere((s) => s.name == 'Spielwiese');

    Future<double Function()> pump(
      WidgetTester tester, {
      required bool reducedMotion,
    }) async {
      await tester.pumpWidget(
        Builder(
          builder: (context) => playground.buildWithConfig(
            context,
            config,
            modes: [if (reducedMotion) ReducedMotionMode(on: true)],
          ),
        ),
      );
      return () => tester.getCenter(find.text('Anlegen')).dy;
    }

    testWidgets('sinks the face and lets it bounce back', (tester) async {
      final labelY = await pump(tester, reducedMotion: false);
      final rest = labelY();
      final press = await tester.startGesture(
        tester.getCenter(find.byType(FilledButton)),
      );
      await tester.pump();
      await tester.pump(HlDuration.press ~/ 2);
      expect(
        labelY(),
        allOf(greaterThan(rest), lessThan(rest + HlDepth.press)),
      );
      await tester.pump(HlDuration.press);
      expect(labelY(), moreOrLessEquals(rest + HlDepth.press));

      await press.up();
      await tester.pump();
      await tester.pump(HlDuration.release * 0.6);
      // The bounce curve overshoots: the face rises past rest, then settles.
      expect(labelY(), lessThan(rest));
      await tester.pump(HlDuration.release);
      expect(labelY(), moreOrLessEquals(rest));
      expect(find.text('Gedrückt: 1×'), findsOneWidget);
    });

    testWidgets('jumps with reduced motion', (tester) async {
      final labelY = await pump(tester, reducedMotion: true);
      final rest = labelY();
      final press = await tester.startGesture(
        tester.getCenter(find.byType(FilledButton)),
      );
      await tester.pump();
      expect(labelY(), moreOrLessEquals(rest + HlDepth.press));
      await press.up();
      await tester.pump();
      expect(labelY(), moreOrLessEquals(rest));
      expect(find.text('Gedrückt: 1×'), findsOneWidget);
    });
  });
}
