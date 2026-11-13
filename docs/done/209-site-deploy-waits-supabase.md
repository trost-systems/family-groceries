# Job 209: production site deploys wait for supabase-deploy (2026-11-13)

PR: https://github.com/trost-systems/snacklist/pull/404 (merged as 5fcad5bb)

## What changed

- **Mechanism.** The ignored build step of the Vercel project `hummlist-site` now does the wait. `site/vercel.json:4` sets `"ignoreCommand": "node scripts/supabase-gate.mjs"`, which overrides the dashboard's step and keeps its branch rule (only `main` builds).
- **Where it waits.** `site/scripts/supabase-gate.mjs:118` sleeps between polls. `decide()` at `site/scripts/supabase-gate.mjs:47` makes the call. The script polls GitHub every 30 s (longer when the rate limit asks) for at most 25 min, under Vercel's 45-min build limit.
- **Exit codes.** Exit 1 builds the site. Exit 2 covers a failed or cancelled run, a timeout and any error. The deployment then ends in ERROR and the last good site stays live.
- **How "no supabase-deploy for this SHA" is decided.** `planFromGit` lists the commits from `VERCEL_GIT_PREVIOUS_SHA` (the last successful production deployment) to this commit. When that SHA is not in the clone or not an ancestor, it takes this commit alone. It checks each commit's first-parent diff against `DEPLOY_PATHS`, the workflow's `on.push.paths`, kept equal by a test. If none matches, the site builds at once with no API call.
- **Which run counts.** When a commit matches, the newest matching commit's `event=push`, `branch=main` run decides. When this commit matches, only its own run counts. A run that hasn't been created yet is waited for. A rollback dispatch with `ref` is a `workflow_dispatch` run, so it never counts.
- **Beyond the brief's wording.** A site-only push waits for an earlier mixed push's run while that push's site is not live yet. It carries the same pages, so publishing it would put them ahead of the functions (DECISIONS, Job 209).
- **Why this mechanism.** The GitHub Actions `vercel deploy --prod` route needs a Vercel token in the repo secrets (`gh secret list` has none) and Vercel's git deploys switched off. Neither is done, and half of the switch would stop the site from deploying at all. The ignore step needs no secret and no dashboard change.
- **Also in the PR.** `scripts/push-pr.sh` now stops when the PR title or description holds a GitHub skip-CI marker. The first version of this PR's body quoted one, and GitHub ran no CI on the squashed commit.

Untouched: Vercel Deployment Protection, every domain, DNS entry, alias and redirect, and the supabase-deploy workflow and its order.

## Verification

- `site/test/supabase-gate.test.mjs` has 36 tests covering every edge case in the brief. They pass on Node 22 and 24. `scripts/verify.sh --only lint,site,changelog` passed.
- Dry runs against the real GitHub API, read-only:
  - a1f53b75 (a supabase push) exited 1 after its green run 43413029566.
  - b39430a6 (no deploy paths) exited 1 without calling GitHub.
  - 3900926c with previous `e5d43316^` exited 1 on a1f53b75's run.
- On the PR branch, Vercel's `hummlist-site` deployment shows "Canceled by Ignored Build Step". The old dashboard step also canceled non-main branches, so this doesn't prove the new gate ran.
- Sonnet reviews: review.0.md PASS (rate-limit backoff taken), review.1.md PASS (the title is now checked too).
- On main, 5fcad5bb (this PR, no deploy paths) deployed on `hummlist-site` about 17 s after the push. The `release` branch push of the same afternoon's Release run was "Canceled by Ignored Build Step", as intended.
- Not yet observed in Vercel: a real wait on a production build. The first `main` push that touches `supabase/**` will show it in the `hummlist-site` build log (`supabase-gate: wait: ...`, then `build: ... succeeded`).

## Ops

Nothing is required. Optional: if a build log shows `GitHub answered 403 (rate limit remaining 0 ...)`, add a read-only `GITHUB_ACTIONS_READ_TOKEN` (docs/NEEDS_PETER.md, "Job 209"). After a supabase-deploy rerun turns green, Redeploy the ERROR site deployment.

No user-facing change, no flag, no TestFlight relevance (Changelog: none).
