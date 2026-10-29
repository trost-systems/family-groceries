# CI

`.github/workflows/ci.yml` runs on every PR, on every push to `main` and on
demand (`gh workflow run ci.yml --ref <branch>`). `ci-ok` is the one check a
merge waits for (`scripts/merge-pr.sh`). For only the e2e and db gates on a
branch, with a spec filter, use `scripts/ci-e2e.sh` (On-demand e2e, below).

## Gates

Each CI job installs its tools and runs one script in `scripts/gates/`.
`scripts/verify.sh` runs the same scripts locally, so a local run and CI check
the same things.

| Gate | What it checks | Runs locally |
| --- | --- | --- |
| `gitleaks` | No secret in the history or in what the working tree could commit (ignored output such as Playwright traces is skipped) | yes |
| `lint` | actionlint, shellcheck, `tsc --noEmit` for `e2e/`, `scripts/check-gates.sh`, `scripts/lint.sh` | yes |
| `site` | The guides site in `site/`: build checks, tests, a production build; no real access token in the repo | yes |
| `db` | Migrations on a fresh database, pgTAP, the classifier sweep, `db lint` | yes |
| `functions` | Deno fmt, lint and tests for the functions, the classifier and the deploy tooling | yes |
| `fg-cli` | Deno fmt, lint and tests for the verify skill's CLI | yes |
| `flutter` | Generated l10n, format, `flutter analyze --fatal-infos`, tests | yes |
| `web-prod` | The production web build, into `app/build/web-prod` | yes |
| `fastlane` | The Gemfile.lock installs and the Fastfile parses | yes |
| `e2e` | Playwright against the release web build and the local stack | yes, under `/tmp/fg-e2e.lock` |
| `android` | Debug APK build (the app's Kotlin) | `--only android` |
| `ios` | Simulator build (the app's Swift), macOS only | no |

```bash
scripts/verify.sh                          # every local gate, e2e last
scripts/verify.sh --only flutter,db        # some gates
scripts/verify.sh --only e2e -- tests/list.spec.ts   # one spec, under the e2e lock
scripts/verify.sh --skip-e2e
```

To add a check, add it to the gate script it belongs to. To add a gate, add
`scripts/gates/<name>.sh`, a `ci.yml` job of the same name that runs it, the
name in `ci-ok`'s `needs`, and the name in `GATES` (or `CI_ONLY`) in
`verify.sh`. `scripts/check-gates.sh`, part of the lint gate, fails when one
of these is missing or a check command is written into `ci.yml` or
`verify.sh` directly. It also fails when any job in any workflow has no
`timeout-minutes`.

In CI the e2e job runs as two shards (`--shard=1/2`, `--shard=2/2`), each on
its own runner with its own stack, because Playwright is the longest step.
Each shard starts the Supabase stack in the background before installing
Flutter and Playwright; the gate's `supabase_up` (`scripts/lib.sh`) waits on
the same per-project lock and reuses the stack. CI pulls the Supabase images
from Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY: docker.io`): the default
registry rate-limits runners and cost about 14 s of retries per run, and
ghcr.io refused every runner pull for hours on 2026-10-27.

The e2e gate takes the box-wide lock `/tmp/fg-e2e.lock`, held from stack start
through Playwright. A second run prints the last holder that recorded itself
in the lock file and waits. Anything else that runs Playwright on the box can
take the same lock with `flock /tmp/fg-e2e.lock <command>`. The kernel
releases the lock when the holder exits, however it exits.

A failed e2e test gets one retry only when the host paused the test runner
for 2 s or more during it (a VM stall on the shared box): the line
`[host-stall] <test>: the host paused the test runner for N s` names it, and
the retry shows as flaky. Any other failure fails its retry at once with
"not retried", so the gate still fails (`e2e/tests/fixtures.ts`, DECISIONS
job 15b).
That the app itself recovers from a pause is a test of its own (live-sync.spec,
the sleeping phone).

## Which gates a PR runs

The `changes` job (`scripts/ci-changes.sh`) reads the PR's changed files:

- Only `docs/` and Markdown changed (the verify skill's files under
  `.cursor/` and `.claude/` count as code): only `gitleaks`, `lint` and
  `site` run. `site` always runs because the guides are Markdown.
- `android` and `ios` run when `app/ios/`, `app/android/` or `app/pubspec.*`
  changed. They compile the app's Swift and Kotlin and the plugin registrant
  generated from pubspec. A Dart change in `app/lib/` is compiled by the
  flutter, web-prod and e2e gates already.
- `fastlane` runs when `app/fastlane/` or `app/Gemfile*` changed.
- A change to `ci.yml`, `.github/actions/`, `scripts/ci-changes.sh`,
  `scripts/lib.sh`, `scripts/gates/` or `scripts/e2e-summary.sh` runs
  everything, and so does a push to `main` or a manual run.
- `e2e.yml` and `scripts/ci-e2e.sh` (On-demand e2e) count like
  documentation: ci.yml doesn't run them, and the `lint` gate (actionlint,
  shellcheck, `check-gates.sh`) checks them.

A skipped job counts as passed for `ci-ok`. A failed or cancelled one fails
it.

## On-demand e2e (job 27)

`scripts/ci-e2e.sh` runs the Supabase + Playwright e2e, and by default the
db gate, on GitHub Actions for a pushed branch, without the rest of CI. It is
the way to run e2e where Docker is not allowed (the Mac runner), and it takes
that load off the box. It needs only `gh` (logged in), `git` and `jq`.

```bash
scripts/ci-e2e.sh                                  # full suite, 2 shards, db gate, fg sync smoke
scripts/ci-e2e.sh --spec tests/stores.spec.ts      # one spec: 1 shard, no sync smoke
scripts/ci-e2e.sh --spec '-g "drag"' --no-db       # by title, without the db gate
scripts/ci-e2e.sh --spec tests/list.spec.ts --download /tmp/pw   # also fetch report, traces, screenshots
scripts/ci-e2e.sh --ref job/42-foo --shards 2 --sync-smoke
```

- The branch must be pushed: the script refuses when your local branch and
  `origin/<ref>` are different commits, since the run checks out origin's.
  On a PR branch push with `scripts/push-pr.sh` first. Uncommitted changes
  are not part of the run, and the script says so.
- It dispatches `.github/workflows/e2e.yml` with a fresh `request_id`. The
  workflow puts that id into its run name (`run-name:`), so the script finds
  its own run, not one someone else started on the same branch a second
  earlier. Then it waits for the run and prints each job's result with its
  time, each shard's passed, failed and flaky counts with the failed titles,
  and the run URL. It exits 0 when the run passed and at least one test ran,
  1 when the run failed or was cancelled or no test ran, 2 on a usage
  problem. If a run fails, `gh run view <id> --log-failed` says why.
- Inputs of `e2e.yml` (also in the Actions tab, **Run workflow**): `spec`
  (Playwright arguments; empty is the full suite), `shards` (`auto` is 2 for
  the full suite and 1 with a spec), `db` (default on: `scripts/gates/db.sh`
  in its own job), `sync_smoke` (`auto` runs the fg sync smoke test on shard
  1 for the full suite only). A sharded spec run passes an empty shard
  (`--pass-with-no-tests`); the script then checks that some test ran.
- One run per branch and spec: a second dispatch with the same spec cancels
  the first (`concurrency`). Different specs run side by side.
- Artifacts, per shard and attempt: `playwright-<shard>-attempt<n>` (HTML
  report, test results with traces, screenshots, sync evidence) and
  `e2e-results-<shard>-attempt<n>` (only `playwright-results.json`, what the
  script reads). Each e2e job writes a summary of passed, failed and flaky
  tests per spec file onto the run page (`scripts/e2e-summary.sh`); ci.yml's
  e2e jobs write the same summary.
- It is not a required check and does not replace `ci-ok`: a PR still lands
  on ci.yml's run. Once a PR is open, every push runs the full ci.yml anyway;
  use ci-e2e.sh for single specs while iterating.

The backend comes up exactly as in ci.yml's e2e and db jobs and the local
gates. Both workflows' jobs use the same composite actions:
`.github/actions/e2e-setup` (Supabase CLI, ephemeral ports, the stack
started in the background, Flutter, Node and Playwright, Deno, ffmpeg),
`.github/actions/e2e-report` (the stack's logs on failure, the artifacts,
the job summary) and `.github/actions/db-setup`. Between them each job runs
its own `scripts/gates/<gate>.sh`, which calls `supabase_up` with the repo's
migrations and seed, the job-18 fixtures and `e2e/playwright.config.ts`.
The pins (`FLUTTER_VERSION`, `SUPABASE_CLI_VERSION`,
`SUPABASE_INTERNAL_IMAGE_REGISTRY`) are written in both workflows, because a
composite action can't read a workflow's `env`. `scripts/check-gates.sh` fails
when the pins differ, when the two `e2e` or `db` jobs use different actions,
versions or action inputs, or when e2e.yml's job no longer runs its gate script. The
gate's `FG_SYNC_SMOKE=1|0` overrides its sync smoke rule (`sync_smoke`).

`gh workflow run` finds a workflow by file name only once GitHub has
registered it, and a `workflow_dispatch` workflow is registered when it
reaches the default branch. To try changes to e2e.yml on a branch before it
is on main, add a temporary `push:` trigger limited to that branch. One
push registers it, and from then on `scripts/ci-e2e.sh --ref <branch>` runs
the branch's own e2e.yml. Remove the trigger before landing (job 27 did
this, DECISIONS job 27).

### Browsers and timings (job 28)

The e2e run has three Playwright projects: `chromium` (every spec but one),
`iphone` (WebKit as an iPhone 15, `tests/iphone.spec.ts`: the add field's tap
focus) and `webkit` (the timings). The web build is `--wasm`, so Chromium runs
the wasm app; `tests/wasm-boot.spec.ts` also boots the JS fallback. WebKit
runs on GitHub Actions only: it does not start on the Mac runner.

The timings (`tests/perf.spec.ts`, 4-5 min) run only when named:

```bash
scripts/ci-e2e.sh --no-db --spec tests/perf.spec.ts
```

Each build measured prints a `PERF {...}` line, and the job summary shows
them as a table: the time from navigation to the drawn list, and the frame
intervals while scrolling a 200-item list (DECISIONS job 28, 7).

## Landing a PR: one CI run

1. Push the branch once (`git push -u origin HEAD`), then `gh pr create`.
2. From then on, push with `scripts/push-pr.sh`. It rebases the branch onto
   `origin/main` and squashes it into the one commit `main` takes: subject
   `<PR title> (#n)`, the noreply author, the trailers. Then it pushes with
   `--force-with-lease`. It refuses `main`.
3. `scripts/merge-pr.sh --wait <n>` waits for `ci-ok` on that commit and
   rebase-merges it. No second squash, no second push, no second CI run.
   `--dry-run` runs every check and stops before the merge. `--wait` gives
   up after `MERGE_WAIT_MINUTES` (default 30) and exits 1, so a stuck run
   can't hold the merge lock. The value is a whole number of minutes, such as
   `MERGE_WAIT_MINUTES=10`. Anything else (`0.5`, `abc`) stops merge-pr.sh
   with exit 2 before it does anything.

The commit message is the PR as GitHub shows it: the title with ` (#n)` as
the subject and the PR description as the body. Messages of the branch's
working commits are dropped. After `gh pr edit <n> --body-file <file>`, run
`scripts/push-pr.sh` again: it re-squashes when the description changed, so
the commit on `main` carries the current one. merge-pr.sh refuses (exit 1)
a head whose message is not the current description, so a description
edited after the last push can't land stale. Trailers follow the body:

- `Co-authored-by` lines from the description and from the branch's commits,
  once each, in that order.
- `Co-authored-by: $MODEL_CO_AUTHOR` when that variable is set, as
  `MODEL_CO_AUTHOR="Claude Opus 5.5 <noreply@anthropic.com>"`. When unset,
  nothing is added. A value that is not `Name <email>` stops the push.
- Peter's trailer, always last.

`scripts/landing-test.sh` (run by the lint gate) covers these rules against
a scratch remote and a fake `gh`.

If `main` moved after your last push, the commit is no longer on top of
`main`. merge-pr.sh then stops and says so. Run `scripts/push-pr.sh` again
(one rebase, one push, one CI run), then merge-pr.sh.

A PR pushed with plain `git push` still lands the old way: merge-pr.sh
squashes it, force-pushes, exits 2, and merges when rerun after `ci-ok`. That
costs a second CI run. The pre-push hook (`.githooks/pre-push`) warns when a
PR branch goes up as several commits. Every worktree runs it, because
`core.hooksPath=.githooks` is in the shared repository config and resolves
against each worktree's root.

## Dependencies

`.github/dependabot.yml` opens grouped weekly PRs for GitHub Actions, pub
(`app/`) and npm (`e2e/`), labelled `dependencies` and `agent-ready`. Major
updates come in their own group. Renovate would also handle the Flutter,
Supabase CLI and gitleaks versions pinned in `ci.yml`, but it needs the
Renovate app installed on Peter's account.

## Measuring

`scripts/ci-timings.sh` prints per-job end times of recent successful runs,
counted from the run's start, and their median and range. With
`--steps <job>` it adds the median step durations of one job. Use it before
and after a CI change.

```bash
scripts/ci-timings.sh --limit 10 --steps e2e
scripts/ci-timings.sh --branch job/11-ci-flow --since 2026-10-24T18:00:00Z
```

## Measurements (job 11, October 2026)

Wall clock from the run's start to `ci-ok`, full runs (every gate), first
attempt only. Medians with the range over n runs, from `scripts/ci-timings.sh`.

| CI version | n | `ci-ok` | Limiter |
| --- | --- | --- | --- |
| Before: one job per tool group, sequential e2e setup | 15 | 6:10 (5:17-7:05) | e2e, ends at 6:05 |
| Gates, background stack start, ghcr.io images, Gradle/NDK cache | 5 | 5:44 (5:20-6:13) | e2e, ends at 5:38 |
| Plus web build during the stack start (dropped, see DECISIONS 11.11) | 5 | 5:59 (4:52-6:10) | e2e; Playwright on slow runners in 4 of 5 |
| Plus e2e in two shards | 5 | 4:38 (4:12-9:55) | e2e/ios; the 9:55 is a 6:37 apt download |
| Plus apt deps only when Chromium can't launch, no browser cache | 5 | 5:07 (4:26-5:30) | ios, ends at 5:03 (3:34-5:24) |
| Docs-only change | 1 | 0:27 | lint |

What a PR waits for now:

- A change touching `app/ios/`, `app/android/` or `app/pubspec.*` waits for
  ios-build, about 5 min (macOS runners vary from 3:34 to 5:24).
- Any other code change waits for the slower e2e shard. Derived, not
  measured as `ci-ok`: 4:26 median (4:18-4:40) is the end time of `e2e (2)`
  in the 5 full runs above. One real filtered run so far: Dependabot's npm
  PR (#33), `ci-ok` at 3:58.
- A docs-only change waits about 30 s.
- A change to the CI definition runs everything, like a push to `main`.
  After a cache key changes (a Flutter bump, a new NDK), the first run on
  `main` refills the Gradle and NDK cache. The first `main` run after this
  job's merge took 6:49, android 6:43 against ~2:45 once cached. Branch runs
  read `main`'s cache, so they pay this until that run has finished.

Merging costs one CI run instead of two: before, merge-pr.sh squashed and
pushed, and the merge waited for a second full run on identical content.

Playwright itself is the noise: a full run takes ~2.9 m or ~3.8 m depending
on the runner, and on a slow runner nearly every test is 1.3-1.5× slower.
