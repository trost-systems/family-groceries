# Job 219: verification tooling (2026-11-14)

PRs, one commit each on main:

- https://github.com/trost-systems/snacklist/pull/420 (merged as `86d5d8c5`)
- https://github.com/trost-systems/snacklist/pull/423 (merged as `31a0de87`)
- https://github.com/trost-systems/snacklist/pull/441 (merged as `868340c2`)
- https://github.com/trost-systems/snacklist/pull/439 (merged as `7c3e2faf`)
- https://github.com/trost-systems/snacklist/pull/440 (merged as `f80960a7`)
- https://github.com/trost-systems/snacklist/pull/442 (merged as `789ffd6a`)
- https://github.com/trost-systems/snacklist/pull/445 (merged as `78659c8f`)
- https://github.com/trost-systems/snacklist/pull/451 (merged as `43453367`)

This file, the hill-climb section and the lead's points came in a ninth PR, docs only. It also
says in `AGENTS.md` and `docs/CI.md` when a land needs `MERGE_WAIT_MINUTES=45`.

The numbers, the baseline and the cost are in
[`docs/hillclimb/fable-improvement-2026-11.md`](../hillclimb/fable-improvement-2026-11.md),
section "Job 219". The decisions are in `docs/DECISIONS.md`, "Job 219".

## What changed

- **`scripts/verify.sh` says what happened (#420).** Its last line is the verdict in plain text:
  `[verify] passed: <gates>` or `[verify] FAILED: <gate> (exit n) after s s; its output: <file>`.
  Each gate run's output is kept in its own file. Each gate is timed, with the wait for the e2e
  lock set apart. A ledger (`--history`) keeps every run, and a note names a gate that gave both
  results on the same files or failed three runs in a row.
- **A failed e2e job in CI keeps the stack's logs (#423).** Every container's log, with
  timestamps, is in the `e2e-results` artifact. `scripts/ci-timings.sh --steps e2e` finds the
  shards.
- **The gates that run Flutter require CI's version (#439).** They stop with the fix named
  (`scripts/install-flutter.sh`) on any other. The schema check no longer reports a migration
  that main gained after the branch left it as deleted: it passes with a note to rebase.
- **The MCP hang in e2e is fixed at its cause (#440).** A function behind `withTelemetry` reads
  the request's body before it answers, so the edge runtime no longer drops an early answer. The
  MCP specs' requests fail after 15 s with the request named.
- **Five e2e tests wait until the server took a tick before they reload (#441).** `tickSaved` in
  `e2e/tests/helpers.ts`.
- **The e2e gate resets a stale stack (#442).** When a running local stack's applied migrations
  are not the checkout's, the gate resets its database before the web build, as the db gate
  does.
- **Recipes for failures seen before (#445).** A failed gate's verdict names the recipe whose
  signal its output matches (`seen before? <file>`). Recipes are files in
  `.cursor/skills/verify-snacklist/recipes/`, each with its condition, mechanism, what to do and
  not to do, and the evidence. The first is the fake sign-in provider that the Hetzner runner's
  containers cannot reach. The skill has a "Gates" section for the loop after an edit.
- **The fg-cli gate no longer ends other processes (#451).** One of its tests cleaned up with
  `pkill -f '^sleep 20$'`, which ended every `sleep 20` on the machine. `merge-pr.sh --wait` polls
  with `sleep 20`, so a gate run in one checkout ended a land that waited for CI in another
  ("Terminated", exit 143). The test now ends the pid its own shell wrote down, and a bystander
  `sleep 20` must outlive it. `merge-pr.sh --wait` goes on when a signal ends only its sleep (up to
  20 times per wait) and logs it, so a land is safe even while other checkouts still run the old
  test.

No gate was weakened, skipped or given a retry. No user-facing change, no flag, no migration.

## Verification

- Each PR: a test in a gate for the new behavior, a `claude-fable-5-2` review that ended in PASS
  (38 rounds over the eight PRs, each FAIL on a measured defect or on a sentence of the PR
  that claimed more than its test pinned), and `ci-ok` green on the merged commit.
- Mutants: the reviews and the author ran mutants of each changed script against its test; every
  survivor either got a test or is named in its PR as not pinned.
- Measured before and after, on the runner or from CI's artifacts: the table in the hill-climb
  section. In short: a lost early answer went from about a third of 150 POSTs to 0 of 150 on each
  of three functions; the two MCP tests passed 30 of 30 on one core; a stale stack costs a
  reset (38 s against 19 s with a warm web build) and no longer a failed suite; the
  tick-and-reload specs passed 54 of 54.
- Not measured yet: CI's failure rates after these PRs. They reached main on 14 November, and a
  rate needs a week of runs.
- Cost of the job's own tests: the lint gate is 23 to 30 s slower on the runner (79 to 86 s
  before, 108.5 to 108.6 s after; three alternating rounds of `scripts/gates/lint.sh`).

## Ops

- Nothing to deploy and nothing to configure. #440 changes edge functions' request handling; the
  `supabase-deploy` run of its merge deployed them, and its "Smoke test" step
  (`scripts/smoke-remote.sh`) passed (run 43586820148).
- On the Hetzner runner, `~/flutter` is still 3.47.8. The Flutter gates now find
  `~/flutter-3.50.0` by themselves or stop with the fix named; nobody has to export
  `FLUTTER_DIR`.
- Port block 619xx is free again; the job's stack is stopped.
- A checkout that does not have #451 still carries the fg-cli test's kill by name until it is
  rebased: its fg-cli gate ends every `sleep 20` on the machine. A land is safe from that since
  #451 (`merge-pr.sh` logs "the wait's sleep was ended by a signal" and waits on); a land that
  ended with "Terminated" after "waiting for ci-ok" before it lost only its turn.
- Open points for the lead are in `docs/NEEDS_LEAD.md`, "Job 219".
