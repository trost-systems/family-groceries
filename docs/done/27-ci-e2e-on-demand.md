# Job 27: on-demand e2e on GitHub Actions

## What was built

- `.github/workflows/e2e.yml`: `workflow_dispatch` with `spec`, `shards`
  (auto/1/2), `db` (default on), `sync_smoke` (auto/true/false) and
  `request_id`, which goes into `run-name:`. Jobs: `plan` (shard list),
  `db` (scripts/gates/db.sh), `e2e` (matrix of shards, scripts/gates/e2e.sh
  with the spec). Concurrency per ref and spec, cancel-in-progress.
  Artifacts are `playwright-<shard>-attempt<n>` and
  `e2e-results-<shard>-attempt<n>`. Each e2e job writes a summary of
  passed, failed and flaky tests per spec.
- `.github/actions/{e2e-setup,e2e-report,db-setup}`: the steps ci.yml's e2e
  and db jobs ran, now shared by both workflows. ci.yml's jobs keep their
  names, matrix, gate lines, artifact names and `ci-ok`.
- `scripts/ci-e2e.sh`: refuses an unpushed ref, dispatches, finds its run by
  `request_id`, waits, prints per-job and per-shard results with the failed
  titles and the run URL, and downloads artifacts with `--download`. Exits 1
  on failure or when no test ran. Needs only gh, git and jq.
- `scripts/e2e-summary.sh`: Markdown or brief text from Playwright's JSON
  report (the CI reporter now also writes `e2e/playwright-results.json`).
- `scripts/check-gates.sh`: fails when e2e.yml and ci.yml drift (pins,
  actions, versions, gate scripts). `scripts/ci-changes.sh`: e2e.yml and
  ci-e2e.sh alone need only the lint gate; `.github/actions/` and
  e2e-summary.sh run everything.
- `scripts/gates/e2e.sh`: `FG_SYNC_SMOKE=1|0` overrides the sync smoke rule
  (unset: unchanged).
- Docs: docs/CI.md "On-demand e2e (job 27)", an AGENTS.md line, one line in
  the verify skill, DECISIONS job 27.

## How it was verified

A workflow only on a branch can't be dispatched until GitHub has registered
it. A temporary `push: branches: [job/27-ci-e2e-on-demand]` trigger
registered it with the first push; the next commit removed it, and every
later run was a real `scripts/ci-e2e.sh` dispatch (DECISIONS job 27, 10).

| Run | What | Result |
| --- | --- | --- |
| [40916209974](https://github.com/trost-systems/family-groceries/actions/runs/40916209974) | full suite (push trigger): db, 2 shards, fg sync smoke | green; db 2:27, shards 5:46 and 5:12 |
| [40916275286](https://github.com/trost-systems/family-groceries/actions/runs/40916275286) | `ci-e2e.sh --spec tests/stores.spec.ts --download …` | green, 1 shard, 3 passed; e2e job 3:08, 3:55 end to end incl. db |
| [40916458597](https://github.com/trost-systems/family-groceries/actions/runs/40916458597) | `ci-e2e.sh --spec tests/zz-job27-fail.spec.ts --no-db` (temporary spec, never on main) | failed as intended: exit 1, "FAILED zz-job27-fail.spec.ts: job 27: deliberately failing test"; failure logs, artifacts and summary uploaded |
| [40917549683](https://github.com/trost-systems/family-groceries/actions/runs/40917549683) | `scripts/ci-e2e.sh` (full suite) on the PR head c317a5c | green: 80 passed (40 + 40), 0 flaky; db 2:17, shards 5:38 / 4:58, 6:05 end to end |

Single spec vs full suite: one e2e runner instead of two, the e2e job 3:08 vs 5:38, and without the db job (`--no-db`) the failing-spec run took 2:20 for its e2e job. A `ci.yml` dispatch would also have run gitleaks, lint, site, functions, fg-cli, flutter, web-prod and both shards.

Locally (Mac, no Docker): actionlint, shellcheck (0.11 on the Mac flags
SC2218 in existing scripts too; CI's shellcheck doesn't), check-gates.sh
plus six drift mutations each caught, ci-changes on eight synthetic
changes, e2e-summary.sh on a real Playwright JSON report (pass, fail, flaky,
skip, "No tests found"), ci-e2e.sh argument and unpushed-ref refusals,
landing-test.sh, lint.sh. release/test.sh needs a real keytool, which the
Mac lacks, so it runs only on CI.

PR #91's ci.yml run: `ci-ok` green on a5b1070
([40919156529](https://github.com/trost-systems/family-groceries/actions/runs/40919156529)),
all gates, artifact names unchanged. After the review fixes, a stores spec
run on a5b1070 was green again
([40919155340](https://github.com/trost-systems/family-groceries/actions/runs/40919155340)).

Review (Sonnet): nothing must-fix. The should-fix items were all fixed:
transient gh errors in the poll, an unbounded wait, finding results whatever
gh's download layout, a clear message for a cancelled run, a summary that can
never fail a job, and the drift check now also compares action input names.


## Also: the dangling seed (lead's request on BOARD, 18:12)

`supabase/config.toml` named `./seed.sql` with the seed enabled since job 1, but the file never existed ("no files matched pattern: supabase/seed.sql" on every start and reset). The job-18 fixtures are the seed: reference data is in migrations (production has it too), and accounts and households come per run from `scripts/fg seed <scenario>`, which tears them down again. So `[db.seed] enabled = false`, with a comment; recorded as DECISIONS job 27, 11. This PR's CI (db + e2e, which `config.toml` triggers) proves nothing depended on it.

## Missing or blocked

Nothing. The temporary push trigger and failing spec are not on main.
