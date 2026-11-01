# Needs the Engineering Lead

Browser steps for the Engineering Lead, in the build box's browser, with
Peter only signing in. Everything around them is done from the box. Steps
that need Peter's own decision, money or identity are in
[`NEEDS_PETER.md`](NEEDS_PETER.md) instead.

## mcp.hummlist.com

Status: done. The Lead posted `Lead: mcp.hummlist.com live` (2026-10-28 15:44), and job 26's
`scripts/mcp-smoke.sh https://mcp.hummlist.com` passed. The steps below
stay as the record of the setup.

Job 26. Makes `https://mcp.hummlist.com` the public MCP URL
([`MCP.md`](MCP.md#public-url-mcphummlistcom)). Everything else is on
`main`: `mcp-proxy/vercel.json` and the function that advertises the public
URL. Nothing here costs money: a Hobby project, no env vars, no secrets.
DNS needs no change: hummlist.com is on Vercel's nameservers with a
wildcard, and `mcp.hummlist.com` answers `DEPLOYMENT_NOT_FOUND` today.

1. **Create the project** (Vercel connector or dashboard, team of the
   existing Hummlist projects):
   - Project name: `hummlist-mcp`.
   - Git repository: `trost-systems/family-groceries`, production branch
     `main`.
   - Root Directory: `mcp-proxy`.
   - Framework Preset: Other.
   - Build and Output Settings: leave every override off. `mcp-proxy/vercel.json`
     sets `installCommand`, `buildCommand` and `outputDirectory` to empty
     and `framework` to null, which skips the build (checked with
     `vercel build`: status `ok`, routes only).
   - Environment variables: none. Node.js version: any.
2. **Domain.** Add `mcp.hummlist.com` to `hummlist-mcp` as a production
   domain (no redirect). If Vercel says another project holds it, move it.
3. **Deployment Protection** (Settings, Deployment Protection):
   - Vercel Authentication: off, or Standard Protection. Standard covers
     only preview and generated URLs, never the production domain. Not "All
     Deployments".
   - Password Protection: off.
   - MCP clients must reach `https://mcp.hummlist.com` with no Vercel
     sign-in.
4. **Builds only for `mcp-proxy/` (optional).** Settings, Build and
   Deployment, Ignored Build Step: Behavior "Custom", command
   `git diff --quiet HEAD^ HEAD -- . || exit 1`. Vercel runs it in the Root
   Directory and skips the build when it exits 0: the newest commit on
   `main` (one per merged PR) left `mcp-proxy/` unchanged. Any other result,
   a missing `HEAD^` included, exits 1 and Vercel builds. Without this step
   every push to `main` redeploys the same two files, which is harmless.
   The Root Directory's "Skip deployment" switch does not apply: it needs
   JS workspaces, which this repo has none of.
5. **Verify** from the box, in the repo:

   ```bash
   scripts/mcp-smoke.sh https://mcp.hummlist.com
   ```

   Four lines start with `PASS`, one with `SKIP` (no token), and the last
   line reads `all checks passed against https://mcp.hummlist.com`. Then
   post on BOARD.md: `Lead: mcp.hummlist.com live`.

   If only the metadata check fails with a 404 from Vercel, Vercel refused
   the `/.well-known` rewrite: say so on the board; job 26 has a one-line
   fallback (`DECISIONS.md`, Job 26, item 8).

## Job 23: weekly release pipeline

Done from the box (job 23, 2026-10-27): the weekly Release workflow
([`RELEASE.md`](RELEASE.md)), the Android upload key and its two `release`
secrets, and the keyless Play service account
`play-release@family-groceries-ci.iam.gserviceaccount.com`. iOS ships
weekly without any step below. Android builds and signs weekly; it uploads
once L1 to L4 are done and `PLAY_RELEASE_STATUS` is set.

Status (2026-10-28): all done. Nothing is open for the Lead.

- L1 and L2: Play app "Hummlist", app ID `4972374295718364245`.
- L3: release 1003 (0.1.0) on internal testing, list "Familie", track
  active; Google-generated app signing key (fingerprints in
  `RELEASE.md`, "Android signing"); `PLAY_RELEASE_STATUS=completed`.
- L4: the service account has Hummlist only, "Release to testing tracks"
  and "View app information" (Play Console adds "View app quality
  information" by itself). The Release runs reach Play with it.
- L5: nothing to do for internal testing.
- L6: Associated Domains enabled; `renew_profile` made profile
  `5T4AGK7RF2` (ACTIVE, with associated domains, match repo `03f489d`).
- L7: Android clients "Hummlist upload key" and "Hummlist Play app signing"
  (SHA-1 `77:B6:9B:5E:8F:10:5D:3F:46:3C:62:C3:BC:BE:A8:3D:EA:10:08:53`) in
  `family-groceries-512507`.

The steps below stay as the record of what was done and for a re-setup.

Values used below (none is secret):

| What | Value |
| --- | --- |
| Package name | `com.hummlist.app` |
| App name | Hummlist |
| Upload key SHA-1 | `D4:9D:98:9E:AD:E3:2E:FE:D2:D3:A1:7A:71:B2:95:29:84:81:78:69` |
| Upload key SHA-256 | `2C:9B:48:6D:AF:1B:94:AB:3F:92:38:49:CC:0F:C3:42:EF:09:64:2C:32:40:74:97:69:25:61:74:0C:BA:84:F5` |
| Service account | `play-release@family-groceries-ci.iam.gserviceaccount.com` |

### L1: Play Console account

1. Open <https://play.google.com/console> and let Peter sign in with his
   Google account.
2. If Play Console shows the "All apps" list (with or without apps), a
   developer account exists. Note its name and whether it is a personal or
   an organization account, then go to L2.
3. If it asks to create a developer account (account type, USD 25 fee,
   identity verification): stop here. Do not create it and do not enter any
   payment or identity data. That is Peter's decision:
   `NEEDS_PETER.md`, "Job 23", item 1. Skip L2 to L5 and L7's Play part;
   iOS keeps shipping weekly.

Verify: the "All apps" page loads.

### L2: Create the app

Only if "Hummlist" is not in "All apps".

1. Select **Create app**.
2. App name: `Hummlist`. Default language: `German – de-DE`. App or game:
   **App**. Free or paid: **Free**.
3. Tick the declarations (Developer Program Policies, US export laws).
   Select **Create app**.

The package name is set by the first upload (L3) and cannot change after
that; the AAB carries `com.hummlist.app`.

Verify: Hummlist opens on its Dashboard.

### L3: Internal testing, first release, Play App Signing

1. Get the signed AAB. For the first upload: `~/groceries-ops/artifacts/app-release.aab`
   (built on the box, version code 1003, signer checked). Later: the newest
   Release run on `main` with an `android`
   job (Actions, Release, open the run, Artifacts,
   `hummlist-<build number>-aab`; artifacts are kept 7 days). Unzip it to
   get `app-release.aab`. If none is younger than 7 days, run
   `gh workflow run release.yml -f upload=false -f platform=android` and
   wait about 15 minutes.
2. Hummlist, **Test and release**, **Testing**, **Internal testing**,
   **Testers** tab: **Create email list**, name `Familie`, add Peter's Google
   account (the one he uses on his Android phone, if any). Do not add Lea
   until Peter says so. Save, tick the list, **Save**.
3. **Releases** tab, **Create new release**.
4. App integrity / Play App Signing: choose **Use Google-generated key**
   (Google creates and keeps the app signing key; our key stays the upload
   key). Select **Next** or **Save**.
5. **App bundles**, **Upload**: `app-release.aab`. Play shows version name
   `0.1.0` and the version code (the build number). Release name: leave
   Play's default. Release notes: leave empty.
6. **Next**, review the warnings (missing store listing or app content
   warnings do not block internal testing), **Save and publish** (or
   **Start rollout to Internal testing**).
7. **Test and release**, **Setup** (or **Release**, **Setup**), **App
   signing**: copy the **App signing key certificate** SHA-1 and SHA-256, and
   the **Upload key certificate** SHA-256. The upload key SHA-256 must equal
   the value in the table above; if it differs, the wrong AAB was uploaded.
8. Send the two app signing key fingerprints back (BOARD.md or the job
   brief). They go into `RELEASE.md`, table under "Android signing", row
   "Play app signing key", and into L7 and job 22's `assetlinks.json`.
9. Tell the box (BOARD.md) that L3 is done. The box then sets
   `gh variable set PLAY_RELEASE_STATUS --env release --body completed`
   (or `draft` if Play still calls the app a draft; see below) and dispatches
   one Release run. If you have `gh` at hand, you can run it yourself.

Verify: Internal testing shows the release as "Available to internal
testers"; the **Testers** tab shows the "Copy link" opt-in URL. If Play
says "Only releases with status draft may be created on draft app" in a
later run, set `PLAY_RELEASE_STATUS` to `draft` and roll that draft out by
hand once; after that, back to `completed`.

### L4: Grant the service account

1. Play Console (account level, not the app), **Users and permissions**,
   **Invite new users**.
2. Email address:
   `play-release@family-groceries-ci.iam.gserviceaccount.com`. This is the
   CI's API account, not a person; no email goes out.
3. **App permissions**, **Add app**: Hummlist only. Tick:
   - **Release to testing tracks** (under Releases)
   - **View app information (read-only)** (under App access)
   Leave everything else unticked, including account permissions.
4. **Apply**, **Invite user**, confirm.

Verify: the next Release run's `android` job, step `upload`, prints
"Play access works" (before `PLAY_RELEASE_STATUS` is set) or uploads to
internal testing (after). Until L4, it prints "Play refuses the service
account for com.hummlist.app (...)".

### L5: Policy items (App content)

Google's help: "You can start an internal test before completing app setup"
([Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334)).
None of the items below blocks an internal testing upload or rollout. They
block closed testing, open testing and production, and the Dashboard lists
them under "Set up your app".

| Item (Policy, App content) | Blocks internal testing | Blocks closed/open/production | When |
| --- | --- | --- | --- |
| Privacy policy URL | No | Yes | After 33a's policy is on hummlist.com (https://hummlist.com/datenschutz). |
| App access (sign-in needed; reviewer credentials) | No | Yes (review) | With the production track. |
| Ads (no ads) | No | Yes | Any time: "No, my app does not contain ads". |
| Content rating (IARC questionnaire) | No | Yes | Any time; the answers are Peter's. |
| Target audience and content | No | Yes | Any time: 18+ suggested (household tool); Peter's call. |
| Data safety form | No | Yes | After 33a's policy; answers from `docs/PRIVACY_DATA_MAP.md` (job 14). |
| Government apps, financial features, health | No | Yes | Any time: "No" for each. |
| Store listing (descriptions, screenshots, icon) | No | Yes | Job 14 owns the metadata. |

A personal developer account created after 2023-11-13 also needs a closed
test with at least 12 testers opted in for 14 days before production. That
concerns production only.

### L6: Apple Developer, Associated Domains (job 22)

Weekly TestFlight builds do not need this (job 23 checked: the current
profile is `ACTIVE` and the build has no new entitlement). Job 22 needs it
for universal links (`applinks:app.hummlist.com`).

1. <https://developer.apple.com/account>, Peter signs in. **Certificates,
   Identifiers & Profiles**, **Identifiers**, `com.hummlist.app`.
2. Tick **Associated Domains**. Leave every other capability as it is.
   **Save**, confirm the dialog about invalidated profiles.
3. Do not touch **Certificates** or **Profiles** (no revoke, no new
   certificate). The profile "match AppStore com.hummlist.app" now shows
   "Invalid"; that is expected.
4. Post on BOARD.md that L6 is done. The box (job 22, or whoever is
   running) then runs `bundle exec fastlane ios renew_profile`
   (`RELEASE.md`, "Capabilities", step 2), which regenerates the profile
   with the existing certificate `GN85KDC962`.

Verify: Profiles shows "match AppStore com.hummlist.app" as Active with a
new expiry date, and the next Release run's `plan` passes "Check the
profile". Between step 2 and the box's `renew_profile`, a Release run fails
in `plan` with "Profile ... is INVALID"; that is the expected signal, not a
new problem.

### L7: Google sign-in on Play builds

Google Cloud Console, project `family-groceries-512507`, **Google Auth
Platform**, **Clients**, **Create client**, type **Android**:

1. Name `Hummlist upload key`, package `com.hummlist.app`, SHA-1
   `D4:9D:98:9E:AD:E3:2E:FE:D2:D3:A1:7A:71:B2:95:29:84:81:78:69`.
   **Create**. (Builds signed locally or by CI with the upload key.)
2. After L3: a second client, `Hummlist Play app signing`, package
   `com.hummlist.app`, SHA-1 = the app signing key SHA-1 from L3, step 7.
   This one makes Google sign-in work in builds installed from Play.

No client secret is created and nothing goes into the repo: the app never
sends an Android client ID; Google matches it by package and SHA-1.

Verify: both clients are listed with package `com.hummlist.app`. On a phone
with the internal testing build, "Mit Google anmelden" completes.

## Job 24: help page URLs (after Peter's publish OK)

Status: waiting for Peter's OK on the text (docs/NEEDS_PETER.md, Job 24).

1. Send Peter the hummlist-site preview of the PR's head: `/support` and `/en/support` on the
   preview deployment URL (BOARD.md line "24-privacy-page: PR …", or the PR's Vercel check).
2. After the publish PR is merged and https://hummlist.com/support answers 200:
   - App Store Connect → Apps → Hummlist → the app version (or App Information) → **Support
     URL**: `https://hummlist.com/support` (required for review). Marketing URL stays empty.
   - Play Console → Hummlist → Grow users → Store presence → Store settings → **Store listing
     contact details**: Email `support@hummlist.com`, Website `https://hummlist.com/support`,
     **Save**.
3. Check: `curl -sI https://hummlist.com/support | head -1` gives 200 and the page has no
   "ENTWURF" banner.

## Job 25: Hummlist Lifetime store setup (browser; Peter only signs in)

Order matters: items 1 and 5 wait for NEEDS_PETER Job 25 items 1 and 2. Nothing here submits
anything for review. Docs: `docs/PURCHASES.md`.

**Since job 43 (RevenueCat):** the steps below that set function secrets for our own Apple/Google
verification (`PURCHASES_ENVIRONMENTS`, `APPLE_IAP_*`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`,
`PURCHASES_CRON_SECRET`) and point App Store Server Notifications at our function no longer apply;
those keys go to RevenueCat instead ("Job 43 – RevenueCat setup" below). Creating the products
(P1, the Play product) still does.

### P1: The product in App Store Connect (after the Paid Apps agreement, or try before)

On the box (the ASC key is there):
`ASC_KEY_ID=4J3N457M89 ASC_ISSUER_ID=<issuer> ASC_KEY_PATH=~/groceries-ops/AuthKey_4J3N457M89.p8 deno run --allow-env --allow-read --allow-net scripts/iap/apple_product.ts`
(dry run), then the same with `--apply`. Copy the printed "equalized price AUT/CHE" lines into
DECISIONS 25.1. If Apple refuses (for example because the agreement is not active), do it by hand:
App Store Connect → Apps → Hummlist → Monetization → In-App Purchases → "+": type
Non-Consumable, Reference Name `Hummlist Lifetime`, Product ID `com.hummlist.app.lifetime`;
Availability: all countries; Price Schedule: Germany, 9,99 €, keep the automatic prices; App
Store Localization: German and English (U.S.), display name `Hummlist Lifetime`, descriptions
from `scripts/iap/product.ts`; Family Sharing: leave off. Review information: no screenshot,
do not submit.

### P2: In-App Purchase key and function secrets

1. App Store Connect → Users and Access → Integrations → In-App Purchase → Generate In-App
   Purchase Key (name "Hummlist purchases"). Download the .p8 once to
   `~/groceries-ops/secrets/apple-iap/` (chmod 600). Note the Key ID and the Issuer ID shown there.
2. Set the hosted function secrets (you, not a job):
   `supabase secrets set --project-ref jdwqrallbpdbshrdhenk APPLE_IAP_KEY_ID=… APPLE_IAP_ISSUER_ID=… APPLE_IAP_PRIVATE_KEY="$(cat <file>.p8)" PURCHASES_ENVIRONMENTS=Sandbox PURCHASES_CRON_SECRET=<openssl rand -hex 32>`
   and the same cron value as repository secret: `gh secret set PURCHASES_CRON_SECRET`.
   `PURCHASES_ENVIRONMENTS=Sandbox` while TestFlight testers buy; switch to
   `Production,Sandbox` before the App Store review (App Review buys in the sandbox).
3. Check: `curl https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases` answers
   `{"configured":true,"environments":["Sandbox"]}`.

### P3: App Store Server Notifications V2

App Store Connect → Apps → Hummlist → App Information → App Store Server Notifications: Production
Server URL and Sandbox Server URL both
`https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/apple/notifications`, Version 2.
Then send Apple's test notification ("Request a Test Notification", or the App Store Server API
`POST /inApps/v1/notifications/test` with the P2 key): the function answers 200 `ignored`.

### P4: Sandbox tester

App Store Connect → Users and Access → Sandbox → Test Accounts → "+": an address Peter chooses
(an alias on hummlist.com works; never a real person's Apple ID without his OK), region Germany.
On the test iPhone: Settings → App Store → Sandbox Account → sign in.

### P5: Google Play (after the payments profile)

1. Google Cloud project `family-groceries-ci`: a service account `play-purchases` with a JSON key
   (edge functions cannot use the keyless GitHub federation of `play-release`). Save the key to
   `~/groceries-ops/secrets/` (600), set it as function secret
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat <key>.json)"`.
2. Play Console → Users and permissions → invite that service account for Hummlist with "View
   financial data", "Manage orders and subscriptions" and "Manage store presence".
3. The product: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=<key> deno run --allow-env --allow-read --allow-net scripts/iap/google_product.ts`
   (dry run, prints Play's AT and CH prices for DECISIONS 25.1), then `--apply`. By hand
   instead: Play Console → Monetize with Play → Products → One-time products → Create:
   Product ID `com.hummlist.app.lifetime`, name and description DE and EN, purchase option `buy`,
   price 9,99 € in Germany, other countries from the converted prices, Activate.
4. Play Console → Settings → License testing: add the Google accounts Peter names, response
   LICENSED. Their purchases are test purchases (Sandbox) and never charged.
5. Check the poll: Actions → "Purchases voided poll" → Run workflow: green, log shows
   `{"checked":0,"revoked":0}`.

### P6: Device checklist (TestFlight build from release.yml, with Peter)

On the iPhone with the sandbox tester (and on Android with a license tester after P5):
1. More → Hummlist Lifetime shows "9,99 €" from the store; buy; "Freigeschaltet". The partner's
   phone shows "Freigeschaltet" without buying.
2. Kill the app right after confirming the purchase; open it again: unlocked.
3. Delete and reinstall; "Käufe wiederherstellen": unlocked.
4. Ask to Buy is not testable without a family; Play: buy with the license tester's "slow test
   card, approves after a few minutes": "Wartet auf Bestätigung", then unlocked.
5. Refund: App Store Connect sandbox → the tester → "Clear Purchase History" does not refund;
   use Play Console → Order management → refund (test order) for Google, and for Apple check
   P3's test notification. The next poll (or a REFUND notification) shows the household locked.
6. Report the result on BOARD.md.

## Job 43: Hummlist Lifetime, household-bound (2026-10-31)

### Steps

1. **Testers** (on the box, which has `SUPABASE_ACCESS_TOKEN`): `scripts/iap/testers.ts`
   (docs/PURCHASES.md "Testers"). Dry run first, then `--apply`:
   `deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts add --email <e> [--grants n] [--note "TestFlight"]`;
   `set-grants --email <e> --grants n` raises a tester's count case by case; `list`, `remove`.
   It prints user ids, never keys. Keep notes free of names and e-mail addresses.
2. **PostHog insights** in project 319492 (read-only for jobs; you create them): paste
   `analytics/queries/paying_households_d35.sql` and `analytics/queries/paying_share_wah.sql` as
   HogQL insights. The kill gate is `paying_share_wah`'s `share_percent` ≥ 2 in the Berlin week
   that contains day 35 after launch (docs/ANALYTICS.md). No PostHog groups.
3. **No new analytics event is proposed.** The queries work on `purchase_completed`,
   `purchase_refunded`, `item_added` and `item_ticked` with their existing `household_id`; nothing
   waits for a privacy-policy section 9 change. `purchase_restored` is no longer sent (RevenueCat
   restores produce no event for us); its catalog entry stays.
4. **Archiving for real users** (after Legal Review): add `"HOUSEHOLD_ARCHIVE": "true"` to
   `app/config/auth.json`, which the store builds (fastlane) and the web build (`scripts/vercel.sh`)
   read. Until then it is on only in e2e builds (`app/config/e2e.json`).
5. **The purchase screen** (after Peter approves the legal texts, ADDENDUM 5): builds need
   `--dart-define=REVENUECAT_PURCHASES=true` plus the public SDK keys `REVENUECAT_APPLE_API_KEY` and
   `REVENUECAT_GOOGLE_API_KEY` (from `~/groceries-ops/env`). First only for Peter's own builds;
   then wire them into fastlane's defines (`app/fastlane/Fastfile`, like the analytics defines)
   for everyone.

### Job 43 – RevenueCat setup (Ops, not done by the job)

**Done by the Lead by 2026-10-31 14:56 (ADDENDUM 6):** project 9cb4a72e with entitlement
`lifetime`, offering `default`, package `$rc_lifetime`, product `com.hummlist.app.lifetime`
(non-consumable), and the function secrets `REVENUECAT_WEBHOOK_AUTH` (with `Bearer `),
`REVENUECAT_SECRET_KEY` (v2), `REVENUECAT_TOMBSTONE_HMAC_KEY`, `REVENUECAT_PROJECT_ID`. After this
PR lands: point the webhook at the URL in step 7 and send RevenueCat's test event (expect 200
`ignored`); check steps 3 to 6 and 9 below. The SDK key defines are `REVENUECAT_APPLE_API_KEY`
and `REVENUECAT_GOOGLE_API_KEY`.

1. RevenueCat account and project "Hummlist" (free up to USD 2,500 monthly tracked revenue, then
   1 %; confirm webhooks are included on the plan the dashboard shows). Accepting the terms
   accepts the DPA.
2. Apps: App Store (`com.hummlist.app`) and Play Store (`com.hummlist.app`). Public SDK keys into
   `~/groceries-ops/env` as `REVENUECAT_APPLE_API_KEY`, `REVENUECAT_GOOGLE_API_KEY`.
3. App Store Connect: an In-App Purchase key (Users and Access → Integrations → In-App Purchase),
   `.p8` and Issuer ID uploaded to RevenueCat; App Store Server Notifications V2, Production and
   Sandbox, set to the URL RevenueCat shows (replaces our function's URL there).
4. Google: a service account with Play access, its JSON key uploaded to RevenueCat (validation
   can take up to 36 h). Real-time developer notifications need a Pub/Sub topic, which needs a
   Google Cloud project with billing enabled; DECISIONS 25.8 avoided that ("not allowed"). Peter
   decides (NEEDS_PETER Job 43 item 3); until then RevenueCat learns of Play refunds without
   notifications only as RevenueCat documents it.
5. Products: import `com.hummlist.app.lifetime` for both stores, mark the Play product
   **NON-CONSUMABLE** (otherwise RevenueCat consumes it and Google sells it again), entitlement
   `lifetime` attached, an offering with a lifetime package.
6. Project settings → General → Restore behavior: **Keep with original App User ID**, production
   and sandbox alike. Leave "Track new purchases from server-to-server notifications" off. Leave
   RevenueCat's AI features off (Legal Review C4). No integrations, no data exports.
7. Webhook integration: URL
   `https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/revenuecat/webhook?forceFunctionRegion=eu-central-1`,
   an `Authorization` header value (a long random string), production and sandbox, all apps;
   optionally HMAC signing. Then set the function secrets `REVENUECAT_WEBHOOK_AUTH` (that header
   value), `REVENUECAT_WEBHOOK_HMAC_SECRET` (if signing is on) and `REVENUECAT_TOMBSTONE_HMAC_KEY`
   (a random 32-byte hex string, never rotated), e.g. `supabase secrets set --project-ref
   jdwqrallbpdbshrdhenk REVENUECAT_WEBHOOK_AUTH=…`. Send RevenueCat's test event: the function
   answers 200 `ignored`.
8. A v2 secret API key with `customer_information:customers:read_write` as the function secret
   `REVENUECAT_SECRET_KEY`, and `REVENUECAT_PROJECT_ID` (the daily workflow
   `revenuecat-delete.yml` only starts the function's deletion route).
9. Afterwards delete what job 43 removed: function secrets `PURCHASES_ENVIRONMENTS`,
   `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`,
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PURCHASES_CRON_SECRET`, and the repository secret
   `PURCHASES_CRON_SECRET`. Update the App Privacy and Data safety answers (Purchases, User ID)
   once Legal Review and Peter have decided the privacy text (RevenueCat as a new processor).

### Legal Review: draft 5a sentences this job affects

`site/content/legal/datenschutz-kaeufe.md`, `privacy-purchases.md`; not edited here.

- "Du kaufst im App Store von Apple oder bei Google Play. Apple bzw. Google wickeln die Zahlung
  ab …" / "You buy it in Apple's App Store or on Google Play …": RevenueCat, Inc. (USA) now sits
  between the app and the stores as our processor: the app's SDK sends it the household UUID as
  App User ID, transaction ids, product, price, currency, country, dates, environment, platform,
  app/SDK version, device locale and the IP address; RevenueCat checks with Apple and Google. US
  transfer under its DPA (SCCs module 2); its subprocessors are all in the USA.
- "Nach dem Kauf schickt die App den vom Store signierten Kaufbeleg an unseren Server … Wir
  prüfen ihn, bei Bedarf auch direkt bei Apple … bzw. Google …" / "After the purchase the app
  sends the receipt … We check it, where needed directly with Apple … or Google …": no longer
  true. RevenueCat checks; our server receives RevenueCat's webhook and, from the app, the buyer's
  claim (user id ↔ transaction id). What we store: store, product, the store's transaction id and
  an HMAC of it, whether it was a test purchase, purchase and refund time, price, currency,
  country, the buyer (from the claim), and the household it belongs to (kept after that household
  is deleted, for 30 days; then only the HMAC).
- "… welches Konto den Kauf zuerst bestätigt hat und welchen Haushalt er freischaltet." / "…
  which account confirmed the purchase first and which household it unlocks.": now "which member
  said they bought it (first claim)".
- "Alle Mitglieder deines Haushalts sehen, dass der Haushalt freigeschaltet ist." / "All members
  … see that the household is unlocked.": still true; members no longer see who paid (H-55). New:
  someone with a valid invite sees, before joining, whether the household has Hummlist Lifetime;
  the joining user's own recent purchase (30 days) is checked to offer the refund help (shown to
  no one else); members see when the household bought Lifetime more than once.
- "Rechtsgrundlage: … dass ein Kauf nicht mehrfach oder in fremden Haushalten verwendet wird." /
  "Legal basis: … not used twice or in other households.": now enforced also after the household
  is deleted (the kept household id for 30 days, then the HMAC tombstone, kept while Lifetime is
  sold or honoured, reviewed yearly).
- "Speicherdauer: Die Freischaltung bleibt beim Haushalt … Löschst du dein Konto, entfernen wir
  die Verbindung zwischen dem Kauf und deinem Konto; die Transaktion selbst bleibt ohne
  Personenbezug gespeichert, solange Hummlist betrieben wird … Wird der Haushalt gelöscht, endet
  seine Freischaltung." / "Retention: …": the transaction is no longer kept while Hummlist runs:
  30 days after the household's deletion it is deleted (only the HMAC stays) and RevenueCat is
  asked to delete the household's customer. Account deletion still only removes the buyer link.
  New: the last member may archive the household instead (once archiving is on), which keeps its
  data and unlock.
- Not in 5a yet, new processing: the tester list (user id, number of free unlocks, how many were
  used, a note, the date) and which households a tester's free unlock went to; analytics marks
  tester households internal (usage data section; nothing new is sent).
- Outside 5a: §14 Speicherdauer ("Bist du das letzte Mitglied eines Haushalts, wird der Haushalt
  mit allem gelöscht."), the support FAQ (`support.md`: "Bist du das letzte Mitglied, wird der
  ganze Haushalt gelöscht.") and `app/web/konto-loeschen.html` ("Du bist das letzte Mitglied")
  describe deletion on leaving; with archiving they need the archive case. Account deletion
  deletes the last member's household and the households they archived.

### Job 43 – privacy/retention notes (Legal Review H-49 to H-56, RevenueCat conditions)

Plain facts from the code; what the law requires is Legal Review's call.

- **H-49, the purchase record after the unlock ends.** While its household exists (archived
  included) a purchase row keeps: store, transaction id, latest transaction id, the HMAC, product,
  kind, environment, price, currency, country, purchase/verification/refund times, the bound
  household, and the buyer's user id until their account is deleted. 30 days after the household
  is deleted the row is deleted (`purge_purchases`, daily) and only the HMAC stays
  (`purchase_tombstones`, nothing attached; kept while Lifetime is sold or its unlocks are
  honoured, reviewed yearly). The financial records Apple and Google keep (8 years, archived by
  Ops) are the tax records; these rows are not.
- **H-50, archived households.** An archived household keeps all its data unchanged: name,
  categories, stores and layouts, items and their history (`item_events`), invites (unusable),
  entitlements, purchases. It has no members, so no client can read it (RLS) and its invites
  answer `invalid_invite`. It is kept until the archiving user re-enables it (Mehr → Archivierte
  Haushalte → Wieder aktivieren, `unarchive_household`) or deletes their account, which deletes
  it (`delete_account`); one whose archiver was deleted another way goes with the daily purge.
  Only that user (`households.archived_by`) can re-enable it. Inside it, other former members'
  rows keep pointing to them as before (e.g. `items.added_by`); their own account deletion nulls
  those links. There is no time limit: an archived household stays until re-enabled or account
  deletion. A limit (e.g. after N months, with notice) would be a product and legal decision.
- **H-51, testers.** `public.lifetime_testers`: user id (cascade-deleted with the account),
  grants, used, a note (Lead's free text, no names or e-mail), added_at. Service connection only;
  the Lead's script resolves an e-mail to the id at run time and stores no e-mail. A used grant
  is an `entitlements` row (`source` tester, `tester` the user id, nulled when the account is
  deleted); it stays with the household like a purchase, also after launch (Peter, 2026-10-31).
  No tester data goes to RevenueCat (no promotional entitlements). Sandbox purchases stay after
  launch too (NEEDS_PETER Job 25 item 8). The store transaction id is kept in
  `purchases.transaction_id` while the row exists; analytics only ever gets a hash
  (`transaction_ref`).
- **H-53, recipients.** docs/PURCHASES.md "Who receives what": our server calls neither Apple nor
  Google; RevenueCat (US, DPA) receives the household UUID as App User ID and the purchase data
  listed there and talks to the stores; our one outbound call is RevenueCat's customer deletion.
- **H-54, region.** RevenueCat calls the webhook from the US, so the registered URL carries
  `?forceFunctionRegion=eu-central-1`; the app's claim call is pinned with `region:
  'eu-central-1'` (`app/lib/purchases/purchase_api.dart`); the function logs `SB_REGION`.
  Supabase "Regional Invocations" (https://supabase.com/docs/guides/functions/regional-invocation,
  read 2026-10-31).
- **H-55, the buyer.** RevenueCat knows only the household. The buyer is recorded from the
  member's claim (`purchase_claim`, through the function, first member wins). Members have
  column-level select on `entitlements` without `granted_by` and `tester`: migration
  `20261031123504_household_bound_lifetime.sql`; pgTAP `purchases.test.sql`,
  `household_bound.test.sql`; the function's integration test; Realtime to the partner checked by
  `e2e/tests/purchases.spec.ts`.
- **H-56, restore.** RevenueCat's "Keep with original App User ID" (Ops) plus the server:
  `purchase_record` unlocks only `purchases.bound_household` (also after archive and
  re-enabling), refuses every other household (`used_elsewhere`, `household_gone`), ids that are
  no household, and tombstoned transactions; a `TRANSFER` moves nothing. Purchases from before
  this migration that unlocked nothing are bound to the nil UUID. Tests: pgTAP,
  `supabase/functions/purchases/handler_test.ts`, `e2e/tests/household-bound.spec.ts`.
- **C3 (SDK data).** The SDK starts only on the purchase page of a household known to have no
  Lifetime, with the household id; no attributes, no device or ad ids, no `logOut`: lint rules
  `purchases-flutter-only-in-revenuecat-repository` and `no-revenuecat-customer-data` fail the build otherwise.
- **RevenueCat's retention** after a deletion request follows its DPA ("subject to standard data
  backup and archival practices"), RevenueCat's statement.

## Job 44: PostHog SDK, error tracking, feature flags (2026-10-31)

The app now runs PostHog's official SDK (posthog_flutter 5.58.3, posthog-js 1.444.0 on the web;
DECISIONS Job 44, ANALYTICS.md). Nothing changes before the analytics yes: no request, no file.
After the yes, more data goes to PostHog than the legal texts name. Legal texts are unchanged;
these are the sentences and steps for you.

### For the Legal Review (privacy policy, consent text, store labels)

1. **Device and app data on every event (iOS, Android).** Proposed policy sentence (DE): "Mit
   jedem Ereignis übermittelt das PostHog-SDK außerdem technische Angaben zum Gerät und zur App:
   App-Version und -Build, Gerätehersteller, -modell und -typ, Betriebssystem und Version,
   Bildschirmgröße, Sprache und Zeitzone, ob WLAN oder Mobilfunk genutzt wird (Android zusätzlich
   Bluetooth, den Namen des Mobilfunkanbieters und die technische Kennung des Systembrowsers) und
   eine zufällige Sitzungskennung, die nach 30 Minuten ohne Nutzung wechselt." EN: "With every
   event the PostHog SDK also sends technical details of the device and the app: app version and
   build, device maker, model and type, operating system and version, screen size, language and
   time zone, whether Wi-Fi or mobile data is used (on Android also Bluetooth, the mobile
   network's name and the system's HTTP user agent) and a random session id that changes after 30
   minutes without use." Web: "Im Browser: Browser und Betriebssystem mit Version, Gerätetyp,
   Bildschirm- und Fenstergröße, Sprache und Zeitzone; nie die aufgerufene Adresse, die
   verweisende Seite oder die vollständige Browserkennung." The consent screen says "zum
   Beispiel ... Plattform und App-Version": please judge whether "Geräte- und App-Angaben" must be
   named there.
2. **Crash reports from the phone's own code.** "Stürzt die App ab, sendet sie beim nächsten Start
   einen Absturzbericht (Fehlerart, Fehlermeldung des Systems, technische Aufrufliste) an
   PostHog." Unlike Dart errors these system messages are not scrubbed by the app (ANALYTICS.md,
   "Gaps"); they normally hold no user content. iOS keeps its crash handler after switching
   analytics off: a crash after the off is sent only after a new yes.
3. **Feature flags.** "Nach Ihrer Einwilligung fragt die App PostHog mit der zufälligen Kennung,
   welche Funktionen für Ihre Installation freigeschaltet sind." No new purpose beyond running the
   app; same consent, same id.
4. **Storage on the device (TDDDG §25).** With the yes the PostHog SDK stores the install id, a
   device id (the same random value), queued events and the flag answer on the device; switching
   off deletes them (the More text "Ausschalten löscht die Kennung auf diesem Gerät" stays true).
   The web stores nothing (no cookie, no localStorage).
5. **Store labels.** App Store "App Privacy" and Play "Data safety" (NEEDS_LEAD Job 14 row): add
   Crash data / Diagnostics and "Device or other IDs" (the random install id), linked to no
   identity, not used for tracking, collected only with consent. Answers in PRIVACY_DATA_MAP.md.

### Steps in PostHog project 319492 (read-only from here; never 262464)

1. When a feature needs a runtime toggle: create the flag (key as in the code,
   `Analytics.flags.isOn('<key>')`, default off), roll it out there, and set the same key in
   `releases/flags.json` (`off`/`partial`/`full`) for its changelog item. No flag exists yet.
2. After the first SDK events from a release: run `analytics/queries/privacy_scan.sql` (block 1
   now lists the SDK's keys; anything else is a finding) and check that `$lib` reads
   `posthog-flutter`, `posthog-ios` or `posthog-android`.
3. Error tracking: the first native crash report arrives at the launch after a crash; exception
   autocapture must stay on in the project settings. Symbol upload (iOS dSYMs, Android mappings)
   is not set up (ANALYTICS.md, "Gaps").

### Upstream issue drafts (not filed; Peter: contribute upstream rather than add a vendor)

**A. posthog_flutter: let `beforeSend` see and strip what the native SDKs add**
- Repro: posthog_flutter 5.58.3 on Android or iOS, `config.beforeSend = [(e) { e.properties?.remove(r'$network_carrier'); return e; }]`, capture any event.
- Expected: the event goes out without `$network_carrier` (and the app can drop `$device_model`,
  `$raw_user_agent`, `$session_id` ...).
- Actual: the Dart callback sees only the caller's properties; posthog-android and posthog-ios
  add device, app, network and session properties afterwards, and those are sent. Both native
  SDKs have a `beforeSend` that sees the final properties, but the plugin sets none.
- Proposed fix: a Dart-side `PostHogConfig.propertyDenylist` (or `systemPropertiesBeforeSend`)
  that the plugin applies in the native `beforeSend` it registers at setup, and in posthog-js'
  `property_denylist` on the web; exposing the full native property map to the Dart callback
  would be the general form.

**B. posthog-ios and posthog-android: opting out does not stop network or storage**
- Repro: `PostHogConfig(optOut: true)` (or `optOut()` after setup), fresh install, watch the
  network and the app's files.
- Expected: an opted-out SDK makes no request and writes no id, so it can be set up before the
  user's consent.
- Actual: setup fetches `/array/<token>/config` and `/flags` (posthog-ios
  `PostHogRemoteConfig.swift` 157-209, no opt-out check; posthog-android `PostHog.kt` 397-412),
  writes an anonymous id and a device id (`PostHogStorageManager.swift` 72-104, `PostHog.kt`
  363, 660-689), and already queued events still flush. `reset()` keeps the device id and
  requests `/flags` at once under a new id, so there is no way to delete the SDK's state on the
  device without deleting its files.
- Proposed fix: opt-out gates remote config, flags and queue flushes, and defers id creation
  until opt-in; plus a `wipe()` (or `reset(keepDeviceId: false, reloadFlags: false)`) that
  deletes ids, queue and caches without a request.

**C. posthog_flutter: exception types are minified on Flutter web release builds**
- Repro: a `flutter build web --release` (dart2js) app calls `Posthog().captureException(error: StateError('x'))`.
- Expected: `$exception_list[0].type` is `StateError`.
- Actual: `minified:hm` (`DartExceptionProcessor._getExceptionType` uses `runtimeType`), so
  PostHog groups issues by meaningless names.
- Proposed fix: map the core error and exception types by `is` checks before falling back to
  `runtimeType` (Hummlist's `errorType` in `app/lib/analytics/exceptions.dart` does this), and let
  the app add its own types.

## Job 47: purchase legal fixes, Legal Review K.11 (2026-10-31)

Nothing here is live for users: `REVENUECAT_PURCHASES` and `HOUSEHOLD_ARCHIVE` stay off, and the
new server switch is seeded off. Decisions: DECISIONS "Job 47". Behavior: docs/PURCHASES.md.

### Steps

1. **The deletions cron secret (must, or the daily workflow fails).** `POST
   /purchases/revenuecat/deletions` now needs `x-deletions-secret`; while the function secret is
   unset it answers 503 and `revenuecat-delete.yml` fails (and opens its issue "RevenueCat
   customer deletion failed") until both secrets below are set. Generate one value and set it in
   both places without printing it:
   ```
   v="$(openssl rand -hex 32)"
   printf '%s' "$v" | gh secret set REVENUECAT_DELETIONS_SECRET --repo trost-systems/family-groceries
   supabase secrets set --project-ref jdwqrallbpdbshrdhenk REVENUECAT_DELETIONS_SECRET="$v"
   unset v
   ```
   Then run the workflow by hand once (`gh workflow run revenuecat-delete.yml`); it should end
   green with `{"status":"not_configured"}` until `REVENUECAT_SECRET_KEY` is set, or the
   deletion counts after.
2. **Archiving for real users (H-70), when you and Peter decide to offer it** (the 24-month texts
   are live since #147).
   Two switches, both needed, in this order:
   - Server (the database, service role), in the SQL editor or with the Management API:
     ```sql
     update public.app_switches set enabled = true, changed_at = now() where key = 'household_archive';
     ```
     Off again: the same with `false`. While it is off, every archiving call
     (`leave_current_household(true)`, `accept_invite(code, true)`, `unarchive_household(id, true)`
     when it would archive the household left) fails with `archive_disabled` and changes nothing;
     re-enabling an archived household keeps working.
   - App: `"HOUSEHOLD_ARCHIVE": "true"` in `app/config/auth.json` (Job 43 step 4).
   Turn the server switch on first: an app with the define on and the switch off shows "Archivieren
   ist gerade nicht möglich. Dein Haushalt bleibt, wie er ist." on the archive choice.
3. **Migration `20261031194500_purchase_legal_fixes.sql`** deploys with the normal pipeline. It
   deletes the nil-bound `Sandbox` purchases from before job 43 (H-69). It does not touch a
   nil-bound `Production` row; there should be none (nothing was sold). Check after the deploy:
   `select environment, count(*) from public.purchases where bound_household = '00000000-0000-0000-0000-000000000000' group by 1;`
   should return no rows.

### For Legal Review (re-check against the texts #147 put live; this job did not edit them)

- **H-67, done.** The SDK starts only on "Weiter zum Kauf" or "Kauf wiederherstellen" (tests:
  `app/test/purchases/no_sdk_before_tap_test.dart` with the real repository over the SDK's mocked
  channel; the web e2e checks no request goes to RevenueCat). The page shows no price (option a;
  DECISIONS 47.1). One fact for 5a ("Erst wenn du … einen Kauf startest oder einen Kauf
  wiederherstellst, verbindet sich die App mit RevenueCat"): after that tap the SDK stays
  configured for the rest of that app run, and on each return to the foreground it refreshes the
  household's CustomerInfo and offerings from RevenueCat when its cache is older than 5 minutes
  (purchases-ios `applicationWillEnterForeground` → `updateAllCachesIfNeeded`). A later app start
  contacts RevenueCat only after the next tap.
- **H-68, verified, matches draft 5a.** From the source of purchases-ios 5.99.0 and
  purchases-android 11.0.0 (pinned by purchases_flutter 11.0.0; links in docs/PURCHASES.md "What
  Apple and Google receive"): Apple gets the household id with every purchase (StoreKit 2
  `appAccountToken`; StoreKit 1 on iOS 15 `applicationUsername`), Google gets
  Base64(SHA-256(household id)) as `obfuscatedAccountId`, never `obfuscatedProfileId`. Note: the
  hash is unsalted, so whoever knows the household id can compute it; the household id is a
  random UUID that only the household's members, our server and RevenueCat know.
- **H-73, device storage.** The data map has the row (iOS UserDefaults suite
  `com.revenuecat.user_defaults`, Android SharedPreferences `com_revenuecat_purchases_preferences`,
  contents, cache times). Decision 47.6: sign-out and account deletion leave it on the device; the
  SDK has no call to clear it except `logOut`, which creates an anonymous RevenueCat customer and
  contacts RevenueCat. It goes when the app is uninstalled, or is replaced at the next Buy or
  Restore for another household. Draft 5a says the library stores the household id and the unlock
  status once a purchase or restore starts; it does not say how long. Please decide whether 5a
  needs a sentence on that.
- **Android Auto Backup (new finding, app-wide).** `app/android/app/src/main/AndroidManifest.xml`
  sets no `android:allowBackup`, so Android's default (on) applies: Auto Backup may copy the app's
  SharedPreferences, RevenueCat's file included (and the app's own DeviceCache and the Supabase
  session), to the user's Google account backup and to a new phone. Not changed here (it is
  app-wide, not purchase-specific). Options: `android:allowBackup="false"`, or backup rules that
  exclude RevenueCat's file and the session. Your call; a small app PR either way.
- **H-50.** Archived households are deleted 24 months after archiving; "Archivierte Haushalte"
  shows "Wird am <Datum> gelöscht", and the join screen's archive offer names the 24 months. No
  reminder e-mail: Hummlist sends no e-mails of its own (DECISIONS 47.3). If the texts promise a
  reminder, that needs a mail sender first.
- **The buyer's claim (job 43 review).** It now names the purchase's household and counts for a
  member at the purchase time, also one who left within the hour. That needs a new, short-lived
  record: `household_departures` (household, user, joined, left), kept one hour, service only.
  Draft 5a does not mention it; it is in the data map. Please check whether 5a needs it.
- **H-72.** Removing a tester (`testers.ts remove`) or their account deletion now clears their
  mark on the households they unlocked (`entitlements.tester`), as 5a says.
- **H-74 (optional), not done.** A refunded transaction whose household is deleted still gets a
  tombstone after 30 days, like any purged purchase. Leaving refunds out needs a decision whether a
  refunded-then-reversed purchase may then bind elsewhere, so it waits for Legal Review.

## Job 51: native Siri (2026-10-31)

Nothing here blocks the merge. Native Siri reaches testers with the next TestFlight build after
the merge. The changelog item waits on the `native-siri` hold in `releases/flags.json`.

### 1. Device test on Peter's iPhone (internal TestFlight, after the merge)

Sign in to Hummlist on the TestFlight build, open the list once, then close the app. Set Siri to
English (Settings → Siri → Language) for lines 1 to 5, then to German for lines 6 to 9.

1. "Hey Siri, add to Hummlist" → "What should I add?" → "milk, eggs and bread" → Siri: "Added
   milk, eggs and bread to Hummlist." Lea's phone shows the three items within seconds.
2. "Hey Siri, add milk to Hummlist" (milk on the list before) → no follow-up question, "Already on
   the list: milk." or "Added milk …".
3. "Hey Siri, what's on my Hummlist?" → reads at most ten items, then "and N more".
4. Airplane mode on, then line 1 → Siri says nothing was added. No item appears after airplane
   mode goes off again.
5. HomePod (if one is paired, Personal Requests on): line 1 → the full sentence is spoken.
6. "Hey Siri, füge etwas zu Hummlist hinzu" → "Was soll auf die Liste?" → "Milch, Eier und Brot"
   → "Hinzugefügt: Milch, Eier, Brot."
7. "Hey Siri, füge Milch zu Hummlist hinzu" → no follow-up question.
8. "Hey Siri, was steht auf meiner Hummlist?" → reads the list.
9. Mehr → Abmelden, then line 6 → "Öffne Hummlist und melde dich an …", nothing added.
10. The old Shortcut ("Hey Siri, Einkaufsliste") still answers as before.
10a. One-word items take the app's language when the word is too short to tell (DECISIONS "Job 51"
    item 13). With the iPhone in English and Siri in German, say "Füge etwas zu Hummlist hinzu" →
    "Milch". Note whether the answer comes in German or English. English there is a known
    limitation, not a failure; the item must still be added.
11. Later, with job 50's lock on and a locked household: line 6 → the Premium sentence, nothing
    added, the app stays closed.

If Siri doesn't hear the phrases at all (lines 1 and 6), do section 2 and test again.

### 2. Only if the device test needs it: the Siri capability

Apple requires `com.apple.developer.siri` for SiriKit Intents extensions, not for App Intents
(DECISIONS "Job 51" item 5). If voice invocation fails anyway:

1. Lead: developer.apple.com → Identifiers → `com.hummlist.app` → enable **Siri** → Save.
2. On the box, renew the App Store profile (docs/RELEASE.md "Capabilities"): `bundle exec fastlane
   ios renew_profile` with the env shown there.
3. A one-line PR adds `<key>com.apple.developer.siri</key><true/>` to
   `app/ios/Runner/Runner.entitlements`. Its CI `ios` job and the next Release run prove the
   profile matches.

No `NSSiriUsageDescription`: the app never calls `INPreferences.requestSiriAuthorization`.

### 3. Placeholder copy for Hummlist Launch (Spec #5)

- `premium_required` (voice, not reachable until job 50): de "Sprachbefehle sind Teil von
  Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt." en "Voice
  commands are part of Hummlist Premium. You can unlock it in the app under More, Hummlist Premium.
  I didn't add anything." The iOS app has the same sentences as a fallback
  (`app/ios/Runner/AppIntents`).
- The guides' native Siri sections (`site/content/guides/de/siri-kurzbefehl.md` "Ohne
  Einrichtung", `en/siri-shortcut.md` "Siri without setup") carry a draft note. They show on
  production from version 1.0.0. The EN guide's title still says "German only for now". Launch
  rewrites it once native Siri is public.
- The Zugänge card text (`siriWorksWithoutSetup`, `siriOldShortcutHint` in `app/l10n/app_*.arb`).

### 4. Legal Review touchpoints (no legal text was edited)

- **New credential.** "Siri (dieses iPhone)" is a token stored hashed on our server and in plain
  form in the iPhone's Keychain. It is bound to the app session and ends with sign-out. The
  privacy policy's section on access tokens and voice should name it.
- **Item names on the device for Siri.** Up to 50 item names of the household go to the iOS App
  Shortcuts system so that "Add milk to Hummlist" works. Apple states it "may extract anonymized
  App Shortcuts data such as localized phrases, display representation values … Machine learning
  models use this data" (https://developer.apple.com/documentation/appintents/app-shortcuts). The
  display representation values are our item names. The privacy text should say so, or Launch
  drops the one-shot phrase.
- **Analytics.** `siri_add` and `siri_read` (docs/ANALYTICS.md) count Siri use per household under
  the existing consent. No text and no names.

### 5. Known gaps

- English "beer" is classified as produce (DECISIONS "Job 51" item 11). The household's category
  memory fixes it after one move.
- iOS 15 and 16 get no native Siri. The Shortcut recipe stays for them.


## Job 49: Hummlist Premium, yearly and Lifetime (2026-11-01)

Nothing here is live for users: `REVENUECAT_PURCHASES` stays off (Peter turns it on, 20:35 CET),
and the new server switch `premium_offer` is seeded off. Nothing is gated (job 50). Decisions:
DECISIONS "Job 49". Behavior: docs/PURCHASES.md.

### Done by Ops already (ADDENDUM 2, A2-7), so not listed as steps

RevenueCat entitlement `premium` (`entl654efcfce4`) with all four products attached, offering
`default` with `$rc_annual` and `$rc_lifetime`, the Play base plan `yearly`, Play grace period
14 days and account hold 46 days, the App Store subscription group "Hummlist Premium"
(`22532621`) with `com.hummlist.app.yearly` (`6829293557`), the country prices (ADDENDUM 3).

### Steps

1. **Migration `20261031214500_premium_yearly.sql`** deploys with the normal pipeline, together
   with the `purchases` function (same push to main). In the minutes between the two, a webhook
   from the old function fails the new kind check (500) and RevenueCat retries; nothing is sold,
   so none is expected. After the deploy: `select kind, count(*) from public.entitlements group by 1;`
   shows only `premium`.
2. **The old `lifetime` entitlement at RevenueCat**: delete it only after every installed app is a
   job 49 build or later. The webhook reads the product, not `entitlement_ids`, so events naming
   either work meanwhile. An entitlement's identifier can't be changed through RevenueCat's API v2
   (only `display_name`; https://www.revenuecat.com/docs/api-v2/entitlement, read 2026-11-01),
   which is why a new one was created.
3. **Keep unchanged at RevenueCat:** restore behavior "Keep with original App User ID", "Track new
   purchases from server-to-server notifications" off, the webhook URL with
   `?forceFunctionRegion=eu-central-1`. Please confirm in the dashboard that the webhook sends
   subscription lifecycle events (RENEWAL, CANCELLATION, UNCANCELLATION, BILLING_ISSUE,
   EXPIRATION, SUBSCRIPTION_PAUSED, SUBSCRIPTION_EXTENDED) for both stores on the current plan,
   and that App Store Server Notifications V2 and Play RTDN reach RevenueCat for subscriptions.
4. **Offering the purchase (when Peter says so), in this order:**
   - The store prices must be confirmed first (launch gate): run the drift check (step 6) green,
     or the app shows no amount it didn't read from the store anyway; the check proves the stores
     sell at the planned prices.
   - Server switch, service role (SQL editor or Management API):
     ```sql
     update public.app_switches set enabled = true, changed_at = now() where key = 'premium_offer';
     ```
     Off again (also the one command on price drift): the same with `false`. Off: no card, no Buy,
     no store price query, on every build.
   - App: `REVENUECAT_PURCHASES=true` (Job 43/47 steps).
5. **Secrets for the price drift check** (`scripts/iap/price_drift.ts`, `.github/workflows/price-drift.yml`,
   daily 05:17 UTC; it fails with "SKIPPED: … missing (NEEDS_LEAD Job 49)" until they exist).
   Repository secrets, set without printing them:
   - `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the `.p8` text): an App Store Connect API key;
     the check only reads (subscription prices, IAP price schedule, availability). The existing
     App Manager key works; a read-only role may suffice (not tested).
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: a service account with `androidpublisher` scope that can
     see the app's products in Play Console (Users and permissions).
   Not added on purpose: a service-role secret in CI that would turn `premium_offer` off by itself
   on drift. Propose it if you want automatic switching; today drift opens the issue "Store prices
   drifted from scripts/iap/product.ts" and a person runs step 4's `false`.
6. **First run of the drift check:** `deno run --allow-env --allow-net --allow-read scripts/iap/price_drift.ts`
   on the box (ASC key there), with the Play service account if available. It prints the BR, MX
   and IN yearly amounts; put them into `expectedPrices` in `scripts/iap/product.ts` (they are
   `null` now). The 20 euro storefronts all expect 9.99 / 29.99; if a store set one differently,
   the check says which.
7. **StoreKit configuration file:** `app/ios/Hummlist.storekit` was written by hand (Xcode format
   4) with the subscription group; open it once in Xcode on a Mac (or a StoreKit test run) and
   commit whatever Xcode rewrites.
8. **PostHog (319492 only):** update the two paying-household insights from
   `analytics/queries/paying_households_d35.sql` and `paying_share_wah.sql` (both products count;
   the WAH share counts a yearly purchase for 365 + 14 days). The HogQL was not run here.
9. **Proposed event (not shipped):** a `subscription_renewed` / `subscription_expired` server
   event would let the WAH share count active yearly households exactly instead of the 379-day
   approximation. It needs a privacy policy section 9 change through Legal Review first.

### For Legal Review (via the Lead; this job edited no legal text)

- **5a** (privacy policy): the subscription, its renewal and expiry processing; the new stored
  facts per household: plan (`yearly`/`lifetime`), the plan's end (`expires_at`), whether it
  renews (`auto_renew`), whether a billing problem is open (`billing_issue`, with the grace end),
  the time of the newest RevenueCat event (`state_at`); `premium_source` readable by members.
  `cancel_reason` and `expiration_reason` are not stored (H-87).
- **S-8** ("an expired yearly plan can be renewed there under the same transaction number"):
  Apple: confirmed, `originalTransactionId` stays across renewals and a lapsed resubscribe in the
  same group (Apple commerce engineer, https://developer.apple.com/forums/thread/732932; a 2025
  report of a changed id for a few accounts is unanswered). Google: renewals keep RevenueCat's
  `original_transaction_id` (RevenueCat staff, community answer 2023-08-08); a resubscribe after
  expiry creates a new purchase token (Google's subscription docs), so on Google an expired plan
  bought again is a new transaction (it still binds only to the same household's App User ID).
  The clause holds for Apple, not for Google.
- **Section 9**: the new `premium_source` property on `purchase_completed` / `purchase_refunded`;
  the proposed event in step 9.
- **§12 / §13**: unchanged by this job as far as the code goes; please confirm.
- **Support FAQ** (S-3, „Wie kündige ich das Jahresabo?“): the app links `/support` and
  `/en/support` (no anchor exists); the entry is Legal's.
- **H-76 strings name only Lifetime** (`refundHelpBody`, `refundHelpGoogle`, `refundHelpReason`,
  `lifetimeBoughtTwice`, `joinLifetimeEnds`): left word for word. The refund sheet now adds the
  placeholder `premiumRefundYearly` ("Für das Jahresabo gilt dasselbe. Eine Kündigung beendet nur
  die Verlängerung; das laufende Jahr wird nicht automatisch erstattet.") below them.
- **S-11**: the rename „Hummlist Lifetime“ → „Hummlist Premium“ in the 26 values of app_de.arb
  (and app_en.arb) was not applied (legal text change; Peter's approval).
- **Terms / EULA (H-20, H-93)**: no Hummlist terms exist. The Premium page links Apple's standard
  EULA on iOS (`appleEulaUrl`) and, as a placeholder, the support page on Android and the web
  (`termsUrl` in `app/lib/purchases/premium_server.dart`).
- **Kündigungsbutton (§ 312k BGB)**: built nothing beyond the store-management links
  ("Abo verwalten oder kündigen"); is that enough for subscriptions sold through Apple/Google?
- **Store privacy labels (C10)** for subscriptions.
- **app/web/konto-loeschen.html (S-5)**: not edited; the in-app deletion now warns the subscriber.
- **Static-price question (ADDENDUM 1)** is moot: the app shows only what the store returns
  (A2-5). Legal may still want to confirm § 25 TDDDG for the store price query on page open (a
  StoreKit / Play Billing call, no RevenueCat, no network to us).
- **Placeholder copy needing final text** (every `premium*` ARB key marked PLACEHOLDER in its
  description): the page intro, status lines, card titles and price lines, "Einmal zahlen, für
  immer: so viel wie drei Jahre.", the yearly disclosures (`premiumYearlyTerms`), Buy labels,
  "nicht verfügbar" / "bald verfügbar", the yearly-elsewhere hint, the two-plans note, the web
  note, the yearly refund note, and the Lead's generic H-85 line
  (`premiumBillingContinuesOther`: „Ein Jahresabo für diesen Haushalt läuft weiter, bis es
  gekündigt wird.“). The EN button "Buy anyway" is the Lead's wording.
- **Disclosure wording**: Apple's subscription page asks for name, duration, the full renewal
  price and restore on the sign-up screen and links to the terms and privacy policy; the "24
  hours" sentence comes from Apple's Media Services Terms. `premiumYearlyTerms` follows that;
  please confirm or replace.
