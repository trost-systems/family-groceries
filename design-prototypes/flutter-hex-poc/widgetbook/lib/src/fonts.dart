import 'package:flutter/services.dart';

/// Registers the PoC's fonts under the family names its tokens use.
///
/// A dependency's fonts are bundled as `packages/hummel_hex_poc/<family>`, but
/// `HexType` asks for plain `Baloo 2` and `Nunito`; this loads the same bundled
/// files under those names instead of shipping a second copy.
Future<void> loadHexFonts() async {
  for (final (family, file) in const [
    ('Baloo 2', 'Baloo2-wght.ttf'),
    ('Nunito', 'Nunito-wght.ttf'),
  ]) {
    await (FontLoader(
      family,
    )..addFont(rootBundle.load('packages/hummel_hex_poc/fonts/$file'))).load();
  }
}
