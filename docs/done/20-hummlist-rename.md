# Job 20: the app is "Hummlist", `com.hummlist.app`

PR: https://github.com/trost-systems/family-groceries/pull/46, on `main` as
b8ce8b9 (CI run 40229348169 and Supabase deploy run 40229348033 green).

Peter approved the name and the ID on 2026-10-25. Every place that shows
the app's name now says "Hummlist", and every app identifier is
`com.hummlist.app`. The production web URL is `https://app.hummlist.com`.
Builds that are already installed keep working: their bundle ID and deep
link stay accepted on the server.

## What changed

- **Identifiers.** iOS `PRODUCT_BUNDLE_IDENTIFIER` (Runner
  `com.hummlist.app`, RunnerTests `com.hummlist.app.RunnerTests`), Android
  `applicationId` and `namespace`, `MainActivity.kt` moved to
  `kotlin/com/hummlist/app/` with `package com.hummlist.app`, Linux
  `APPLICATION_ID`, fastlane `APP_ID`, `Appfile` and `Matchfile`, and the
  verify skill's `APP_ID`. `release.yml` holds no ID.
- **Deep link.** `mobileAuthCallback`, the `Info.plist` URL scheme and the
  Android intent filter use `com.hummlist.app://login-callback`.
  `supabase/config.toml`, `supabase/deploy/auth_urls.ts` and
  `scripts/configure-social-auth.mjs` keep the old callback next to the new
  one. The Google reversed client ID scheme is unchanged.
- **Name.** Home-screen names (`CFBundleDisplayName`, `CFBundleName`,
  `android:label`), the iOS microphone and speech prompts, the Linux window
  title, the web `<title>`, Apple web-app title and manifest, the deletion
  page, `appTitle` and `accountDeletedApple` ("Entferne „Hummlist“"), the
  voice errors ("in der Hummlist-App"), and the MCP server (`name:
  hummlist`, title and `resource_name` "Hummlist"). Also README, SPEC,
  ACCOUNT_DELETION and SIRI_SHORTCUT. "Einkauf" stays wherever it is the
  ordinary word.
- **Apple client IDs.** `configure-social-auth.mjs` writes one comma list,
  Services ID, old bundle ID, new bundle ID, and an empty additional list.
  That is exactly the live state the Lead set. The old script would have put
  the old bundle ID back into the additional list and dropped
  `com.hummlist.app`.
- **Account deletion on iPhone.** An Apple code only exchanges with the
  bundle ID it was issued to, and the request doesn't say which build sent
  it. `supabase/functions/account/apple.ts` now tries `com.hummlist.app` and
  then `com.petertrost.familygroceries`, and revokes as the one that
  worked. Before, a Hummlist build's deletion could never revoke.
- **app.hummlist.com** (brief addendum 20:45). `APP_URL` in
  `app/config/auth.json` (the phone apps' invite links), the deletion page's
  link, the `auth_urls.ts` example and test, and the docs. The old Vercel URL
  stays an alias and stays in the allow list.
- **Left as is, on purpose.** The Dart package `family_groceries`, the
  `familygroceries/speech` channel, the Linux binary name, the repo, the
  Vercel project and the export format id `family-groceries-export`.

Decisions: `docs/DECISIONS.md`, "Job 20".

## Proof

- `scripts/verify.sh` on e9e5714 is green: gitleaks, lint, db, functions
  (250 tests), fg-cli, flutter (245 tests), web-prod, fastlane, and e2e with
  67 of 67 Playwright tests (`--workers=1`, under `/tmp/fg-e2e.lock`).
- New pins: `boot.spec.ts` "the app is called Hummlist in the tab and when
  installed" (title, Apple title, manifest), the deletion page title in
  `account.spec.ts`, the MCP server name in `mcp.spec.ts`, the voice 401 text
  in `voice.spec.ts`, "Entferne „Hummlist“" in `account_test.dart`, two
  bundle-ID cases in `apple_test.ts` (an old build's code with
  `invalid_grant` or `invalid_client` on the new ID), and both callbacks in
  `auth_urls_test.ts`.
- `flutter build web`: `index.html` and `manifest.json` say "Hummlist".
  `flutter build apk --debug`: `aapt2` shows package `com.hummlist.app`,
  label "Hummlist", activity `com.hummlist.app.MainActivity`, scheme
  `com.hummlist.app`. That proves the Kotlin package move compiles and
  resolves.
- `scripts/fg` on the Linux app (`FG_PORT_PREFIX=546`): `fg up`, both
  logins, logout, magic-link send, and a restart that keeps the session. The
  window title is "Hummlist" and `WM_CLASS` is `com.hummlist.app`. The magic
  link mail carries `redirect_to=com.hummlist.app://login-callback`, so the
  local allow list accepts the new callback. The voice function answers
  "Erstelle in der Hummlist-App …".
- `configure-social-auth.mjs --dry-run`, with `fetch` stubbed to return the
  live values from the brief (no call to the Management API), prints exactly
  the live Apple client list and allow list.
- Greps: no "Humm" without "list" (only "hummus" in the classifier), and no
  "Einkauf" as the app name outside history.
- Screenshots and the table of checks:
  [`docs/screenshots/20-hummlist-rename/`](../screenshots/20-hummlist-rename/README.md).

## Open, for Peter (`docs/NEEDS_PETER.md`, "Job 20")

These can't be done from the box:

1. Create the App Store Connect app record "Hummlist" for `com.hummlist.app`.
2. Google Cloud: change the iOS OAuth client's bundle ID, add Android
   clients for `com.hummlist.app`, and rename the consent screen. Until then,
   Google sign-in fails on the new builds.
3. Apple: make the Sign in with Apple key cover `com.hummlist.app`. Until
   then, account deletion from a Hummlist iPhone build falls back to the
   "remove by hand" hint. Also rename the Services ID description "Einkauf
   Web", which Apple's web sign-in page shows.
4. Play Console: a new app for the new package.
5. Remove `com.petertrost.familygroceries` from the Apple client IDs only
   after the new build is verified.

## After the deploy (2026-10-25, 21:15)

Read-only requests against production, after b8ce8b9 deployed:

- `https://app.hummlist.com` and the alias
  `https://family-groceries-pied.vercel.app`: `<title>Hummlist</title>`,
  `apple-mobile-web-app-title` "Hummlist", manifest `name` and `short_name`
  "Hummlist". `konto-loeschen.html` has the title "Hummlist: Konto und Daten
  löschen" and links `https://app.hummlist.com/`.
- Hosted `voice` with an invalid token: 401, "Erstelle in der Hummlist-App
  unter Menü, Zugänge einen neuen."
- Hosted `mcp` protected-resource metadata: `resource_name` "Hummlist".

No change was made to hosted Supabase, Vercel, Apple or Google from the box.

## Review 0 fixes

- Must fix: `features/auth.md` (verify skill), the "Magic link, send" recipe,
  still expected `redirect_to=com.petertrost.familygroceries://login-callback`
  in the mail. It now says `com.hummlist.app://login-callback`. Rerun with
  `scripts/fg` (`FG_PORT_PREFIX=546`): the mail's subject is "Your sign-in
  link" and its link is
  `/auth/v1/verify?token=…&type=magiclink&redirect_to=com.hummlist.app://login-callback`,
  as the recipe now says. `.claude/skills/verify-family-groceries` is a
  symlink to the same directory, so there is no second copy. An untruncated
  grep finds no other stale old callback outside the intended server-side
  keeps and history.
- Nice to have: `docs/screenshots/20-hummlist-rename/README.md` lists the
  commands that rerun the APK, web and Linux checks. The "Einkauf Web" text in
  `features/web-hosting.md` already says it holds until Peter renames the
  Services ID (`NEEDS_PETER.md`, job 20, step 3).
