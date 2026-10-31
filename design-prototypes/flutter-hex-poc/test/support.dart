import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';

/// Loads the real Baloo 2 and Nunito files, so goldens and the contrast
/// guideline see glyphs instead of Ahem boxes.
Future<void> loadFonts() async {
  for (final (family, file) in const [
    ('Baloo 2', 'fonts/Baloo2-wght.ttf'),
    ('Nunito', 'fonts/Nunito-wght.ttf'),
  ]) {
    final bytes = File(file).readAsBytesSync();
    await (FontLoader(
      family,
    )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
  }
}

final allThemes = [
  for (final variant in HexVariant.values)
    for (final brightness in Brightness.values)
      HexThemeData(variant: variant, brightness: brightness),
];

String themeName(HexThemeData theme) =>
    '${theme.variant.name}-${theme.brightness.name}';

/// Pumps [child] centred on the theme's surface inside a widgets-only app.
Future<void> pumpHex(
  WidgetTester tester,
  Widget child, {
  HexThemeData theme = const HexThemeData(
    variant: HexVariant.sharp,
    brightness: Brightness.light,
  ),
  bool disableAnimations = false,
  Size size = const Size(420, 300),
}) async {
  tester.view
    ..physicalSize = size
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    WidgetsApp(
      color: theme.colors.honey,
      debugShowCheckedModeBanner: false,
      builder: (context, _) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(disableAnimations: disableAnimations),
        child: HexTheme(
          data: theme,
          child: ColoredBox(
            color: theme.colors.surface,
            child: Center(child: child),
          ),
        ),
      ),
    ),
  );
}

/// Global rect of the moving face inside the control found by [control].
Rect faceRect(WidgetTester tester, Finder control, Key faceKey) =>
    tester.getRect(find.descendant(of: control, matching: find.byKey(faceKey)));

Future<void> pressKey(WidgetTester tester, LogicalKeyboardKey key) async {
  await tester.sendKeyEvent(key);
  await tester.pumpAndSettle();
}
