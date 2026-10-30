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
