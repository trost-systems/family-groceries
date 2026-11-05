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
