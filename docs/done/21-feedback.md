# Job 21: in-app feedback for beta testers (Spec #2)

PR: https://github.com/trost-systems/family-groceries/pull/103

Testers (and, from the next release, every DACH user) send a short note from **Mehr → Feedback
senden** on iOS, Android and the web. The note lands in `public.feedback` with the app version,
build, platform, OS version, app language and the screen the user came from, and nothing from
the list. Peter and the PM read it with the service role; nothing notifies anyone (Peter's
decisions 1-5 of 2026-10-27, DECISIONS "Job 21"). Overview: [FEEDBACK.md](../FEEDBACK.md).

## What changed for users

- More has a section "Feedback" with **"Feedback senden"** ("Send feedback"), hint "Fehler, Ideen
  und Fragen an Peter".
- It opens a sheet (content-sized, at most 640 px wide): the note (1 to 2,000 characters; a
  counter from 1,800, an error over 2,000), optional chips Bug / Idee / Sonstiges, an optional
  "Peter darf mich dazu kontaktieren" (off), and the line "Wird mitgeschickt: App-Version, Gerät,
  Sprache und aktueller Bildschirm. Keine Listeneinträge."
- **Senden** closes the sheet and shows "Danke!". Without a connection (or a server error, or
  15 s without an answer) the note stays with "Nicht gesendet. …" and **Erneut senden**; nothing is
  sent later on its own. A closed sheet keeps the draft until it is sent.
- German and English throughout, following the app language.
- "Meine Daten exportieren" now includes the user's own notes.

## Where

- Migration `supabase/migrations/20261030070000_feedback.sql`: `public.feedback` (checks,
  comments on every column), `feedback_trim`, trigger `feedback_before_insert` (household,
  created_at, trim, test accounts internal, own-id repeat skipped), policy `feedback_insert_own`,
  column grants, `purge_old_feedback()`, pg_cron job `purge-old-feedback` (daily 03:17 UTC),
  `export_my_data` with a `feedback` section.
- App `app/lib/feedback/`: `feedback_repository.dart` (insert, 23505 handling, offline/timeout),
  `feedback_cubit.dart` (draft, one id per note, double tap, Retry, event once),
  `feedback_sheet.dart` (the form), `feedback_context.dart` (package_info_plus, device_info_plus,
  `webOsVersion`), `screen_tracker.dart`. Router: `screenNames`, `screenNameOf`, `inMoreTab` in
  `app/lib/app/router.dart` (replaces the private `_inShell`). `app.dart` provides the tracker,
  device facts and cubit; `main.dart` the repository; `more_screen.dart` the row.
  `Analytics.internalNow`; `feedback_submitted` in `eventCatalog`. New dependency:
  `device_info_plus`. Strings: 20 `feedback*` keys in both ARB files.
- Tests: pgTAP `supabase/tests/feedback.test.sql` (51), `rls.test.sql` (+4),
  `account_deletion.test.sql` (+5, export); Flutter `test/feedback/` (cubit, repository, sheet,
  screen names, context), `events_test.dart`, More, language and parity tests; e2e
  `e2e/tests/feedback.spec.ts` (8), `rls.spec.ts` (+1), `account.spec.ts` (feedback in both
  deletion paths and the export); `scripts/feedback-monday.sh` in the db gate; rows in
  `scripts/backup/fixtures.sql`.
- Docs: `docs/FEEDBACK.md`, DECISIONS "Job 21", NEEDS_PETER "Job 21", ANALYTICS.md (event row),
  verify skill `features/feedback.md` (+ README, SKILL key table, shell-more, account).

## Acceptance criteria

| AC | Proof |
| --- | --- |
| 1 More shows the entry (DE/EN), opens the form | e2e (web), widget tests; same Flutter widget on iOS/Android (no simulators on the runner) |
| 2 one row, text only, user/category/contact/context; double tap one row | e2e "a note from More…", "a double tap…" (one POST), cubit and widget tests, pgTAP repeats |
| 3 `screen` = `list` from list → More → Feedback | e2e row `screen: list`; `account` beside a More page (wide); `screen_name_test.dart` incl. `/join/<code>` → `join` |
| 4 empty, blank, > 2,000 refused in app and DB | e2e (UI + API 23514), widget/cubit tests, pgTAP (Unicode blanks, emoji counts) |
| 5 RLS literally | pgTAP `feedback.test.sql`, `rls.test.sql`; e2e `rls.spec.ts` |
| 6 service role sees it within a minute | e2e polls with the service role (< 60 s); Monday query on fake rows (db gate output below); hosted proof is the lead's |
| 7 offline: error, text stays, Retry, no row offline, no duplicate | e2e `context.setOffline(true)`; lost-answer e2e; widget test with a failing repository |
| 8 one `feedback_submitted` with consent, no text; declined → no event, row saved | e2e with the fake collector (both cases), cubit tests |
| 9 no list data outside `message` | e2e scans every other column of a household with items |
| 10 DE and EN | e2e English test, widget tests DE/EN, ARB parity |
| 11 internal for Peter's household / test account / debug build | pgTAP (fg.test, fg-test.invalid, example.com forced; client flag kept), e2e `is_internal: true`; Peter's household via the define (NEEDS_PETER) |
| 12 account deletion removes the user's notes | pgTAP kept and deleted household, former member's note stays without id; e2e account spec |
| Retention | pgTAP: 12 months + 1 day gone, 11 months stays, one cron job after a second schedule |

## How to verify

```bash
(cd app && flutter analyze --fatal-infos && flutter test test/feedback test/more test/analytics/events_test.dart)
scripts/lint.sh
scripts/ci-e2e.sh --spec "tests/feedback.spec.ts tests/rls.spec.ts tests/account.spec.ts"   # also runs the db gate
```

## Results

- Flutter gate on the Mac: analyze clean, 586 tests passed.
- `scripts/lint.sh` and `check-gates.sh` pass. Locally on macOS the lint gate's shellcheck step
  reports SC2218 in untouched scripts and the gitleaks gate's tar step fails (BSD tar); both pass
  on CI. `gitleaks git` found no leaks.
- CI (on-demand e2e): db gate green (pgTAP, drill with 18 tables incl. `feedback`, Monday proof),
  run 41011512867; feedback spec 8/8, run 41015960576; rls and account specs green in 41011512867.
  The PR's full CI run is linked in the PR body.
- Real app via `scripts/fg`: not run. The Mac runner has no Docker, so no local stack and no
  Linux build; the web e2e drives the same Flutter code against the real stack on CI. The
  recipe is in `features/feedback.md` for the next box run.

## Screenshots

`docs/screenshots/job-21/`: `more-entry-de`, `more-entry-en`, `form-empty-de`, `form-filled-de`,
`form-filled-en`, `thanks-de`, `thanks-en`, `offline-retry-de`, `offline-retry-en` (390×844),
`wide-more`, `wide-form` (1366×1024), `monday-summary-fake.png` (+ `.txt`).

## Missing or blocked

- Privacy policy text for feedback, and Peter's household id as a build define: NEEDS_PETER
  "Job 21".
- Hosted check of the cron job after deploy (lead): NEEDS_PETER "Job 21", item 3.
- No iOS/Android device run (no simulators/emulators allowed on the runner).
