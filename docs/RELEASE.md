# Releases

The Release workflow (`.github/workflows/release.yml`) builds green `main`
every Monday at 03:00 UTC (04:00 CET, 05:00 CEST) and ships it with no human
step:

- iOS to TestFlight, internal group "Familie" only. No external groups, no
  Beta App Review, no App Store submission.
- Android to the Play internal testing track.

Both platforms get the same build number in a run. The one-time store setup
that needs a browser is in [`NEEDS_LEAD.md`](NEEDS_LEAD.md); decisions are in
[`DECISIONS.md`](DECISIONS.md), section "Job 23".

## When a run ships

The `plan` job gathers facts (`scripts/release/plan.sh gather`) and decides
(`plan.sh decide`, a pure function with fixture tests in
`scripts/release/test.sh`). The first rule that matches wins:

| Facts | Result |
| --- | --- |
| The newest `ci.yml` push run on the commit has not finished, or did not conclude `success` | Skip with a notice. A scheduled run also opens the failure issue. `force` does not override this: only green `main` ships. |
| The build number is not above TestFlight's highest build | Fail, naming `BUILD_NUMBER_OFFSET`. |
| `upload` is off | Build, sign and validate (dry run). |
| `force` is on | Ship. |
| No earlier upload run | Ship. |
| `main` moved since the last upload run | Ship. |
| TestFlight has no installable build (all expired) | Ship. |
| The last upload run is 60 or more days old | Ship, before TestFlight's 90-day expiry. |
| Otherwise | Skip with the notice "main is unchanged since the last upload". |

The last upload run is the newest successful Release run on `main` whose
`Uploaded` job succeeded. That job runs only after a real upload, so dry runs
and skipped runs never count. The workflow needs no tags and no `contents:
write`; `actions: read` on the plan job is enough.

## Run it by hand

A scheduled run has no inputs; the plan job gives it the dispatch defaults,
so a dispatch with the defaults takes the same path. The log line `Release
plan (schedule): platform=both upload=true force=false ...` (or
`(workflow_dispatch)`) shows it.

```bash
gh workflow run release.yml                       # the scheduled path, now
gh workflow run release.yml -f force=true         # ship even if main is unchanged
gh workflow run release.yml -f upload=false       # build, sign and validate only
gh workflow run release.yml -f platform=android   # one platform
```

| Input | Default | Meaning |
| --- | --- | --- |
| `platform` | `both` | `both`, `ios` or `android`. |
| `upload` | `true` | Off: iOS builds, signs and runs `altool --validate-app`; Android builds, signs, checks the signer and, once Play is set up, runs the upload with `validate_only`. Nothing is published. |
| `force` | `false` | Ship even if `main` is unchanged since the last upload. |
| `simulate_failure` | `false` | Fail the plan job on purpose, to test the failure issue. |

The `release` environment allows deployments from `main` only, so a run on
another branch fails at its first job.

## Failures

A scheduled run that fails, or that skips because `main` is not green, opens
the issue "Weekly release failed" with the run link and the failing job
(`plan`, `ios` or `android`), or comments on it if it is already open. The
next green upload run, or a run that finds `main` unchanged since the last
upload, closes it. Dry runs never touch it. A failed dispatch does not open
the issue, since whoever started it watches the run; `simulate_failure`
does. Watch the repository's issues (Watch, Custom, Issues) to get these.

What to do, by failing job:

- `plan`, "CI concluded failure": fix `main`; the next Monday run ships it,
  or dispatch the workflow once `ci-ok` is green.
- `plan`, "Profile ... is INVALID": see [Capabilities](#capabilities).
- `plan`, "Build number ... is not above": a build was uploaded outside this
  workflow. Raise `BUILD_NUMBER_OFFSET` in `release.yml` so that
  `offset + run number` is above it.
- `ios`, upload: an Apple outage gets one retry, after the lane has looked
  for the build in App Store Connect for 10 minutes (a first attempt may have
  arrived after all). Check
  <https://developer.apple.com/system-status/> and rerun the failed jobs.
- `ios`, "Wait for TestFlight processing": `INVALID` or `FAILED` means Apple
  rejected the binary; Apple's email to the account holder says why. A build
  still processing after 45 minutes usually turns `VALID` later; check
  TestFlight before rerunning.
- `ios`, "VALID but already expired": see
  [TestFlight builds expired](#testflight-builds-expired).
- `android`, "is signed by ..., not by the upload key": `ANDROID_KEYSTORE_BASE64`
  holds another key; restore it from `~/groceries-ops/secrets/android/`.
- `android`, upload: Play's error names the cause. "Only releases with status
  draft may be created on draft app" means `PLAY_RELEASE_STATUS` must be
  `draft` until the app leaves draft (`NEEDS_LEAD.md`, L3).

### TestFlight builds expired

On 2026-10-26 at 13:14:02 to 13:14:03 UTC, Apple expired every unexpired
TestFlight build of the team at once: Hummlist 1002 (uploaded the day
before), build 1001 of the old app record (`6826907810`) and all 65 builds of
another app of the team that were younger than 90 days (uploaded since
2026-09-13). No build of ours was expired by hand, no Beta App Review
submission exists, no newer build replaced them, and the certificate, profile
and membership-bound API access kept working. Other teams report the same
mass expiry on Apple's developer forums (thread 813703: January, July and
August 2026); Apple's TestFlight team acknowledged an investigation and has
not named a cause.
`DECISIONS.md`, Job 23, has the query results.

The weekly run handles it: when TestFlight has no installable build, an
unchanged `main` ships again (rule above), so testers have a build again by
the next Monday at the latest. To get one sooner, dispatch the workflow with
the defaults. If a new build comes out expired too, the run fails ("VALID but
already expired"): then the account holder opens a case with Apple Developer
Support (developer.apple.com/contact, TestFlight) quoting the build number;
nothing in the account or the repo fixes it.

## App identity

The app is "Hummlist", bundle ID and Android `applicationId`
`com.hummlist.app` since job 20. `app/fastlane/Appfile`, `Matchfile` and
`APP_ID` in the `Fastfile` name it.

- iOS: App Store Connect app "Hummlist", Apple ID `6826922741`, primary
  language de-DE. Internal group "Familie" has access to all builds, so every
  `VALID` build reaches it. The old app record (`6826907810`,
  `com.petertrost.familygroceries`) gets no further builds.
- Android: Play app "Hummlist" (app ID `4972374295718364245`), created by
  the Lead on 2026-10-27. The Lead uploaded the first bundle (0.1.0, version
  code 1003, built on the box) by hand to internal testing, list "Familie",
  on 2026-10-28 and set `PLAY_RELEASE_STATUS` to `completed`; since then
  every upload run rolls out to internal testers.

## Lanes

Run lanes from `app/` with `bundle exec fastlane <platform> <lane>`.

| Lane | What it does |
| --- | --- |
| `ios certificates` | Creates or renews the distribution certificate and profile in the match repo. Run by the manual Certificates workflow only; the team keeps its three distribution certificates, so don't run it. |
| `ios preflight` | Fails if the App Store profile is not `ACTIVE`; writes TestFlight's highest build number and whether any build is installable to `TESTFLIGHT_JSON`. The plan job runs it. |
| `ios beta` | Installs the certificate and profile from match (read-only), signs manually, runs `flutter build ipa`. `RELEASE_UPLOAD=true` uploads to TestFlight (internal only, one retry), otherwise `altool --validate-app` validates the IPA. |
| `ios wait_processing` | Sets What to Test (de-DE and en-US) as soon as the build shows up (a refusal only warns), then polls until it is `VALID` (at most `WAIT_MINUTES`, 45). Fails on `INVALID`, `FAILED`, an expired build or two API errors in a row. |
| `ios renew_profile` | Regenerates the App Store profile with the existing certificate `GN85KDC962` and pushes it to the match repo ([Capabilities](#capabilities)). |
| `android build` | `flutter build appbundle`, signed with `android/key.properties`. |
| `android play_access` | Gets a Google token for the service account (fails if that does not work), then tries to open a Play edit; writes `ok` or Play's refusal to `PLAY_ACCESS_FILE`. |
| `android internal` | Uploads the AAB to the `internal` track with `PLAY_RELEASE_STATUS`, or validates it only (`RELEASE_UPLOAD` not `true`). Uploads no listing, changelog or images. |

The lint gate runs `scripts/release/test.sh` and shellchecks
`scripts/release/`; CI's `fastlane` job checks that the Gemfile.lock installs
and the Fastfile parses.

## What to Test

`scripts/release/notes.sh` writes the TestFlight notes: the titles of the PRs
merged into `main` since the last upload's commit (`main` takes one
`<PR title> (#n)` commit per PR), newest first, at most 12 lines. It drops
PRs about the repo's own machinery (docs, CI, lints, gates, deploys, backups,
release tooling, the verify skill; the word list is `internal` in the
script), the `Job <n>:` prefixes, PR numbers and anything that looks like an
email address. The lane removes what Apple rejects (emoji, `<`) and cuts to
4000 bytes; if App Store Connect still refuses the notes, the run warns and
stays green, since the build reached the testers anyway. de-DE gets a German heading,
en-US an English one; the titles stay as written. Play gets no release notes
(`skip_upload_changelogs`; job 14 owns store metadata).

The first upload (Release run 11, build 1021) had no earlier upload to start
from, so the script took the last 20 `main` commits, and after the filters
only "rename the app to Hummlist (com.hummlist.app)" was left. That note was
a one-off: from build 1021 on, every run lists the PRs since the previous
upload.

## Secrets and variables

All live in the `release` environment (Settings, Environments, `release`;
deployments from `main` only). Values marked "variable" may also be secrets.

| Name | Kind | Used by | Value |
| --- | --- | --- | --- |
| `APPLE_TEAM_ID` | variable | iOS | `VCZSHMZY25`. |
| `MATCH_GIT_URL` | variable | iOS | SSH URL of the private certificates repo. |
| `MATCH_DEPLOY_KEY` | secret | iOS | Private SSH key; its public half is a deploy key on the certificates repo. |
| `MATCH_PASSWORD` | secret | iOS | Passphrase that encrypts the certificates repo. |
| `APP_STORE_CONNECT_API_KEY_ID` | secret | iOS | Key ID of the App Store Connect API key (`family-groceries-ci`). |
| `APP_STORE_CONNECT_ISSUER_ID` | secret | iOS | Issuer ID shown above the API keys list. |
| `APP_STORE_CONNECT_API_KEY_P8` | secret | iOS | Full text of the `AuthKey_<id>.p8` file. |
| `ANDROID_KEYSTORE_BASE64` | secret | Android | The upload keystore, base64-encoded. |
| `ANDROID_KEY_PROPERTIES` | secret | Android | The `key.properties` file (format below). |
| `PLAY_RELEASE_STATUS` | variable | Android | Unset: Play is not set up, no upload. `draft`: upload as a draft release (until the app leaves draft). `completed`: upload and roll out to internal testers. |

Play needs no key: the Android job signs in to Google with Workload Identity
Federation (below). The workflow's `env` holds the non-secret identifiers:
`BUILD_NUMBER_OFFSET`, `UPLOAD_CERT_SHA256`, the workload identity provider
and the service account email.

The build needs no Supabase defines: `app/lib/app/environment.dart` defaults
to the production URL and publishable key. Both platforms pass
`--dart-define-from-file=config/auth.json`, the public Google and Apple
sign-in client IDs and `APP_URL`.

## Build numbers and versions

The build number is `BUILD_NUMBER_OFFSET + GITHUB_RUN_NUMBER` (offset 1010).
Every run, dry runs and skips included, takes a new run number, so the
number only grows on both stores, and iOS and Android get the same one in a
run. Gaps are fine. When the schedule started, TestFlight's highest was 1002
(Release run 2, offset 1000 then) and Play's first bundle, built on the box
for the Lead's first manual upload, had version code 1003. The offset went
to 1010 so that the next run (3) builds 1013, above both. The plan job fails
a run whose number is not above TestFlight's highest; Play rejects a version
code it already has, and the offset is the fix for both.

The version name comes from `version` in `app/pubspec.yaml` (`0.1.0+1`; the
`+1` is ignored because the lanes pass `--build-number`). To bump it, change
`version` in a PR, for example to `0.2.0+1`. The next run uploads 0.2.0 with
the next build number. TestFlight groups builds by version; Play shows the
version name. A version bump never resets the build number.

## Android signing

`app/android/app/build.gradle.kts` signs release builds with the key named in
`app/android/key.properties`:

```properties
storePassword=<store password>
keyPassword=<key password>
keyAlias=upload
storeFile=../upload-keystore.jks
```

`storeFile` resolves from `app/android/app`, so `../upload-keystore.jks` is
`app/android/upload-keystore.jks`; that is where the workflow writes the
keystore, and it deletes both files after the build. Without
`key.properties`, release builds sign with the debug key, so local builds
work without secrets; the workflow's `check-aab.sh` step fails a bundle
signed by anything but the upload key. `key.properties` and keystores are in
`.gitignore`.

The upload key (created 2026-10-27, job 23): PKCS12, RSA 4096, alias
`upload`, `CN=Hummlist, O=Trost Systems`, valid until 2054-03-14. The
keystore and its `key.properties` are on the build box in
`~/groceries-ops/secrets/android/` (mode 600) and in the `release` secrets
above. Copy both to a password manager; Google can reset a lost upload key,
but only through Play Console support.

| Certificate | SHA-1 | SHA-256 |
| --- | --- | --- |
| Upload key | `D4:9D:98:9E:AD:E3:2E:FE:D2:D3:A1:7A:71:B2:95:29:84:81:78:69` | `2C:9B:48:6D:AF:1B:94:AB:3F:92:38:49:CC:0F:C3:42:EF:09:64:2C:32:40:74:97:69:25:61:74:0C:BA:84:F5` |
| Play app signing key (Google-generated, Play Console, Setup, App signing; L3, 2026-10-28) | `77:B6:9B:5E:8F:10:5D:3F:46:3C:62:C3:BC:BE:A8:3D:EA:10:08:53` | `27:0E:40:2B:04:1D:4D:C8:E7:65:10:C6:B4:36:FE:E8:51:D9:08:E6:00:43:89:7F:4E:AF:B9:2F:BC:7B:E4:2A` |

Play App Signing holds the app signing key, which signs what testers
install. Google sign-in on Play builds and `assetlinks.json` (job 22) need
the app signing key's fingerprints; debug and locally signed builds need the
upload key's.

### Play service account

`play-release@family-groceries-ci.iam.gserviceaccount.com` (Google Cloud
project `family-groceries-ci`, Android Publisher API enabled) has no key and
no project roles. Only jobs in this repo's `release` environment can act as
it: its `roles/iam.workloadIdentityUser` binding names the subject
`repo:trost-systems@267752722/family-groceries@1429864759:environment:release`
on the workload identity pool `github`, provider `family-groceries`.
`google-github-actions/auth` exchanges the job's GitHub OIDC token and writes
an `external_account` credentials file, which fastlane's supply reads as
`json_key`. Play Console grants the account access to Hummlist
(`NEEDS_LEAD.md`, L4).

## iOS signing

[match](https://docs.fastlane.tools/actions/match/) keeps the distribution
certificate (`GN85KDC962`, Apple Distribution, expires 2027-10-25) and the
App Store profile "match AppStore com.hummlist.app", encrypted with
`MATCH_PASSWORD`, in the private repo
`trost-systems/family-groceries-certificates`. The workflow loads
`MATCH_DEPLOY_KEY` into an SSH agent so match can clone it.
`app/fastlane/Matchfile` is read-only by default, so a release run never
creates certificates. The Xcode project keeps automatic signing for local
development; `ios beta` switches to manual signing for the release build only.

`Info.plist` sets `ITSAppUsesNonExemptEncryption` to `false`, so TestFlight
does not ask the export compliance question for each build.

### Capabilities

Enabling a capability on the App ID `com.hummlist.app` (for example
Associated Domains for job 22) makes the App Store profile `INVALID`. The
next Release run then fails in `plan` ("Profile ... is INVALID") before any
build. The sequence:

1. The Lead enables the capability in the browser (`NEEDS_LEAD.md`, L6).
2. From the build box, in `app/` (the box reaches GitHub over HTTPS only, so
   the match URL is the HTTPS one; `gh` is the git credential helper):

   ```bash
   set -a; . ~/groceries-ops/env; set +a   # MATCH_PASSWORD
   APPLE_TEAM_ID=VCZSHMZY25 \
   MATCH_GIT_URL=https://github.com/trost-systems/family-groceries-certificates.git \
   APP_STORE_CONNECT_API_KEY_ID=4J3N457M89 \
   APP_STORE_CONNECT_ISSUER_ID=<issuer ID> \
   APP_STORE_CONNECT_API_KEY_P8="$(cat ~/groceries-ops/AuthKey_4J3N457M89.p8)" \
   bundle exec fastlane ios renew_profile
   ```

   match regenerates the profile with the certificate `GN85KDC962` and pushes
   it to the match repo. It creates a certificate only when the repo holds
   none, so it creates and revokes none here. `MATCH_FORCE=false` checks
   without regenerating (proven 2026-10-27: "All required keys, certificates
   and provisioning profiles are installed", repo unchanged).
3. The PR that adds the entitlement (for example
   `com.apple.developer.associated-domains` in
   `ios/Runner/Runner.entitlements`) lands after step 2.
4. Dispatch the Release workflow; the plan's preflight passes and the build
   signs with the new profile.

Order matters only between 1 and 2: a run between them fails in `plan` with
the message above and costs nothing else. A weekly run after step 2 but
before step 3 builds fine; the new profile allows the capability without
requiring it.

## Build locally

Android, from `app/`:

```bash
flutter build apk --release --dart-define-from-file=config/auth.json        # build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release --dart-define-from-file=config/auth.json  # build/app/outputs/bundle/release/app-release.aab
```

Add `--build-number=<n>` to match a store build. To check which key signed a
build, run `keytool -printcert -jarfile <aab>` or
`apksigner verify --print-certs <apk>`.

iOS builds need macOS and Xcode. On a Mac with the match secrets in the
environment, `BUILD_NUMBER=<n> RELEASE_UPLOAD=true bundle exec fastlane ios beta` builds and
uploads; `flutter build ipa` alone builds with automatic signing.

Ruby for the lanes: `app/.ruby-version` names the version CI uses. Run
`bundle install` in `app/` once.

## App icon

`scripts/icons.py` (Python 3 with Pillow) draws the icon and writes every
size: `app/assets/icon/icon.png` (1024 px source), the iOS `AppIcon` set, the
Android launcher and adaptive icon mipmaps, and the web icons and favicon.
Change the drawing there and rerun `python3 scripts/icons.py`.
