# Job 180: web production deploys unbroken (2026-11-11)

## Root cause

The `family-groceries` Vercel project's Ignored Build Step (a dashboard setting) ran
`git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- …`. Vercel clones 10 commits deep. The last
READY production build was `1f8e5edb` (2026-11-10 04:00 UTC), and `0873093e` was exactly 10 commits
past it. So the previous commit was not in the clone, and `git diff` exited 128 with
`fatal: bad object 1f8e5edb…`. Vercel builds on exit 1, skips on exit 0 and fails the deployment on
any other code. The release pushes of 0873093e, f8a19438 and 0286a194 all ended in ERROR before the
build. A failed deployment leaves the previous SHA where it was, so every later push failed the
same way.

## Fix

PR #364, merged as `c08a48b9`.

- `vercel.json` has `"ignoreCommand": "bash scripts/vercel-ignore.sh"`. It overrides the dashboard
  setting, so no project setting changed.
- `scripts/vercel-ignore.sh` keeps the old rules: only `release` builds, and only when the app paths
  changed. It builds when the previous commit is empty or missing from the clone, and skips only
  when `git diff` proves the paths unchanged.
- `scripts/vercel-ignore-test.sh` (lint gate) checks 13 cases in a 10-deep clone. Against the old
  one-liner it fails four of them with exit 128.
- Other projects were checked through the API: `hummlist-site` decides by branch name only,
  `hummlist-mcp` maps any git error to a build, and `hummlist-nexus` has no git link. No change.

## Production

- The Release run never moves `release` for a commit that leaves `app/` and `release.yml` unchanged,
  and #364 left them unchanged. So `release` was fast-forwarded by hand, per docs/DEPLOY.md, to
  `c08a48b9` (00:46 CET). Its `app/` and web build scripts are byte-identical to `0286a194`, the
  last store upload, so the web app still matches the store builds.
- Deployment `dpl_8wp1uaRHLk3UYisrN5X7iVYvKQ3Z`: READY, 00:50 CET on 2026-11-11. Its log reads
  `vercel-ignore: build, previous commit '1f8e5edb…' is not in the clone`.
- `app.snacklist.app` and `app.hummlist.com` serve it: `last-modified: Tue, 10 Nov 2026 23:50:06 GMT`,
  and `main.dart.js` sha256 changed from `699015b6…` to `a1bcfc3e…`.
- Pushes to `main` and job branches now log `vercel-ignore: skip, only release builds` and are
  canceled (exit 0), for example `dpl_6aQfVRLZkMF9w1FNxi76fzRzL8iL` for `c08a48b9` on `main`.

## Left open

- The dashboard still holds the old one-liner. It only runs for commits older than #364, which
  `release` never gets again unless someone pushes one by hand (docs/DEPLOY.md says how far back is
  safe). Clearing it is optional and needs a project-settings change, which this job was told not to
  make.
- PR #343 (docs/vercel-build-skips, open) documents the old one-liner and says a failing `git diff`
  builds, which is wrong. docs/DEPLOY.md on main now covers it, so #343 can be closed.
