# Job 98: hc-tests hill-climb (test speed and coverage)

Branch `job/98-hc-tests`. Score = line coverage x mutation score / suite wall seconds (x 1000),
higher is better.

- On the box, main `7b00b51b`'s source, a mutant sample no test was written against, 3 runs each:
  **10.952 -> 14.421 (+31.7 %)**, band 0.819; wall time alone 1.16x (63.6 -> 54.7 s), mutation
  0.7786 -> 0.8702 (102 -> 114 of 131, as corrected by review 5), coverage 89.42 -> 90.59 %.
- On hz after the rebase onto main `ec0a49e7` (review 5), a new sample with the same seed, 3 runs
  each: **10.294 -> 11.339 (+10.2 %)**, band 0.976; mutation 0.7744 -> 0.8722 (103 -> 116 of
  133), coverage 89.75 -> 90.77 %. The wall part does not resolve on hz (12 cores, so the default
  is already 6 files at a time; paired runs range 0.81x to 1.36x).

The hill-climb's own figures (10.36 -> 18.09 on `c5a580a8`'s source with the sample the tests
targeted) are in the log.

What changed:

- `app/dart_test.yaml`: `concurrency: 8`. The suite ran 4 files at a time (package:test's default
  of half the cores); wall time fell from ~63-70 s to ~46-55 s on the box.
- 52 new behaviour tests in `app/test` (no production code changed), chosen from the surviving
  mutants: the list and invite repositories' wire contract (requests and how answers are read),
  the list cubit's resubscribe, save and usuals rules, analytics without known members, list
  prefs defaults, entry and quantity parser boundaries, `SetTo`, `ontoKept`, `walkingOrder`,
  `suggestionMatch`. On `c5a580a8`'s source with the sample they were written against (superseded
  by the headline above): coverage 88.81 % -> 90.37 %, mutation score 0.8189 -> 0.9843.
- `tool/hillclimb/hc-tests/`: `measure.sh` (the score as one JSON line), `mutate.py` (deterministic
  mutator, seed 98, committed `mutants.tsv`, `equivalent.tsv` with reasons).

How to verify: `tool/hillclimb/hc-tests/measure.sh` (about 30 min the first time, mutation results
are cached by content hash), `cd app && flutter test && flutter analyze --fatal-infos`.

Shipped tree after review 0 (superseded, `c5a580a8`'s sample), one full run: score 18.365,
coverage 90.36 %, mutation 0.9843, wall 48.4 s.

Results on the shipped tree (hz, review 5, rebased onto `ec0a49e7`): `flutter test` 1920
passed, 90 skipped (screenshot tests without `SCREENSHOT_DIR`), 0 failed. On the box the 4 wide
goldens (`list wide`, `add sheet wide`, light and dark) failed with a 13 px logo diff on an
untouched tree too; they pass on hz and in CI. `flutter analyze --fatal-infos` clean, lint gate
green. Goldens unchanged.

Stop: rule 2 of the brief, 5 attempts in a row without a keep (attempts 5 to 9), at 5h35m. The
first write-up had stopped at 4h25m on the playbook's "marginal ideas" rule; review 0 flagged that
as a deviation, so attempts 6 to 9 tried the remaining ideas (all below the bar, reverted).

Review 5 fixes: m149 survives on this PR (114/131, not 115); it most likely died on the box by one
180 s timeout, which the harness counted as killed unseen. `mutate.py` now retries a timed-out batch
once with 360 s, lists `timeout`/`timeouts` in the JSON and kills a timed-out run's process group
(hung testers had stayed alive and loaded the host); `measure.sh` no longer exits silently when no
test fails. Re-measured on hz: main 102/131, the PR 114/131 (1905 passed, 0 failed). The rebase onto
`ec0a49e7` (#253 rewrote `list_cubit.dart`) made m040 stale, so a new list was drawn (same seed,
150 of 483) and both trees were measured again (numbers above; 1920 passed, 0 failed). A
`fate()` test that kills m149 (attempt 10) gained +1.2 %, below the band, and was reverted. The
log's "Score" section describes the current harness; the first one is kept beside it.

Review 4 fix: rebased onto main `4a103f67` with both the job 112 and the job 98 lines in
`DONE_SUMMARY.md`; the attempts table in `docs/hillclimb/hc-tests.md` now has rows 6 to 9
(change, upper bound, why reverted), so it matches the stop section.

Review 3 (lead) fix: rebased onto main `884b3c8d` (#247) with job 111's dictation tests in
`list_repository_test.dart` kept whole (the diff against main removes none of its lines); this PR's
`splitSpoken` wire tests now read the `(entries, truncated)` answer and expect `split: true`. All
150 mutants still resolve, also on main `a661fee7` after #239 and #255. `flutter test` there: 1901 passed, the same 4 wide goldens
failed; `flutter analyze --fatal-infos` clean.

Review 1 fixes: mutants are anchored by line text instead of byte offset, a stale mutant stops the
run instead of leaving the denominator, a fresh list (seed 98, 150 of 437) on today's source, and
baseline and PR measured 3 times each on that same source; the PR title and summary carry the
wall-only factor next to the score.

Review 0 fixes: the stop above; a test and note for equivalent mutant m028; the PR states that the
mutation score is fit to its fixed sample (20 invalid, 3 equivalent) and asks the lead to sign off
on "the same 4 wide goldens fail, nothing else" as the local green; a per-part split of the gain
(wall 64 %, mutation 33 %, coverage 3 %); CI's flutter job is no slower than on main (243 s against
245 s and 287 s).

Log of every attempt, the harness correction (the first mutation numbers were inflated by those
golden failures and by fixtures outside `app/`) and the stop reason: `docs/hillclimb/hc-tests.md`.
Not merged: the lead reviews and merges.
