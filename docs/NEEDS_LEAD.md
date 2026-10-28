# Needs the Engineering Lead

Browser steps for the Engineering Lead, in the build box's browser, with
Peter only signing in. Everything around them is done from the box. Steps
that need Peter's own decision, money or identity are in
[`NEEDS_PETER.md`](NEEDS_PETER.md) instead.

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
| Privacy policy URL | No | Yes | After job 24 publishes the page and Peter OKs it. |
| App access (sign-in needed; reviewer credentials) | No | Yes (review) | With the production track. |
| Ads (no ads) | No | Yes | Any time: "No, my app does not contain ads". |
| Content rating (IARC questionnaire) | No | Yes | Any time; the answers are Peter's. |
| Target audience and content | No | Yes | Any time: 18+ suggested (household tool); Peter's call. |
| Data safety form | No | Yes | After job 24's privacy page (the form must match it). |
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
