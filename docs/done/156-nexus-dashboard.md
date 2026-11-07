# Job 156: nexus.hummlist.com, the ops control room

## What was built

- **`nexus/`**: a one-page ops dashboard. A summary row has six tiles: running out of lanes,
  queued, needs lead, merged in 7 days, CI pass rate over 7 days, and Claude weekly use against
  pace. Below it are five sections. Now covers running jobs with their step, step age, PR and CI.
  Waiting covers queued, blocked, awaiting merge, open `NEEDS_LEAD.md` items and parked drafts.
  Shipped 7d has merges per day and the median time from brief to merge. Hill-climbs shows
  baseline to best with a sparkline per doc. Health covers hz lanes, load, memory and disk, CI
  runs per day, the flaky-issue trend and review rounds before PASS. Clicking a job opens a
  drawer (a full-screen sheet on the phone) with its step timeline, review verdicts and PR. Light
  and dark themes use the Hummlist tokens, the layout drops to one column on the phone, every
  chart has a data table, and the page runs under a strict CSP with no inline script. It shows
  "updated N min ago" and marks the data stale after 30 min.
- **Pipeline**: `nexus/pipeline/` (Deno, typed by `nexus/src/snapshot.ts`) reads the hz ops
  mirror (job status, logs, review verdicts, `config.hz`, `usage-feed.json`, `/proc`), `gh`
  (PRs, ci.yml runs, `flaky` issues) and `docs/hillclimb/hc-*.md` on main. It writes
  `data/snapshot.json`, which holds only repo-level facts and no names or free text. A test and
  a runtime email guard enforce that. `nexus/scripts/publish.sh` builds Build Output API v3 files
  and deploys them with `vercel deploy --prebuilt --prod` when a token is present.
  `nexus/scripts/cron.sh` runs every 10 minutes from the hz crontab in a clone that follows main
  (`~/nexus-publisher`, installed).
- **Gate**: `scripts/gates/nexus.sh` (fmt, lint, check, 31 tests, bundle), CI job `nexus` in `ci-ok`.
- **Phase 0**: `~/groceries-ops/reading/nexus-research.md` covers dashboard principles and
  charting libraries. It recommends hand-rolled SVG here and fl_chart for the Flutter app.

## Verify

- `scripts/verify.sh --only lint,nexus` passes.
- `nexus/scripts/publish.sh` builds from the real ops dir and prints `skip deploy: no --deploy`; only
  `publish.sh --deploy` (the cron, or a deliberate by-hand deploy) deploys.
- `cd nexus && deno run --allow-net=127.0.0.1 --allow-read scripts/serve.ts 55690` serves the
  page. `node nexus/scripts/screenshots.mjs docs/screenshots/156` retakes the screenshots and
  checks for console errors and that focus returns after Escape.
- `cron.sh` was dry-run against a scratch origin: it fetched, reset, built and skipped the deploy.

## Screenshots

`docs/screenshots/156/`: desktop-light, desktop-dark, desktop-light-drawer, phone-light,
phone-dark and phone-dark-drawer.

## Missing or blocked

- **Live since 2026-11-07** at `https://nexus.hummlist.com`, behind Vercel Authentication (a
  logged-out request gets a 302 to the Vercel login). The first deploy came from the PR worktree.
  The hz cron takes over once this PR is on main: until then main has no `nexus/` and the cron
  only moves its clone.
- **Box health.** Only the hz host is measured. The box sleeps most of each hour and its
  `hz-status.json` stays on the box. Box and Mac jobs still show through the job mirror.
