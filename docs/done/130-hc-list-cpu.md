# Job 130: hill-climb hc-list-cpu (the in-memory list model)

Branch `job/130-hc-list-cpu`, runner hz. Started 2026-11-05 20:27:32 CET, stopped 22:52 CET
by the rule of 5 attempts in a row without a kept step. PR marked DO NOT MERGE; the lead
reviews and merges.

## What was built

- `app/benchmark/list_cpu/fixture.dart`: a seeded household (seed 130): 3,000 open and 5,000
  bought items, 24 categories, 6 stores with their own walking orders, 400 usuals.
- `app/benchmark/list_cpu/list_cpu_bench.dart`: 11 benches over the model, the cubit and the
  cache (sections, visible items, walk order and sort, suggestions, recently used, duplicate
  hint, 30 ticks, 350 realtime rows, resync, cache save and load). Run with `flutter test`.
- `tool/hillclimb/hc-list-cpu/measure.sh`: runs the bench under `/tmp/fg-hc-measure.lock`
  and prints one JSON line. The score is the geometric mean of the 11 p50s in ms.
- Kept app changes:
  - `ListCubit.onChange` tells whether the open names changed from the rows a write named,
    with per-name counts, instead of building two 3,000-name sets for every realtime row.
  - The device cache's snapshot is version 4: server rows are `Item.toRow()` arrays, built
    once per item, with UTC times as microseconds since the epoch. A version 3 snapshot
    upgrades on load.
  - `suggestUsuals` folds and splits each usual's name once per usual, not on every keystroke.

## Result

Baseline 8.5659 (band 0.43) → **4.4831** (−47.7 %), the medians of 3 runs. Interleaved under
the same load, baseline 9.7649 → final 5.1752 (−47.0 %). 30 ticks: 1,630 → 563 ms. 350 realtime
rows: 252 → 55 ms. Cache load: 73 → 14 ms. Cache save: 54 → 18 ms. Suggestions for 12 typed
strings: 19.3 → 4.5 ms. The snapshot shrinks from 3.1 to 1.6 MB. 15 attempts: 5 kept, 10
reverted. The table, every attempt and where the time goes now are in
[docs/hillclimb/hc-list-cpu.md](../hillclimb/hc-list-cpu.md).

## How to verify

    tool/hillclimb/hc-list-cpu/measure.sh     # one JSON line, about 1.5 min

- `flutter test` in app/: +1855 ~90, about 1.5 min (the baseline had +1852 ~90; 3 new tests:
  realtime rows refresh the usuals only when the open names change, a version 3 snapshot
  loads with every column, server times keep their microseconds and zone).
- `flutter analyze`: No issues found. `scripts/gates/lint.sh`: passes.
- No goldens or screenshots changed. Nothing under `app/lib/list/list_view/`,
  `list_screen.dart`, `supabase/`, `alexa/`, Siri, l10n, e2e or site.

## Open

- **Overlaps:** #268 (hc-suggest-cpu) supersedes the suggestion step and conflicts in
  `model.dart`. #270 (hc-cache-codec) owns the device cache format and also calls it
  version 4. Recommended order: #268, #270, then this PR rebased down to the open-name
  counts and re-measured (docs/hillclimb/hc-list-cpu.md, "Overlaps with open PRs").
- From attempt 8 on, steps were kept against paired HEAD runs (`tool/hillclimb/hc-list-cpu/ab.sh`),
  not against the best by the band: a protocol deviation, logged. Attempts 11 to 13, 3 of the 5
  that triggered the stop, ended at a scratch measurement.

- A tick still encodes the whole snapshot (about 17 ms of its 19 ms in the bench). Saving the
  queue apart from the server rows would remove most of that. It changes the `ListCache`
  interface, which this run's frozen bench implements.
- The host ran at load 8 to 17 for most of the run. Decisions from attempt 8 on used
  interleaved HEAD and candidate runs (rule in the log).
