import 'package:flutter/services.dart';

/// Registers the app's bundled fonts under the family names its tokens use.
///
/// A dependency's fonts are bundled as `packages/family_groceries/<family>`,
/// but `HlFont` asks for plain `Bricolage Grotesque` and `Inter`; this loads
/// the same bundled files under those names instead of shipping a copy.
Future<void> loadAppFonts() async {
  for (final (family, files) in const [
    ('Bricolage Grotesque', ['Bold', 'ExtraBold']),
    ('Inter', ['Regular', 'Medium', 'SemiBold', 'Bold']),
  ]) {
    final loader = FontLoader(family);
    final stem = family.replaceAll(' ', '');
    for (final weight in files) {
      loader.addFont(
        rootBundle.load(
          'packages/family_groceries/assets/fonts/$stem-$weight.ttf',
        ),
      );
    }
    await loader.load();
  }
}
