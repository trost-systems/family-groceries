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
