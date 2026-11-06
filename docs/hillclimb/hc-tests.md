# hc-tests hill-climb log (job 98)

Start: 2026-11-04 22:44:07 CET (epoch 1793828647)

Weekly usage at start: 0.32

Elapsed time is tracked by `/proc/uptime` (the VM suspends; frozen time does not count).
Start ≈ uptime 2d 14:22 (224520 s; 6 h stop at 246120 s) (at 23:39 CET uptime was 2d 15:17; at 02:37 CET it was 2d 15:32).

## Score

This section describes the harness as committed (after reviews 1 and 5). The harness as first
built is described under "Harness as first built" below; the baseline and attempt rows up to
"Review 1" were measured with it.

`tool/hillclimb/hc-tests/measure.sh` prints one JSON line:

    score = coverage_fraction x mutation_score / wall_s x 1000      (higher is better)

- **Coverage**: `flutter test --coverage` in `app/`, lines hit / lines found over every `SF:` record
  of `coverage/lcov.info`, exactly as Flutter writes it (no exclusions added; the l10n output and
  `*.g.dart` count as they do today). `lcov_files` is printed so a step that drops files from the
  report shows.
- **Mutation score**: `tool/hillclimb/hc-tests/mutate.py`, a small deterministic mutator.
  - Sites are found on code only (a lexer skips strings and comments; `dart format` spaces binary
    operators, so ` < ` is never a type argument): `==`/`!=`, `<`/`<=`/`>`/`>=` boundaries,
    `&&`/`||`, `+`/`-`, `true`/`false`, `.isEmpty`/`.isNotEmpty`, and removing a unary `!`.
  - Targets: `lib/list/{model, entry, quantity, list_cache, list_cubit, list_repository}.dart` and
    the repositories (`feedback`, `access`, `account`, `invite`, `purchase`); not Siri, not the
    RevenueCat wrapper.
  - `mutate.py generate` finds 483 sites on main `ec0a49e7`'s source and
    `random.Random(98).sample(..., 150)` picks the committed list `mutants.tsv` (sha
    `6b076ff1ab48`; regenerating on `ec0a49e7` reproduces it byte for byte). The list before it,
    437 sites on `7b00b51b` (sha `45e59dfeaad4`), is kept as `mutants.7b00b51b.tsv`; main's #253
    changed a line of its m040 (see "Review 5").
  - Each mutant is anchored by file, line text (and which of identical lines) and column, so edits
    elsewhere in a file do not move it. A mutant whose line no longer holds it stops the run with
    its id; nothing leaves the denominator silently.
  - The run first records the failures of the unmutated tree (on the Hetzner runner: none in a full
    checkout; a repository copy without `ios/`/`android/` has a few, which the run
    lists). A test file that fails to load stops the run.
  - Each mutant runs the test files that import the mutated file (directly or through a test
    helper), its own `*_test.dart` first, then the other importers. Only a test failure the
    unmutated tree does not have kills. A mutant the compiler rejects is `invalid` and leaves the
    denominator.
  - A batch past 180 s runs once more with 360 s; only a mutant that times out twice counts as
    killed, and it is listed in `timeout`/`timeouts` in the JSON (review 5; before that a single
    180 s timeout counted as killed and was folded into `killed` unseen).
  - The mutants run in a copy of the whole repository, since tests read fixtures beside `app/`
    (`../supabase/tests/*.tsv`, `../docs`, `../site`).
  - `mutation_score = killed / (total - equivalent - invalid)`. `equivalent.tsv` is empty: no
    mutant of this list is marked equivalent, so a possibly equivalent survivor counts against
    every tree alike.
  - The result depends only on the files it reads, so it is cached under a content hash of
    `app/lib`, `app/test`, `pubspec.lock`, `mutants.tsv`, `equivalent.tsv` and `mutate.py`.
- **Wall time**: plain `flutter test --no-pub` in `app/`, 3 timed runs under
  `flock /tmp/fg-hc-measure.lock`, median, monotonic clock (the VM gets frozen and wall-clock time
  jumps). A run during which mem-guard SIGSTOPped this job (its log says so) is timed again.

Deterministic: fixed seed and committed, line-anchored mutant list that stops on a stale mutant;
failures are counted against the unmutated tree's own; a timeout must repeat at twice the time;
content-hash cache. The noise is in the wall time, from the other jobs' load on the host.

### Harness as first built (up to review 1)

372 sites on `c5a580a8`'s source, list sha `68effc76c5a1` (now `mutants.c5a580a8.tsv`, with
`equivalent.c5a580a8.tsv`: m028, m029, m075). Mutants were pinned by byte offset, and one whose
offset no longer matched counted as `mismatched` and left the denominator (the bug review 1 found).
A single 180 s timeout counted as killed. On the box, the unmutated tree failed exactly the 4 wide
goldens below, and the guardrail was "these 4 and nothing else".

### Pre-existing failures on the box

`design/screens_golden_test.dart`: `list wide` and `add sheet wide`, light and dark, failed on the
box with a 13 px diff in the top-left logo on every run, untouched tree included (same Flutter
3.47.8 as CI; CI on main `c5a580a8` is green). They were an environment difference, counted in
`tests_failed`. On the Hetzner runner (reviews 4 and 5) they pass: 0 failures.

## Baseline

First baseline (harness `fd16079b`): 12.1072, 13.2056, 13.2347. Run 1 had a 255 s wall run: mem-guard
SIGSTOPped this job at 04:08:41-04:09:31 during it (`mem-guard.log`). The harness then learned to
time such a run again, and m028 was found equivalent, so per the protocol it was re-baselined:

| run | score | coverage % | mutation | wall runs (s) | median wall |
| --- | --- | --- | --- | --- | --- |
| 1 | 11.4123 | 88.81 | 0.9531 (122/128) | 70.37, 74.17, 75.26 | 74.17 |
| 2 | 12.0577 | 88.81 | 0.9531 | 127.63, 70.2, 63.38 | 70.2 |
| 3 | 13.2340 | 88.81 | 0.9531 | 63.96, 58.44, 74.88 | 63.96 |

**Baseline 12.0577** (harness `3b1f290e`), noise band max-min **1.8217** (15 %; 2 % would be 0.24).
Load average was 8-10 from the other HC jobs. Tests: 1737 passed, 88 skipped, 4 failed (the
goldens above). A step is kept only above **13.88**.

Mutation baseline: 150 mutants, 122 killed, 6 survived (m025, m031, m032, m042, m050, m061),
2 equivalent, 20 invalid. The first full mutation run took about 25 min of unfrozen time.

## Harness correction (3h00m in)

Writing tests for `invite_repository` showed its `preview` mutants counted as killed although lcov
had those lines unrun. Two bugs inflated every mutation score so far:

1. 7 of 11 targets have `design/screens_golden_test.dart` among their importers. Its 4 wide goldens
   fail on this box on every run, so any mutant that outlived its own test file died there.
2. The mutants ran in a copy of `app/` only; `entry_test` and `quantity_test` read
   `../supabase/tests/*.tsv` and failed to load, so every `entry.dart`/`quantity.dart` mutant died.

Fixed in `3465857e` and `0baa9739` (a mutant dies only by a failure the unmutated tree lacks; the
copy is the whole repository; a test file that does not load stops the run). The baseline
mutation run was redone on the kept tree (`lib`/`test` identical to the baseline): **104 killed
of 150, 24 survived, 20 invalid, 2 equivalent = 0.8125**; m075 was then found equivalent
(`equivalent.tsv`), so **0.8189 (104/127)**. The coverage and wall parts do not depend on the
mutator, so the recorded runs were re-scored with it rather than timed again:

| run | coverage % | mutation | median wall (s) | score |
| --- | --- | --- | --- | --- |
| baseline 1 | 88.81 | 0.8189 | 74.17 | 9.806 |
| baseline 2 | 88.81 | 0.8189 | 70.20 | 10.360 |
| baseline 3 | 88.81 | 0.8189 | 63.96 | 11.371 |
| attempt 2 (kept) | 88.81 | 0.8189 | 55.60 | 13.081 |

**Corrected baseline 10.360, band 1.565** (15 %). Attempt 2 stays kept (13.081 > 11.925). The
next keep needs more than **14.646**. Rows below written before this section keep their old
numbers, marked "(old mutator)".

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 06:36 | kill the 6 surviving mutants: 6 behaviour tests in list_cubit/list_cache/list_events tests (+ per-call unwatch gate in the fake) | <= 11.46 (upper bound; cov 88.84, walls 65.9/77.5/101.2) | reverted (old mutator) | load avg ~10 put the wall median at 77.5 s; even mutation 1.0 could not reach 13.88. Verified each of m025 m031 m032 m042 m050 m061 dies (check.py) |
| 2 | 07:01 | `app/dart_test.yaml`: `concurrency: 8` (package:test's default is half the cores, 4 here) | 15.2239 (old mutator; 13.081 corrected; walls 55.9/55.6/55.2, cov 88.81) | kept | -15.5 s wall; same 1737 passed / 4 env goldens failed; one run, the gain is 1.7x the band |
| 3 | 07:13 | survivors' tests (attempt 1) + `list_repository` wire-contract tests | upper bound 16.44 (old mutator; cov 89.89, walls 43.2/56.4/54.7) | aborted | near the band, so 3 full runs started; stopped when the harness bugs above surfaced. Its tests carry into attempt 4 |
| 4 | 08:19 | behaviour tests for 22 of the 24 corrected survivors (list cubit: closed during resubscribe, due+recent usuals, store sort order, catalog save, op on device before ack; analytics without members; prefs default; entry `X2`/`20`; `SetTo` equality, `ontoKept`, `walkingOrder`, `suggestionMatch` 4 letters, 1000 g = 1 kg) and the wire contract of `list_repository` and `invite_repository` (+ m075 equivalent) | 19.2368 (cov 90.37, mut 0.9843 = 125/127, walls 46.24/46.23/46.77) | kept | +6.16, 4x the band; 1789 passed, the same 4 env goldens fail; survivors m086, m148 |
| 5 | 09:40 | concurrency 6 instead of 8 (probe: with compilation now the bottleneck, fewer test processes might leave the compiler more CPU) | not applied (paired `-j` runs: 6 = 47.5, 45.7 s; 8 = 46.1 s) | reverted | no difference beyond noise, far below the 8.1 % band |
| 6 | after review 0 | a behaviour test for m086 (`ontoKept` for a merge) | upper bound 18.19 | reverted | below the 20.80 bar (attempt 4 + 8.1 % band) |
| 7 | after review 0 | `session_events_test` without its back-off waits | upper bound 18.41 | reverted | below the 20.80 bar |
| 8 | after review 0 | fold 6 small test files into their siblings (fewer compiled entrypoints) | upper bound 20.13 | reverted | below the 20.80 bar, and it broke 12 tests: a sibling's `setUp` reaches the folded groups |
| 9 | after review 0 | wire contract of `access_repository` | upper bound 18.54 | reverted | below the 20.80 bar |
| 10 | 2026-11-06 05:30 (review 5, hz) | `account_repository_test` group `fate` against a mock PostgREST: the last member deletes the household (`unlocked` read), others keep it with their names; kills m149 in its own file (12 s) | 11.7587 on hz (cov 91.04, mut 0.8779 = 115/131, walls 67.95/67.97/80.09); shipped tree the same hour: see "Review 5" | reverted | cov x mut +1.2 % over the shipped tree (91.04 x 115 against 90.72 x 114), the band is 7.5 %; the walls of both trees swing 68-95 s on hz and cannot tell 2 tests apart. The test is kept aside for the lead as `jobs/98-hc-tests/attempt10_fate_test.diff` in the ops dir |

Rows 6 to 9 are reconstructed from the PR text of that round (fix 5, review 4): no clock times,
JSON lines or wall runs of them were kept, and how each "upper bound" was computed was not
recorded, so these rows cannot be audited. They stand as the PR reported them.

## Result

**Superseded:** these are the hill-climb's own figures on `c5a580a8`'s source; the numbers that
stand are in "Review 1: re-measured on today's source with a fresh sample" below.

Final tree `01d2020a`, 3 runs of `measure.sh`: 19.2368, 18.0869, 17.5550 (median **18.087**). The
tree that ships (`01d2020a` rebased onto main, plus the m028 test from review 0) was measured once
more with a fresh mutation run: **18.3649** (coverage 90.36 % = 10335/11437 lines, main brought 32
new lines; mutation 125/127; walls 43.63/48.43/59.03; 1791 passed, 4 failed).

| part | baseline (median run) | final (median run) | factor | share of the gain (log) |
| --- | --- | --- | --- | --- |
| score | **10.360** (band 1.565) | **18.087** (+74.6 %) | 1.746 | |
| suite wall (median) | 70.20 s | 49.18 s | 1.427 | 64 % |
| mutation score | 0.8189 (104/127) | 0.9843 (125/127) | 1.202 | 33 % |
| line coverage | 88.81 % (10129/11405) | 90.37 % (10307/11405) | 1.018 | 3 % |
| tests passed / skipped / failed | 1737 / 88 / 4 | 1789 / 88 / 4 (the same 4 wide goldens) | | |

What the mutation score measures, plainly: the 150 mutants were fixed first and attempt 4's tests
were then written against its survivors, so 0.98 says how well the suite now covers *this sample*,
not mutation strength in general; 20 of the 150 (13 %) do not compile and leave the denominator;
3 are marked equivalent by me (m028, m029, m075, reasons in `equivalent.tsv`; m028's rests on the
resubscribe timer being cancelled, which `list_cubit_test` "a channel back before the retry is not
subscribed again" pins, and it still passes with the cancel removed and m028 applied together,
since `_rewatch` checks `_channelUp` once more). Left alive: m086 (`ontoKept` for a merge whose
other item is the add's copy) and m148 (`account_repository.fate()` reading `unlocked`).

CI's flutter job on this PR took 243 s against 245 s and 287 s on main's last two green runs:
`concurrency: 8` does not slow the smaller CI runners.

## Review 1: re-measured on today's source with a fresh sample

Review 1 found the committed list broken on the PR's own head: `mutants.tsv` pinned mutants by byte
offset, main's later changes to `entry.dart`, `model.dart` and `list_cubit.dart` (#236, #243)
moved most of them, and `run` silently left the unmatched ones out of the denominator (the reviewer
got 0.9714 over 35 mutants). Fixed:

- Mutants are anchored by file, line text (and which of identical lines) and column, so edits
  elsewhere in a file do not move them (`mutate.py` `anchor`/`resolve`).
- A mutant whose line no longer holds it stops the run with its id; nothing leaves the
  denominator silently (`mismatched` is gone from the output).
- The old list, converted to anchors, still resolved all 150 on `c5a580a8` but 5 not on today's
  source, so it is kept for the record (`mutants.c5a580a8.tsv`, `equivalent.c5a580a8.tsv`) and a
  new list was drawn from today's source with the same seed (`mutants.tsv`: 150 of 437 sites).
  No test in this PR was written against it, which also answers the "fit to the sample" concern;
  no mutant of it is marked equivalent, so a possibly equivalent survivor counts against both trees.
- `measure.sh` sets `PYTHONDONTWRITEBYTECODE`.

Both trees measured 3 times with this harness, the same list and the same source (`lib` identical).
**Review 5 corrected the PR's mutation part to 114/131 and its median to 14.421**; see "Review 5" below:

| run | baseline: main `7b00b51b` | this PR: `46346d06` (rebased on `7b00b51b`) |
| --- | --- | --- |
| 1 | 10.9521 (wall 63.57) | 15.9921 (wall 49.73) |
| 2 | 10.2011 (wall 68.25) | 11.3662 (wall 69.97) |
| 3 | 11.0197 (wall 63.18) | 14.5471 (wall 54.67) |
| **median** | **10.952** (band 0.819) | **14.547 (+32.8 %)** |

| part (median run) | baseline | this PR | factor | share of the gain (log) |
| --- | --- | --- | --- | --- |
| suite wall | 63.57 s | 54.67 s | 1.163 | 53 % |
| mutation score (fresh sample) | 0.7786 (102/131) | 0.8779 (115/131) | 1.128 | 42 % |
| line coverage | 89.42 % (10349/11573) | 90.59 % (10484/11573) | 1.013 | 5 % |
| tests passed / skipped / failed | 1815 / 90 / 4 | 1868 / 90 / 4 (the same 4 wide goldens) | | |

19 of the 150 are invalid (do not compile) on both trees. Survivors on this PR: m009, m010, m024,
m026, m029, m033, m051, m060, m072, m077, m085, m086, m088, m090, m145, m146. The run-2 wall of
the PR (70 s) came with the box's load; it is kept, it is the median's job. The PR's own runs
spread 11.37 to 15.99, far wider than the baseline's band (0.819): the band was measured on the
baseline only, so it describes that tree under that hour's load, not every run.

These numbers supersede the headline 10.36 -> 18.09 above, which was measured on `c5a580a8`'s source
with the sample the tests were written against.

## Review 5: m149, and timeouts made visible

Review 5 ran the mutation part on the PR's head (`f4c71692`) and got **114/131 = 0.8702**, not the
recorded 115: m149 (`account_repository.dart:170`, `others.isEmpty` -> `isNotEmpty` in `fate()`)
survived its full run and two isolated runs. Nothing in `account_repository.dart` or its tests
changed since `7b00b51b`, where 115 was measured, and m149 survives on main too.

Why m149 died on the box: most likely a timeout. No test reads the real `fate()` (the screens use
`FakeAccount`), so m149 cannot fail a test. Its second batch is the 28 other importers of
`account_repository.dart`, and the harness counted a single 180 s timeout as killed and folded it
into `killed`, so the JSON could not show it. The box run's per-mutant log was not kept, so this
cannot be proven. What supports it: on hz at load 15-22 the
list_cubit batch of 19 files went past 180 s on its first try (m068), and the harness left the
timed-out `flutter_tester` processes running (4 of them, an hour old), which loads the host
further for every later mutant.

Harness fixes (`mutate.py`; the measured inputs and the mutant list are unchanged):

- A batch past 180 s runs once more with 360 s; only a second timeout counts as killed.
- The JSON prints `timeout` and `timeouts` (ids), and stderr prints each mutant's seconds.
- `flutter test` runs in its own process group, which is killed on a timeout, so no hung tester
  outlives its mutant.
- `measure.sh` no longer exits silently when no test fails (`grep` for failed names found nothing
  under `set -e`; on the box the 4 wide goldens always matched). The score is computed the same
  way.

Re-measured on hz with these fixes, before the rebase, the same list (sha `45e59dfeaad4`, all 150
resolve):

| tree | mutation | survivors | timeouts |
| --- | --- | --- | --- |
| main `4a103f67` | 102/131 = 0.7786 (19 invalid) | the 29 of review 5, m149 among them | m071 (hangs in its own file) |
| this PR (`f4c71692`) | 114/131 = 0.8702 (19 invalid) | the 16 recorded in Review 1 plus m149 | m071; m068's 19-file batch went past 180 s and failed on the 360 s retry, so it counts as a plain kill |
| attempt 10 (+ `fate` tests) | 115/131 = 0.8779 | the 16 recorded in Review 1 | m068, m071 |

Main's baseline mutation part stays 102/131, so the baseline 10.952 stands. The PR's three runs,
re-scored with 114/131 (coverage and walls unchanged): 15.853, 11.267, 14.421, **median 14.421**
(+31.7 %; 14.547 before). Still above baseline + band (11.771), so the keep stands. The
mutation factor is 1.118 (0.7786 -> 0.8702), and the shares of the log gain become wall 55 %, mutation 40 %, coverage 5 % (53/42/5 before).

`f4c71692` on hz (one run, load 10-20, not comparable with the box's walls): score 8.8912,
coverage 90.72 % (10586/11669), mutation 0.8702, walls 88.79/95.35/73.11 s, 1905 passed, 90 skipped,
0 failed, mutation part 47 min. Attempt 10's run an hour earlier had walls of 68-80 s for the same
suite plus 2 tests; the walls on hz swing that much from one run to the next.

### Rebased onto main `ec0a49e7`: a new list and a new baseline

Rebasing for review 5 brought main's #253 (rename onto an open item merges), which rewrote much of
`list_cubit.dart`; m040's line changed, so the harness stopped as designed. Per the protocol the
list was drawn again with the same seed on `ec0a49e7`'s source (150 of 483 sites, sha
`6b076ff1ab48`) and both trees were measured anew on hz: one mutation run each, then 3 `measure.sh`
runs each, alternating main and PR (07:33-08:04 CET, load 11-18). The PR's `app/lib` is identical to
main's.

| run | main `ec0a49e7` | this PR `02e788ce` |
| --- | --- | --- |
| 1 | 9.7849 (walls 100.36/70.98/71.03) | 11.8482 (walls 67.79/66.82/63.16) |
| 2 | 10.7606 (walls 64.59/64.72/63.65) | 11.3391 (walls 72.00/68.14/69.82) |
| 3 | 10.2936 (walls 66.11/67.52/68.49) | 7.4667 (walls 82.87/137.95/106.03) |
| **median** | **10.294** (band 0.976, bar 11.269) | **11.339 (+10.2 %)** |

| part (median run) | main | this PR | factor | share of the gain (log) |
| --- | --- | --- | --- | --- |
| mutation score | 0.7744 (103/133, 17 invalid) | 0.8722 (116/133) | 1.126 | 123 % |
| line coverage | 89.75 % (10529/11732) | 90.77 % (10649/11732) | 1.011 | 12 % |
| suite wall | 67.52 s | 69.82 s | 0.967 | -35 % |
| tests passed / skipped / failed | 1867 / 90 / 0 | 1920 / 90 / 0 | | |

Survivors on the PR: m008, m009, m022, m024, m027, m035, m042, m051, m062, m070, m075, m077, m087,
m088, m089, m092, m147, every one of them a survivor on main too (main has 13 more). Timeout on
both: m071 (`!identical(p, op)` removed: the op is never dropped, its own file hangs).

The wall part does not resolve on hz. Five more wall-only pairs under the lock (08:06-08:30,
main/PR): 64.65/79.94, 73.85/65.88, 130.67/143.62, 93.69/68.71, 69.44/62.22 s; ratio main/PR 0.81
to 1.36, median 1.12. hz has 12 cores, so package:test's default is already 6 files at a time
(the box's was 4), and other jobs swing its load from 11 to 30. The 1.16x wall factor is the box's
(8 cores). The score's gain on hz is the tests', and it clears the bar by 0.07, inside one run's
spread: on hz this PR is a mutation and coverage gain, not a measured speed gain.

## Stop

Stop rule 2 of the brief: 5 attempts in a row without a keep (5 to 9), at 5h35m of unfrozen time,
weekly usage 0.46.

Deviation, for the record: the first write-up (PR #245 before review 0) stopped at 4h25m after
attempt 5, on the hillclimb playbook's "remaining ideas are marginal" rule, which is not one of the
brief's three. Review 0 flagged it; attempts 6 to 9 then tried the ideas listed there (m086, the
`session_events` back-off, folding small test files, the `access_repository` wire contract), each
measured, each below the 20.80 bar, and all reverted.

Attempt 10 came after the stop, at review 5's request (an attempt row for a test that kills m149),
and was reverted under the same rule.

Next, if pushed further: fewer compiled test entrypoints done without sharing `setUp` (attempt 8
shows a plain fold breaks 12 tests), then m086/m148.
