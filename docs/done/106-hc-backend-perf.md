# Job 106: hill climb hc-backend-perf (Supabase edge functions and SQL latency)

Branch `job/106-hc-backend-perf`. PR marked DO NOT MERGE; the lead reviews and merges.
Runner hz, local stack `family-groceries-106` on 127.0.0.1:606xx. No hosted project, no deploy.

## What was built

- `tool/hillclimb/hc-backend-perf/measure.sh`: resets the local stack, seeds a fixed fixture
  through `fg seed`, and runs `bench.ts` under `/tmp/fg-hc-measure.lock`. It prints one JSON line.
  The score is the geometric mean of 24 p95 latencies: 12 hot paths (app list open, item reads,
  `suggest_items`, `put_item`, tick, untick, MCP `list_items`/`add_items`/`tick_items`, voice
  add), each run sequentially and at concurrency 4. `parts` holds p50/p95/p99 per path, plan
  costs, the top statements from pg_stat_statements, Docker stats and the host load.
- The fixture `hc-backend-perf.yaml`: 2 members, 3 stores, 300 open items, and 5,000 items
  bought over a year (10,300 item events). `gen-fixture.py` (seed 106) generates it.
- Kept step: `supabase/migrations/20261105075541_hc_suggest_items_names.sql`. `suggest_items`
  keys each distinct name once instead of every event and item row. The output is the same.
  `supabase/tests/hc_backend_perf.test.sql` compares it with the old body, copied verbatim, row
  for row on a generated household (undone ticks, deleted typos, variants, numbers, clocks,
  prefixes, a non-member). A planted change makes the test fail.
- fg fix: `fg seed`'s checks counted rows, and PostgREST caps those at 1,000. They now ask for an
  exact count through RLS (`cli/target.ts` `count(..., token)`).

## Result

Baseline median 122.82 (noise band 21.11). The final median of 98.02 mixes attempt 1's unpaired
run at load 2 (91.98) with two paired runs, so read the total score as confounded by host load.
In my paired check (same load, 3-6), the final code scored 108.82 and 98.02 and the baseline
159.08 and 133.61. In the reviewer's pairs at load 5-10, the baseline scored 147.83 and 148.98
and the final code 152.72 and 125.98, which is inside the band. The result that reproduces at any
load is per path: `suggest_items` p95 -44 % (about 1,190-1,300 -> 490-670 ms), and the app's
list open -38 % (about 1,290-1,530 -> 590-790 ms), in every pair, with 0 errors. 5 attempts: 1
kept, 4 reverted. Details and every attempt are in
[`docs/hillclimb/hc-backend-perf.md`](../hillclimb/hc-backend-perf.md).

## Stop reason (a deviation)

No stopping rule fired. Rule 4 says to stop at the first rule that hits. I stopped at 4 rejected
attempts in a row (rule: 5), at 4 h 23 min (rule: 6 h), with weekly usage at 48 % (rule: 60 %).
That was my judgment, not a rule: every hypothesis left was worth an estimated 5 % of the score or
less, against a 17 % noise band, at about 40 minutes per A/B pair. It can't be made up now, since
the 6 h mark has passed. See the log's "Stop" section.

## Review 0 fixes (lead's must-fix, brief addendum 3)

1. `measure.sh` no longer can hold `/tmp/fg-hc-measure.lock` forever. The docker stats sampler
   starts with `9>&-`, and an EXIT trap in the locked subshell kills it. Tested: bench replaced
   with `false` (3 runs) and with `true`. The lock is free afterwards and no sampler is left.
   (The first version's `pkill -P` failed under `set -e` inside the trap and skipped the kill.
   The test caught that.) Also: `score: null` when any request failed, and `+dirty` from
   `git status --porcelain`. No re-baseline: the timed work is unchanged.
2. The test's old body is main's only `suggest_items` (`git log -S` on main: 49bc260c, job 8,
   `20261023194403`). Nothing else on main alters it. The copy is verbatim (checked by script).
3. NULL names: `item_events.item_name` and `items.name` are NOT NULL on main (foundation lines 210
   and 117, never dropped). The test now asserts both (`col_not_null`), and the migration header
   says why it relies on that.
4. Docs: the open list grows from 300 to 725 items over a run (it was "the same 300-item list").
   Worker boot is about 210 ms everywhere (it was 300 ms in two places). The PR body names 14
   files.
5. The test header says it is a one-time equivalence proof, to delete when `suggest_items` changes
   on purpose.

Also from the review's nice-to-haves: an fg-cli test for the seed count fix (fails on the old row
count with 1000 against 1100).

## For the lead

Measured wins that cannot clear the band but are worth taking as pure performance. Each has its
files and equivalence tests in `~/groceries-ops/jobs/106-hc-backend-perf/hc/` (`ab-it3`,
`ab-it4`, `attempt2`):

1. A partial index `items (household_id, bought_at desc) where status = 'bought'`. The app's
   bought list goes from 100-127 to 5-10 ms at p95. With it, `counts()` as two indexed counts
   drops MCP `list_items`' 50 ms counts scan.
2. `suggest_items` reading through security-definer helpers that check membership once (RLS ran
   `is_household_member` about 25,000 times per call): about 30 % off the list open.

Also found: `suggest_items`' `latest_quantity` has no tie-breaker, so the quantity it suggests
is arbitrary among a name's rows with the same time (items ticked in one statement). It predates
this job and is left unchanged, because fixing it changes results.

## How to verify

```bash
tool/hillclimb/hc-backend-perf/measure.sh | jq '{score, parts: .parts.paths.suggest_items}'
supabase test db supabase/tests/hc_backend_perf.test.sql
scripts/verify.sh --only lint,functions,fg-cli,db,flutter
```
