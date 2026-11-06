import 'dart:ui' show loadFontFromList;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Lists the bundled fonts' SIL Open Font Licenses on the licence page, as
/// the OFL asks of a bundle that ships the fonts.
void registerFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    for (final (family, file) in const [
      ('Bricolage Grotesque', 'OFL-BricolageGrotesque.txt'),
      ('Inter', 'OFL-Inter.txt'),
    ]) {
      yield LicenseEntryWithLineBreaks([
        family,
      ], await rootBundle.loadString('assets/fonts/$file'));
    }
  });
}

/// Registers the bundled fonts before the first frame: Bricolage Grotesque
/// and Inter as TrueType on devices and as WOFF2 on the web, where they are a
/// fifth smaller on the wire (Android's engine reads no WOFF2, and a pubspec
/// `fonts:` entry cannot differ per platform, so they are assets). On the web
/// also the item icons' emoji as "Noto Color Emoji", the family
/// `emojiFontFallback` names: the icons cut from the chunks the engine would
/// otherwise download as fallback fonts (scripts/app-fonts.sh writes all of
/// them). A family that fails to load only logs; one that is late after 5 s
/// still applies when it arrives (job 133).
///
/// [prefix] is `packages/family_groceries/` for an app that depends on this
/// one (the Widgetbook). [bundle] is for tests.
Future<void> loadAppFonts({String prefix = '', AssetBundle? bundle}) async {
  // What FontLoader does (all reads at once, each face registered in turn,
  // the bytes viewed, not copied), but each read handles its own failure
  // from the start: FontLoader stops at the first one and leaves the other
  // reads' errors to the zone's handler and so to error tracking.
  Future<void> family(String name, List<String> files) async {
    final reads = [
      for (final file in files)
        (bundle ?? rootBundle)
            .load('${prefix}assets/fonts/$file')
            .then<ByteData?>(
              (data) => data,
              onError: (Object error) {
                debugPrint('font $file: $error');
                return null;
              },
            ),
    ];
    for (final read in reads) {
      if (await read case final data?) {
        try {
          await loadFontFromList(
            Uint8List.view(data.buffer, data.offsetInBytes, data.lengthInBytes),
            fontFamily: name,
          );
        } on Object catch (error) {
          debugPrint('font $name: $error');
        }
      }
    }
  }

  String face(String name) => kIsWeb ? 'web/$name.woff2' : '$name.ttf';
  await Future.wait([
    family('Bricolage Grotesque', [
      for (final weight in ['Bold', 'ExtraBold'])
        face('BricolageGrotesque-$weight'),
    ]),
    family('Inter', [
      for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold'])
        face('Inter-$weight'),
    ]),
    if (kIsWeb) family('Noto Color Emoji', ['web/NotoColorEmoji-icons.ttf']),
  ]).timeout(const Duration(seconds: 5), onTimeout: () => const []);
}
