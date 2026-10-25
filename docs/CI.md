# CI

`.github/workflows/ci.yml` runs on every PR, on every push to `main` and on
demand (`gh workflow run ci.yml --ref <branch>`). `ci-ok` is the one check a
merge waits for (`scripts/merge-pr.sh`).

## Gates

Each CI job installs its tools and runs one script in `scripts/gates/`.
`scripts/verify.sh` runs the same scripts locally, so a local run and CI check
the same things.

| Gate | What it checks | Runs locally |
| --- | --- | --- |
| `gitleaks` | No secret in the history or the working tree | yes |
| `lint` | actionlint, shellcheck, `tsc --noEmit` for `e2e/`, `scripts/check-gates.sh`, `scripts/lint.sh` | yes |
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
`verify.sh` directly.

In CI the e2e job runs as two shards (`--shard=1/2`, `--shard=2/2`), each on
its own runner with its own stack, because Playwright is the longest step.
Each shard starts the Supabase stack in the background before installing
Flutter and Playwright; the gate's `supabase_up` (`scripts/lib.sh`) waits on
the same per-project lock and reuses the stack. CI pulls the Supabase images
from ghcr.io (`SUPABASE_INTERNAL_IMAGE_REGISTRY`): the default registry
rate-limits runners and cost about 14 s of retries per run.

The e2e gate takes the box-wide lock `/tmp/fg-e2e.lock`, held from stack start
through Playwright. A second run prints the last holder that recorded itself
in the lock file and waits. Anything else that runs Playwright on the box can
take the same lock with `flock /tmp/fg-e2e.lock <command>`. The kernel
releases the lock when the holder exits, however it exits.

## Which gates a PR runs

The `changes` job (`scripts/ci-changes.sh`) reads the PR's changed files:

- Only `docs/` and Markdown changed (the verify skill's files under
  `.cursor/` and `.claude/` count as code): only `gitleaks` and `lint` run.
- `android` and `ios` run when `app/ios/`, `app/android/` or `app/pubspec.*`
  changed. They compile the app's Swift and Kotlin and the plugin registrant
  generated from pubspec. A Dart change in `app/lib/` is compiled by the
  flutter, web-prod and e2e gates already.
- `fastlane` runs when `app/fastlane/` or `app/Gemfile*` changed.
- A change to `ci.yml`, `scripts/ci-changes.sh`, `scripts/lib.sh` or
  `scripts/gates/` runs everything, and so does a push to `main` or a manual
  run.

A skipped job counts as passed for `ci-ok`. A failed or cancelled one fails
it.

## Landing a PR: one CI run

1. Push the branch once (`git push -u origin HEAD`), then `gh pr create`.
2. From then on, push with `scripts/push-pr.sh`. It rebases the branch onto
   `origin/main` and squashes it into the one commit `main` takes: subject
   `<PR title> (#n)`, the noreply author, the trailers. Then it pushes with
   `--force-with-lease`. It refuses `main`.
3. `scripts/merge-pr.sh --wait <n>` waits for `ci-ok` on that commit and
   rebase-merges it. No second squash, no second push, no second CI run.
   `--dry-run` runs every check and stops before the merge.

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
- Any other code change waits for the slower e2e shard: 4:26 median
  (4:18-4:40), the same runs' end time for `e2e (2)`.
- A docs-only change waits about 30 s.

Merging costs one CI run instead of two: before, merge-pr.sh squashed and
pushed, and the merge waited for a second full run on identical content.

Playwright itself is the noise: a full run takes ~2.9 m or ~3.8 m depending
on the runner, and on a slow runner nearly every test is 1.3-1.5× slower.
