# Nexus

Nexus is the control room for Snacklist engineering at `nexus.snacklist.app`. It shows one page with these
parts:

- **Summary row:** running jobs against lanes, the queue, items for the lead, merges in 7 days, the CI pass
  rate over 7 days, and Claude weekly usage against pace. Each tile links to its section.
- **Now:** the running jobs, each with its state, current step, step age, PR and CI result.
- **Waiting:** blocked and queued jobs, PRs that the lead merges, and open `docs/NEEDS_LEAD.md` items.
- **Shipped 7d:** merges per day, the median time from brief to merge, and the merged jobs.
- **Hill-climbs:** the baseline, the best kept score and the change for each `docs/hillclimb/hc-*.md` on main,
  with a sparkline of the kept steps.
- **Health:** hz lanes, load against cores, memory, disk, the Claude week, CI per day, the flaky issue trend,
  and review rounds before a PASS.

Click a job to open a drawer with its timeline: queued, each step with its duration, the review verdicts, and
the merge. On a phone the drawer fills the screen. Press Escape to close it, and focus returns to the job.

The site is static. A cron job on hz builds a snapshot and deploys it once a night, in the 03:00 hour
(Europe/Berlin). The page fetches `/data/snapshot.json` every 60 s while the tab is visible. The header says
how old the snapshot is and links the product feature map (`docs/PRODUCT_FEATURE_MAP.md` on GitHub, "Feature
map") and its living Page ("Living view"). After 25 hours (a missed night) the page shows a `stale` label and
dims. After 49 hours the label says `outdated`.

## Layout

| Path              | What it holds                                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/snapshot.ts` | The `Snapshot` type. It is the only contract between the pipeline and the page.                                                                                                                                                                                                     |
| `pipeline/`       | Builds the snapshot. `jobs.ts` holds the job state machine, `github.ts` the `gh` reader and parsers, `hillclimbs.ts` the hill-climb doc registry, `ops.ts` config, usage, host and NEEDS_LEAD, `series.ts` the daily and weekly series, `build.ts` the assembly, `main.ts` the CLI. |
| `web/`            | The page: `index.html`, `styles.css`, `main.ts` (fetch, poll, theme, drawer), `render.ts` (the sections), `charts.ts` (hand-rolled SVG), `format.ts`, `dom.ts`.                                                                                                                     |
| `scripts/`        | `publish.sh` builds and deploys, `cron.sh` is the hz cron entry, `setup-vercel.sh` is the one-time project setup, `serve.ts` is a local server with the production headers, `theme.ts` and `vercel-config.ts` are build helpers.                                                    |
| `test/`           | Deno tests. `fixtures/ops.ts` writes a fixture ops dir and a fake `gh`.                                                                                                                                                                                                             |

The page has no framework and no npm dependency. `publish.sh` bundles `web/main.ts` into one ES module with
`deno bundle --platform browser`. The charts are plain SVG and are drawn at the measured width of their
container. Every chart is a `<figure>` with a one-line takeaway and a `<details>` data table. Colour marks
state only, and every colour has a text label next to it. The hexagon markers use the 6b hex language.
Colours, type and spacing come from `site/public/tokens.css`. `scripts/theme.ts` derives `theme.css` from that
file, so the theme toggle can override `prefers-color-scheme`.

## Data pipeline

`pipeline/main.ts --ops <dir> --repo <dir> --out <file>` reads these sources:

| Source                                             | Read                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `~/groceries-ops/jobs/<id>/`                       | `status`, `branch`, `runner`, `pid`, `workdir`, `start_after`, the brief's mtime (queued at), `log` lines `[time TZ] step <name> start/ok` and `status=<x>`, and the last `VERDICT:` line of each `review.<N>.md`. |
| `~/groceries-ops/config.hz`, `config`              | `HZ_LANES` (hz lane capacity) and `MAX_PARALLEL` (box).                                                                                                                                                            |
| `~/groceries-ops/usage-feed.json`                  | `weekly_util` and `weekly_reset_epoch`. Pace is 0.95 times the elapsed part of the week.                                                                                                                           |
| `/proc`, `df`                                      | Cores, load average, memory and free disk on hz.                                                                                                                                                                   |
| `gh` (read-only, `trost-systems/family-groceries`) | PRs (`gh pr list`), `ci.yml` runs per UTC day for 15 days (GitHub caps a filtered list at 1000 runs), and issues labelled `flaky`.                                                                                 |
| The checkout's `docs/`                             | `NEEDS_LEAD.md` sections whose `Status` line does not say done, and `hillclimb/hc-*.md`.                                                                                                                           |

The job state is one state machine in `pipeline/jobs.ts` (`stateOf`):

- `running` or `review` is live (`building`, `reviewing` or `fixing`, from the last step in the log) while a
  `job-worker` runs the job. On hz, the job's `pid` must name a running `job-worker`. For box and mac the
  status is taken as it is. An hz job without a worker is `waiting` for a lane.
- `queued` is `queued`, or `waiting` while `start_after` is in the future. `waiting` stays `waiting`.
  `limit-blocked`, `failed` and `paused-*` are `blocked`.
- `done` and `moved-*` take their state from the PR: `merged`, `awaiting-merge` (open) or `closed`. Without a
  PR the state is `done`. `cancelled` stays `cancelled`.
- An open PR that is a draft, or whose title says "do not merge" or "not for merge" in any case, makes the job
  `parked` instead of `awaiting-merge` (hill-climbs, prototypes). `parsePulls` in `pipeline/github.ts` decides
  this once, as `notForMerge` on the parsed PR. Parked jobs are not in the lead's list.

A job's PR is the PR of its branch (`branch` file, default `job/<id>`). If no PR has that branch, the job
takes the newest PR of a branch that starts with `<branch>-`, with open PRs first. A PR's CI result is the
newest `ci.yml` run of its head branch that was not cancelled.

Only `review.<N>.md` counts as a review round. `review.<N>.pass.md` keeps a PASS that the lead later overrode,
and `review.<N>.lead-requeue.md` is the lead's note. Counting either one would count the round twice.

The snapshot holds every live, queued, waiting and blocked job, every job awaiting a merge or parked, and
every job that finished or merged in the last 7 days. Days are Europe/Berlin calendar days.

The hill-climb docs do not share one format for the baseline. Each doc therefore has an entry in
`pipeline/hillclimbs.ts` with the metric, the direction, a baseline pattern and, where needed, a score
pattern. The attempts table is shared, and its `score` and `kept` columns are found by name. A doc that drifts
from its entry fails `test/hillclimbs_test.ts`, which reads the real docs. A new `hc-*.md` on main without an
entry also fails that test. At runtime a doc that fails is left out with a warning on stderr.

## Privacy

The repository is public, and the page must stay harmless if it leaks. The snapshot holds only repo-level
facts: job ids, PR numbers, URLs and titles (already public), states, step names, timestamps, verdict counts,
CI results, issue counts, hill-climb numbers, host load, memory and disk, lane counts, and the Claude usage
fraction. It never holds brief, BOARD, review or log text, names, emails, list or user content, or env values.
A job's title is its PR title, or its slug made readable. A NEEDS_LEAD.md item shows its heading without the
remarks in parentheses, where headings name who approved what. `pipeline/main.ts` refuses to write a snapshot
that contains an email address.

The `Snapshot` type enforces this rule. The pipeline reads tokens and times from the ops files and drops the
prose. `test/build_test.ts` writes a person's name and email into the fixture briefs, BOARD.md, the reviews
and NEEDS_LEAD.md. It then asserts that none of them reaches the JSON and that every job has exactly the keys
of `Job`. Data never lands in git: the snapshot exists only in the deploy output, and `.vercel/` is ignored.

## Run it locally

```bash
cd nexus
NEXUS_OPS_DIR=~/groceries-ops scripts/publish.sh   # builds .vercel/output only, prints "skip deploy: no --deploy"
deno run --allow-net=127.0.0.1 --allow-read scripts/serve.ts 55690   # http://127.0.0.1:55690
```

`publish.sh` needs `gh` signed in (read-only) and Deno. `serve.ts` serves the output with the same CSP and
cache headers as production. To run the tests, use `scripts/verify.sh --only nexus` from the repo root, or
`deno test --allow-read --allow-write --allow-env` in `nexus/`.

## Deploy and setup

The Vercel project `hummlist-nexus` (it keeps its pre-Snacklist name) is not connected to git. The publisher
deploys prebuilt output (Build Output API v3: `.vercel/output/config.json` with the header routes, and the
files in `static/`) with `vercel deploy --prebuilt --prod`. The production domain `nexus.snacklist.app`
follows each deploy; the old `nexus.hummlist.com` is a 308 redirect to it.

- **Headers:** every response gets a strict CSP (`default-src 'none'`, `script-src 'self'`,
  `style-src 'self'`, `connect-src 'self'`, no inline script or style) and `X-Robots-Tag: noindex, nofollow`.
  `data/snapshot.json` is served with `Cache-Control: no-store`.
- **Protection:** Vercel Authentication on all deployments (`ssoProtection.deploymentType: "all"`). This
  option has been free on every plan since 2026-09-09.
- **One-time setup** (needs `VERCEL_TOKEN`, plus `VERCEL_ORG_ID`, the team id, for a team project):
  `scripts/setup-vercel.sh`. It creates the project if it is missing, adds the domain, keeps
  `nexus.hummlist.com` a 308 redirect to it and turns on the protection. It ends with a logged-out `curl` that
  must return 401 or a redirect to the Vercel login. Run it again at any time. It prints `VERCEL_PROJECT_ID`.
  DNS needs no record: snacklist.app and hummlist.com are on Vercel's nameservers with a wildcard, so the
  domain resolves as soon as the project holds it.
- **Publisher on hz:** a shallow clone at `~/nexus-publisher` and this crontab line (installed):

  ```text
  */10 * * * * { git -C $HOME/nexus-publisher fetch -q --depth 1 origin main && git -C $HOME/nexus-publisher reset -q --hard FETCH_HEAD && if [ -x $HOME/nexus-publisher/nexus/scripts/cron.sh ]; then $HOME/nexus-publisher/nexus/scripts/cron.sh; else echo "[$(date "+\%F \%T \%Z")] nexus: main has no nexus/ yet"; fi; } >> $HOME/nexus-publisher.log 2>&1
  ```

  The line moves the clone to main's head with a fetch and a hard reset (a `pull` refuses to fast-forward a
  depth-1 clone once main moved) and runs `cron.sh` once main has it. `cron.sh` runs under
  `flock -n /tmp/nexus-publish.lock`. It returns at once unless it is the 03:00 hour Europe/Berlin and no
  publish succeeded yet that day (stamp `~/.cache/nexus-last-publish`; `NEXUS_FORCE=1` publishes now), so the
  ticks every 10 minutes deploy at most once a night (Peter, 2026-11-10). Then it resets the clone to
  `origin/main` and runs `publish.sh --deploy`. Only `--deploy` deploys: without it `publish.sh` never reads
  the secrets. With it `publish.sh` reads `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from
  `~/.config/agents/nexus.env` (mode 600) for the deploy step only, and refuses to deploy unless the project's
  protection is `all`. Without that file, a `--deploy` run builds and prints `skip deploy: no VERCEL_TOKEN`.

## Cost

| Item                                                                                                    | Cost                             |
| ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Vercel project with one static deploy a night (was 144 a day; no git connection, so pushes never build) | €0, included in Pro              |
| Vercel Authentication on all deployments                                                                | €0 since 2026-09-09              |
| Bandwidth (one ~120 KB snapshot a minute per open tab)                                                  | €0, within the included transfer |
| Cron and build on hz (about 10 s a run)                                                                 | €0, existing host                |
| `gh` API calls (about 18 a run)                                                                         | €0, within the bot's rate limit  |
