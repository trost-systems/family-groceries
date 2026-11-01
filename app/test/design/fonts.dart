import 'dart:io';

import 'package:flutter/services.dart';

/// Loads the app's bundled fonts (Bricolage Grotesque, Inter) and the
/// Material icons from the Flutter SDK, so goldens show real glyphs instead
/// of the test font's boxes. Once per test file, in `setUpAll`.
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
}
