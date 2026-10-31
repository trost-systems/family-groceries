import 'dart:io';

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';

import 'support.dart';

enum ButtonState() { rest, hover, pressed, focused, disabled }

const shot = ValueKey('shot');
const cellSize = Size(260, 96);

String buttonGolden(HexThemeData theme, HexButtonKind kind, ButtonState s) =>
    'goldens/button/${themeName(theme)}-${kind.name}-${s.name}.png';

/// [child] on the theme's surface with room around it, as one image.
Widget framed(HexThemeData theme, Widget child) => RepaintBoundary(
  key: shot,
  child: ColoredBox(
    color: theme.colors.surface,
    child: Padding(padding: const EdgeInsets.all(12), child: child),
  ),
);

void main() {
  setUpAll(loadFonts);
  tearDown(
    () => FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.automatic,
  );

  group('HexButton states', () {
    for (final theme in allThemes) {
      for (final kind in HexButtonKind.values) {
        for (final state in ButtonState.values) {
          testWidgets('${themeName(theme)} ${kind.name} ${state.name}', (
            tester,
          ) async {
            final focus = FocusNode();
            addTearDown(focus.dispose);
            await pumpHex(
              tester,
              SizedBox.fromSize(
                size: cellSize,
                child: framed(
                  theme,
                  Center(
                    child: HexButton(
                      label: 'Hinzufügen',
                      kind: kind,
                      focusNode: focus,
                      onPressed: state == ButtonState.disabled ? null : () {},
                    ),
                  ),
                ),
              ),
              theme: theme,
              size: cellSize,
            );
            final center = tester.getCenter(find.byType(HexButton));
            TestGesture? gesture;
            switch (state) {
              case ButtonState.rest || ButtonState.disabled:
                break;
              case ButtonState.hover:
                gesture = await tester.createGesture(
                  kind: PointerDeviceKind.mouse,
                );
                await gesture.addPointer(location: center);
                await gesture.moveTo(center);
              case ButtonState.pressed:
                gesture = await tester.startGesture(center);
              case ButtonState.focused:
                FocusManager.instance.highlightStrategy =
                    FocusHighlightStrategy.alwaysTraditional;
                focus.requestFocus();
            }
            await tester.pumpAndSettle();
            await expectLater(
              find.byKey(shot),
              matchesGoldenFile(buttonGolden(theme, kind, state)),
            );
            if (state == ButtonState.pressed) {
              await gesture?.up();
            } else {
              await gesture?.removePointer();
            }
            await tester.pumpAndSettle();
          });
        }
      }
    }
  });

  // Built from the per-state goldens above: focus is global, so no single
  // screen can show every button focused at once.
  for (final variant in HexVariant.values) {
    testWidgets('states grid ${variant.name}', (tester) async {
      final rows = [
        for (final brightness in Brightness.values)
          for (final kind in HexButtonKind.values)
            (HexThemeData(variant: variant, brightness: brightness), kind),
      ];
      final images = await tester.runAsync(
        () async => [
          for (final (theme, kind) in rows)
            [
              for (final state in ButtonState.values)
                await decodeImageFromList(
                  File('test/${buttonGolden(theme, kind, state)}')
                      .readAsBytesSync(),
                ),
            ],
        ],
      );
      const theme = HexThemeData(
        variant: HexVariant.sharp,
        brightness: Brightness.light,
      );
      final caption = HexType.label.copyWith(color: theme.colors.text);
      await pumpHex(
        tester,
        framed(
          theme,
          Table(
            defaultColumnWidth: const IntrinsicColumnWidth(),
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            children: [
              TableRow(
                children: [
                  Text(variant.name, style: caption),
                  for (final state in ButtonState.values)
                    Center(child: Text(state.name, style: caption)),
                ],
              ),
              for (final (i, (rowTheme, kind)) in rows.indexed)
                TableRow(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        '${rowTheme.brightness.name} ${kind.name}',
                        style: caption,
                      ),
                    ),
                    for (final image in images![i])
                      RawImage(image: image, width: 260, height: 96),
                  ],
                ),
            ],
          ),
        ),
        size: const Size(1500, 660),
      );
      await expectLater(
        find.byKey(shot),
        matchesGoldenFile('goldens/states-grid-${variant.name}.png'),
      );
      for (final row in images!) {
        for (final image in row) {
          image.dispose();
        }
      }
    });
  }

  for (final theme in allThemes) {
    testWidgets('HexChip ${themeName(theme)}', (tester) async {
      await pumpHex(
        tester,
        framed(
          theme,
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              HexChip(label: 'Alle', selected: true, onSelected: (_) {}),
              HexChip(label: 'Edeka', selected: false, onSelected: (_) {}),
              const HexChip(label: 'Aldi', selected: false, onSelected: null),
            ],
          ),
        ),
        theme: theme,
      );
      await expectLater(
        find.byKey(shot),
        matchesGoldenFile('goldens/chip/${themeName(theme)}.png'),
      );
    });

    testWidgets('ListRow ${themeName(theme)}', (tester) async {
      await pumpHex(
        tester,
        SizedBox(
          width: 380,
          child: framed(
            theme,
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListRow(
                  title: 'Hafermilch',
                  subtitle: '2 Liter, ungesüßt',
                  store: 'Edeka',
                  checked: false,
                  onChanged: (_) {},
                ),
                ListRow(
                  title: 'Bananen',
                  quantity: '6',
                  checked: true,
                  onChanged: (_) {},
                ),
                ListRow(title: 'Brot', checked: false, onChanged: (_) {}),
              ],
            ),
          ),
        ),
        theme: theme,
      );
      await expectLater(
        find.byKey(shot),
        matchesGoldenFile('goldens/list-row/${themeName(theme)}.png'),
      );
    });

    testWidgets('gallery ${themeName(theme)}', (tester) async {
      await pumpHex(
        tester,
        // Drawn at twice the size: the gallery goldens double as screenshots.
        RepaintBoundary(
          key: shot,
          child: SizedBox(
            width: GalleryPanel.width * 2,
            child: FittedBox(child: GalleryPanel(theme: theme)),
          ),
        ),
        theme: theme,
        size: const Size(800, 1900),
      );
      await expectLater(
        find.byKey(shot),
        matchesGoldenFile('goldens/gallery/${themeName(theme)}.png'),
      );
    });
  }
}
