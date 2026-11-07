# hc-domain-tests (job 128)

Start: 2026-11-05 18:16:31 CET
Start epoch: 1793898991

Goal: behaviour-test coverage of the app's domain logic (sync, dedupe, categories).
Score = domain line coverage (%) x mutation score, higher is better.

## Base

This branch is stacked on job 98's PR #245 (`hc(hc-tests)`). That PR was open, not merged,
when this job started, and the brief asks for tests that cover what job 98's tests do not.
Measuring on main alone would credit this job with mutants job 98's tests already kill; the new
tests also use #245's `FakeRepository.unwatchGates`, so the stack is real.

This branch was stacked on #245; #245 landed as 45a40cbe and this branch was rebased onto main.

## Scope (fixed before the baseline)

| file | why |
| --- | --- |
| `app/lib/list/list_cubit.dart` | sync: server rows, pending ops, realtime, resync |
| `app/lib/list/list_repository.dart` | sync: the PostgREST/RPC calls and how answers are read |
| `app/lib/list/list_cache.dart` | sync: the device snapshot, seen mark, prefs |
| `app/lib/list/model.dart` | ops, categories, stores, section grouping and walking order |
| `app/lib/list/entry.dart` | parsed entries |
| `app/lib/list/add_sheet/suggestion.dart` | dedupe: suggestion rows and their key |
| `app/lib/list/add_sheet/add_sheet_cubit.dart` | dedupe: the add sheet's matching, hints and merges (a cubit, no widget) |
| `app/lib/list/category_names.dart` | categories: seeded names in the UI language |

Not in scope: Siri, Alexa, generated code, l10n, widgets (`list_view/`, `list_screen.dart`,
`add_sheet.dart`, sheets and dialogs), `quantity.dart` (job 98 covered its boundaries).

## How the score is computed

`tool/hillclimb/hc-domain-tests/measure.sh` prints one JSON line.

1. Coverage: one `flutter test --coverage` run of the whole suite (timed under
   `flock /tmp/fg-hc-measure.lock`, informational). `lcov.info` filtered to the scoped files:
   `coverage_pct = 100 x lines_hit / lines_found`. The app-wide figure is printed as
   `app_coverage_pct`, informational. No exclusions were added.
2. Mutation: `mutate.py` (adapted from job 98's) found 421 mutation sites in the scoped files
   (relational, equality, logical, arithmetic, boolean literal, isEmpty/isNotEmpty, `!` removal;
   code only, not strings or comments). Seed 128 picked 140 into `mutants.tsv`. Each mutant is
   anchored by its line's text, so edits elsewhere don't move it, and a mutant whose line
   changed stops the run. In a copy of the repository each mutant is applied and its test files
   run: the file's own test first, then every test that imports it (directly or through a test
   helper) and every `test/list/` test whose imports reach it through other files. A mutant is killed when
   a test fails that does not fail unmutated (or the run times out, 180 s). Non-compiling
   mutants are `invalid` and leave the denominator. `equivalent.tsv` lists mutants proven to
   behave the same, with the reason.
   `mutation_score = killed / (total - equivalent - invalid)`. The brief's formula is killed /
   (total - equivalent); dropping invalid mutants too only scales the score (today's main:
   91/116 -> 104/116 here versus 91/140 -> 104/140), so the order of candidates is the same.
3. `score = coverage_pct x mutation_score` (so 100 is the ceiling).

Deterministic: the sample is fixed by the seed and committed; coverage and test outcomes do not
depend on timing. The mutation result is cached per hash of `app/lib`, `app/test`,
`pubspec.lock` and the harness, so an unchanged tree reuses it; `NO_CACHE=1` reruns it (the
three baseline runs use it).

Harness fix before the baseline (18:28): the first draft ran only tests importing the mutated
file directly, so `add_sheet_cubit.dart` (tested through the add sheet) got 2 test files and
`category_names.dart` none. That run was stopped after 10 mutants and is not a baseline. The full
transitive closure reaches about 80 files per file (everything imports the router), so the rule
above adds the list feature's own tests only.

## Baseline (HEAD 9f31d530: main c4aecf48 + job 98's #245, no new test)

`flutter analyze`: no issues. Suite: 1880 passed, 90 skipped, 4 failed. The 4 are the wide
goldens of `test/design/screens_golden_test.dart` (add sheet / list, wide, light and dark), which
fail on this box without any change (font rendering); mutate.py ignores failures the unmutated
tree has.

| run | score | coverage | lines hit/found | killed | survived | invalid | mutation s | suite wall s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (fresh mutants) | 75.695 | 97.07 % | 1592/1640 | 85 | 24 | 31 | 1634 | 63.4 |
| 2 (fresh mutants) | 75.695 | 97.07 % | 1592/1640 | 85 | 24 | 31 | ~1680 | 73.9 |
| 3 (mutants cached) | 75.695 | 97.07 % | 1592/1640 | 85 | 24 | 31 | cached | 81.2 |

Runs 1 and 2 re-ran all 140 mutants and agree mutant for mutant (same 24 survivors). Run 3
re-ran coverage and the suite and reused run 2's mutant results, to save 30 minutes of the 6 h:
mutate.py had gained the holdout generator (below) in between, which changes no `run` code, so
run 2's cache entry was copied to the new key.

Per file, lines hit/found: list_cubit 498/501, list_repository 218/231, list_cache 50/54, model
542/559, entry 113/115, suggestion 11/11, add_sheet_cubit 150/151, category_names 10/18.
App-wide coverage 90.67 % (informational).

Equivalent mutants. While writing tests, two of the 24 baseline survivors proved equivalent
(reasons in `equivalent.tsv`): m042 and m045. They count as equivalent from here on, and the
baseline is restated with them, from the same runs (they were survivors there):
85 / (140 - 31 invalid - 2 equivalent) = 0.7944.

**Baseline median: 77.112** (97.07 x 0.7944). Noise band: the three runs are identical, so the
band is the 2 % floor: **1.542**. A step is kept when it beats the best by more than 1.542.

Holdout. `holdout.tsv` holds 100 more mutants (seed 1280) from the 281 sites `mutants.tsv` does
not hold, generated before any new test was written; `holdout.sh` runs them. It is not the
score: it shows whether the new tests kill mutants they were not written against (job 98's
review asked for that). Measured on the baseline and on the final tree.

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 20:40-21:50 | `domain_coverage_test.dart`, 20 tests for the 48 lines no test ran: seeded category names in English, `SetTo`/`ItemChanges`/`Entry` equality and hashing, `ontoKept` for merges, `ListPrefs.copyWith` and its JSON, a realtime catalog change reloading the catalog, the add sheet dropping a dedupe hint | 82.573 (cov 99.27 %, 89/107) | kept | +5.46 > band 1.542; kills m011 m012 m111 m113; suite 1900 passed, same 4 box-only golden failures; analyze clean |
| 2 | 21:52-23:44 | `domain_add_sheet_test.dart`, 8 tests: Enter takes rows already answered or waits for the current text's, asks again after an empty or failed answer, adds nothing once the sheet is dismissed; offline rows are deduped by key; `parseEntry` reads a capitalised "Halbes" and only whole number words | 89.988 (cov 99.27 %, 97/107) | kept | +7.42 > band; kills m001 m002 m003 m008 m017 m018 m023 m024; m010 survives (attempt 3 kills it); suite 1908 passed, same 4 golden failures; analyze clean |
| 3 | 03:40-05:46 | `domain_sync_test.dart`, 9 tests: an add made before the device cache answers keeps the cached list, a cached seen mark survives an early resync and a restart, the list loads 3 s after a failed resync once the server is back, refreshed usuals are saved to the device, a channel closing during close is not unsubscribed twice, household size up to 100 in analytics, route order numbers 10/20/30, no-store walking order hides nothing; plus one add-sheet test (text changed while its rows load: m010) | 99.27 (cov 99.27 %, 107/107) | kept | +9.28 > band; kills m010 m038 m040 m044 m066 m087 m092 m094 m103 m104; no survivor left; suite 1918 passed, same 4 golden failures; analyze clean |

### Harness fix after the baseline (20:40): timeouts on a loaded box

The first measurement of attempt 1 ran while job 98 measured on the same box. Its mutants ran
about 3x slower, and m038 and m040, both survivors in the baseline, ran past the 180 s timeout,
which counts as a kill. Applied by hand, m038 does not make the new test file hang (it passes in
4 s), so the timeout was load, not a test. That run was stopped and is not logged as a score.

Fix in `mutate.py`: a run past 180 s is retried once with 900 s, and only a second timeout
counts as a kill. This changes only the path a timeout takes, so only baseline mutants that
timed out can change. In both fresh baseline runs exactly one did: m078. It was rechecked alone
on the baseline tree under the fixed rule (`HC128_ONLY=m078`): it ran past 180 s and then past
900 s, so it is a real hang and stays killed. The baseline stands at 77.112. That stands in for
three full new baseline runs, which would have cost about 1.5 h of the 6 h on a loaded box.

### Harness fix 2 (01:58): kill a timed-out run's whole process group

`subprocess.run(timeout=...)` killed `flutter` but not its `flutter_tester` children. The tester
of m078's hanging run (a genuine infinite loop) kept running and grew to 4.2 GB in 70 minutes;
with orphans from earlier runs it filled RAM and swap, mem-guard paused the job for long
stretches, and the box itself stalled twice (22:51-23:42 and 23:52-00:36, no mem-guard samples).
The first measurement of attempt 3 died with them at mutant 20 and is not logged as a score.
`failures()` now runs `flutter test` in its own session and kills the group on timeout. Only
processes of runs whose result was already taken are affected, so no mutant's outcome can
change and the baseline stands.

## Result

| part | baseline (median of 3) | final (attempt 3) |
| --- | --- | --- |
| **score** | **77.112** (band 1.542; 3 identical runs) | **99.27** (+22.16, +28.7 %) |
| coverage_pct (scoped) | 97.07 % (1592/1640) | 99.27 % (1628/1640) |
| mutation_score | 0.7944 (85/107) | 1.0 (107/107) |
| mutants total / killed / survived / equivalent / invalid | 140 / 85 / 22 (+2 eq.) / 2 / 31 | 140 / 107 / 0 / 2 / 31 |
| seed | 128 | 128 |
| suite (passed / skipped / failed) | 1880 / 90 / 4 | 1918 / 90 / 4 (same 4 box-only goldens) |
| suite wall s (informational, loaded box) | 63.4 / 73.9 / 81.2 | 76.4 |
| app-wide coverage (informational) | 90.67 % | 91.11 % |
| holdout mutation (100 mutants, seed 1280, informational) | 0.8471 (72/85, 15 invalid) | 0.8588 (73/85) |

Per file at the end: list_cubit 501/501, list_repository 220/231, list_cache 53/54, model
559/559, entry 115/115, suggestion 11/11, add_sheet_cubit 151/151, category_names 18/18.

**The holdout says the gain is fit to the sample.** On 100 mutants no test was written against,
the new tests kill one more (m068), 0.8471 to 0.8588. They pin the behaviours behind the sampled
mutants and the lines no test ran; they do not make the suite much stronger in general. What
the holdout still lets through, for a next round: the German plural/stem length cut-offs in
`entry.dart` (m028 m029 m031, `>=` vs `>`) and a second `caseSensitive` regex (m022); in the
cubit, the channel-up flag's start value (m036), `keyBefore` on a rename (m047), the dedupe-hint
filter (m062), the resync bookkeeping (m066) and the save-on-server-change check (m067); the
add sheet's stale-answer guard (m012); the repository's PGRST3 code check (m070); and
`withRouteOrder`'s twin in model.dart (m076).

What stays uncovered (12 lines on `c4aecf48`; 13 on today's main, 1742 - 1729: cubit 1, repository 11, cache 1, line numbers moved): `list_repository.dart` 14 and `list_cache.dart` 100 declare the
constructors of `abstract interface class`es, which fakes implement and never call; 392-393 is a
`StateError` branch `send` never reaches (adds and merges are routed off before it); 490-533 are
the realtime callbacks registered on a real `RealtimeChannel`, which would need a fake realtime
client (worth 8 lines, 0.49 points).

## Stop

No protocol rule fired: active time about 3.6 h of 6 (the clock ran 11.5 h, about 8 h of it
frozen by mem-guard pauses and two host stalls; estimated from mem-guard's log), every attempt
was kept, weekly usage 63 % before the Friday reset and 2 % after. The run stopped at the
score's ceiling: 100 is the most it can reach, 0.73 above 99.27, which is less than the 1.542
band, so no further step could be kept. Covering the realtime callbacks would be the next test,
but its +0.49 could not pass the band.

No production code changed. No list UI widget, sync wire contract, l10n, golden or other job's
file was touched; the new tests are three new files under `app/test/list/`.

## On today's main (after rebasing onto ec0a49e7)

Overnight main changed `list_cubit`, `list_repository`, `model` and `add_sheet_cubit`, so one
mutant of the scored list (m052) and five of the holdout no longer matched their lines and the
harness refused to run, as designed. The list the hill-climb ran on is kept as
`mutants.c4aecf48.tsv` (with `equivalent.c4aecf48.tsv`); `mutants.tsv` was regenerated with the
same seed on today's source (140 of 468 sites; neither old equivalent is in it, so
`equivalent.tsv` is empty), and nothing was written against it. One run each:

| part | today's main + #245, no job 128 test | this branch | this branch on c2ce938f (review 15) |
| --- | --- | --- | --- |
| **score** | 77.081 as measured, **76.244** corrected (below) | **88.988** (+12.74, +16.7 %) | **88.692** |
| coverage_pct | 97.19 % (1693/1742) | 99.25 % (1729/1742) | 98.92 % (1739/1758) |
| mutation_score | 92/116 = 0.7931, corrected 91/116 = 0.7845 | 104/116 = 0.8966 | 104/116 = 0.8966 |
| survived / invalid / equivalent | 24 (25 corrected) / 24 / 0 | 12 / 24 / 0 | 12 / 24 / 0 |
| suite passed / skipped / failed | 1916 / 90 / 4 | 1954 / 90 / 4 (same 4 goldens) | 2119 / 90 / 0 |

The third column is `measure.sh` on bea29b45 (main c2ce938f, review 15's run). #295 (Baumarkt)
added six rows to `_seeded` in `category_names.dart` (`paint`, `plumbing`, `electrical`,
`fasteners`, `building`, `garden`) that no test here reaches. The scoped files now have 1758
lines (1742 at the first measure), 6 of the new ones uncovered, so coverage and the score drop by
0.30 (inside the 1.542 band). The baseline was not re-measured on c2ce938f; it would lose the
same six lines.

The correction: m027 (`entry.dart:163`, `<` to `<=`) died in the baseline run and survived on
this branch. Rerun twice by hand on the baseline tree, only the 4 known goldens fail: it
survives. The baseline run had two mem-guard pauses (07:38, 07:54), the branch run none; a
test that measures time can fail when its process is stopped and resumed, and the harness
counts that as a kill. So this is a remaining harness weakness, not fixed here (fixing it
changes the measurement): a kill should be confirmed by a second run. The mutants this job's
tests were written for were each confirmed by hand by applying the mutant and running the new
file.

So on a sample no test here was written against, the tests raise the score 16.7 % and kill 13
more of 116 mutants. The holdout on the old source (one more of 85) shows less; the two samples
together say the tests generalise a little.

## Review 0 notes

**Which numbers reproduce from this head.** `tool/hillclimb/hc-domain-tests/measure.sh` on this
branch uses the regenerated `mutants.tsv` and gives **88.988** (99.25 % x 104/116), against
**76.244** for the same tree without the three `domain_*_test.dart` files (measured once, 77.081,
corrected for m027). That was the reproducible pair on ec0a49e7; on today's main it is 75.341 to
88.209 on 137 mutants ("Re-measured on 8f1e110d" below). The hill-climb's own figures, 77.112 to
99.27, were measured on `c4aecf48` + #245 with `mutants.c4aecf48.tsv` and `equivalent.c4aecf48.tsv`;
they reproduce only on that source (`HC128_MUTANTS=.../mutants.c4aecf48.tsv
HC128_EQUIVALENT=.../equivalent.c4aecf48.tsv python3 mutate.py run <copy of the repo>/app` on a
checkout of that commit with the tests added), because main has since rewritten lines the old list
anchors to. The test tree here differs from the one measured at 88.988 only by a comment in
`app/dart_test.yaml` (#245's review 5), which is not an input to the result.

**Re-measured after review 3's rebase onto 504a4c93.** #264 and #267 changed four scoped files
(`autoCategory` in the cubit, repository, model and add sheet cubit); all 140 mutants still anchor.
`measure.sh` on `54fe118f` (one run, 15:16-15:51 CET): **88.997** (99.26 % = 1736/1749 x
104/116), the same 104 kills and 12 survivors as at 88.988; full suite 2064 passed, 90 skipped,
0 failed. That run hit a harness bug, now fixed: with no failing test the failure-name `grep`
exited 1 and `pipefail` ended `measure.sh` without output (every earlier run had the 4 golden
failures).

**Re-measured after review 14's rebase onto c2ce938f (review 15).** #295 changed two scored
files, `model.dart` and `category_names.dart`. All 140 mutants still apply, but the six new
`_seeded` lines are uncovered: `measure.sh` on bea29b45 gives **88.692** (98.92 % = 1739/1758 x
104/116), suite 2119 passed, 90 skipped, 0 failed. This is the number that reproduces from the
head as of c2ce938f; 88.988 and 88.997 were the older bases'.

**After the rebase onto 41424fe7 (#311, review 15).** #311 rewrites `list_cubit.dart` and
`list_repository.dart`, and 3 scored mutants (m072, m075, m096) no longer match their lines, so
`measure.sh` stops before the mutation half, as designed. The coverage half alone, same scope:
98.68 % (1792/1816), full suite 2158 passed, 90 skipped, 0 failed. No score is claimed on
41424fe7; 88.692 on c2ce938f was the last full measure on all 140.

**Re-measured on 8f1e110d (review 16, lead addendum).** #298 (the store rating prompt) changes
`list_cubit.dart` again; the same 3 mutants are stale and no other. To get a score, both sides ran
on the 137 that still anchor, one run each on 356a174d (main 8f1e110d), 11:46-12:56 CET, no
timeouts:

```sh
grep -vP '^m(072|075|096)\t' tool/hillclimb/hc-domain-tests/mutants.tsv >/tmp/mutants.137.tsv
# NO_CACHE: the cache key hashes mutants.tsv, not HC128_MUTANTS
HC128_MUTANTS=/tmp/mutants.137.tsv NO_CACHE=1 tool/hillclimb/hc-domain-tests/measure.sh
```

| part | 8f1e110d without the job 128 tests | this branch on 8f1e110d |
| --- | --- | --- |
| **score** | **75.341** | **88.209** (+12.87, +17.1 %) |
| coverage_pct | 96.74 % (1778/1838) | 98.69 % (1814/1838) |
| mutation_score | 88/113 = 0.7788 | 101/113 = 0.8938 |
| survived / invalid / equivalent | 25 / 24 / 0 | 12 / 24 / 0 |
| suite passed / skipped / failed | 2183 / 90 / 0 | 2221 / 90 / 0 |
| app-wide coverage (informational) | 91.20 % | 91.60 % |

Per file on the branch: list_cubit 617/621, list_repository 257/270, list_cache 53/54, model
587/587, entry 115/115, suggestion 11/11, add_sheet_cubit 155/155, category_names 19/25 (the six
Baumarkt rows). The tests kill the same 13 mutants as on ec0a49e7 (m001 m002 m003 m008 m010
m011 m012 m016 m017 m041 m068 m094 m095), and m027 survives on both sides, so no mem-guard
correction is needed. The 3 dropped mutants were killed on both sides before, so the
comparison stays like for like: 91 -> 88 and 104 -> 101 of 116 -> 113. This is the pair that
reproduces from this head. `push-pr.sh` then met main at 147370cb (#313 and the nexus dashboard),
which changes nothing under `app/`, so no input of the measure moved.

**Kills confirmed by a second run.** The 13 mutants the new tests kill and the baseline does not
(m001 m002 m003 m008 m010 m011 m012 m016 m017 m041 m068 m094 m095) were run again alone on this
head (`HC128_ONLY`, 09:10-09:14, no mem-guard pause during the run): **13 of 13 killed**. Review 0 also applied
those 13 by hand against only the new files (13/13 killed) and 5 of them against every other
`test/list/` test (5/5 survive), so the kills come from the new tests.

**Deviations from the protocol, named as such.**
- Baseline run 3 reused run 2's mutant results (cache copied across a generator-only change of
  `mutate.py`); only runs 1 and 2 re-ran all 140 mutants. They agreed mutant for mutant.
- `mutate.py` changed twice after the baseline (timeout retry at 20:40, process-group kill at
  01:58) without the protocol's three new baseline runs. Each change can only alter mutants
  whose run timed out; the one baseline timeout (m078) was rechecked alone under the new rule.
- The stop is not one of the protocol's three rules (6 h, 5 tries without a kept step, 95 %
  usage). It is a reading of the keep rule: with 0.73 left to the ceiling of 100 and a band of
  1.542, no further step could be kept, so further tries could only end in reverts.
- The today's-main pair is one run each, not three.

**Two thin tests.** `'an edit reads as what it sets'` (`SetTo.toString`) and `'a rejection reads
as its message'` (`RejectedOp.toString`) assert debug output that nothing logs or sends (no
caller in `app/lib` formats either). They are the weakest behaviour claims here and mostly buy
four coverage lines. They stay because removing them would change the tree the reported number
was measured on; the lead may drop them (coverage would fall by those lines, about 0.2 points).

**Invalid mutants.** 31 of 140 (old list) and 24 of 140 (new list) do not compile (`!` removed
from a non-bool, `==` flipped in a const pattern, a literal flipped in a const context) and
leave the denominator. That is standard but wastes about a fifth of the sample; a generator that
skips such sites would sample more useful mutants. Not changed here, since it would change the
measurement.

**Follow-up.** The realtime callbacks in `list_repository.dart` (490-533) need a fake
`RealtimeChannel`. That is the live-sync path jobs 120 and 122 are fixing, so a test there is
worth more than its 0.49 points; it should be written with them.
