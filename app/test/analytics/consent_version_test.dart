import 'dart:convert';
import 'dart:io';

import 'package:family_groceries/analytics/consent_version.dart';
import 'package:flutter_test/flutter_test.dart';

/// The consent text version is one fact in three places: the app, the
/// functions and docs/consent/ (Legal Review 2026-11-01, addendum 12:35).
void main() {
  Map<String, Object?> arb(String locale) =>
      jsonDecode(File('l10n/app_$locale.arb').readAsStringSync())
          as Map<String, Object?>;

  final doc = File('../docs/consent/$consentTextVersion.md');

  test('the functions name the same version', () {
    final ts = File('../supabase/functions/_shared/consent_version.ts')
        .readAsStringSync();
    expect(
      RegExp("CONSENT_TEXT_VERSION = '([^']+)'").firstMatch(ts)?.group(1),
      consentTextVersion,
    );
  });

  test('the version is a date', () {
    expect(consentTextVersion, matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
  });

  for (final locale in ['de', 'en']) {
    test('docs/consent keeps the $locale text word for word', () {
      final text = doc.readAsStringSync();
      final strings = arb(locale);
      for (final key in [
        'analyticsConsentTitle',
        'analyticsConsentBody',
        'analyticsConsentPrivacyLink',
        'analyticsAccept',
        'analyticsDecline',
      ]) {
        expect(text, contains(strings[key]! as String), reason: key);
      }
    });
  }
}
