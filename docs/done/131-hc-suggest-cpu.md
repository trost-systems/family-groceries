# Job 131: hill-climb hc-suggest-cpu (client-side suggestion ranking)

PR #268, ready for review, **DO NOT MERGE** (the lead merges). Branch `job/131-hc-suggest-cpu`.

## What was built

- A frozen workload and harness for the add sheet's offline ranking (`suggestUsuals`,
  `suggestionMatch` in `app/lib/list/model.dart`): `tool/hillclimb/hc-suggest-cpu/gen_fixture.py`
  (seed 131) writes `app/test/list/suggest_fixture/` (5,000 usuals, 60 on the list, 40 queries);
  `tool/hillclimb/hc-suggest-cpu/measure.sh` runs `app/test/hillclimb/suggest_bench_test.dart`
  under `/tmp/fg-hc-measure.lock` and prints one JSON line (score = p50 ms of 1,200 calls).
- A characterisation test in the normal suite, `app/test/list/suggest_ranking_test.dart`: top 5
  of every query, the sha256 of all 4,520 matches in order, and `limit` 1..20 = top of the full
  ranking.
- Six kept steps in `model.dart`: fold once per usual, allocation-free word and typo matching,
  rank pruning, on-list check for matches only, a sorted name/word-start index per usuals list,
  bounded buckets per rank. Score 15.283 -> 0.032 ms p50 (-99.8 %), p90 21.9 -> 1.3 ms, ranks
  identical. The kept steps one commit each: ref `hc/131-steps`.
- Review 0 fix: a usual whose name folds to nothing (NBSP or tab only) made `suggestionMatch`
  throw on scan queries; guarded, unit-tested, plus `app/test/list/suggest_differential_test.dart`
  (seeded random catalogs against the plain ranking it replaced).
- The app loads at most 200 usuals (`fetchUsuals`, `p_limit: 200`): there, per keystroke
  0.57-0.84 ms on main vs 0.055-0.080 ms (review 0's A/B), both far under a frame, so users
  won't notice; the 5,000 workload was the brief's.

## How to verify

- `tool/hillclimb/hc-suggest-cpu/measure.sh` (about 30 s; exits 1 on any rank change).
- `cd app && flutter test test/list/suggest_ranking_test.dart test/list/model_test.dart`.
- Attempt log with every run: `docs/hillclimb/hc-suggest-cpu.md`.

## Test results

After the review fix: `scripts/verify.sh --only gitleaks,lint,flutter` (see the PR for the run on
the rebased head); before it, app `+1855 ~91`, Widgetbook `+336`, `flutter analyze --fatal-infos`
no issues. No goldens or UI code changed.

## Stopped, missing, for the lead

- Stop rule 2: five consecutive genuine attempts without a kept step (12, 14, 15, 16, 17; 13 was a
  ceiling measurement and does not count), after 2 h 44 min; weekly usage 0.63.
- `bytes_per_query` in measure.sh only counts the VM's slow-path allocations; it is reported,
  never scored (explained in the log).
- Proposal, not applied: `docs/hillclimb/hc-suggest-cpu-proposals/17-combined-on-fix.diff`
  (p50 not separable from host noise in 5 A/B pairs; p90 and mean -60 % in every pair, typo
  queries 1.3 -> 0.35 ms; ranks identical, keeps the empty-name guard).
