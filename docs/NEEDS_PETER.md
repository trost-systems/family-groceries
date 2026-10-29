# Needs Peter

Steps that cannot be done from the build box. Everything around them is
implemented.

## Status (checked 2026-10-24, job 7b)

Done from the box (details in the sections below):

- Remote project `jdwqrallbpdbshrdhenk`: all migrations applied, edge
  functions `health`, `mcp` and `voice` deployed, Google and Apple sign-in
  enabled. The "Supabase deploy" workflow redeploys from every push to
  `main` over the Management API and fails red when a credential is
  missing (section 1).
- Web app on Vercel at `https://app.hummlist.com` (job 20;
  `https://family-groceries-pied.vercel.app` still serves it as an alias), moved
  only by a store release since 2026-10-29; `main` is on
  `https://preview.app.hummlist.com` behind Vercel login (section "Job 7: web
  hosting on Vercel", `DEPLOY.md` section "Web app"). Site URL,
  redirect URLs and the OAuth consent path point at it (section 2).
- `app/config/auth.json` and `app/ios/Flutter/Auth.xcconfig` carry the real
  client IDs and the app URL (section 4, step 15).

Still yours:

- Section 4, step 7: an Android OAuth client for the release keystore's
  SHA-1 (today only the build box's debug key has one, so Google sign-in
  works in debug APKs only).
- Section 4, step 13: renew the Apple client secret before it expires
  (set up on 2026-10-23 per the board, valid 180 days, so renew by
  2027-04-21 at the latest).
- Section 4, steps 16 and 18: the Xcode capability check and trying
  sign-in on your phones.
- Section 5, step 1: one MCP connect and disconnect against production.
- "Job 4: Siri", step 2. Releases (job 23): every Monday green `main` goes
  to TestFlight group "Familie" and to the Play internal track (list
  "Familie") by itself.
  Yours: "Job 23" below. Also "Job 5: Android verification run".
- "Job 13: database backups": done (job 13b). Copy the backup private key
  from the build box to your own computer and password manager (section
  "Job 13: database backups").
  Also watch the repository's issues (Watch, Custom, Issues): a failed
  daily keepalive opens one there (docs/DEPLOY.md, "Keepalive").

None of the steps below changes the hosted Site URL or removes a redirect
URL. Only `supabase/deploy/auth_urls.ts` sets the Site URL (section 2).

## 1. Remote Supabase deploy (job 1)

Done (job 7). The repo has the secret `SUPABASE_ACCESS_TOKEN` and the
variable `SUPABASE_PROJECT_REF`. The workflow applies migrations through
the Management API (`supabase/deploy/migrate.ts`), deploys the functions
with `supabase functions deploy --use-api` and smoke-tests them; it needs
no database password and no direct Postgres connection. From any machine:

```bash
set -a; source ~/groceries-ops/env; set +a
export SUPABASE_PROJECT_REF=jdwqrallbpdbshrdhenk
deno run --allow-read --allow-env --allow-net --config supabase/deploy/deno.json supabase/deploy/migrate.ts
supabase functions deploy --use-api --project-ref "$SUPABASE_PROJECT_REF"
```

## 2. Auth URLs on the hosted project

Done (job 7, 2026-10-23, Management API via `supabase/deploy/auth_urls.ts`):

- Site URL: `https://app.hummlist.com` (set by the Engineering Lead on
  2026-10-25, job 20; it was `https://family-groceries-pied.vercel.app`).
- Redirect URLs: `https://app.hummlist.com` and `https://app.hummlist.com/**`,
  `https://family-groceries-pied.vercel.app/**`,
  `https://family-groceries-*-peter-trost.vercel.app/**` (Vercel previews
  of this team), `com.hummlist.app://login-callback` and
  `com.petertrost.familygroceries://login-callback` (builds from before
  job 20). No localhost entries on production (DECISIONS 7.9).
- OAuth server: enabled, authorization path `/oauth/consent`, so MCP
  clients land on `https://app.hummlist.com/oauth/consent`.

To change the URL later, rerun
`deno run --allow-env --allow-net supabase/deploy/auth_urls.ts <new-url> --preview <pattern>`
with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` set, and change
`APP_URL` in `app/config/auth.json` (the invite links of the phone apps).

Magic links and sign-up confirmation mails redirect there. Email
confirmation is on by default for hosted projects: new users confirm their
address before the first sign-in, and the app tells them so.

## 4. Sign in with Google and Apple (job 1b)

The app, the Supabase config and a configuration script are ready. Both
providers stay hidden in the app and disabled on Supabase until these
steps give them credentials. Background: `docs/AUTH.md`.

Collect the values in `~/groceries-ops/env` (outside the repo) as you go.
The variable names are in `.env.example`.

### Google Cloud Console (https://console.cloud.google.com)

1. Create a project, or pick an existing one, for example "Family Groceries".
2. Go to **Google Auth Platform → Branding** (formerly "OAuth consent
   screen"). Enter the app name "Einkauf", your support email and the
   developer contact. Under **Authorized domains**, add `supabase.co`.
3. Under **Audience**, choose **External**. While the app is in "Testing",
   add your Google address and Lea's under **Test users**. Alternatively,
   press **Publish app**. Only the non-sensitive scopes `openid`, `email` and
   `profile` are used, so publishing needs no Google verification.
4. Under **Data Access**, add the scopes `openid`,
   `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
5. Under **Clients → Create client → Web application**, name it
   "Einkauf Web (Supabase)". Add
   **Authorized redirect URI** `https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/callback`.
   No JavaScript origin is needed: the web app signs in through Supabase's
   redirect, which works on production (job 7). Copy the **Client ID**
   (`GOOGLE_WEB_CLIENT_ID`) and the **Client secret**
   (`GOOGLE_WEB_CLIENT_SECRET`, a secret).
6. Under **Clients → Create client → iOS**, set the bundle ID to
   `com.petertrost.familygroceries`. Copy the **Client ID**
   (`GOOGLE_IOS_CLIENT_ID`).
7. Under **Clients → Create client → Android**, set the package name to
   `com.petertrost.familygroceries` and enter the SHA-1 fingerprint of a
   signing certificate. Create one Android client per certificate:
   - This build box's debug keystore (`~/.android/debug.keystore`):
     `4B:41:A1:23:70:B5:26:8F:01:53:98:97:C7:B5:28:79:FA:07:EB:F1`
   - Your Mac's debug keystore, if you build debug APKs there:
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - The release keystore from job 4:
     `keytool -list -v -keystore <release.jks> -alias <alias>`
   - If the app ever ships through Google Play with Play App Signing, add
     the **App signing key certificate** SHA-1 from Play Console → Test and
     release → App integrity.

   Copy one Android client ID as `GOOGLE_ANDROID_CLIENT_ID`. The app never
   uses it; Google matches the app by package name and SHA-1.

### Apple Developer (https://developer.apple.com/account, team of peter@petertrost.com)

8. Go to **Certificates, Identifiers & Profiles → Identifiers → App IDs**,
   then to `com.petertrost.familygroceries`, or register that ID. Tick
   **Sign in with Apple** (as a primary App ID) and save. Note the **Team ID**
   (top right, `APPLE_TEAM_ID`).
9. Go to **Identifiers → + → Services IDs**. Use description "Einkauf Web"
   and identifier `com.petertrost.familygroceries.web` (`APPLE_SERVICES_ID`).
   Enable **Sign in with Apple → Configure**. Set the primary App ID to
   `com.petertrost.familygroceries`, the domain to
   `jdwqrallbpdbshrdhenk.supabase.co`, and the return URL to
   `https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/callback`.
10. Go to **Keys → +**. Name it "Einkauf Sign in with Apple", tick **Sign in
    with Apple**, configure it with the primary App ID, register it and
    download `AuthKey_<KEYID>.p8` **once**. Keep it outside the repo, for
    example `~/groceries-ops/AuthKey_<KEYID>.p8`. Note the **Key ID**
    (`APPLE_KEY_ID`) and set `APPLE_PRIVATE_KEY_FILE` to the file's path.
11. Optional: under **Services → Sign in with Apple for Email
    Communication**, register `jdwqrallbpdbshrdhenk.supabase.co`. Only needed
    if mails ever go to private relay addresses.

### Supabase (from this box or your Mac)

12. With the values in the environment, run:

    ```bash
    set -a; source ~/groceries-ops/env; set +a
    node scripts/configure-social-auth.mjs --dry-run   # shows what changes, secrets redacted
    node scripts/configure-social-auth.mjs
    ```

    The script enables Google once `GOOGLE_WEB_CLIENT_ID` and
    `GOOGLE_WEB_CLIENT_SECRET` are set. The client ID list is web first, then
    iOS and Android. It enables Apple once the Services ID, Team ID, Key ID
    and `.p8` file are set. The client ID list is the Services ID, then the
    old and the new bundle ID (job 20), and the client secret is generated from the `.p8`. To do the
    same by hand, use Dashboard → Authentication → Sign In / Providers →
    Google / Apple, with the same values in the same order. Leave "Skip
    nonce check" off.
13. **Every 5 months**, rerun step 12 for Apple: the Apple client secret
    expires after 6 months, and web and Android Apple sign-in stop working
    then. The script prints the expiry date. Native iOS sign-in keeps
    working without it.
14. Done (job 7, job 20): the redirect URLs list the web app and both deep
    links, `com.hummlist.app://login-callback` and the pre-rename
    `com.petertrost.familygroceries://login-callback` (section 2).

### The app

15. Put the public values into `app/config/auth.json` and commit them
    (client IDs are public):

    ```json
    { "GOOGLE_WEB_CLIENT_ID": "<web client id>",
      "GOOGLE_IOS_CLIENT_ID": "<ios client id>",
      "SIGN_IN_WITH_APPLE": "true",
      "APP_URL": "https://app.hummlist.com" }
    ```

    In `app/ios/Flutter/Auth.xcconfig`, set `GOOGLE_REVERSED_CLIENT_ID` to
    the iOS client ID with its dot-separated parts reversed. For
    `123-abc.apps.googleusercontent.com`, that is
    `com.googleusercontent.apps.123-abc`. `flutter test` fails if the two
    files disagree.
16. In Xcode, check that the Runner target shows the **Sign in with Apple**
    capability. It comes from `Runner/Runner.entitlements`. Automatic signing
    regenerates the provisioning profile with it.
17. GitHub: nothing is needed for sign-in. Client IDs live in
    `app/config/auth.json`; secrets live only in Supabase. Job 4's release
    workflow builds with `--dart-define-from-file=config/auth.json`.
18. Try it once: Google and Apple on the iPhone, Google and Apple on an
    Android phone, and both on the web app. Then sign in with the same email
    by password or magic link and check that you land in the same household.

## 5. MCP server on the hosted project (job 3)

Done from the box through the Management API on 2026-10-22: OAuth 2.1 server
enabled, dynamic client registration enabled, authorization path
`/oauth/consent`. JWT signing already used an ES256 key (`in_use`).

Done since: migrations and `mcp` deployed (section 1), web app hosted and
Site URL set (section 2); an MCP client registered by DCR reaches
`https://family-groceries-pied.vercel.app/oauth/consent` (job 7), since
job 20 `https://app.hummlist.com/oauth/consent`.

Still yours:

1. **Connect and disconnect once** (job 3b): connect Claude or ChatGPT to
   `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp`, then
   disconnect it under Menü → Zugänge. Its next MCP call must get `401`.
   The function reads `auth.sessions` through `SUPABASE_DB_URL` for this; a
   `500` instead would mean the hosted database role lacks that read. Not
   run on production yet: it needs your Google or Apple account.
2. **Optional:** if a browser-based MCP client on another site should connect,
   set the edge function secret `MCP_ALLOWED_ORIGIN_HOSTS` to its hostname(s),
   comma-separated (`supabase secrets set MCP_ALLOWED_ORIGIN_HOSTS=…`).

## Job 4: Siri

1. Done (job 7): `voice` is deployed (section 1). `supabase/config.toml` sets
   `verify_jwt = false` for it, because Siri sends a personal access token,
   not a JWT. Check it with:

   ```bash
   curl -s -X POST 'https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/voice?format=text' \
     -H 'Authorization: Bearer nope' -d 'Milch'
   # -> Der Zugriffstoken fehlt oder ist ungültig. …
   ```

2. On your iPhone, follow `docs/SIRI_SHORTCUT.md` (German): create a token
   in the app under Menü, Zugänge, then build the three-action Shortcut
   "Einkaufsliste". Lea does the same on her phone with her own token.

The Shortcut itself needs no Apple account setting, but creating the token
needs a running app on the hosted project: the TestFlight or Play build
(job 4 release section below) or the web app at
`https://app.hummlist.com`.

## Job 4b: the microphone on a real phone

This box has no iOS device and no Android emulator (KVM is locked), so the
on-device check ran only in unit and widget tests and through the iOS and
Android compile jobs in CI. On the first build on your phone:

1. Tap the microphone next to "Was fehlt?", allow microphone and speech
   recognition, and say "Milch, zwei Gurken und Klopapier". Expect the
   words in the field, then "Hinzugefügt: Milch, 2 Gurken, Klopapier."
2. If instead you see "Diktieren geht nur offline … fehlt hier die deutsche
   Offline-Spracherkennung …", the phone has no offline German model.
   iPhone: Einstellungen › Allgemein › Tastatur › Diktieren on, with German
   among the keyboards (iOS downloads the model). Android: Einstellungen ›
   System › Sprachen › Spracheingabe (Google) › Offline-Spracherkennung ›
   Deutsch. Then try again.
3. Which phones can dictate: iPhones with iOS 13 or later and the German
   model; Android 12 (API 31) or later with Google's on-device recognizer.
   Android 11 and older always show the message above, because they have
   no on-device recognizer the app can require. On Android 12 the app can't
   ask for the language in advance, so a phone without offline German shows
   the message once you start speaking; please try that too if you have
   such a phone.

## Job 4: release

The Release workflow and the fastlane lanes are in place
([`RELEASE.md`](RELEASE.md)). Until the secrets below exist, the workflow
skips both platforms and stays green. All secrets and variables go into one
GitHub environment.

### Status (2026-10-27, job 23)

Superseded by the weekly pipeline: [`RELEASE.md`](RELEASE.md) and
[`NEEDS_LEAD.md`](NEEDS_LEAD.md). What still holds from job 4:

- Environment `release` (deployments from `main` only) holds variables
  `APPLE_TEAM_ID` (`VCZSHMZY25`) and `MATCH_GIT_URL`, secrets
  `MATCH_DEPLOY_KEY`, `MATCH_PASSWORD`, the three `APP_STORE_CONNECT_*`
  (API key `family-groceries-ci`, key ID `4J3N457M89`, Admin) and, since
  job 23, `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEY_PROPERTIES`. The match
  deploy key pair is `~/groceries-ops/match-deploy-key` (+ `.pub`) and
  `MATCH_PASSWORD` is in `~/groceries-ops/env` on the build box. Copy both
  to your password manager. Without the passphrase the match repo is
  unreadable.
- Certificates run
  [40224053069](https://github.com/trost-systems/family-groceries/actions/runs/40224053069)
  created Apple Distribution certificate `GN85KDC962` (expires 2027-10-25)
  and the profile now named "match AppStore com.hummlist.app". The team has
  three distribution certificates; none was revoked. Don't rerun
  Certificates unless the certificate needs renewing.
- The App Store Connect app "Hummlist" (Apple ID `6826922741`) exists, with
  the internal group "Familie" (all builds, you are in it). Release run
  [40229901781](https://github.com/trost-systems/family-groceries/actions/runs/40229901781)
  uploaded 0.1.0 (1002). Apple expired it, and every other build of the
  team, on 2026-10-26 (`RELEASE.md`, "TestFlight builds expired"); the
  weekly run uploads a new one.
- Steps 1 to 7 below are done for iOS (Lea's App Store Connect invitation is
  pending; the Lead follows it up). The Android steps are replaced by
  `NEEDS_LEAD.md`.

### iOS

1. **Agreement and bundle ID.** App Store Connect, Business (or the banner
   on the home page): accept the current Apple Developer Program License
   Agreement; TestFlight uploads fail until it is accepted. The App ID
   `com.petertrost.familygroceries` should already exist from Sign in with
   Apple (section 4, step 8); if not, register it in developer.apple.com,
   Certificates, Identifiers & Profiles, Identifiers, description "Einkauf".
2. **Create the app record.** App Store Connect, Apps, New App: platform iOS,
   name "Einkauf" (the name must be unique on the App Store; pick a variant
   such as "Einkauf Familie" if it is taken, the home-screen name stays
   "Einkauf"), primary language German, bundle ID
   `com.petertrost.familygroceries`, SKU `family-groceries`.
3. **Team ID.** Done: `APPLE_TEAM_ID=VCZSHMZY25` in `release`.
4. **App Store Connect API key.** App Store Connect, Users and Access,
   Integrations, App Store Connect API, Team Keys, generate a key with the
   Admin role (match needs it to create the certificate). Download
   `AuthKey_<KEY_ID>.p8`; Apple offers the download once. Then, from a clone
   of the repo:

   ```bash
   gh secret set APP_STORE_CONNECT_API_KEY_ID --env release --body <KEY_ID>
   gh secret set APP_STORE_CONNECT_ISSUER_ID --env release --body <ISSUER_ID>
   gh secret set APP_STORE_CONNECT_API_KEY_P8 --env release < AuthKey_<KEY_ID>.p8
   ```

5. **match repo and deploy key.** Secrets and variable done. Left: as an
   owner of `trost-systems`, create the repo and add the public key, which
   is on the build box at `~/groceries-ops/match-deploy-key.pub`:

   ```bash
   gh repo create trost-systems/family-groceries-certificates --private --add-readme
   gh repo deploy-key add ~/groceries-ops/match-deploy-key.pub --allow-write \
     --repo trost-systems/family-groceries-certificates --title release-ci
   ```

   Or ask the box to do it after giving `petertrost-bot` permission to create
   repositories in the organization. Write access lets step 6 push the
   certificates with the same key; the Release workflow only reads.
6. **Create the certificate and profile once.** After the PR that adds
   `certificates.yml` is merged: Actions, Certificates, Run workflow on
   `main`, type `create`. It fails early, naming what is missing, if a
   secret from steps 4 or 5 is not set. Apple allows only a few
   distribution certificates per team. If the lane reports the limit,
   revoke an unused one in the developer portal and rerun. On a Mac the
   same works by hand with `bundle exec fastlane ios certificates` in `app/`
   and the six values in the environment.
7. **First release and testers.** Run the Release workflow with
   `platform: ios`. The build shows up in TestFlight after Apple's
   processing (10 to 30 minutes). In App Store Connect, TestFlight, create
   an internal group and add yourself and Lea. Lea must first be a user of
   your team (Users and Access, invite her, any role such as Customer
   Support or Developer); she then installs the TestFlight app and accepts
   the invitation.

### Android

Replaced by job 23. The upload keystore exists (created on the build box,
`~/groceries-ops/secrets/android/`), its secrets are set, and Play access is
keyless (no `PLAY_SERVICE_ACCOUNT_JSON`). The Play Console steps are the
Lead's: [`NEEDS_LEAD.md`](NEEDS_LEAD.md), L1 to L5.

## Job 5: Android verification run

1. **Run the Android surface once on a machine where the emulator works**
   (your Mac, or a Linux host with working KVM). The build box cannot: a
   KVM guest there crashes the host kernel (see DECISIONS 5.1), so `fg`
   drives the Linux desktop build instead. On that machine:
   `scripts/fg setup --surface android`, then
   `FG_SURFACE=android scripts/fg up --clients peter,lea`, `scripts/fg doctor`
   and `.cursor/skills/verify-family-groceries/journeys/quick-add-live-sync.sh`.
   Those steps have never run end to end (SKILL.md, section "Android").
2. **Optional, for whoever runs the VM host:** nested KVM on this box oopses
   in `vmx_vcpu_create` (dmesg, 2026-10-23 05:53–06:03). Once the host is
   fixed, delete `~/.config/fg/kvm-broken` on the box to re-enable the
   emulator.

## Job 7: web hosting on Vercel

Done. The Vercel project `peter-trost/family-groceries` (created by
Engineering Lead on 2026-10-23) is linked to this repo and builds every
push from `vercel.json`:

- Production: `https://app.hummlist.com` (custom domain since job 20), also
  reachable as `https://family-groceries-pied.vercel.app`. Since 2026-10-29
  the production branch is `release`, which `release.yml` moves when it ships
  a store build; `main` is on `https://preview.app.hummlist.com` behind
  Vercel Authentication (`DEPLOY.md`, section "Web app").
  The plain `family-groceries.vercel.app` belongs to someone else.
- Previews: `https://family-groceries-git-<branch>-peter-trost.vercel.app`,
  behind Vercel Authentication (team default, unchanged).
- Project settings: root directory empty (repo root), framework "Other",
  no install, build or output overrides, Node 22.x. Environment variables
  for Production and Preview, both public values:
  `SUPABASE_URL=https://jdwqrallbpdbshrdhenk.supabase.co` and
  `SUPABASE_PUBLISHABLE_KEY=sb_publishable_YMFUFoZ-smly3zDIYTIFRw_vRt6UBk5`.
  The build fails if either is missing or the key is not a publishable key.
- Check a deployment with `node e2e/web-smoke.mjs <url> <screenshot-dir>`
  (after `cd e2e && npm ci`): SPA routes, cache headers, and the Google and
  Apple buttons reaching the providers' sign-in pages.

Nothing is needed from you here. The custom domain `app.hummlist.com` is
attached (job 20); for another one, rerun `auth_urls.ts` with it (section 2)
and change `APP_URL` in `app/config/auth.json`.

## Job 9: account deletion and data export

In-app deletion and export are built and tested (`docs/ACCOUNT_DELETION.md`).
Three things need you.

### Approve the drafts (ENTWURF, nicht veröffentlicht: Freigabe durch Peter)

1. `app/web/konto-loeschen.html`: the public "Konto und Daten löschen"
   page Google Play asks for. After the merge it is served at
   `https://app.hummlist.com/konto-loeschen.html` with
   `noindex` and a red ENTWURF banner. Check the wording, the developer
   name ("Peter Trost", which must match the Play listing), the support
   address `peter@petertrost.com` and the promise "innerhalb von 30 Tagen"
   for requests from people who can no longer sign in. To publish it, delete
   the `<p class="draft">` line and the `noindex` meta tag, then enter the
   URL in Play Console under App content › Data safety › Data deletion.
2. `docs/ACCOUNT_DELETION.md`, sections "What is deleted" and "What stays,
   and for how long": these are the facts for the App Store privacy label
   and the Play Data safety form (job 14 drafts those).

### Sign in with Apple token revocation on the hosted project

Apple wants the app to revoke Sign in with Apple tokens when a user deletes
their account. The `account` function does that on iPhones, but only when
it has the Sign in with Apple key. The function deploys with every merge to
`main`. Until the secrets below exist, it deletes accounts without revoking,
and the app tells Apple users to remove "Hummlist" in their Apple ID
settings (Apple's documented fallback, TN3194).

3. Set the function secrets once, from your Mac or the build box (the key
   file and IDs are the ones from section 4, step 10; this prints nothing):

   ```bash
   source ~/groceries-ops/env
   supabase secrets set --project-ref jdwqrallbpdbshrdhenk \
     APPLE_TEAM_ID="$APPLE_TEAM_ID" APPLE_KEY_ID="$APPLE_KEY_ID" \
     APPLE_PRIVATE_KEY="$(cat "$APPLE_PRIVATE_KEY_FILE")"
   supabase secrets list --project-ref jdwqrallbpdbshrdhenk | grep APPLE_
   ```

   The function tries the bundle IDs `com.hummlist.app` and
   `com.petertrost.familygroceries` in turn (job 20), so the key must cover
   both App IDs (job 20, step 3). An `APPLE_BUNDLE_ID` secret from before
   job 20 is ignored; remove it with `supabase secrets unset`. Unlike
   the Supabase Apple client secret, nothing here expires: the function
   signs a fresh 5-minute client secret per deletion.
4. Check it once on your iPhone with a throwaway Apple account (never with
   your or Lea's real account). Sign in with Apple, then Konto › Konto
   löschen. The success message must not show the "Apple-ID-Einstellungen"
   hint, and the function log must show `apple: revoked`.

## Job 13: database backups (decision for Peter)

**DONE (job 13b, 2026-10-25).** Peter said yes on 2026-10-25, with three
changes to the proposal below: nightly instead of weekly, 90 days of
retention, and `auth.users` plus `auth.identities` included. Runbook,
restore steps and key rotation: [`BACKUP.md`](BACKUP.md).

- **Live:** `.github/workflows/backup.yml`, every night at 02:30 UTC and
  on demand. A failed run opens the issue "Database backup failed".
- **Key pair:** created by the Engineering Lead. The public key is
  `supabase/backup/recipient.txt`. The private key is on the build box at
  `~/groceries-ops/backup-age-key.txt`. **Still yours:** copy it to your
  own computer and your password manager. Without it no backup can be read.
- **Database password:** the repository secret `SUPABASE_DB_PASSWORD`, set
  by the Engineering Lead on 2026-10-25 from the existing value (not
  rotated). Engineering Lead: update this line if you rotate it through
  the Management API.
- "What you would do" below is superseded: steps 1 and 2 were done by the
  Engineering Lead, step 3 became a repository secret (DECISIONS 13b.3),
  step 4 is answered (auth tables included).

The original proposal follows for the record.

### What exists today

- **The free plan has no backups.** Supabase backs up Pro, Team and
  Enterprise projects daily; for free projects it recommends regular
  exports with `supabase db dump` kept off-site
  (https://supabase.com/docs/guides/platform/backups). Point-in-time
  recovery is a paid add-on. So if a migration or a bug destroys data,
  there is nothing to restore from.
- **A GitHub runner can reach the database, but only through the pooler.**
  Measured on 2026-10-24 with a throwaway workflow on `ubuntu-latest`, without
  any credential (log: `docs/screenshots/13/runner-pooler-probe.txt`):
  - `db.jdwqrallbpdbshrdhenk.supabase.co` has only an IPv6 address, and
    the runner has no IPv6 route ("Network is unreachable"). The IPv4
    add-on for direct connections is paid.
  - The session pooler `aws-1-eu-central-1.pooler.supabase.com:5432`
    (user `postgres.jdwqrallbpdbshrdhenk`) is reachable. `psql` with a
    wrong password got "password authentication failed", so the pooler
    routes to this project. Supabase documents the shared pooler as
    IPv4 on every plan
    (https://supabase.com/docs/guides/database/connecting-to-postgres).
  - The server runs Postgres 17, so the runner needs `pg_dump` 17
    (`postgresql-client-17`, or `supabase db dump`, which brings a matching
    one).
- **The build box can't reach Postgres at all.** Its DNS points every
  database host at a local proxy, so a backup must run on GitHub.
- **The repo has no database password secret.** Job 7b deleted the unused
  `SUPABASE_DB_PASSWORD` secret; deploys need only the access token.

### Proposal

A weekly workflow, `backup.yml` (Sunday night and on demand):

1. Install `pg_dump` 17 and `age`.
2. Dump the data of `public` through the session pooler:
   `pg_dump --data-only --schema=public` (schema comes from the
   migrations). Optionally add `auth.users` and `auth.identities`, so a
   restore keeps everyone's sign-in and household membership. Without
   them, the restored rows point at user IDs that no longer exist.
3. Encrypt the dump with `age -r <your public key>` and stream it straight
   into the file. Nothing unencrypted touches the disk or the log.
4. Check that the file starts with the `age-encryption.org/v1` header.
   Upload nothing if it doesn't.
5. Upload it as a workflow artifact with 90 days of retention, the maximum
   for a public repo, so about 13 weekly copies exist.

The repo is public, so anyone can download the artifacts: encryption is
mandatory. Only the public key would be committed. Without your private
key the file is useless, and only you can restore it with
`age -d -i key.txt dump.sql.age | psql ...`.

### What you would do (superseded, see above)

1. Create the key pair on your Mac: `age-keygen -o ~/family-groceries-backup.key`.
   Keep the file in your password manager. It prints the public key
   (`age1...`). If you lose the private key, every backup is unreadable.
2. Give the public key to the next job (paste it on the board or in the job
   brief). It goes into the repo as `supabase/backup/recipient.txt`.
3. Add the database password as a secret for the workflow only:
   Settings, Environments, New environment `backup`, add secret
   `SUPABASE_DB_PASSWORD` (dashboard, Project Settings, Database).
   Alternative: a read-only role just for backups, if you'd rather not
   hand the workflow the `postgres` password.
4. Say yes or no to including `auth.users` and `auth.identities` (step 2
   of the proposal).

A cheaper variant without a database password: the workflow could read the
tables as JSON through the Management API with the existing
`SUPABASE_ACCESS_TOKEN`. The restore would then need a small loader script
instead of `psql`, and it reads with the most powerful credential the repo
has. I'd pick `pg_dump` through the pooler.

## Job 20: the app is now "Hummlist" (`com.hummlist.app`)

The repo builds the app as "Hummlist" with bundle ID and Android package
`com.hummlist.app` and the deep link `com.hummlist.app://login-callback`.
Already done by the Engineering Lead: the App ID `com.hummlist.app` (Sign in
with Apple, In-App Purchase), the hosted Supabase Apple client IDs
(`com.petertrost.familygroceries.web,com.petertrost.familygroceries,com.hummlist.app`)
and both deep links in the redirect allow list. The match profile is the
Lead's step. Yours, in this order:

1. **App Store Connect app record.** Done (2026-10-25): "Hummlist", Apple
   ID `6826922741`, with the internal group "Familie". The old app record
   (`6826907810`) gets no new builds.
2. **Google sign-in** (Google Cloud project `family-groceries-512507`,
   Google Auth Platform, Clients). Without this, Google sign-in fails on the
   new builds.
   - Open the iOS client `1001040145655-q542…` and change its bundle ID to
     `com.hummlist.app`. The client ID stays, so `app/config/auth.json`,
     `Auth.xcconfig` (the reversed client ID URL scheme) and Supabase need no
     change. The TestFlight build 0.1.0 (1001) of the old bundle ID can lose
     Google sign-in after this; Apple, email and magic link still work there.
   - Create an Android client with package name `com.hummlist.app` for each
     SHA-1 of section 4, step 7 (build box debug keystore
     `4B:41:A1:23:70:B5:26:8F:01:53:98:97:C7:B5:28:79:FA:07:EB:F1`, your Mac's
     debug keystore, the upload keystore and, once on Play, the app signing
     key). The app never sends an Android client ID; Google matches it by
     package name and SHA-1.
   - Branding: change the app name "Einkauf" to "Hummlist", so the Google
     consent screen names the app.
3. **Sign in with Apple key for account deletion** (developer.apple.com,
   Certificates, Identifiers & Profiles). The `account` function revokes
   Apple tokens with the key `APPLE_KEY_ID`, signing as the bundle ID the
   code was issued to. The key was configured with the primary App ID
   `com.petertrost.familygroceries`; `com.hummlist.app` is a primary App ID
   of its own. Until the key covers it, deleting an account from a Hummlist
   iPhone build deletes it but cannot revoke, and the app shows the hint to
   remove "Hummlist" by hand (nothing else breaks). Fix: under Identifiers,
   group `com.petertrost.familygroceries` and the Services ID
   `com.petertrost.familygroceries.web` under the primary App ID
   `com.hummlist.app`, then under Keys edit the Sign in with Apple key to
   the primary App ID `com.hummlist.app`. Then rerun section 4, step 12 (the
   Apple client secret is signed with this key) and check the web Apple
   sign-in once. Apple changes the grouping on its side; this is inferred
   from Apple's docs, not tried from the box. While there, change the
   Services ID's description "Einkauf Web" to "Hummlist": Apple's web
   sign-in page shows it to the user.
4. **Play Console.** Done by job 23 up to the browser: the Lead creates
   the Play app "Hummlist" (`NEEDS_LEAD.md`, L1 to L4). Nothing of a
   `com.petertrost.familygroceries` Play app carries over.
5. **Retire the old bundle ID** only after a Hummlist build is verified on
   your iPhone (Apple, Google, magic link) and Lea has moved to it: remove
   `com.petertrost.familygroceries` from the Supabase Apple client ID list
   (Dashboard, Authentication, Sign In / Providers, Apple, or drop it from
   `bundleIds` in `scripts/configure-social-auth.mjs` and rerun step 12).
   A job can then drop it from `appleBundleIds` in
   `supabase/functions/account/apple.ts`. Keep its deep link in the redirect allow list; it costs nothing.

## Job 23: weekly releases

The Release workflow ships green `main` every Monday at 03:00 UTC: TestFlight
group "Familie" and the Play internal track
([`RELEASE.md`](RELEASE.md)). The Play Console and Apple Developer browser
steps are the Lead's, with you only signing in
([`NEEDS_LEAD.md`](NEEDS_LEAD.md)). Yours:

1. **Google Play developer account:** nothing to do. It exists; the Lead
   created the app "Hummlist" in it on 2026-10-27.
2. **Copy the Android upload key to your password manager.** Both files are
   on the build box in `~/groceries-ops/secrets/android/`:
   `upload-keystore.jks` and `key.properties` (its two passwords). Google can
   reset a lost upload key only through Play Console support, so keep a copy
   outside the box.
3. **Watch the repository's issues** (Watch, Custom, Issues) if you haven't:
   a failed Monday release opens "Weekly release failed" there.
4. **If a new TestFlight build comes out already expired** (the run fails
   with "VALID but already expired"; `RELEASE.md`, "TestFlight builds
   expired"): as the account holder, open a case at
   <https://developer.apple.com/contact/> (TestFlight) naming the build
   number. Apple expired all of the team's builds at once on 2026-10-26 and
   has acknowledged the same problem for other teams; nothing in the account
   settings or the repo fixes it.


## Job 24a: guides on hummlist.com

The guides site is `site/` on `main`. The Lead creates its Vercel project
(Root Directory `site`, everything else from `site/vercel.json`) and
attaches hummlist.com and www. Yours:

1. **Remove noindex at the beta launch.** Every page carries
   `X-Robots-Tag: noindex` so search engines skip it while the pages change.
   At launch, delete that header entry from `site/vercel.json` (or ask a
   job to).
2. **The support@hummlist.com mailbox must receive mail** before the site
   goes live: the Impressum lists it as the contact address.

## Job 16: the design H list

Nothing blocks. Two things to look at, both reversible:

- **Removed the store filter chips because H folds stores; say if you miss
  them.** The "Alle / dm / Lidl / Edeka" chips above the list are gone. Each
  store is a section in its own walk order; fold the ones you are not in.
  With the chips went two side effects of "the store I'm in": an add no
  longer lands in the viewed store (the add sheet's store chip in job 17 does
  that), and ticking an item without a store no longer tags it to that store.
  Tag items by dragging them onto a store or with the edit sheet's store
  chip. The per-store "gibt es bei …" switches went from the store layout
  screen too, since nothing is hidden any more (DECISIONS, Job 16, 1 and 2).
- **Empty stores show as "Edeka 0 Artikel" dividers**, so you can drop items
  on them and reorder them. The prototype hid stores without items. Say if
  you'd rather hide them (they'd then only appear while dragging).

## web-release-align: production branch `release` (2026-10-29, done)

Done on 2026-10-29 at about 18:20 CET. You authorized the Vercel CLI on the
box, and the agent made the change with it:

- Production branch (Settings, Environments, Production, Branch Tracking):
  `main` -> `release`, through `PATCH /v9/projects/{id}/branch`.
- Auto-assignment of production domains is back on
  (`autoAssignCustomDomains: true`).
- `preview.app.hummlist.com` is a domain on the `main` branch, behind Vercel
  Authentication (deployment protection unchanged).
- `app.hummlist.com` stayed on the 5b6659d build (`dpl_AiSL9Jf7`) and moves
  with the next store release (`DEPLOY.md`, section "Web app").
