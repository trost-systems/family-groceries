# Job 22: onboarding: create or join a household and invite a partner (Spec #3)

PR: https://github.com/trost-systems/family-groceries/pull/114

After sign-in and the analytics consent (job 19), someone without a household now goes through
onboarding. Step 1 offers "Haushalt erstellen" and "Einladung annehmen". Step 2a creates the
household (name, default German stores or Skip). Step 2b joins one and shows the household's name
first. Step 3 invites the partner: the share sheet in the apps, Web Share or copying on the web.
Invites last 7 days, work once, and any member can revoke one under More. An invite link survives
sign-in by any method on every platform, and `https://app.hummlist.com/join/<code>` opens the
installed apps through universal links and App Links. Peter's decisions and the calls made:
[DECISIONS.md, "Job 22"](../DECISIONS.md).

## What changed for users

- **Step 1** "Willkommen bei Hummlist" ("Welcome to Hummlist"): "Haushalt erstellen" / "Create a
  household" and "Einladung annehmen" / "Join with an invite", plus sign-out and Konto löschen as
  before. Someone who opened an invite link skips it and lands on the join screen.
- **Step 2a**: the name is prefilled with "Unser Haushalt" / "Our household" (1-80 characters).
  "Deutsche Standard-Läden hinzufügen" (dm, Lidl, Edeka in their aisle order; the default) or
  "Überspringen" (no stores; the categories with "Sonstiges" always). A double tap or a retry
  after a lost answer makes one household.
- **Step 2b**: type a code (or arrive with one), "Weiter" shows "Einladung in den Haushalt
  <Name>", then "Haushalt beitreten". In a household the screen first says "Du bist schon in
  einem Haushalt" and what switching does ("Du bist das einzige Mitglied von „X“. Trittst du bei,
  wird „X“ mit seiner Liste gelöscht." or "… Die anderen Mitglieder behalten die Liste."). There,
  Abbrechen is the filled button.
- **Step 3** "Partner einladen": the apps open the share sheet with "Komm in unseren
  Hummlist-Haushalt: https://app.hummlist.com/join/<code> · Code: <code>". The web shows the
  code, the link, "gültig bis …", "Link kopieren", "Code kopieren" (and "Teilen" where the browser
  has Web Share). "Später" / "Weiter zur Liste".
- **Mehr → Partner einladen** (`/more/invites`): "Neue Einladung", the open invites with their
  validity, "Widerrufen". "Anderem Haushalt beitreten" opens the join screen. The old invite
  dialog and the join dialog are gone.
- **Errors**: one "Dieser Code ist ungültig oder abgelaufen." for made-up, expired, revoked and
  used codes; "Zu viele Versuche. Bitte später noch einmal." after 10 failures in an hour;
  "Keine Internetverbindung. Versuche es erneut, sobald du online bist." Everything typed stays.
- German and English throughout. The export ("Meine Daten exportieren") lists the invites the
  user created.

## Where

- Migration `supabase/migrations/20261030120000_onboarding_invites.sql`: invites 7 days and
  `used_at`/`used_by`; `check_invite` (internal), `preview_invite`, `accept_invite`,
  `revoke_invite`; `join_household` on top of `accept_invite`; table `invite_attempts` (rate
  limit); `create_household(p_name, p_default_stores)`, `seed_household(uuid, boolean)`;
  `export_my_data` with `invites_created`; the members' update right on `invites` revoked.
- App `app/lib/household/`: `welcome_screen.dart` (Step 1), `create_household_screen.dart`
  (2a), `join_screen.dart` + `join_cubit.dart` (2b), `invite_partner_screen.dart` (3),
  `invites_page.dart` + `invites_cubit.dart` (More), `invite_share.dart` (card, share text, share
  sheet, copy, `invite_sent`), `web_share*.dart`, `invite_repository.dart` (RPCs,
  `HouseholdError`/`HouseholdProblem`, offline), `pending_invite.dart`, `onboarding_page.dart`.
  `router.dart`: new paths, `inviteIn`, `authRedirect(pendingInvite:)`, screen names
  `onboarding_create`, `onboarding_invite`, `invites`. `session_cubit.dart`:
  `createHousehold(defaultStores:)`, `join` on `accept_invite`, events once also after a lost
  answer, pending invite answered on join and sign-out. `device_cache.dart`: `invite.pending`.
  `events.dart`: `household_created.default_stores`, `invite_sent`. 36 new ARB keys.
- Deep links: `app/ios/Runner/Runner.entitlements` (`applinks:app.hummlist.com`),
  `AndroidManifest.xml` (verified https filter for `/join/`), `app/web/.well-known/` (AASA,
  `assetlinks.json` with the Play app signing and upload key SHA-256), `vercel.json`,
  `scripts/gates/web-prod.sh` (the build copies both), `e2e/web-smoke.mjs` (served as JSON).
- Box-wide: `scripts/backup/fixtures.sql` (a failed attempt), `supabase/functions/account/smoke.sh`
  (one invite per join), `e2e/tests/account.spec.ts` (attempts go with the account), the verify
  skill (`features/onboarding.md` new, `household.md`, `auth.md`, `SKILL.md`,
  `journeys/account-deletion.sh`, `hosted-signin.fgs`, `SCREEN_KEYS.welcome`).
- Docs: DECISIONS "Job 22", ANALYTICS.md (events), NEEDS_PETER "Job 22" (device checklist,
  AT/CH stores, privacy text), TEST_FIXTURES.md.

## How to verify

- pgTAP: `supabase/tests/invites.test.sql` (51: 7 days, 6 vs 8 days, single use, member
  without consuming, revoke and no un-revoke, rate limit 11th refused, valid code refused while
  limited, after the hour it works, purge, the old RPC, create with and without stores, export),
  `rls.test.sql` (+2), `households.test.sql`, `account_deletion.test.sql` (export).
- Flutter: `app/test/household/onboarding_test.dart` (every step, errors, offline, double tap,
  warning, Step 3 share and copy events, More's list and revoke, DE and EN),
  `pending_invite_test.dart`, `app/test/app/router_test.dart` (pending invite, the URIs the
  platforms deliver, cold start), `deep_links_config_test.dart`, `session_events_test.dart` (lost
  answers, once per action), `events_test.dart`, `more_screen_test.dart`.
- Playwright: `e2e/tests/onboarding.spec.ts` (AC1-3, 5-13 on the web: password, magic link via
  Mailpit, Google and Apple via the fake provider, the location losing the invite, a dropped
  first response for create and join, offline, rate limit, a two-session race, events and their
  scan, English, screenshots); `live-sync.spec.ts` (AC4 live both ways); every spec that went
  through the old welcome screen uses the new helpers (`createHousehold`, `skipInvite`,
  `joinWithCode`, `confirmJoin`, `createInviteCode`).

## Results

- **CI green on 186635c** (this code; the head that lands adds only this document and the PR text): [https://github.com/trost-systems/family-groceries/actions/runs/41045200635](https://github.com/trost-systems/family-groceries/actions/runs/41045200635), every job incl. db (pgTAP), e2e 1+2, web-prod, ios, android, ci-ok. e2e shard 1 needed one rerun of the failed job for the known main flake `add-sheet.spec.ts:212` ("rot" for "Brot"), recorded on the `flaky` issue [#109](https://github.com/trost-systems/family-groceries/issues/109#issuecomment-6521446836). Before the review fixes and the rebase onto 32a, everything was also green on 5bcd4d4: [https://github.com/trost-systems/family-groceries/actions/runs/41043580262](https://github.com/trost-systems/family-groceries/actions/runs/41043580262).
- Earlier rounds on CI found and fixed: the export's pgTAP expectation, Supabase's db lint on a composite OUT parameter (`check_invite` returns scalars now), Flutter web not exposing an unedited field's value (the e2e proves a kept name or code by retrying without typing), and the invite card's lines merged into one semantics label (now own nodes).
- Local (Mac): `flutter analyze --fatal-infos` clean, `flutter test` 803 passed, lint steps (ast-grep tests and scan, schema check and its tests, squawk) pass, `tsc` on e2e clean.
- Review: an independent read of the diff found nothing must-fix; the should-fix and three edge cases are fixed (DECISIONS 22.20).

## Screenshots

`docs/screenshots/job-22/`, from CI's e2e run (390×844 and 1366×1024, DE and EN): consent,
Step 1, create with stores and with Skip, create offline, Step 3 web card, More's invite list
with revoke, the join screen with the household name, invalid code, offline, rate limit, and
already in a household.

## Not done here / for others

- **Device run** (iPhone, Android): no simulator or emulator on the runners; checklist in
  NEEDS_PETER "Job 22". The domain files reach app.hummlist.com with the next dispatched
  release.
- **The Linux app via scripts/fg** was not run: the Mac runner has no Docker, so no local stack.
  The recipes are in `features/onboarding.md`; the web e2e on CI drives the same Flutter code.
- Old store builds (before this release) get no error message for a bad code (the old RPC now
  returns null, DECISIONS 22.8); a good code still joins.
