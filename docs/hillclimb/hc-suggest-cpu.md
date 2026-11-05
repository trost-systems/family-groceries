# Hill-climb: hc-suggest-cpu

Started: 2026-11-05 20:41:47 CET (epoch 1793907707)

Runner: hz (Hetzner AX41, 12 cores, shared by up to 11 jobs). Branch `job/131-hc-suggest-cpu`.

## What is measured

The add sheet's client-side ranking: `suggestUsuals` in `app/lib/list/model.dart`
(with `suggestionMatch`, `foldName` and `_offList`), which `ListCubit.suggestionsFor`
calls on every keystroke for the offline `history` rows (`AddSheetCubit._offline`).
The server path (`suggest_items`, `suggest_entries`) is not touched.

Workload (frozen, seed 131, `tool/hillclimb/hc-suggest-cpu/gen_fixture.py`, committed
output in `app/test/list/suggest_fixture/`): 5,000 usual names (German groceries,
brands, sizes, prefixes with space or hyphen, umlauts, some lower case or padded), 60 of
them active on the list, and 40 queries: 1-2 letter prefixes (`m`, `ä`, `kä`), umlaut
prefixes, whole names, multi-word (`rote bete`, `Windeln Größe 4`), typos (`mlch`,
`bannane`, `zuccini`), a miss (`xyzq`) and a padded upper-case `  MILCH  `.

Harness: `tool/hillclimb/hc-suggest-cpu/measure.sh` runs
`app/test/hillclimb/suggest_bench_test.dart` (skipped in the normal suite unless
`HC_SUGGEST_BENCH` names an output file) with `flutter test --enable-vmservice` under
`flock /tmp/fg-hc-measure.lock`. JIT VM, asserts on, like every `flutter test`; the
shape of the cost (allocations, per-name work) carries over to AOT, the absolute ms do not.

- 5 warm-up rounds, then 30 timed rounds of the 40 queries: 1,200 samples, one
  `suggestUsuals(usuals, onList, query)` call each (Stopwatch, µs).
- **score = p50 of the 1,200 samples in ms** (lower is better). `p90_ms`, `mean_ms` are
  reported.
- `bytes_per_query`: bytes allocated during one more round of the 40 queries, from the VM
  service's `getAllocationProfile` (`accumulatedSize` summed over classes, reset with a GC
  first), divided by 40. Checked live: allocating 1M strings in that window added ~126 MB.
  **Secondary**: it decides only when a change's latency is inside the noise band (keep
  it then only if bytes drop by more than 10 %).
- `cold_p50_ms`: 30 calls, each on freshly built `Usual` objects (as after a usuals
  reload), one query each. Reported, not scored: it keeps a per-list cache honest.
- `rank_mismatches`: measure.sh fails (exit 1) when any query's top 5 differs from
  `expected.json`. `app/test/list/suggest_ranking_test.dart` (in the normal suite) checks
  the top 5 and, as a sha256, every match of the 40 queries in order (`limit: 5000`,
  4,520 rows), both captured at 698ebeba.

Deterministic: fixed fixture files, fixed query order, no randomness at run time (the
seed only made the files). The timing varies with host load; `loadavg_1m` is printed.

## Baseline (698ebeba + harness)

| run | score (p50 ms) | p90 ms | mean ms | cold p50 ms | bytes/query | load 1m |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 15.283 | 20.565 | 16.255 | 18.174 | 2,517,436 | 6.32 |
| 2 | 19.543 | 23.014 | 19.514 | 18.108 | 2,607,186 | 10.58 |
| 3 | 14.780 | 21.901 | 16.690 | 14.411 | 2,544,593 | 8.14 |

Baseline (median) **15.283 ms**; noise band 19.543 - 14.780 = **4.763 ms** (31 %, run 2
ran at load 10.6). Three earlier runs before `cold_p50_ms` was added (same timed loop):
14.397, 14.333, 14.704. A kept step must score below 15.283 - 4.763 = 10.520 ms for the
first step, then below its own best minus the band.

Guardrail baseline: `flutter test` 1854 passed, 91 skipped (80 s); `flutter analyze` no
issues; `scripts/lint.sh` ok.

### Two findings after the baseline (no measure.sh change)

- **`bytes_per_query` is not a real allocation count.** It sums `accumulatedSize` from
  `getAllocationProfile`, which only sees allocations through the VM's slow path: a base
  round shows ~411k strings where `foldName` alone makes over 200k plus the replace
  passes, compiler objects (`Class`, `Instructions`, `ICData`) land in the window, and
  attempt 1, which provably drops all 200k `foldName` calls, read *higher*
  (2.5 MB -> 2.9-4.7 MB). `flutter test` passes no VM flags (`--no-inline-alloc`) to
  the tester. So the score is latency only; bytes are reported and never break a tie.
- **The band is applied relative.** 4.763 ms is 31.2 % of the baseline median; an
  absolute 4.763 ms would forbid every step once the score is under ~9.5 ms. A step is
  kept when its median is below `current best x (1 - 0.312)`. Candidates within reach
  of the line get alternating candidate/HEAD runs (A/B pairs) to cancel host load.

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 21:01 | `suggestUsuals`: fold each `Usual.name` once (`Expando` per usual) instead of on every keystroke | 7.969 (7.969, 10.222, 7.427) | kept | -48 %; 5,000 `foldName` calls per query were half the time; cold p50 unchanged (14.6-24.9, load 9-11) |
| 2 | 21:05 | `suggestionMatch`: word-start check by `indexOf` after a space/hyphen instead of `split` + `any` (split kept for typos) | 7.784 (1 run, load 8.7) | reverted | mean 7.4 -> 6.9 but p50 is held by the 27 queries of 3+ letters that still split every name for the typo stage; not past the 31 % band |
| 3 | 21:06 | attempt 2's word-start scan plus an allocation-free typo stage: walk words by index, `Int32List` edit-distance rows reused across calls, no `split` and no `{name, ...words}` set | 1.766 (1 run, load 5.6) | kept | -78 %; every 3+ letter query split and hashed all 5,000 names; ranks identical (sha256 of all 4,520 matches) |
| 4 | 21:08 | cache the lower-case name next to the folded one (one `Expando` record), `_offList` and the rank loop use it; index loop instead of `.indexed` records | 1.721 (1 run, load 4.8) | reverted | -3 %, inside the band: 5,000 `toLowerCase` + records per query are cheap next to the match scans |
| 5 | 21:11 | rank pruning: one list per rank instead of collect-and-sort; once `limit` usuals rank better than r, `suggestionMatch(below: r)` skips the stages from r on (exact: a later usual of rank r sorts after them) | 0.777 (1 run, load 7.9) | kept | -56 %; short prefixes stop scanning words after 5 prefix hits, typo queries skip the typo walk; new test: limit 1..20 = top of the full ranking (fails on an off-by-one mutation) |
| 6 | 21:15 | check "already on the list" only for usuals that match, not `toLowerCase` + set lookup on all 5,000 (`_offList` stays for due/recent) | 0.381 (0.554, 0.381, 0.352; HEAD in A/B pairs 0.775, 0.776, 0.763; load 14-16) | kept | -51 %; a scratch split showed `_offList` at ~450 µs of the ~870 µs floor |
| 7 | 21:18 | one occurrence scan for ranks 2 and 3 (`_inside`) instead of `indexOf` word starts, then `contains` | 0.332, A/B pairs cand/HEAD 0.369/0.405, 0.486/0.527 (load 10-20) | reverted | wins every pair but by 9-13 % p50 (mean -14 %, p90 -12 %): inside the 31 % band; near-miss kept as /tmp diff to combine |
| 8 | 21:21 | 32-bit letter mask per folded usual (in the `Expando` record): a letter of the query missing from the name rules out ranks 0-3 and, past `most`, the typo stage | 0.378 (1 run, load 7.1); p90 1.3-1.9 -> 0.573, mean 0.40 | reverted | p50 flat: the median queries already prune; their cost is the per-usual `Expando` lookup and record, not the scans. Near-miss for the tail |
| 9 | 21:23 | per-list cache of the folded names (identity check of every element) instead of the `Expando` | 0.442 / 0.411 (load 12-14) | reverted (folded into 10) | no gain alone: a scratch count showed the median queries settle their cutoff only after 600-2,500 names, so the scans, not the lookup, cost |
| 10 | 21:26 | sorted index per usuals list of every folded name and every word start after a space or hyphen (`_UsualIndex`): ranks 0-2 are one binary-search range; when it holds `limit` off-list usuals that is the answer (ranks 3-4 sort after), else the scan as before | 0.046 (1 run, load 16.2); p90 1.035, mean 0.350 | kept | -88 %: 28 of 40 queries need no scan; cold p50 9-13 -> 17.6 ms (the index is built and sorted on the first query after a reload) |
| 11 | 21:31 | index range into one sorted bucket of at most `limit` positions per rank (on-list check on insert only) instead of collecting and sorting the whole range | 0.028 (0.028, 0.038, 0.021; HEAD in A/B pairs 0.069, 0.067; load 16-17) | kept | -39 % vs 0.046 (-45/-69 % in pair): one-letter prefixes had ~1,000 range entries to sort; `limit: 0` guarded (empty bucket) |
| 12 | 21:35 | hoist `foldName`'s `RegExp(r'\s+')` to a top-level final; keep the on-list name set for the same items (identity check) | 0.034; A/B pair HEAD/cand 0.034/0.033 (load 12-13) | reverted | flat: in isolation fold 4.5 µs and the set 6.8 µs of a 17 µs floor, but the median sample is not floor-bound |
| 13 | 21:36 | ceiling prototype, never keepable: attempt 12 plus an `identical(list)`-only index check (unsafe if a caller edits its list in place) | 0.026, 0.025 (load 13-14) | reverted | the most the per-call setup (fold, on-list set, identity check) can give is 15-25 %, under the band; and rounds 1-7 of the 30 still run 46-58 µs vs ~30 later (JIT tiering after 5 warm-up rounds), so the frozen harness can't resolve smaller steps |
| 14 | 21:38 | letter mask per index position for the scan path (attempt 8 on top of the index) | 0.028 (1 run, load 10.7); p90 1.0-1.3 -> 0.362, mean 0.35-0.42 -> 0.119 | reverted (proposal) | p50 flat as predicted (the median queries never scan); the typo/miss/multi-word tail gets ~70 % faster. Diff kept as `docs/hillclimb/hc-suggest-cpu-proposals/14-letter-mask-tail.diff` for the lead |
| 15 | 21:40 | lean index build: starts as (position, offset) `Int32List`s sorted by comparing suffixes in place, no substrings or records | 0.026, 0.029 (load 10.5); cold p50 14.8-17.6 -> 11.9-12.0 | reverted (proposal) | p50 flat; the first query after a reload is ~25 % cheaper. Diff kept as `docs/hillclimb/hc-suggest-cpu-proposals/15-lean-index-build.diff` |
| 16 | 21:44 | near-misses combined: 12 (hoisted `RegExp`, kept on-list set) + 15 (lean index) + 14 (letter mask) | cand 0.020, 0.022 vs HEAD 0.028, 0.032 in A/B pairs (load 10-11); mean 0.32-0.37 -> 0.107, p90 1.04-1.26 -> 0.35 | reverted (proposal) | -29/-31 % in pair, but the keep line is 0.0193 (0.028 x (1 - 0.312)); no third run can bring the median under it. Superseded by 17 |
| fix | 23:11 | review 0, must fix 1: `_startsAWord` threw `RangeError` (`indexOf(typed, 1)` on `""`) for a usual whose name folds to nothing (NBSP, tab or U+3000 only: Postgres `btrim` keeps them, Dart `trim` strips them), on every query that reaches the scan. Guard `name.isEmpty`; unit test in `model_test.dart`; new `suggest_differential_test.dart` checks `suggestUsuals` and `suggestionMatch` against the plain 698ebeba ranking inlined as reference (seeded random catalogs with blanks, tabs, NBSP, umlauts, duplicates, items on the list, `limit` 0..8; fails on the missing guard and on an off-by-one in the index cutoff) | not a score step | fixed | correctness; the frozen fixture has no blank name |
| 17 | 23:20 | attempt 16 rebased onto the fix (`proposals/17-combined-on-fix.diff`), 5 A/B pairs, `app/build/test_cache` removed before each run | HEAD 0.038, 0.036, 0.032, 0.025, 0.020; cand 0.038, 0.019, 0.016, 0.018, 0.020 (load 11-19); p90 0.88-1.34 -> 0.32-0.52, mean 0.27-0.41 -> 0.10-0.24 in every pair | reverted (proposal) | p50 per pair 0, -47, -50, -28, 0 %: HEAD alone spread 0.018 ms over the 5 runs, as much as the effect; counting only the first 3 HEAD runs (band 0.006 ms) would pick the window. The tail gain is real in every pair |

## Result

| | baseline 698ebeba | final (fix on top of the kept steps) | change |
| --- | --- | --- | --- |
| **score: p50 ms** | **15.283** (15.283, 19.543, 14.780) | **0.032** (HEAD runs of attempt 17: 0.038, 0.036, 0.032; earlier 0.034, 0.037, 0.037) | **-99.8 %** |
| p90 ms | 21.901 | 1.297 | -94 % |
| mean ms | 16.690 | 0.406 | -98 % |
| cold p50 ms (first query on new `Usual` objects) | 14.4-18.2 | 15.0-16.1 | about the same: it now builds the index, before it folded everything every time |
| bytes per query (slow-path count only, see above) | 2.52-2.61 M | 2.6-2.7 M | not a real allocation number |
| rank mismatches | 0 | 0 | plus the differential test against the plain ranking |

Kept steps, in order: 1 (fold once), 3 (no split, reused edit-distance rows), 5 (rank
pruning), 6 (on-list check for matches only), 10 (sorted start index), 11 (bounded
buckets), then the review fix. push-pr.sh squashes the PR into one commit; the kept
steps one commit each, as measured, are on the ref `hc/131-steps` (53b16887 harness,
3640bcd5, 35bc11f6, 77d601e9, 2c764a3d, 93057c8f, c8d09376).

### What this is worth in the app

The brief fixed the workload at 5,000 usuals; **the app never ranks that many**.
`ListRepository.fetchUsuals` asks `suggest_items` for at most 200 (`p_limit: 200`).
Review 0 measured 200 usuals (JIT, A/B): per keystroke main 0.57-0.84 ms, branch
0.055-0.080 ms; the first keystroke after a usuals reload 0.57-0.85 ms on main and
0.67-0.86 ms on the branch (it builds the index). Both are far under a 16 ms frame, so
users will not notice the difference. What the lead weighs: about 240 lines of index,
bucket and pruning code and two module-level mutable values (`_UsualIndex._last`,
`_rows`) against headroom that only matters if the 200 cap is raised.

**Stop: rule 2, five consecutive genuine attempts without a kept step: 12, 14, 15, 16,
17.** Attempt 13 was a ceiling measurement (an unsafe check, never keepable) and does
not count; the first write-up wrongly counted it, and review 0 caught that. Wall time
20:41-23:25 (2 h 44 min of 6 h); weekly usage 0.63 at 23:09 (< 0.95). At about 0.03
ms the p50 moves with host load by as much as the remaining ideas move it, so the
frozen harness can no longer separate them.

### Proposals for the lead (not in the branch's code)

All three apply on the fixed branch and keep the empty-name guard.

- `docs/hillclimb/hc-suggest-cpu-proposals/17-combined-on-fix.diff`: the best next
  step. p50 not separable from noise; p90 -60 to -65 % and the mean -60 % in every one
  of 5 A/B pairs (typo, miss and multi-word queries 1.3 -> 0.35 ms), ranks identical
  (characterisation and differential tests pass). Cold p50 about the same.
- `14-letter-mask-tail.diff` (the tail alone) and `15-lean-index-build.diff` (cold
  first query ~25 % cheaper) are its parts.
- If the PR merges, drop these diffs or move them to the job dir so main doesn't carry
  stale patches.
