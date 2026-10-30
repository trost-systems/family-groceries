# Job 33b: legal fixes in the app

PR #107 (branch `job/33b-legal-app`). **Not merged:** the PR waits,
ready to merge, for Peter's legal OK. A merge ships TestFlight and Play
internal builds, so the Hummlist Lead merges it after that OK, together with
33a (the privacy pages). Decisions: `docs/DECISIONS.md`, "Job 33b". Peter's
steps: `docs/NEEDS_PETER.md`, "Job 33b".

## What was built

- **H-01, app part.** `privacyPolicyUrl(languageCode)` in
  `app/lib/app/guides.dart` returns https://hummlist.com/datenschutz for
  German and https://hummlist.com/en/privacy for every other language.
  Every privacy link in the app uses it. More → Datenschutz opens it. The
  in-app draft page is deleted, together with its route `/more/privacy`,
  `MorePage.privacy`, the ARB keys `privacyDraftBody` and `draft`, and its
  tests.
- **H-07.** `LegalFooter` (`app/lib/app/legal_links.dart`) shows "Impressum ·
  Datenschutz" ("Imprint · Privacy") below the login form, outside the
  scrolling part, so it is visible without scrolling.
- **H-03.** The consent title, body, switch and hint are copied verbatim
  from the review's redline, DE and EN, with "Peter Trost" spelled out.
  "Datenschutzerklärung" ("privacy policy") at the end of the body is a
  link (`analyticsConsentPrivacyLink`). Peter approved the wording on
  2026-10-30 (07:51), so the ENTWURF chip and `analyticsDraftNote` are removed
  here.
- **H-08.** `Analytics.load()` never creates an install id. A yes creates
  and stores it. A no, or switching it off, deletes the id and the
  `first_open` mark (`AnalyticsStore.forgetInstallId`). An id that a
  job 19 build stored without a yes is deleted at the next start.
- **No in-app browser.** `openLegalPage` and `LegalLink` open the legal
  pages with `LaunchMode.externalApplication`: the system browser on iOS
  and Android, a new tab on the web.
- **H-17.** `consentListAccess` takes `{client}` and says that the client
  and its provider receive the list contents.

## How to verify

- `cd app && flutter test` (701 tests). The H-08 cases are in
  `test/analytics/analytics_test.dart`, group "the install id exists only
  while the answer is yes".
- `scripts/ci-e2e.sh --spec "tests/legal.spec.ts tests/analytics.spec.ts tests/shell-more.spec.ts"`
  on the pushed branch, or the PR's CI. `legal.spec.ts` needs no Supabase
  and runs locally against an e2e web build.

## Results

- Locally: `flutter analyze --fatal-infos` clean, `flutter test` 701
  passed, gates gitleaks, lint (without shellcheck, which is missing on the
  box), flutter and web-prod passed, `legal.spec.ts` 4 passed.
- CI on the PR head: see the PR's checks.
- Screenshots: `docs/screenshots/33b/` (login footer DE and EN at phone and
  desktop width, consent screen DE and EN, More → Nutzungsdaten DE and EN).

## Open and follow-ups

- Wording approved by Peter 2026-10-30; the lead merges #107, then 33a (#105).
- H-21: two switches for usage data and error reports (optional, not built).
- Peter: H-11 (where backups live), H-14 (Play payments address 7 → 5).
