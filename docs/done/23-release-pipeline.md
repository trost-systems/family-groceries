# Job 23: weekly releases to TestFlight and Play internal testing

PR #52 is on `main` as 2e76190: the pipeline, Android release signing, and
the docs. The follow-up PR (job 23b) adds this record, the run evidence, and
the doc updates that came after the first real upload.

Every Monday at 03:00 UTC, green `main` ships with no human step. iOS goes to
TestFlight group "Familie" (internal testers only). Android goes to the Play
internal testing track, list "Familie". Both platforms get the same build
number. The first scheduled run fires on 2026-11-02 at 03:00 UTC (04:00 CET).
The workflow is `active`.

## What was built, and where

- `.github/workflows/release.yml`: cron `0 3 * * 1`, plus `workflow_dispatch`
  with the inputs `platform`, `upload`, `force` and `simulate_failure`. A
  dispatch with the defaults takes the scheduled path. The log line
  `Release plan (<event>): platform=both upload=true force=false` shows it.
  The `release` environment deploys from `main` only.
- `scripts/release/plan.sh`: gathers facts from the Actions API and App Store
  Connect, then decides. It ships only if `ci.yml` is green on the commit. It
  skips if `main` is unchanged since the last upload run, unless `force` is
  set, TestFlight has no installable build, or the last upload is 60 or more
  days old. The last upload run is the newest run whose `Uploaded` job
  succeeded, so the workflow needs no tags and no `contents: write`.
- `scripts/release/notes.sh`: TestFlight "What to Test" in de-DE and en-US,
  built from the PR titles since the last upload.
- `scripts/release/report.sh`: opens or comments on the issue "Weekly release
  failed" after a failed scheduled run or a `simulate_failure` run. The next
  green upload run, or a run that finds `main` unchanged, closes it.
- `scripts/release/check-aab.sh`: fails the run if the AAB is not signed by
  the upload key.
- `scripts/release/test.sh`: offline fixture tests for all of the above. The
  lint gate runs it.
- `app/fastlane/Fastfile`: `ios beta` uploads with `distribute_external:
  false` and `skip_submission`. `ios wait_processing` sets What to Test and
  polls for up to 45 minutes until the build is `VALID`. `ios preflight`
  checks the profile and the highest build number. `ios renew_profile`
  regenerates the profile with the existing certificate. `android internal`
  uploads with `release_status` from `PLAY_RELEASE_STATUS`, or with
  `validate_only` when `upload` is off.
- `ci.yml`: `keepalive-schedule` also enables release.yml, so GitHub never
  disables the cron.
- Android signing: an upload key (PKCS12, RSA 4096, alias `upload`) on the
  build box in `~/groceries-ops/secrets/android/` (mode 600), and as
  `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEY_PROPERTIES` in the `release`
  environment. Play App Signing holds a Google-generated app signing key.
  Both sets of fingerprints are in `docs/RELEASE.md`, "Android signing".
- Play access is keyless. The service account
  `play-release@family-groceries-ci.iam.gserviceaccount.com` has no key and no
  project roles. It is bound through Workload Identity Federation to this
  repo's `release` environment only.
- Docs: `docs/RELEASE.md` (runbook), `docs/NEEDS_LEAD.md` (browser steps L1 to
  L7), `docs/NEEDS_PETER.md` "Job 23", `docs/DECISIONS.md` "Job 23".

## How to verify

```bash
scripts/release/test.sh                                   # offline fixture tests
shellcheck scripts/release/*.sh && actionlint             # both clean
gh workflow run release.yml -f upload=false               # build, sign, validate both platforms
gh run list --workflow release.yml                        # then gh run view <id> --log
gh api repos/trost-systems/family-groceries/actions/workflows/release.yml -q .state   # active
```

A dry run's log shows `VERIFY SUCCEEDED` (iOS `altool --validate-app`) and
`Successfully validated the upload to Google Play` (Play `validate_only`).
A real upload run's log shows `Build <n> is VALID and available to the
internal group` and `Successfully finished the upload to Google Play`.

## Release runs on main 2e76190

Each row was checked with `gh run view <id> --log`. Build number = 1010 + run
number.

| Run | ID | Result | Build | What it proves |
| --- | --- | --- | --- | --- |
| 4 | 40604682204 | success | 1014 | Dry run before `PLAY_RELEASE_STATUS` existed: iOS validated, Play only probed access. Does not count toward the five. |
| 5 | 40612085296 | success | 1015 | Dry run 1 of 5: iOS `VERIFY SUCCEEDED`, Play `validate_only` passed |
| 6 | 40616464456 | success | 1016 | Dry run 2 of 5, same |
| 7 | 40617308990 | success | 1017 | Dry run 3 of 5, same |
| 8 | 40621659046 | success | 1018 | Dry run 4 of 5, same |
| 9 | 40622602925 | success | 1019 | Dry run 5 of 5, same |
| 10 | 40624637736 | failure (on purpose) | 1020 | `simulate_failure`: `plan` fails, `report` opens issue #53. This was a test of the failure path, so it does not reset the count. |
| 11 | 40624711152 | success | 1021 | Real upload with default inputs (the scheduled path) |
| 12 | 40628341790 | success | 1022 | Default inputs again: skips with "main is unchanged since the last upload" |

Run 4 is not void. It is green, but it ran before the Lead set
`PLAY_RELEASE_STATUS`, so it shows Play access, not a Play validate. Runs 5
to 9 are the five consecutive green dry runs. No run was void.

### The real upload, run 40624711152

- Plan: `Release plan (workflow_dispatch): platform=both upload=true
  force=false`, notice "Shipping build 1021: no earlier upload run".
- iOS: "Successfully uploaded the new binary to App Store Connect", "What to
  Test set for de-DE, en-US", "Build 1021 is VALID and available to the
  internal group". App Store Connect shows 1021 in "Familie", with no Beta
  App Review submission.
- Android: the AAB is signed by the upload key. The run uploaded to track
  `internal` with `release_status completed`, and the log ends with
  "Successfully finished the upload to Google Play".
- `Uploaded` and `report` succeeded. `report` closed issue #53 "Weekly
  release failed", which run 10 opened at 03:05:23Z (closed 03:15:28Z).

The first What to Test note reads "rename the app to Hummlist
(com.hummlist.app)". It was a one-off, because there was no earlier upload
to start from (`docs/RELEASE.md`, "What to Test").

### Before the pipeline: the Lead's manual Play release

Play takes its first bundle only by hand. The box built one signed AAB
(version 0.1.0, version code 1003, upload key signer checked). The Lead
uploaded it on 2026-10-28 at about 01:43 CET as internal testing release 1003
to list "Familie" and opted into Play App Signing. Then
`PLAY_RELEASE_STATUS=completed` was set in the `release` environment. Every
upload run since then rolls out to internal testers.

### TestFlight builds 1001 and 1002

On 2026-10-26 Apple expired every TestFlight build of the team at once,
Hummlist 1002 included. Nobody did it by hand (`docs/DECISIONS.md`, Job 23).
The plan ships an unchanged `main` again when no build is installable. A build
that is already expired when it turns `VALID` fails the run.

## Screenshots

- `docs/screenshots/job-23/04-upload-run.png`: run 11, both platforms
  uploaded.
- `05-testflight-familie.png`: 1021 VALID in "Familie".
- `06-failure-issue-opened.png`, `07-failure-issue-closed.png`: issue #53
  opened by run 10 and closed by run 11.
- `08-skip-notice.png`: run 12 skips because `main` is unchanged.
- `09-release-runs.png`: runs 4 to 12.
- `01` to `03` are from PR #52: the TestFlight mass expiry, the first
  scheduled decision on real data, and the local gates.

## Open items

- NEEDS_LEAD: nothing open. L1 to L7 are done: the Play app, internal
  testing release 1003, the service account's access, the policy check,
  Associated Domains with the renewed profile `5T4AGK7RF2`, and both Android
  OAuth clients.
- NEEDS_PETER, "Job 23": copy the Android upload key
  (`~/groceries-ops/secrets/android/`) to a password manager outside the box.
  This is Peter's own step. Also watch the repo's issues so a failed Monday
  run reaches him. If Apple again hands out a build that is already expired,
  open a case with Apple.
- Next scheduled run: 2026-11-02 03:00 UTC. It ships only if `main` moved
  past 2e76190 and is green, so it will carry whatever merged in between.
