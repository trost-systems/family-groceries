# Job 9: in-app account deletion and data export (2026-10-24)

Branch `job/9-account-deletion`. This is the store-review blocker: Apple
5.1.1(v) and Google Play both require an in-app deletion path. The store
requirements, researched on 2026-10-24, are in `docs/DECISIONS.md` 9.1.

## What was built

- **Konto in the app.** The list menu has a new "Konto" entry. It opens the
  settings screen at a new "Konto" section with "Meine Daten exportieren"
  and "Konto löschen". The welcome screen has "Konto löschen" for users
  without a household.
- **Deletion dialog.** It says what is deleted and what happens to the
  household. With other members it says "Der Haushalt „Familie Test“
  bleibt für Peter und Lea …". As the last member it says "Du bist das
  letzte Mitglied. Deshalb wird der Haushalt … gelöscht". "Endgültig
  löschen" stays disabled until the user types `LÖSCHEN` (or `LOESCHEN`).
  Offline, the dialog refuses and keeps the account. On any failure,
  nothing is deleted. On success, the app signs out on the device, drops
  its caches and shows "Dein Konto wurde gelöscht." on the sign-in screen.
- **Server.** The new edge function `account` handles
  `POST /functions/v1/account/delete`. It accepts only the app's own
  session; personal access tokens and MCP OAuth tokens get 403. It calls
  `public.delete_account(uuid)` (service role only), which runs one
  transaction:
  - If other members remain, the household stays, the leaver's items stay
    without an author, history stays with `actor` null, and ownership is
    handed over.
  - If the leaver is the last member, the household goes with every row in
    11 tables.
  - Then `auth.users` is deleted, which cascades to the profile,
    membership, PATs, sessions, identities and OAuth grants.

  A retry after a lost response still answers 200.
- **Sign in with Apple revocation.** On iOS the app gets a fresh Apple code.
  The function exchanges it with an ES256 client secret and revokes the
  refresh token. Web, Android and any Apple failure fall back to Apple
  TN3194: the account is deleted, and the user gets the Apple ID settings
  path.
- **Export.** `public.export_my_data()` returns the user's own data as
  versioned JSON, with no token hashes and nothing about other members. The
  app saves `einkauf-daten-YYYY-MM-DD.json`: a download on the web, the
  share sheet on the phones, the Downloads folder (or the temp directory)
  on the desktop.
- **Fixed on main.** No user who had ever added an item could be deleted,
  not even from the Supabase dashboard. `items_before_write` re-pinned
  `added_by` against `ON DELETE SET NULL`. The fix is a new migration,
  `20261024130534_account_deletion.sql`, which also stops 'edited' history
  rows for updates that change nothing visible.
- **Fixed in fg.** Since job 8, every `fg find`/`wait` on a screen with a
  fresh partner item failed with "Unterminated string in JSON". The
  semantics label `"<name>\nNeu"` spans two lines of Marionette output.
  `parseElements` now rejoins the lines, and a test covers it.
- **Docs.**
  - `docs/ACCOUNT_DELETION.md`: what is deleted, what stays, retention (1
    day of Supabase Free logs, no backups).
  - `docs/DECISIONS.md` job 9.
  - `docs/NEEDS_PETER.md` job 9.
  - `app/web/konto-loeschen.html`: the public deletion page for Google Play,
    marked "ENTWURF, nicht veröffentlicht: Freigabe durch Peter" and
    `noindex`.

## How to verify

- `scripts/verify.sh` runs every gate: pgTAP
  (`supabase/tests/account_deletion.test.sql`), Deno
  (`supabase/functions/account/*_test.ts`), Flutter
  (`app/test/settings/account*_test.dart`) and Playwright
  (`e2e/tests/account.spec.ts`).
- `supabase/functions/account/smoke.sh`: curl against the local stack, 26
  steps.
- `FG_PORT_PREFIX=<prefix> scripts/fg up --clients peter,lea`, then
  `.cursor/skills/verify-family-groceries/journeys/account-deletion.sh`.
  This drives the real Linux app through the shared deletion, the
  last-member deletion and the export, and prints `PASS` or
  `FAIL: <step>`. The recipe is `features/account.md`.

## Results

- pgTAP: 9 files, 513 tests, all pass, 36 of them new.
- Deno functions: 246 pass. Deploy tooling: 13. fg CLI: 22.
- Flutter: analyze clean, 242 tests pass.
- Playwright `account.spec.ts`: 6 tests, 3 green runs in a row
  (`--workers=1`). One run before that failed in the shared-household
  test after 7.8 min on a loaded box; 9 further runs did not reproduce it.
- `scripts/verify.sh` on the head rebased onto `edbc6ab`: all checks passed, e2e 66/66 in 5.1 min.
- fg journey on the Linux surface: PASS. Screenshots and a recording are in
  `docs/screenshots/09/`. Evidence is in
  `~/groceries-ops/evidence/09-account`.
- `flutter build apk --debug` builds with the new share_plus plugin. iOS
  was not built on this box (Linux). share_plus needs iOS 13, and the app
  targets 15.

## Missing or blocked (needs Peter, `docs/NEEDS_PETER.md` job 9)

- Approve the drafts: the public page `konto-loeschen.html` (developer name,
  support address, 30-day promise for people who can no longer sign in)
  and the deletion and retention facts for the store privacy forms.
- Set the Sign in with Apple key as function secrets on the hosted
  project. The exact commands are in NEEDS_PETER. Until then, iPhone
  deletions take the documented TN3194 fallback.
- The real Apple exchange and revocation are tested only against a fake
  Apple server. Checking them needs an iPhone and a throwaway Apple ID
  (NEEDS_PETER step 4).

## Review 0 fixes (2026-10-24, branch `job/9b-account-review-fixes`)

- **Must fix: the deletion call that CI saw fail with an empty 503.** The
  503 comes from the edge runtime ("connection aborted" on a cold `oneshot`
  worker), not from the handler. The hosted gateway answers 502, 503, 504
  or 546 the same way when a worker fails to boot. The endpoint is
  idempotent, so `SupabaseAccountRepository.delete` now retries once after
  one second on a gateway error that lacks the handler's JSON `error`.
  Errors the handler answered are not retried, and a second drop fails
  without a third try. Three new tests cover this. The retry test fails
  when the retry is disabled.
- **Nice to have, done.** The function now reads the Apple subject, deletes,
  and only then calls Apple. A failed delete therefore never spends the
  single-use Apple code. A retry that finds the account already gone
  answers `apple: "manual"`, so the app shows the Apple ID hint, because
  that call cannot know whether the first one revoked. Covered in
  `handler_test.ts` and `smoke.sh`.
- **Nice to have, done.** `docs/ACCOUNT_DELETION.md` now says that
  `items_added` covers the current household only. Items added in a
  household you left belong to that household, and your actions there are
  in `history`.
- **Decision.** `docs/DECISIONS.md` 9.12.
- **Verified.** `scripts/verify.sh` all green (pgTAP 513, Deno 246, Flutter 245, Playwright 66/66 in 4.6 min) and `smoke.sh` 26/26 on the local stack.
