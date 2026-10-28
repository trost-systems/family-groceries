# Job 18: test fixtures and multi-client sync capture

Peter asked for an easy way to seed test accounts in interesting states,
clean them up again, and test sync across two or three devices, with
screenshots and videos taken automatically because agents are too slow to
trigger them by hand. Both now live in the existing verification CLI,
`scripts/fg`. The full guide is [docs/TEST_FIXTURES.md](../TEST_FIXTURES.md).

## What was built

- **Scenarios** in `test/fixtures/scenarios/*.yaml`, validated by
  `test/fixtures/scenario.schema.json`. Errors name the field
  (`households[0].items[3].store: no store "Aldi"`). Seven ship:
  `empty-new-user`, `solo-long-list` (64 items), `household-3-mid-shop`,
  `heavy-history` (8 weeks of trips, usuals and due items), `many-stores`
  (10 stores), `edge-cases` (120-character name, emoji, umlauts, duplicates,
  DE and EN users) and `pending-invite`. Times are relative ("-3d 18:10"),
  so scenarios never go stale.
- **`fg scenario list|show`, `fg seed <scenario>`, `fg runs`,
  `fg teardown <run>|--stale|--all`** (`cli/scenario.ts`, `cli/fixtures.ts`,
  `cli/fixture_commands.ts`, `cli/target.ts`).
  - Seeding never resets the database. Plain `fg seed` still resets to
    peter + lea.
  - Users come from the auth admin API, so no mail is sent. Their emails
    look like `<handle>.<run>@fg-test.invalid` and carry
    `app_metadata.fg_run`.
  - Data goes through the app's own RPCs and each member's own session, so
    the classifier, history and item→store memory come from the real
    triggers. The service role only backdates times.
  - After seeding, the result is checked through RLS: counts, members,
    usuals and due items via `suggest_items`, and that no member sees
    another household.
  - Passwords exist only in the run manifest (mode 600).
  - Teardown uses `delete_account`, finds runs whose manifest was lost by
    their email domain, is idempotent, and ends with a 16-table leftover
    check.
- **Member refs** (`cli/members.ts`): `--as`, `fg peer`, `fg login`,
  `fg mail --to`, `fg up --clients` and `--client` take `<run>:<handle>`,
  or a bare handle of the last run seeded.
- **`fg sync <scenario> --clients 2|3 --script <file>`** (`cli/sync.ts`,
  `cli/sync_dsl.ts`, `e2e/sync/engine.mjs`).
  - Opens one Chromium with one context per member, each signed in through
    the login screen.
  - Script steps: `add`, `tick`, `edit`, `delete`, `store`,
    `offline`/`online`, `reload`, `expect see|gone|text … within`, `wait`,
    `screenshot`.
  - A MutationObserver on Flutter's semantics tree triggers a screenshot of
    every client whenever any screen changes. Every step also gets a frame.
    Frames are composited side by side with labels and times.
  - Records one video per client and a composite video.
  - Reports latency per client from the server ack, from the input, and
    from `item_events`, with catch-up after a reconnect reported apart.
  - Writes `index.md` and `index.html`.
  - Holds `/tmp/fg-e2e.lock`, reusing it when a parent process already
    holds it, and tears down the run it seeded.
- **Hosted target** (`--target hosted`): test accounts only. The service
  key is fetched per run through the Management API and kept in memory.
  Teardown runs on failure and on Ctrl-C, and non-test counts are compared
  before and after (counts only).
- **CI.** The db gate runs the fixtures integration test, and the e2e gate
  (shard 1) runs a two-client `fg sync` smoke test (`e2e/sync-smoke.sh`).
  `scripts/lib.sh` gained `fg_on_repo_stack`, and ci.yml gained setup-deno
  for those two jobs.
- **Docs.** `docs/TEST_FIXTURES.md`, the SKILL.md "Fixtures" and
  "Multi-client sync" sections, `features/README.md`,
  `features/live-sync.md` (where `sync-reconnect` is now drivable on web),
  AGENTS.md, README, and DECISIONS "Job 18" (18.1 to 18.15).

## How to verify

```bash
export FG_PORT_PREFIX=560
scripts/fg up --only stack
.cursor/skills/verify-family-groceries/journeys/fixtures-acceptance.sh     # PASS
scripts/fg sync household-3-mid-shop --clients 3 --script .cursor/skills/verify-family-groceries/journeys/sync-3-clients.fgs
scripts/fg sync household-3-mid-shop --clients 2 --script .cursor/skills/verify-family-groceries/journeys/sync-failing-expectation.fgs   # exit 1
scripts/fg sync empty-new-user --clients 1 --target hosted --script .cursor/skills/verify-family-groceries/journeys/hosted-signin.fgs
e2e/sync-smoke.sh
(cd .cursor/skills/verify-family-groceries/cli && deno test -A && FG_INTEGRATION=1 deno test -A fixtures_integration_test.ts)
```

## Results

- **Fixtures** ([fixtures-acceptance.txt](../screenshots/18/fixtures-acceptance.txt)):
  - All 7 scenarios seed in 0.2 to 1 s and pass all their checks.
  - Two runs coexist. Mia sees her 30 rows and none of `heavy-history`'s
    113; Jo sees none of hers.
  - Every teardown leaves all 16 leftover counts at zero, and a second call
    returns `alreadyClean`.
  - A run whose manifest was deleted is listed as orphaned and removed by
    `teardown --stale`.
  - No seeded password appears in any output, and manifests are mode 600.
- **Three clients** (`household-3-mid-shop --clients 3`: add, tick, edit, B
  offline, tick while offline, B online): passes with 40 frames, 23 of them
  on observed changes, three per-client videos, a composite video and
  `index.html`.
  - Live latency p50 is 202 ms from ack, max 246 ms (7 observations).
  - Catch-up after the reconnect takes about 3.1 s from the input.
  - Across all runs, live p50 from ack ranged from 93 to 290 ms.
- **Deliberate failure**: exit 1, code `sync_failed`. The failure frame
  shows B with "Zimt" but no "Zimtschnecken", and `error.failureFrames`
  lists the frames around it.
- **Hosted round trip**: seed, sign-in through the web app (welcome
  screen), teardown with 0 leftovers. Non-test counts were unchanged
  (1 user, 1 household, 3 items, 7 events, before and after), and
  `fg runs --target hosted` shows 0 runs.
- **Linux surface**: `fg up --clients lx1:mia`, then `fg login lx1:mia`,
  then `fg type … --client mia` adds an item that `fg peer lx1:ida` sees.
  `fg doctor` stayed healthy.
- **Measurements behind the design**, each on alternating runs:
  - The WebSocket relay that lets `offline` close the socket adds no
    measurable latency (p50 288 and 290 ms with it, 307 and 304 ms
    without).
  - Change capture does not slow what it measures (218 and 223 ms on, 315
    and 318 ms off).
  - Chromium's offline mode alone keeps an open WebSocket alive and flushes
    it on `online`, which is why `offline` also closes the socket.
- **Tests**: 43 unit tests pass, plus the 2 integration tests (they run in
  the db gate). An independent review found 8 bugs, including a Ctrl-C race
  on hosted seeding and a household-delete race with a joining non-test
  user. All 8 are fixed (DECISIONS 18.5).

## Screenshots

- `docs/screenshots/18/1-sync-3-clients-change-frame.png`: a change frame,
  all three clients captured the moment B saw Hafermilch.
- `2-sync-index-html.png`: the run's index.html.
- `3-sync-failing-expectation.png`: the failure frame.
- `4-hosted-signin-welcome.png`: a hosted test account signed in.
- `5-linux-client-as-fixture-member.png`: the Linux debug app as `lx1:mia`.
- `sync-3-clients-composite.webm` (300 KB): the composite video.
- Seed and teardown JSON: `seed-heavy-history.json`,
  `teardown-heavy-history.json`, `teardown-again.json`, `hosted-*.json`.

## Not done, and why

- A native `--surface linux` driver for `fg sync`. Three Linux debug
  clients (about 650 MB each) plus the stack do not fit next to the other
  jobs on this 16 GB box. The script language is surface-agnostic, and
  docs/TEST_FIXTURES.md ("Other surfaces") maps each step to Marionette for
  a phone or Firebase Test Lab driver (job 06). Single fixture members
  already run on the Linux surface.
- Scenario fields for job 15 (`brand`, `properties`, `walkOrder`) are in
  the schema and feature-detected (`needs_column` until the columns exist).
  No shipped scenario uses them yet; job 15–17 add them when the columns
  land.

## Review 0 fixes

The reviewer found three must-fix gaps, all about leaving a seeded run behind when `fg sync` or
`fg seed` is stopped. All three are fixed (DECISIONS 18.12, 18.16).

- **Lock before seed.** `fg sync` checks the script, builds the web app, takes `/tmp/fg-e2e.lock`
  and only then seeds, so no run (hosted ones included) waits idle for the lock. A stop or kill
  while waiting leaves nothing.
- **Every stop is honoured.** SIGINT, SIGTERM and SIGHUP abort one AbortSignal that reaches every
  slow step: seeding stops at its next request, and the lock wait, the web build and the browser
  driver are child processes started with it, so they die at once. The web server, the lock and
  the config file are released while the command unwinds; then a run it seeded is torn down, and
  fg prints its JSON error (`interrupted`, with `signal` and `tornDown`) and exits 130/143/129.
  A failed or stopped seed is torn down on both targets. Only SIGKILL skips the teardown; `fg runs`
  and `fg teardown --stale` cover that.
- **Two more gaps found while proving it.** (a) A SIGTERM during the browser run first took 116 s
  to exit: the killed driver's Chromium kept its pipes open and fg waited for them. `fg` now waits
  for a stopped process, not its children's pipes, and the driver closes its browser on SIGTERM.
  (b) A hosted seed hung for an hour on one Supabase request that never answered, and a SIGTERM
  could not end it (it also held the e2e lock). Every Supabase request now times out after 30 s
  (`api_timeout`), and seeding requests end at once on a stop. The hung run had created nothing
  (`fg runs --target hosted`: 0).
- **Nice to have, also done.** `port_taken` names the process on the port and reclaims an orphaned
  `serve.mjs` on the instance's own port (the reviewer's blocker). A teardown dry run of a gone run
  says "nothing to delete". The index.html video has a poster. The PR images point at `main`.

Verified:

- `cancel_test.ts` (12 tests): each signal aborts the work, tears down, and fails with its exit
  code; no teardown before a seed; failure tears down; a second signal is ignored; a process run
  with the signal is killed, also when its children hold its pipes; the e2e lock wait ends at once
  and leaves no waiting `flock`; a hung Supabase request ends on a stop and times out without one.
  56 unit tests pass.
- Live, local: SIGTERM while waiting for a held lock exits 143 in milliseconds, nothing seeded, no
  `flock` left; SIGINT the same with 130; SIGHUP during `fg seed heavy-history` exits 129 and the
  half-seeded run is torn down (0 test users left).
- Live, hosted: SIGTERM while the browser runs (`fg sync empty-new-user --target hosted`) exits
  143, the test account is torn down in the real project, `fg runs --target hosted` shows 0, the
  web server and the driver are gone.
- `e2e/sync-smoke.sh` (CI e2e shard 1) now also sends a real SIGTERM in the lock wait and in the
  browser run and checks exit 143, no run left, the port free and no driver running.

## Job 18b: the flakes the 5-green found

PR #35 had passed review 1 but kept failing its 5-green on the box. Each failure was matched
against mem-guard's once-a-minute samples (DECISIONS 18.17).

| Failure | Cause | Fix |
| --- | --- | --- |
| `list_cubit_test` "an add by an unknown member reloads the catalog" (Expected 'Ana', Actual null) | The test waited 300 ms of wall time for the cubit's 200 ms reload. After a stall both timers come due together, and flutter_tester runs them back to back before any microtask, so the test resumed mid-reload. The same pattern was in six more cubit tests. | `elapse()` waits, then drains the event queue. Proven by a stall injected after both timers exist: the old test fails with the CI error, the new one passes. |
| list:53, offline-start:30 (3×) and :84, voice:27 (29.6 min), live-sync:171, stores:113 | VM freezes of 182 s to 30 min. Two (182 s, 239 s) were shorter than the runner's 300 s freeze threshold, so they were counted as flakes. In the stores:113 trace both pages and the runner stop for about 430 s. | No spec waits changed: a paused VM resumes with every deadline passed. A rerun after a host pause is accepted instead, and nothing else is (review 1, DECISIONS 18.22). `e2e/tests/fixtures.ts` now prints `[host-stall] <test>: the host paused the test runner for N s` for a pause of 10 s or more, so the run's own log tells a freeze from a flake. Proven with a 15 s SIGSTOP of the runner, and it also caught a real 45 min freeze (2699 s) during that run. |
| gitleaks gate failing after a failed local e2e run | `gitleaks dir .` scanned gitignored Playwright traces (local-stack JWTs). | The gate scans what git could commit (tracked plus untracked, not ignored). An ignored token file passes; an untracked, unignored one fails with its repo path. |
| db gate: `supabase db reset` exited 1 with no message (one 5-green run; one more in about 90 resets by hand) | The CLI's one-shot realtime init container and the restarting realtime service migrate and seed the fresh database at the same time; the gate sent the CLI's error (stdout) to `/dev/null`. | `db_reset` in `scripts/lib.sh` stops the realtime service before the reset (the CLI starts it again) and prints the CLI's error on a failure; the db gate and the backup drill use it. `docker events` shows the init container now runs alone. |
| functions gate: `account/apple_test.ts` "exchanges the code, then revokes the refresh token" (one 5-green run) | The test required the revoke request to carry the same client-secret JWT as the token request, but each request signs its own, with its own `iat`; they match only when both fall in the same second. | The test verifies each request's secret (issuer, audience, subject, key id, lifetime), which is what Apple checks. With the fake's token answer held across a second boundary, the old test fails and the new one passes. |
| A sweep of every unit test for the same two classes (DECISIONS 18.20) | `cancel_test.ts` raced its lock holder (200 ms) and its abort timer (300 ms) against process starts; the usuals debounce test raced a real 1.5 s timer. | The lock test waits for the holder's "held" and for the waiting flock before aborting; `takeE2eLock` checks the signal after its ancestor walk; the usuals test runs under `fakeAsync`. |
| Found on the way: an item write answered with a JWT error was dropped as "Änderung abgelehnt" | `_refusable` turned every PostgREST error into a refusal, including `PGRST3xx` (token lapsed in flight, e.g. after a freeze). | Those count as offline and are retried with a fresh token. New offline-start.spec test; it failed before the fix. |

### Review 0: stalls get one rerun with proof, and the app's recovery is tested

Review 0 rejected voiding failed runs: the rule counted stall lines instead of matching them to the
failed test, and it never showed the app recovers after a pause (DECISIONS 18.21).

- **One rerun, accepted only for a paused test.** Playwright retries a failed test once, and
  `e2e/host-stall-reporter.ts` fails the run when a test passed only on its rerun and a failed
  attempt has no `host-stall` annotation. Proven both ways: a 75 s SIGSTOP of the runner and its
  Chromium in live-sync.spec failed the paused test, its rerun passed, the run exited 0; a test
  that fails once without a pause failed the run (`FLAKY without a host stall`).
- **Recovery after a pause, tested.** live-sync.spec "a phone that sleeps through a dropped
  connection and a partner's add catches up when it wakes and stays live" freezes the page with
  CDP (timers stand still: a 50 ms interval did not move while frozen and fired 20 times on
  waking), kills its Realtime connection and adds an item meanwhile. After waking the item shows,
  the channel is live again, and adds flow both ways.
- **No voids.** The 5-green loop resets the count on every failed run; it goes on only when each
  failed test has its own `[host-stall]` line on both attempts (at most twice per head, never
  twice for one test) and stops on anything else.
- **Lint.** `no-wall-time-wait-in-tests` fails `Future.delayed` in `app/test`; `elapse()` holds
  the one reasoned exception.

Every earlier failure against its evidence. The 1 s bash heartbeat (`/tmp/fg18b/heartbeat.log`)
runs since 2026-10-26 07:07; before that only mem-guard's once-a-minute samples exist, which also
have holes of their own, so those rows are coarser.

| When | Failure | How it failed | Pause in that window |
| --- | --- | --- | --- |
| 10-25 13:59 | list.spec:53 | `page.reload` waited 60 s for navigation | mem-guard 13:47:50-13:56:39 (529 s) |
| 10-25 14:39 | offline-start.spec:84 (8.5 min) | test timeout | mem-guard 14:23:57-14:37:55 (838 s) |
| 10-25 15:52 | offline-start.spec:30 | 20 s poll for the queued ops | mem-guard 15:44:49-15:50:55 (366 s, load 0.02 after) |
| 10-25 16:56 | offline-start.spec:30 | context teardown timed out after the steps passed | mem-guard 16:44:39-16:54:31 (592 s) |
| 10-25 17:34 | voice.spec:27 (29.6 min) | 10 s expect plus test timeout | mem-guard 17:04:33-17:34:34 (1801 s, load 0.00 after) |
| 10-25 ~20:15 | stores.spec:113 (vmaint review) | 20 s `typeInto` | its trace: runner and both pages stop for about 430 s |
| 10-25 21:52 | live-sync.spec:171 | timeout while setting up `page` | mem-guard 21:40:38-21:47:44 (426 s, load 0.00 after) |
| 10-25 22:05 | offline-start.spec:30 (2.2 min) | test timeout | mem-guard 21:59:20-22:03:19 (239 s) |
| 10-25 23:02 | list_cubit_test (unit) | Expected 'Ana', Actual null | mem-guard 22:59:11-23:02:13 (182 s); the race it exposed is fixed |
| 10-26 03:50 | voice.spec, session token test | detector: 241 s | mem-guard 03:45:34-03:50:28 (294 s, load 0.06 after) |
| 10-26 ~05:45 | stores.spec categories | detector: 176 s | mem-guard 05:42:58-05:45:56 (178 s) |
| 10-26 ~06:44 | offline-start.spec:84 | detector: 198 s | mem-guard 06:40:57-06:44:52 (235 s) |
| 10-26 07:14 | list.spec:53 | detector: 258 s | heartbeat 07:10:03-07:14:22 (259 s) |
| 10-26 07:37 | live-sync.spec, offline tick | detector: 1376 s | heartbeat 07:14:48-07:37:45 (1377 s) |
| 10-26 08:47 | offline-start.spec, expired token | detector: 395 s | heartbeat 08:40:37-08:47:13 (396 s) |
| 10-26 09:27 | live-sync.spec, two members | detector: 371 s | heartbeat 09:21:39-09:27:51 (372 s) |
| 10-26 14:39 | suggestions.spec, due usuals | detector: 127 s | heartbeat 14:36:53-14:39:02 (129 s) |
| 10-26 16:30 | stores.spec categories | detector: 2613 s, timeout while setting up `page` | heartbeat 15:46:56-16:30:28 (2612 s) |

Failures with no pause in their window were real and are fixed above: the db reset, the Apple
client secret, and the cubit race. The local 5-green reached 5/5 once, on head 4fae41b
(started 2026-10-27 20:20 CET, 5 runs of 69 passed, no host stalls; `/tmp/fg18b/five.log`).
Later heads (cba5ecc, 1c90e4c) got 1 green run each before the loop was stopped. The
landing gate changed after that (see "Merge gate" at the end).

## Job 18c: a cause for each flaky spec, then landing after #49

Review 2 asked for a root cause per flaky spec, or a stated policy. Details and numbers are in
DECISIONS 18.23. Evidence is in `/tmp/fg18c` on the box.

| Probe (retries off) | Result | What it shows |
| --- | --- | --- |
| The five specs ×6 under 8 CPU burners, a disk writer and job 15b's run (load 15 to 21) | 27 of 30 passed. The 3 failures each fell in a VM pause the heartbeat saw (217, 1000, 184 s) | Load is not a cause. The runner's 1 s tick ran at most 16 ms late at load 21 |
| The five specs, runner and Chromium SIGSTOPped for 8 s every 20 s, then every 6 s | stores:113 failed 2 of 3 with no VM pause | A test defect: 2 to 3 s latency budgets on the wall clock failed on any pause under the 10 s stall threshold |
| A probe test whose fixture teardown blocks for 3 s, then times out | "not retried" | A pause in a teardown was never named |

The fixes:
- `within(ms, check)` (`e2e/tests/helpers.ts`) counts a latency budget in time the runner ran.
  It covers the live checks in live-sync:7, stores:113, mcp:26 and offline-start:31. With 8 s
  pauses every 6 s, those four passed 11 of 12, and the one failure fell in a 310 s VM pause
  that was named.
- A host stall is named from 2 s (it was 10 s). The mark that allows the retry is written on the
  tick that sees the pause, and cleared when a test's first attempt starts. The teardown probe now
  retries and passes. The same timeout without a pause is still refused.
- On the rebase onto #49, its `stallRetry` fixture replaced job 18b's `host-stall-reporter.ts`.
  Both did the same job.
- `h-list-walk` (design H's list: three stores, brands, properties, walk order) joined the
  scenarios. It seeded with 8/8 checks, and its teardown left 0 rows in all 16 tables.

The accepted policy: a test that the runner saw paused for 2 s or more gets one retry, and the
retry must pass. Every other failure fails the run. A VM pause stops everything, and everything
resumes with every deadline already passed (the VM was paused 80 to 91% of every hour from
2026-10-27 22:00). What a pause does to the app is tested on its own: the sleeping phone, dropped
sockets, the expired token.

## Merge gate

On 2026-10-28 Peter dropped the five-green local runs before a merge (COORDINATION.md, MERGE
GATE). #35 lands when CI is green on its exact head and review has nothing must-fix. A CI
failure that passes on one `gh run rerun --failed` gets a `flaky` issue. The specs that failed
in the local loops each have a `flaky` issue with their evidence.
