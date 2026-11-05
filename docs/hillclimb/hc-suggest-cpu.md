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

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
