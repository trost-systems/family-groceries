# Job 11: one CI run per merge, one gate definition, measured CI speedups (2026-10-24/25)

PR: https://github.com/trost-systems/family-groceries/pull/20 (branch
`job/11-ci-flow`). How CI works now: [`docs/CI.md`](../CI.md). Decisions:
`docs/DECISIONS.md` 11.1-11.12.

## What was built

- **One gate definition.** Every CI job installs its tools and runs one
  `scripts/gates/<gate>.sh`: gitleaks, lint, db, functions, fg-cli, flutter,
  web-prod, e2e, fastlane, android, ios. `scripts/verify.sh` runs the same
  scripts (`--only <gate>`, `--skip-e2e`, `-- <playwright args>`); android
  and ios stay CI-only. `scripts/check-gates.sh` (in the lint gate) fails
  when a gate lacks its CI job, its `ci-ok` need, its `verify.sh` entry or
  its executable bit, or when `ci.yml`/`verify.sh` run a check themselves.
  The local run gained the production web build, the fastlane parse and an
  explicit `--fatal-infos`.
- **Lint gate:** actionlint, shellcheck (`.shellcheckrc`), `tsc --noEmit` for
  `e2e/` (TypeScript added to its devDependencies), check-gates, then
  `scripts/lint.sh` (job 12's rules). The CI job installs job 12's ast-grep
  and squawk too.
- **One CI run per merge.** `scripts/push-pr.sh` rebases the PR branch onto
  `origin/main` (carrying skip-worktree port blocks across), squashes it into
  `<PR title> (#n)` with the noreply author and trailers, and pushes with
  `--force-with-lease`; never `main`. `scripts/merge-pr.sh` then only checks
  `ci-ok` (`--wait` to wait, `--dry-run` to stop before the merge) and keeps
  its old squash-and-exit-2 path for PRs pushed the old way. Shared code is in
  `scripts/lib.sh`. `.githooks/pre-push` warns on multi-commit PR branches in
  every worktree.
- **Box-wide e2e lock.** The e2e gate holds `flock /tmp/fg-e2e.lock` from
  stack start through Playwright and records its checkout; a second run says
  so and waits.
- **Faster CI** (measured, below): two e2e shards, the stack started in the
  background, images from ghcr.io, Gradle and NDK caches, apt deps for
  Playwright only when Chromium can't launch, `timeout-minutes` on every job,
  path filters (`scripts/ci-changes.sh`: docs-only skips the heavy gates,
  native builds only for `app/ios`, `app/android`, pubspec, fastlane only
  for its files; a change to the CI definition runs everything).
- **Measuring:** `scripts/ci-timings.sh` (per-job end times, medians and
  ranges, step medians), `workflow_dispatch` on `ci.yml` for repeat runs.
- **Dependabot:** `.github/dependabot.yml`, grouped weekly PRs for GitHub
  Actions, pub and npm, labels `dependencies` and `agent-ready` (created).
- **Fixed on the way:** `supabase_up` treated a database-only stack as
  running; `bootstrap.sh` installs Ruby, Bundler, shellcheck and actionlint
  (rerun on the rebuilt box, exit 0).

## Measurements

`ci-ok` wall clock, full runs, median (range, n):

| CI version | n | `ci-ok` |
| --- | --- | --- |
| Before (old `ci.yml`) | 15 | 6:10 (5:17-7:05) |
| Gates, background stack, ghcr.io, Gradle/NDK cache | 5 | 5:44 (5:20-6:13) |
| Plus web build during stack start (dropped: 9 s) | 5 | 5:59 (4:52-6:10) |
| Plus two e2e shards | 5 | 4:38 (4:12-9:55) |
| Final: plus apt deps only on demand, no browser cache | 5 | 5:07 (4:26-5:30) |
| Docs-only change | 1 | 0:27 |

The limiter moved from e2e (6:05) to ios-build (5:03 median, macOS runners
3:34-5:24). With the native filter, a PR that doesn't touch `app/ios`,
`app/android` or pubspec waits for the slower e2e shard: 4:26 (4:18-4:40).
A merge now waits for one CI run instead of two.

## How to verify

```bash
scripts/verify.sh                                   # every local gate
scripts/verify.sh --only lint                       # actionlint, shellcheck, tsc, check-gates, lint.sh
scripts/ci-timings.sh --branch job/11-ci-flow --since 2026-10-24T20:44:00Z
```

Screenshots of each acceptance check are in `docs/screenshots/11/`:
`push-pr.png` (3 commits become one, one CI run, `merge-pr.sh --dry-run`
would merge; PR #32 closed), `docs-only.png` (PR #23: heavy gates skipped,
`ci-ok` green in 27 s), `info-lint.png` (an info-level finding fails the
flutter gate), `lock-wait.png` (a second e2e waits on the lock),
`check-gates.png` (drift fails the lint gate), `timings.png`.

## Test results

- CI on PR #20 green, plus 5 green dispatched full runs of the final
  `ci.yml` (40131129356, 40131484389, 40135025214, 40135584214,
  40139443733).
- Local: 5 full runs on the box (one full `verify.sh`, four e2e gate runs),
  66/66 Playwright each; results in the PR.
- actionlint, shellcheck, `tsc --noEmit` and check-gates clean (lint gate).

## Open or for Peter

- Renovate would also update the versions pinned in `ci.yml` (Flutter,
  Supabase CLI, gitleaks, actionlint, ast-grep, squawk); it needs the
  Renovate app installed on Peter's account. Optional; Dependabot covers
  Actions, pub and npm.
- PR #31 (branch `probe/11-push-pr`) was opened by someone outside this job
  with this job's content; left for its owner to close.
