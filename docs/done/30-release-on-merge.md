# Job 30: every green merge to main reaches the internal testers

PR #100 (branch `job/30-release-on-merge`), merged as `ae535df`. Decisions:
`docs/DECISIONS.md`, "Job 30". Runbook: `docs/RELEASE.md`.

## What was built

- **`release.yml` runs after every green CI on `main`** (`workflow_run` on
  CI, `branches: [main]`). The plan job's `if` takes only a green
  (`success`) push run of this repository. A red CI, a dispatched CI run or
  a fork PR from a branch named `main` skips every job, `report` included,
  so nothing ships and no issue opens.
- **Each run ships the newest green `main` commit** (`plan.sh gather` walks
  `main` from its tip to the last upload). Red commits never ship. Newer
  commits whose CI still runs get their own run. Concurrency group
  `release` never cancels a run in progress. GitHub drops older pending
  runs, and whichever run survives ships everything green so far. A run
  whose commit is older than the last upload skips and says so. A dispatch
  that waited while a newer commit shipped skips too.
- **The last upload's commit is in the job name** `Uploaded <sha>`. Old
  `Uploaded` jobs still count.
- **No store build when only docs, CI, scripts or the backend changed** (nothing
  under `app/` or in `release.yml`). The expiry rules and `force` still ship.
- **Monday schedule kept as a catch-up** that decides like an automatic run.
- **`app.hummlist.com` moves only with a dispatch** (DECISIONS 30.7): the
  public web app no longer follows each internal release.
- **No public release path.** `RELEASE.md`, "Public releases", says that a
  public release is a later step with a manual gate, after a full e2e pass.
- **Failure issue renamed "Internal release failed".** Automatic runs open it
  or comment on the open one. A run that uploads, or finds the testers
  current (new plan output `current`), closes it.
- Files: `.github/workflows/release.yml`, `scripts/release/{plan,report,test}.sh`,
  `docs/RELEASE.md`, `docs/DECISIONS.md`, `docs/DEPLOY.md`,
  `docs/NEEDS_PETER.md`, one-line comment updates in `ci.yml`, `Fastfile`,
  `AGENTS.md` and the web-hosting verify recipe.

## How to verify

- `scripts/release/test.sh` (in the lint gate). Fixture cases: newer sha
  already shipped -> skip; the newer commit's CI still running -> the older
  green one ships; CI finishing out of order -> the newer ships; red tip ->
  the newest green ships, never the red one; dispatch `force` (also on
  unchanged main and docs-only changes); dispatch on red blocked even with
  force; a queued dispatch older than the last upload -> skip; docs-only ->
  skip, but the expiry rules re-ship. `gather` runs against a scratch git
  history with a fake `gh`. Mutation-checked: picking the oldest green, or
  dropping the older-dispatch guard, fails the tests.
- "CI failed -> no run": the plan job's `if` (`conclusion == 'success'`),
  and `report` skips when `plan` was skipped.
- `actionlint` clean; yamllint (line length 120) reports only the three long
  lines already on main; shellcheck passes in CI's lint gate.

## Test results

- PR CI (run 41010097423 and, after the rebase onto 29c, 41011794824): all
  gates green. The lint gate prints "release tests: all passed", with
  check-aab running on Linux. The first attempt of 41011794824 failed only on the known
  `classifier.spec.ts:59` e2e flake; a rerun of the failed shard passed.
- Live `gather` + `decide` against the real Actions API before merge: the
  last upload resolved to 899891b (run 15, old `Uploaded` job name), and
  "main is unchanged" was correct then.
- **After merge, automatic:** main CI on `ae535df` (run 41013427947) green,
  then Release run #16
  ([41014200610](https://github.com/trost-systems/family-groceries/actions/runs/41014200610),
  event `workflow_run`) started by itself: "Shipping build 1026: main moved
  since the last upload (899891b -> ae535df)". Build 1026 of `ae535df`: TestFlight
  "Build 1026 is VALID and available to the internal group" (06:36 UTC),
  Play internal "Successfully finished the upload to Google Play" (track
  `internal`, status `completed`). The job ran as
  `Uploaded ae535dff9e825fa07a1a32a75554490e58429f10`; `report` closed the
  issue (none open); `Web production` was skipped, as designed. CI went green at 06:27
  and the testers had build 1026 nine minutes later.

## Missing or blocked

- Nothing blocked. Peter may want the web app on every merge after all;
  that is one `if` in the `web` job (DECISIONS 30.7).
- `main` CI flaked on `classifier.spec.ts:59` and `add-sheet.spec.ts:212`
  (run 41011756707 on 7df4763). That is outside this job and posted on the
  BOARD. A red CI on `main` now delays that commit's internal release until
  the next green commit or a green rerun.
- No screenshots: nothing visible changed. The proof is the Actions runs above.
