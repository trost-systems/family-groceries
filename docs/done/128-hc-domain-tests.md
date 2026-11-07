# Job 128: hc-domain-tests, domain behaviour-test hill-climb

- **What:** behaviour tests for the list domain (sync, cache, dedupe, categories), score =
  coverage of 8 scoped files x mutation score on a seeded sample (seed 128).
  76.24 -> 88.69 on main c2ce938f (+16.3 %), on a fresh seed-128 sample no test was written
  against: mutation 91 -> 104 of 116, coverage 97.19 -> 98.92 %. 88.69 is `measure.sh` on
  bea29b45 (main c2ce938f, review 15); before #295 added six uncovered `_seeded` lines it was
  88.99 (99.25 %, 1729/1742). The 76.24 baseline was measured once, on ec0a49e7. The
  hill-climb sample itself (`c4aecf48` + #245, 140 mutants): 77.11 -> 99.27 (+28.7 %), coverage 97.07 -> 99.27 %,
  mutation 85/107 -> 107/107. A holdout of 100 mutants (seed 1280) moves only 72 -> 73 of 85:
  much of the gain is fit to the sample.
- **Where:** `app/test/list/domain_coverage_test.dart`, `domain_add_sheet_test.dart`,
  `domain_sync_test.dart` (38 tests, new files only); harness `tool/hillclimb/hc-domain-tests/`
  (`measure.sh`, `mutate.py`, `mutants.tsv`, `equivalent.tsv`, `holdout.sh`, `holdout.tsv`);
  log `docs/hillclimb/hc-domain-tests.md`; decisions in `docs/DECISIONS.md` (Job 128).
- **On main:** #245 (job 98) landed as 45a40cbe; the branch is now main plus job 128's paths
  only (last rebased onto c2ce938f after review 14, DECISIONS.md kept both sides).
- **Verify:** `tool/hillclimb/hc-domain-tests/measure.sh` (one JSON line, ~30-60 min);
  `flutter test test/list/domain_*_test.dart`.
- **Tests:** full suite on the head rebased onto 41424fe7: 2158 passed / 90 skipped / 0 failed (2119 / 90 / 0 on bea29b45, review 15); `flutter analyze` clean.
- **Harness bugs found and fixed:** timeouts under load counted as kills (now retried at 900 s);
  timed-out runs left `flutter_tester` orphans that grew to 4 GB (now the process group is
  killed). Job 98's `mutate.py` has the same orphan bug.
- **Known harness weakness:** a mem-guard pause can make a timing test fail and count as a kill
  (seen once, m027); a kill should be confirmed by a second run. The 13 kills that differ from the
  baseline were rerun alone on the final head (review 0): 13 of 13 killed.
- **Review 0:** the branch is rebuilt as #245's head plus job 128's paths only (it had
  squashed an older #245 snapshot that conflicted with #245's later rounds); deviations from
  the protocol and the two thin `toString` tests are named in the log's "Review 0 notes".
- **Review 3:** rebased onto 504a4c93 (DECISIONS.md conflict with #264, both kept); the stale
  "stacked on #245" text in the PR body, the log and DECISIONS is now past tense; the uncovered
  count on today's main (13) and the score's denominator are spelled out in the log; re-measured on
  504a4c93: 88.997 (104/116, 1736/1749 lines), and `measure.sh` no longer exits when no test fails.
- **Review 4:** rebased onto aae7fb34 (DECISIONS.md conflict with #284/#293's job 140 section,
  both kept); the 38 domain tests pass on the rebased tree. Not re-measured: #293 and #284 change
  the edit sheet and an e2e spec, no file the mutants sit in.
- **Review 5:** rebased onto 02cc9da8 (DECISIONS.md conflict with #294's job 148 section, both
  kept); the 38 domain tests pass on the rebased tree. Not re-measured: #294 changes list screens
  and widgets, none of the eight files the mutants sit in (`mutate.TARGETS`).
- **Review 6:** rebased onto 5e639d3a (DECISIONS.md conflict with #249/#285/#289's job 113, 142
  and 143 sections, all kept); the 38 domain tests pass on the rebased tree. Not re-measured: those
  PRs change CI scripts, workflows and e2e specs, nothing under `app/`.
- **Review 7:** rebased onto 03abc2fa (DECISIONS.md conflict with #261's job 119 section, both
  kept); the 38 domain tests pass on the rebased tree. Not re-measured: #261 changes e2e specs,
  `scripts/e2e-stress.sh` and docs, nothing under `app/`.
- **Review 8:** rebased onto 598291fc and, last, 944d2398 (DECISIONS.md conflicts with #290's
  job 145, #276's job 120 and #266's job 123 sections; all kept in main's order, job 128's last);
  the 38 domain tests pass on the rebased tree. Not re-measured: #290 changes the site, #276 and
  #266 e2e specs, nothing under `app/` or `supabase/`.
- **Review 9:** rebased onto 141b245b (DECISIONS.md conflict with #304's job 158 section, both
  kept in main's order, job 128's last); the 38 domain tests pass on the rebased tree. Not
  re-measured: #304 changes `mcp-proxy/`, scripts and docs, nothing under `app/` or `supabase/`.
- **Review 10:** rebased onto 10853dcc (DECISIONS.md conflict with #301's job 150 section, both
  kept in main's order, job 128's last); the 679 tests in `app/test/list/` pass on the rebased
  tree. Not re-measured: #301 touches `list_repository.dart` (one added line below the parse
  answer) and `list_screen.dart`/`dictation.dart`, not the mutated lines; all 140 scored mutants
  still anchor on the rebased source (`mutate.py`'s stale check). Holdout m043-m045, m048, m049
  no longer anchor in `list_cubit.dart`, already so on 141b245b; the holdout is informational.
- **Review 11:** rebased onto 364f0a6a (DECISIONS.md conflict with #296's job 152 section, both
  kept in main's order, job 128's last); the 706 tests in `app/test/list/` pass on the rebased
  tree. Not re-measured: #296 changes `list_screen.dart`, `name_dialog.dart`, `field_border.dart` and
  `access_screen.dart`, none of the six mutated files.
- **Review 12:** rebased onto 86316e91 (DECISIONS.md conflict with #307's job 160 section, both
  kept in main's order, job 128's last). Not re-measured: #307 changes only
  `FEATURES-FOR-WRITERS.md` and `docs/DECISIONS.md`, nothing under `app/` or `supabase/`.
- **Review 13:** rebased onto 9a492dfe (DECISIONS.md conflict with #308's job 159 section, both
  kept in main's order, job 128's last); the 708 tests in `app/test/list/` pass on the rebased
  tree. Not re-measured: #308 changes `list_screen.dart`, `stores_screen.dart`, the shell and the
  voice parser, none of the six mutated files.
- **Review 14:** rebased onto c2ce938f (#295, Baumarkt; DECISIONS.md conflict with job 162's
  section, both kept, job 128's last). #295 changes two scored files, `model.dart`
  (`withStoreName` keeps the `hardware` seed key) and `category_names.dart` (seven map rows): all
  140 scored mutants still apply. Not re-measured, which was wrong (review 15): the mutants
  still apply, but coverage is half the score. Holdout m075 sat on the rewritten `seedKey` line
  and is stale now (6 stale holdout mutants).
- **Review 15:** `measure.sh` on bea29b45 (reviewer's run, 07:33-08:03 CET): **88.692**, coverage
  98.92 % (1739/1758) x 104/116; same kills and survivors as before, suite 2119 / 90 / 0. The
  drop from 88.988 is #295's: its six new `_seeded` rows in `category_names.dart` (`paint`,
  `plumbing`, `electrical`, `fasteners`, `building`, `garden`) are not covered by this job's
  `categoryName` tests. Headline numbers corrected to 88.69 in this file, the log, DONE_SUMMARY
  and the PR; no test added (the climb has stopped). A rebase that touches a `mutate.TARGETS` file
  now needs a `measure.sh` run, not only the stale-mutant check.
- **Review 15, rebase:** `push-pr.sh` met main at 41424fe7 (#311, the sync indicator; DECISIONS.md
  conflict with job 161's section, both kept, job 128's last). #311 rewrites `list_cubit.dart` and
  `list_repository.dart`: 3 of the 140 scored mutants (m072, m075 on `_flushing`, m096 on the
  PGRST3 check) no longer match, so `mutate.py` refuses the mutation half, as designed; no score
  on 41424fe7. The coverage half on 41424fe7: 98.68 % (1792/1816; cubit 595/599, repository
  257/270, cache 53/54, `category_names` 19/25, the rest full), full suite 2158 passed, 90
  skipped, 0 failed. 88.692 on c2ce938f stays the last full measure; a new one needs a regenerated
  `mutants.tsv` and a new baseline, which is a new climb, not this PR.
- **Stop:** the ceiling. 0.73 left to 100 is under the 1.542 band. No production code changed.
