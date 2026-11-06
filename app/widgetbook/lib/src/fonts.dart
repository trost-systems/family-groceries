import 'package:family_groceries/design/fonts.dart' as app;

/// Registers the app's bundled fonts under the family names its tokens use.
///
/// A dependency's assets are bundled under `packages/family_groceries/`;
/// the app's own loader reads them from there, so `HlFont`'s plain
/// `Bricolage Grotesque` and `Inter` resolve without a copy of the files.
Future<void> loadAppFonts() =>
    app.loadAppFonts(prefix: 'packages/family_groceries/');
