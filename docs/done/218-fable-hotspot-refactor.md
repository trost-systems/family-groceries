# Job 218: hotspot refactors from evidence

The brief: find where jobs collide or where files only change together, from evidence, and land
small refactors there without changing behaviour. No scores from code-health products. The
measurements, the limits of each and the costs are in
[`docs/hillclimb/fable-improvement-2026-11.md`](../hillclimb/fable-improvement-2026-11.md),
section "Job 218"; this is the short version.

## What was measured

Scripts in `tool/hotspots/` produce the numbers; rerun them to see whether a hotspot cooled down.

- `history.py`: change counts and co-change on main. `docs/DECISIONS.md` changed in 209 of 315
  commits, `DONE_SUMMARY.md` in 165.
- `conflicts.py`: conflicts in the job agents' transcripts. 79 of 198 jobs had stopped in one of
  the logs every job appends to; in 102 of 145 conflict events nothing else conflicted.
- `replay.py`: main's history of a file replayed as rebases. 256 stops in the logs with git's
  default merge.
- `stale-head.py`: 17 lands in 16 jobs were refused as "behind main" right after their own push
  (by 07:05 on 14 November).
- `e2e-duplicates.mjs`: 13 spare copies of helpers in the e2e specs, 44 lines. Left alone.

## What changed

Three PRs, none with a change users or the app's behaviour could show. Changelog `none` each.

1. **Appended log sections merge themselves** (#426, on main as `fe56ff6e`). A merge driver,
   `scripts/merge-append-log.sh`, for the five logs in `.gitattributes`: two sections added at
   the same place both stay, main's first. It still stops on an edit of existing lines, an entry
   that is already there and a follow-up without its own `##` heading. `push-pr.sh`'s rebase
   installs it in the clone. On the replay 238 of 256 stops go away; 235 of the merged results
   are what landed byte for byte, and the other three hold the same lines (two sections in the
   other order twice, a blank line once).
2. **The db gate finds its integration tests by pattern** (#438, on main as `5c83230d`).
   `scripts/gates/db.sh` ran them from a list every such job appended to; now it runs
   `'**/*_integration_test.ts'`. A file that reads `FG_DB_TEST` under another name stops the
   gate. The same tests run: CI's db job passed 20 files and 128 tests with the list (on
   `055d33ec`, run 43568327834) and the same 128 with the pattern on this PR's landed head
   (`5642a208`, run 43586832198), now in path order.
3. **merge-pr.sh waits for GitHub's record of the pushed head** (this PR). It takes the head
   from the branch and gives the record up to 2 min, so `push-pr.sh && merge-pr.sh --wait` can
   run in one hold of the merge lock, without a `sleep` in between (shown against the test's
   fake `gh`; this PR's own land runs that way). `scripts/landing-test.sh` has
   three new cases, among them the refusal when main really moved, which had no test.

## Skipped, with the reason

- The list cluster (`list_cubit.dart`, `list_repository.dart`, `model.dart`, `list_screen.dart`:
  the strongest co-change), `more_screen.dart` with the router, `app.dart` with `main.dart`:
  in-flight jobs own these files (212, 206, #281).
- `FEATURES-FOR-WRITERS.md` and the feature files: jobs edit sections in place, so the driver
  does not fit; job 219 works on the verify skill.
- `scripts/gates/lint.sh` (one sentence and one line per script test): PR #420 edited it and
  was open until the last morning. In `docs/NEEDS_LEAD.md` as a small job for later.
- Goldens, the ARB file, `ci.yml` with `verify.sh`, `e2e/tests/helpers.ts`: measured, nothing
  worth a refactor. The table "Hotspots after PR 1" has a line for each.
- The merge queue itself moves at one CI run per land (a median 25 min between main's commits
  on the night of 13 November). That is the lead's design; the numbers are in `docs/NEEDS_LEAD.md`.

## Checks and reviews

- Build and every review on `claude-fable-5-2`. PR 1 took seven review rounds to its PASS, PR 2
  three, PR 3 three (the last on the closing docs). Each PR merged on a green `ci-ok` on its exact head, under the merge lock.
- PR 1's test (`scripts/merge-append-log-test.sh`, lint gate) fails for 50 mutants of the
  driver and its wiring; PR 3's cases for six mutants of `merge-pr.sh`.
- No test, CI job or security gate was weakened. PR 2 swaps the gate's list for a pattern and
  adds a check for what the list used to catch (a renamed test).

## Cost

Measured at 11:50 on 14 November, PR 3's own land not included; details and limits in the
hillclimb doc, "Landing and totals".

- Wall time 16 h 3 min from the start (13 November, 19:47), 6 h 55 min of it stopped by the
  usage limit, and most of the second morning waiting for the merge lock and CI.
- Tokens on `claude-fable-5-2`, from the transcripts' usage fields: 4.03 M written to the cache,
  95.7 M read from it, 1.21 M put out, main session and 15 subagent runs together.
- PR 1 took 9 h 8 min from its review PASS to main: one land lost to GitHub's stale record of
  the head (what PR 3 fixes), then the usage stop. PR 2's first turn at the lock ended without
  a merge, because its iOS job ran 33 min and `merge-pr.sh --wait` gives up after 30. The
  second turn came 2 h 5 min later and needed one more CI run, since main had moved.
- CI on the landed heads: 26 min (PR 1) and 31 min (PR 2), each green at the first
  attempt. No flaky run.

## For the lead and for Peter

- `docs/NEEDS_LEAD.md`, two sections "Job 218": a PR that conflicts only in the logs needs no
  rebase job any more (GitHub still shows it as CONFLICTING until its next push); land scripts
  can drop their `sleep 20`; the lint gate's test list and the merge queue's pace are left open.
- Nothing for Peter to do. No flag: nothing here reaches users. The scripts take effect for a
  job as soon as its branch is on a main that has them.
