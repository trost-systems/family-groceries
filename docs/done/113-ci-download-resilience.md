# DONE_SUMMARY: Job 113, CI tool downloads cached and retried (2026-11-05, Hetzner runner)

PR: https://github.com/trost-systems/family-groceries/pull/249 (ready for review, **not merged**; the lead merges). Fixes #246.

## What was built

- `scripts/ci/download.sh <url> <file>` is the one place for retry flags:
  `curl -fsSL --retry 7 --retry-all-errors --retry-max-time 300 --connect-timeout 30` plus a
  stall limit (`--speed-limit 1024 --speed-time 30`, review 0), curl's
  exponential backoff, always into a file (a retried transfer into a pipe duplicates bytes).
- `scripts/ci/install-tools.sh` installs the pinned gitleaks, actionlint, ast-grep and squawk from
  one table into `~/.cache/fg-ci-tools/bin`. A binary that already reports its pin is skipped.
  ci.yml's gitleaks and lint jobs cache that directory with `actions/cache`, keyed by tool versions.
- `.github/actions/deno` installs Deno itself (pins unchanged: lint's `.dvmrc` 2.9.8 through
  `deno-version-file`, `deno-version: v2.x` elsewhere) and falls back
  to `denoland/setup-deno` only when the version lookup fails, with a `::warning::`.
  `scripts/ci/deno-toolcache.sh resolve` picks the version setup-deno picks from the same
  `versions.json`. The release comes from `actions/cache`, or from `download.sh` checked against
  the release's `.sha256sum`, and goes on PATH (review 0: setup-deno's own versions.json fetch
  retries for only about 8 s). `supabase-deploy.yml` and `price-drift.yml` hold secrets and pass
  `cache: false` (addendum 1). All seven setup-deno uses
  moved (ci.yml lint, functions, fg-cli; db-setup; e2e-setup; price-drift; supabase-deploy).
- npm: `NPM_CONFIG_FETCH_RETRIES=5` (10 to 60 s backoff) in ci.yml and e2e.yml, which covers
  `npm ci` and the Supabase CLI package install in `supabase/setup-cli` (not its own `bun install`).
- apt: `-o Acquire::Retries=5` for pg_dump 17/age (`scripts/backup/install-tools.sh`) and ffmpeg;
  the PGDG key through `download.sh`.
- `scripts/ci/download-test.sh` (in the lint gate, 16 checks): a local server that answers 404,
  504, then 200 (download succeeds), stalls once then answers (retried within 15 s), and always
  504 (fails after exactly retries+1 requests); the Deno range resolution against a fixture with
  v3, rc and v1 entries, resolve failures, and a fake release with a matching and a wrong
  `.sha256sum`.
- Docs: `docs/CI.md` "Tool downloads", `docs/DECISIONS.md` "Job 113".

Unchanged: every version pin, `ci-ok`'s needs and rule, no `continue-on-error`, release.yml.
Left alone on purpose (DECISIONS job 113): Playwright browsers (5 tries over 3 CDN mirrors already;
the Actions cache is at its 10 GB limit), Flutter, gradle, NDK and bundler (cached already),
`bootstrap.sh` (local setup, not run by CI). Not covered: Docker image pulls in db and e2e,
setup-cli's own `bun install` (docs/CI.md "Tool downloads").

## Evidence (GitHub Actions)

- Cold run (first push): run 42006366666, ci-ok success. The lint job downloaded Deno 2.9.8 and
  saved `deno-2.9.8-Linux-X64`. The functions job restored it ("Using cached Deno installation").
- Cache-hit run (second push): run 42009253359. gitleaks restored `ci-tools-Linux-gitleaks-8.30.1`
  ("gitleaks 8.30.1: cached"). lint, db, functions and fg-cli restored `deno-2.9.8-Linux-X64` and
  downloaded no Deno.
- Retry test, same run: a temporary pin `ACTIONLINT_VERSION: 0.0.0-retry-test` (cache miss, 404 URL).
  curl tried 8 times at 10:17:55, :56, :58, 10:18:02, :10, :26, :58 and 10:20:03 (backoff 1 to 64 s),
  then exited 22, and the lint job and ci-ok failed. Reverted before ready.
- Head 8abef26f (review 0 input): ci-ok green, run 42012926242; its lint job restored all three
  tools and Deno from the cache.

## Review 0 fixes

- Must fix: a stalled download hung until the job timeout. `download.sh` now ends an attempt
  below 1 KB/s for 30 s and retries it. `download-test.sh` serves a stall, then an answer
  (passes in 13 s). With the stall flags removed, the test fails ("gives up on the stall within
  15 s").
- `--retry-all-errors` is pinned by the test: `/flaky` answers 404 first. With the flag removed,
  the test fails.
- `.github/actions/deno` no longer runs setup-deno when the range resolves, so dl.deno.land is
  fetched once, with `download.sh`'s retries. Locally: resolve, fetch, then `path` wrote the
  tool-cache dir and `~/.deno/bin` to `$GITHUB_PATH`.
- Docs: the npm env covers the CLI package install, not setup-cli's `bun install`; Docker image
  pulls are named as the uncovered residual (docs/CI.md "Tool downloads").

## Review 0 result

Head 4d4938f7: ci-ok green, run 42017364546. The Deno jobs restored deno-2.9.8-Linux-X64 and ran
`deno-toolcache.sh path` (no setup-deno).

## Addendum 1 fixes (lead)

- `.github/actions/deno` has a `cache` input (default `true`). `supabase-deploy.yml` and
  `price-drift.yml` pass `cache: false`: no restore or save, always a fresh download.
- `fetch` checks the zip against the release's `.sha256sum` and installs nothing on a mismatch.
  The test proves it, and with the comparison removed two checks fail.
- A failed resolve prints a `::warning::` and falls back to setup-deno. `resolve` now exits
  non-zero for an unsupported range, a missing major or an unreachable `versions.json`.
  Before, it printed nothing and exited 0.
- `deno-toolcache.sh` header matches the action; the duplicated arch mapping is gone.
- DECISIONS job 113 is numbered 1 to 6; the summaries no longer claim every download goes through
  `download.sh`.

## Addendum 1 result

Head e6b9510e: ci-ok green, run 42031402948. The `cache: false` path does not run on PRs; its
fetch and sha256 step was proven locally (a real 2.9.8 zip matched its `.sha256sum`;
download-test.sh covers a match and a mismatch).

## Review 2: rebase onto main

- #249 conflicted with main in `DONE_SUMMARY.md`, `docs/DECISIONS.md` and `scripts/gates/lint.sh`.
  All three were appends on both sides; both are kept (lint.sh keeps main's TypeScript lint pack
  and this PR's `scripts/ci` shellcheck and `download-test.sh`).
- Main's job 101 (#237) added `.dvmrc` (2.9.8) and gave the lint job's setup-deno
  `deno-version-file: .dvmrc`. The rebase put that input on `.github/actions/deno`, which did not
  have it, so actionlint failed. The action now takes `deno-version-file` (a `deno <version>` line,
  else the whole file, as setup-deno reads it) and passes it to the setup-deno fallback. `resolve`
  returns an exact version as is, with no network. download-test.sh: 16 checks, including that one.
  Locally, `.dvmrc` gives 2.9.8 and a `.tool-versions` sample gives its `deno` line.

## Review 2 result

Head ee307519 (rebased on aae7fb34): ci-ok green, run 42248190747. lint resolved 2.9.8 from
`.dvmrc` and restored it from the cache.

## Review 3 fixes

- The review 2 rebase had brought back main's old "Job 90 … not merged" section in
  `DONE_SUMMARY.md`. Main already records #220 as merged, so that section is dropped. The PR now
  adds only the Job 113 section there.
- The test count above reads 16, which matches `download-test.sh`.

## How to verify

```bash
scripts/ci/download-test.sh             # retry and fail-closed, Deno range resolution
scripts/gates/lint.sh                   # actionlint, shellcheck incl. scripts/ci, check-gates
```

## Missing or blocked

Nothing. The first run after a new Deno 2.x release downloads it once (with retries) and caches it.
