// The analytics consent text version the app shows now: the same value as consentTextVersion in
// app/lib/analytics/consent_version.dart (app/test/analytics/consent_version_test.dart checks it), the texts in
// docs/consent/<version>.md. A server event (Alexa add, purchase, voice, integration lock) goes
// out only while the user's newest answer is a yes to this version (Legal Review 2026-11-01,
// addendum 12:35; migration 20261101123500_consent_text_version.sql).
export const CONSENT_TEXT_VERSION = '2026-11-01';
