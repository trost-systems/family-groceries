import 'dart:io';

import 'package:flutter/services.dart';

/// Loads the app's bundled fonts (Bricolage Grotesque, Inter) and the
/// Material icons and Roboto from the Flutter SDK, so goldens show real
/// glyphs instead of the test font's boxes. Once per test file, in
/// `setUpAll`.
Future<void> loadAppFonts() async {
  Future<void> family(String name, Iterable<String> paths) async {
    final loader = FontLoader(name);
    for (final path in paths) {
      final bytes = File(path).readAsBytesSync();
      loader.addFont(Future.value(ByteData.view(bytes.buffer)));
    }
    await loader.load();
  }

  await family('Bricolage Grotesque', [
    for (final w in ['Bold', 'ExtraBold'])
      'assets/fonts/BricolageGrotesque-$w.ttf',
  ]);
  await family('Inter', [
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold'])
      'assets/fonts/Inter-$w.ttf',
  ]);
  // flutter_tester lives in <sdk>/bin/cache/artifacts/engine/<platform>/.
  final artifacts = File(Platform.resolvedExecutable).parent.parent.parent;
  await family('MaterialIcons', [
    '${artifacts.path}/material_fonts/MaterialIcons-Regular.otf',
  ]);
  // The sign-in buttons name system fonts the tester lacks and ignores
  // their fallbacks: Roboto stands in for Google Sans, Inter (the declared
  // fallback) for SF Pro, instead of the test font's boxes.
  final roboto = [
    for (final w in ['Regular', 'Medium', 'Bold'])
      '${artifacts.path}/material_fonts/Roboto-$w.ttf',
  ];
  await family('Google Sans', roboto);
  await family('Roboto', roboto);
  await family('.SF Pro Text', [
    for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold'])
      'assets/fonts/Inter-$w.ttf',
  ]);
}
