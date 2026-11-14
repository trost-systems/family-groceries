# Fable improvement programme, November 2026

Jobs 218 to 224 record here what they measured, what they changed and what it cost. Each job
appends one `## Job <n>` section at the end of the file and adds later rounds as `###` subsections
of its own section. Numbers are measured unless a line says otherwise; what could not be measured
is labelled as such.

## Job 218: coupled hotspots and merge collisions, 2026-11-13

The brief: find where jobs collide or where files only change together, from evidence, and land
small refactors there without changing behaviour. No scores from code-health products.

### Evidence

Three scripts in `tool/hotspots/` produce every number below; rerun them to check or to see
whether a hotspot cooled down.

**Where main changes** (`tool/hotspots/history.py`, 315 commits on main `61434faf`, one commit
per PR; lines at that commit). A selection of the script's list: the logs, then the files this
section talks about. The generated l10n files, the verify skill's files and the tests follow their
sources and are left out.

| Commits | Lines | File |
| ---: | ---: | --- |
| 209 | 12,085 | `docs/DECISIONS.md` |
| 165 | 742 | `DONE_SUMMARY.md` |
| 79 | 1,787 | `docs/NEEDS_PETER.md` |
| 74 | (moved) | `FEATURES-FOR-WRITERS.md`, counted under its path before the rename |
| 73 | 1,315 | `app/l10n/app_de.arb` (and the generated l10n files with it) |
| 49 | 203 | `AGENTS.md` |
| 48 | 2,153 | `docs/NEEDS_LEAD.md` |
| 41 | 967 | `e2e/tests/helpers.ts` |
| 39 | 1,212 | `app/lib/list/list_screen.dart` |
| 33 | 1,915 | `app/lib/list/list_cubit.dart` |
| 32 | 536 | `docs/ANALYTICS.md` |
| 30 | 715 | `app/lib/more/more_screen.dart` |
| 30 | 224 | `app/lib/main.dart` |
| 29 | 352 | `.github/workflows/ci.yml` |
| 27 | 62 | `scripts/gates/db.sh` |

**What changes together** (same script; code files only, sweeps over 60 files skipped; degree is
the share of the rarer file's commits that also touch the other):

| Shared commits | Degree | Pair |
| ---: | ---: | --- |
| 21 | 0.88 | `list_cubit.dart`, `list_cubit_test.dart` |
| 20 | 0.95 | `list_cubit.dart`, `test/list/fake_repository.dart` |
| 17 | 0.94 | `list_cubit.dart`, `list/model.dart` |
| 17 | 0.89 | `list_cubit.dart`, `list_repository.dart` |
| 13 | 0.76 | `more_screen.dart`, `test/more/more_harness.dart` |
| 12 | 0.86 | `scripts/backup/fixtures.sql`, `supabase/tests/account_deletion.test.sql` |
| 12 | 0.67 | `app/app.dart`, `main.dart` |
| 11 | 1.00 | `ci.yml`, `scripts/verify.sh` |
| 11 | 0.73 | `app/router.dart`, `more_screen.dart` |

Change counts say where edits meet, not that they collide. The next two measure collisions.

**Conflicts the job agents ran into** (`tool/hotspots/conflicts.py ~/groceries-ops/jobs`, the
transcripts of 198 jobs at 20:51, this job's left out; main's history is linear and keeps no
trace of a conflict):

| Conflict events | Jobs | File |
| ---: | ---: | --- |
| 118 | 78 | `docs/DECISIONS.md` |
| 17 | 14 | `DONE_SUMMARY.md` |
| 15 | 12 | `docs/NEEDS_LEAD.md` |
| 11 | 9 | `FEATURES-FOR-WRITERS.md` |
| 5 | 5 | `docs/NEEDS_PETER.md` |
| 4 | 3 | each of 12 list and add-sheet goldens (`app/test/design/goldens/*.png`) |
| 3 | 3 | `docs/PRIVACY_DATA_MAP.md` |
| 3 | 2 | `app/lib/list/list_screen.dart`, `docs/ANALYTICS.md`, `scripts/gates/db.sh` (each) |

- 79 of 198 jobs (40 %) stopped at least once in a conflict in one of the logs every job appends
  to. In 102 of all 145 conflict events nothing else conflicted.
- 64 times the transcript goes on from such an event to a finished rebase or push (a second
  conflict on the way counts into the same stretch): median 9 assistant entries in the
  transcript (an entry is a part of a message; review 1 counted about two per message) and 55 s
  each. Their token cost is not measured (the transcripts repeat usage
  per stream chunk).
- An event is a tool result with git's conflict lines, so a job that only reads such lines counts
  too. Review 0 found one of those among the 145 (job 219 reading a table that quotes one).
- The larger cost is lead time, and it is only partly measured. A PR that is green and reviewed
  goes back to CONFLICTING whenever another job lands first, since every job appends to
  `docs/DECISIONS.md`. On 13 November the watcher queued two extra jobs for that alone
  (BOARD 18:15 `204b-rebase-merge-400`, at 19:46 "Only conflicts were DECISIONS.md appends";
  20:01 `204c-land-400`: "CONFLICTING again (DECISIONS.md appends only)") and a third,
  `207b-rebase-merge-405` (19:48), for `DECISIONS.md` and three feature files. Each such round is
  one more rebase, push and CI run (median 21 minutes from created to updated over the last 24
  green PR runs of `ci.yml`, `gh run list` at 21:25).
- A resolution by hand can go wrong without anyone noticing: PR #386 left a paragraph of job 196
  under job 189 in `DONE_SUMMARY.md`, glued to the next heading. PR 1 repairs it.

**Replay of main's history** (`tool/hotspots/replay.py`): for every PR that changed a file while
another PR changed it too, the script rebuilds the PR's change from the commit that landed, on
main as it was when the PR was opened, and merges it the way a rebase would. "Stops" is a
conflict. The branches themselves are gone, so the replay cannot see what a PR looked like before
its author resolved a conflict; it sees where the landed text would have sat.

| File | PRs with a concurrent change | Stop with git's default merge |
| --- | ---: | ---: |
| `docs/DECISIONS.md` | 145 of 209 | 141 |
| `DONE_SUMMARY.md` | 94 of 165 | 70 (2 more could not be rebuilt) |
| `docs/NEEDS_LEAD.md` | 31 of 48 | 27 |
| `docs/NEEDS_PETER.md` | 25 of 79 | 18 |
| `scripts/gates/db.sh` | 11 of 27 | 3 (6 more could not be rebuilt) |
| `docs/ANALYTICS.md` | 13 of 32 | 3 (1 more could not be rebuilt) |
| `AGENTS.md` | 18 of 49 | 2 (1 more could not be rebuilt) |
| `app/l10n/app_de.arb` | 33 of 73 | 2 (4 more could not be rebuilt) |
| `e2e/tests/helpers.ts` | 15 of 41 | 1 (1 more could not be rebuilt) |

The replay finds more conflicts than the transcripts because one push often rebased over several
landed PRs at once, and because early jobs have no transcript.

So the collisions are not in the code. They are in four files that every job appends to, and they
are a design problem: 200 jobs write to the same last line.

### PR 1: both appended sections stay (merge driver `append-log`)

`.gitattributes` names a merge driver for `docs/DECISIONS.md`, `docs/NEEDS_LEAD.md`,
`docs/NEEDS_PETER.md`, `DONE_SUMMARY.md` and this file. The driver is
`scripts/merge-append-log.sh`: when both sides only inserted text at the same place, both
insertions stay, ours first (in a rebase that is main's section, then the PR's). It stops in a
conflict, as git does today, when

- either side edits or deletes lines, both sides created the file, or the merged file would not
  end in a newline,
- an entry is there twice, as when a commit is replayed after its section landed: a line ours
  added is also the first line theirs adds, or a later heading of theirs of that level (where
  theirs starts without a heading: any line of theirs that is none), or
- ours adds a heading above the level theirs starts at: a paragraph or a `###` subsection that
  continues an older section would otherwise land under main's newest `##` section. A line that
  starts with one to six `#` and a space counts as a heading, also a comment in fenced code.

`rebase_onto_main` (`scripts/lib.sh`), which `push-pr.sh` runs, stores the driver's command in
the clone's git config, because git reads a driver's command only from there. A clone without it
merges as before. The script itself never writes a conflict: when it does not take a merge it
exits and leaves the file alone, and the stored command then runs `git merge-file`, which is what
git does without a driver (up to the diff algorithm, see the limits). A checkout without the
script, or an awk that fails, ends the same way.

Replayed on the conflicts above:

| File | Default conflicts | Merged by the driver | As it landed, byte for byte | Still stops |
| --- | ---: | ---: | ---: | ---: |
| `docs/DECISIONS.md` | 141 | 136 | 135 | 5 |
| `DONE_SUMMARY.md` | 70 | 59 | 58 | 11 |
| `docs/NEEDS_LEAD.md` | 27 | 27 | 27 | 0 |
| `docs/NEEDS_PETER.md` | 18 | 16 | 15 | 2 |
| Total | 256 | 238 (93 %) | 235 | 18 |

- The numbers are the same before and after the fixes of reviews 0 and 1 (main `61434faf`, 312
  merged PRs). Review 1 took the duplicate guard out and got the same 256 outcomes: it stops no
  merge in main's history.
- "As it landed" says what people did by hand, not that the driver is right: the PR's text is
  rebuilt from the landed commit, so the result matches whenever the landed text sits after
  main's. 235 of 238 hand resolutions were "main's section first, then the PR's", which is the
  order the driver produces.
- The three merged results that differ from what landed hold the same lines: two put two whole
  sections in the other order (#284, #5) and one differs in a blank line. No result differs in
  content.
- The 18 that still stop: 3 are edits of existing lines (#91 in `DECISIONS.md`, #89 and #336 in
  `NEEDS_PETER.md`). In the other 15 main had added a `##` section and the PR's text at the same
  place starts without a heading or with a lower one: a follow-up paragraph for an older section,
  a `### fix round` (#386, the PR whose hand resolution went wrong), a one-line entry. The third
  guard stops them on purpose, although 9 of them landed in exactly that order.
- Git's built-in `merge=union` was the first candidate and is rejected on the same replay: it
  never stops, 140 of its 256 results lose a blank line (the one before a heading), and for #89
  and #336 it keeps the old and the new version of an edited line side by side.

Live check on open PRs, each head rebased in a scratch clone onto main without and with the
driver (13 November). The first run, before review 0, on main `9efe6c19` at 20:15: #400, #408,
#409 and #410 stopped in `docs/DECISIONS.md` and #412 in `DONE_SUMMARY.md` without the driver, none
of them with it; #405 went from five conflicted files to its three feature files. The second run,
with the driver as it is now, on main `61434faf` at 20:51 (several of those PRs had been rebased
by hand in between):

| PR | Conflicted files without | With the driver |
| --- | --- | --- |
| #400, #409 | `docs/DECISIONS.md` | none |
| #412 | `DONE_SUMMARY.md` | none |
| #401 | `DONE_SUMMARY.md`, `docs/DECISIONS.md` | `docs/DECISIONS.md` |
| #281, #405, #408, #410, #414 to #421 | none | none |

#401 still stops on purpose: it adds its section as `### Job 205`, one level below the
`## Job 211` main added at the same place, and the third guard will not put it there.

The test `scripts/merge-append-log-test.sh` runs in the lint gate, in a scratch repository with
this checkout's `.gitattributes`. The log must stop a real rebase while the config has no driver.
Then `rebase_onto_main`, the rebase `push-pr.sh` runs, must store the command and merge the log,
while a file without the attribute still stops. The stored command then runs the way git runs it:
43 cases on three files, a file git cannot merge (it stays as it was and conflicts), and the
command in a directory without the script (a conflict has git's markers, a clean merge merges).
Last, a merge puts the branch's section first, and a branch stacked on one whose section already
landed stops with markers. 50 mutants of the script, the stored command, `install_merge_driver`,
its call in `rebase_onto_main` and `.gitattributes` all fail it (each guard removed or weakened,
the reset of each per-place variable, heading depth and form, the marker size without
each file and each marker character, markers inside a line, the final newline, the fallback and
its exit status, an older stored command kept, a log or the anchor dropped). Review 0 had found
four survivors in the first version, review 1 nine in the second, the missing call in
`rebase_onto_main` among them, and review 2 a dozen in the third. Reviews 3 and 5 found more.
Those that change a merge or the conflict left behind are covered now; the ones left concern
headings the script does not see by design (a tab, an indent), the path of one log in
`.gitattributes` and the two messages. It passes with gawk, `gawk --posix`, mawk and busybox
awk; macOS awk is not tried here (the Mac box runs `push-pr.sh`; an awk that fails there ends in
git's own merge, a conflict as today).

Limits:

- GitHub does not run merge drivers. A PR still shows CONFLICTING after another job appended; the
  next `push-pr.sh` rebases it without a stop.
- A clone learns the driver at the first `push-pr.sh` of a branch that has this change. A hand
  `git rebase` before that stops as before.
- Two sides that each add a numbered item to the same older section both stay, with the same
  number twice.
- For the five files `-X ours` and `-X theirs` no longer apply, and conflict markers are labelled
  `ours`, `base`, `theirs` instead of the commits.
- The duplicate guard compares lines, within one place and one heading level. A section that
  landed and is replayed under a changed heading is added a second time, and so is one that
  ours holds at another place of the file or that theirs replays below a higher heading.
- Headings are `#`s and a space at the start of a line. Underlined (setext) headings, indented
  and empty ones and `#` with a tab are not seen, so the third guard does not know them. The
  logs have no such heading (review 3 compared the script's headings with a Markdown parser's
  on the five files). A `#` comment at the start of a line in fenced code counts as a heading:
  after one in ours a merge may stop that could have been taken, and an insertion of theirs
  that starts with one counts as a new section.
- A fence that ours' insertion leaves open does not stop the merge: theirs lands in it, as the
  next section appended to that file would.
- The script and the fallback merge with `git merge-file`, which diffs with Myers. A rebase
  diffs with histogram, and `git merge-file` takes that option only from git 2.44 on (hz has
  2.43, so a branch for it could not be tested here and is left out). Where both sides insert the
  same repeated lines the two can place a hunk differently, both results valid. Review 0 measured
  it: 3 of 1,500 synthetic triples differed, none of 1,946 clean merges built from lines of
  `DECISIONS.md`.
- The command is one string in the clone's config. A later change of it makes worktrees on older
  commits write the old string back at their next `push-pr.sh`, until they are rebased; both
  versions run the script of their own checkout.
- Git runs the script of the tree that is checked out. Merging in a checkout of someone else's
  branch runs their copy, the same trust as running their `push-pr.sh`.
- A new log gets the driver only when it is listed in `.gitattributes`, and should be listed only
  if its entries start with a heading or are single lines.

Review 0 (in-job, `claude-fable-5-2`, verdict FIX) found three defects in the first version, all
fixed before the first push: a section already on main but not first there was added a second
time (reproduced with a real rebase of a stacked branch); a file `git merge-file` cannot read
came out empty with exit 0; and `DONE_SUMMARY.md` in `.gitattributes` also matched a sixth file
under `docs/design/`. The script used to write the conflict markers itself, so a script that
failed early left a conflict without markers; that is why the fallback moved into the stored
command. The rework took the script from three `git merge-file` runs to one.

Review 1 (in-job, `claude-fable-5-2`, verdict FIX, no must-fix) found no wrong merge on a
realistic file and seven smaller things, fixed as well: the test called `install_merge_driver`
itself, so the call in `rebase_onto_main` could vanish with green gates; a clean merge of a file
without a final newline gained one; an unclosed fence in ours hid ours' later headings from the
third guard; nine mutants survived; and two examples of rebase jobs in this file
and in `NEEDS_LEAD.md` named `207b`, which also had real conflicts.

Review 2 (in-job, `claude-fable-5-2`, verdict FIX, no must-fix) reran the replay, the history
table and the 33 mutants and got the same results, and its fuzz (2,800 triples against
`git merge-file`) found no merge that loses, repeats or reorders lines. It found one way to a
misplaced section: two lines of ours that start with inline code in three backticks counted as
a fence around the `##` heading between them. The logs have no such line. It also found two
sentences here that said more than the script does (both corrected), and a dozen mutants of its
own that the test let through: the test got 12 more cases.

Review 3 (in-job, `claude-fable-5-2`, verdict FIX on wording, no must-fix) fuzzed 9,000 triples
and found no merge that loses, repeats or reorders lines. Of 860 real merges cut from
`DECISIONS.md`, the 628 that git merges cleanly came out the same with the driver. It corrected
three sentences here.

Review 4 (in-job, `claude-fable-5-2`, a check of those corrections, verdict FIX on wording) read
review 3's fuzz output again: 148 of the 9,000 merges had put a section in the wrong place, 87
of them through a fence line inside another fence, the rest through headings and fences the
script did not see. That was the third review in a row with a hole in the fence rule, so the
rule went. Until then a `#` line in fenced code was not a heading, and a fence ours left open
stopped the merge. Now every line of ours that starts with one to six `#` and a space is a
heading, which only makes the third guard stop more often, and an open fence no longer stops
(the next section appended to that file lands in it either way). The replay does not change:
all 256 conflicts come out as before, and the four logs it covers have four fence lines at the
start of a line today and no `#` line between them.

Review 5 (in-job, `claude-fable-5-2`, on the script without fence parsing, verdict FIX on two
sentences, no must-fix) ran the script against the one before on 20,000 fuzzed triples. Where
both merge, the bytes are the same. The new one merges 1,451 that the old one stopped, all at a
fence ours leaves open, and stops 369 that the old one merged, all after a `#` line in a fence
of ours. By its Markdown reading 1,381 merges put theirs under a section of ours: 1,272 through
an open fence and 109 through headings the script does not see (both in the limits above),
none through a `#` heading at the start of a line. Of 900 real merges cut from `DECISIONS.md`,
the 665 that git merges cleanly came out the same with the driver.

Review 6 (in-job, `claude-fable-5-2`, a check of those corrections, 10 minutes, verdict PASS)
found both sentences fixed, the test, the mutants and the replay as written here, and nothing
wrong in 22 triples of its own beyond the limits. Its two should-fixes are in: where the driver
stops, the test now compares the file with git's own merge of the three (a script that had
already written into the file passed before), and the limit of the duplicate guard names place
and heading level.

Cost of PR 1 up to its review 2, measured at 21:55 (the job started at 19:47):

- Wall time 2 h 8 min. The three review rounds ran 17, 22 and 18 minutes of it, the three
  evidence searches (in parallel) 10 minutes.
- Tokens, from the usage fields of the job's transcripts, each message id counted once, every
  message on `claude-fable-5-2`: the main session wrote 0.71 M tokens to the cache, read 16.3 M
  from it and put out 253 k; the six subagents (three evidence searches, three reviews) wrote
  1.11 M, read 24.3 M and put out 345 k. Uncached input is under 1,000 tokens in both.
- Gates: `scripts/verify.sh --only gitleaks,lint,changelog,nexus` took 1 min 34 s with the new
  test in the lint gate; the test alone ran 0.9 s then and 1.2 to 1.6 s with the later cases.
  The other gates run in CI, not locally.
- Review rounds: 0 to 2 up to then (each FIX: review 0 with three must-fixes, 1 and 2 with
  none), then reviews 3 (18 minutes), 4 (5 minutes) and 5 (21 minutes), each FIX on wording
  without a must-fix, and review 6 (10 minutes), PASS, all before the first push. No flaky run
  so far.
- Not measured here: CI time and the land of this PR (they go into the job's done summary), and
  what the driver saves from now on. The 55 s and 9 entries per conflict above are what a stop
  cost before; how many stops go away shows in a rerun of `conflicts.py` in some weeks.

Not done: one decisions file per job (`docs/decisions/<job>.md`) would remove the shared file
altogether. It changes where 200 sections live, every doc that cites "DECISIONS job n" and the
lead's standing instructions, for the 7 % of conflicts the driver leaves. Recorded in
`docs/NEEDS_LEAD.md` as an option.

### Hotspots after PR 1

| Hotspot | Evidence | State |
| --- | --- | --- |
| The append-only logs | 79 of 198 jobs, 256 replayed conflicts | PR 1 |
| List cluster: `list_cubit.dart`, `list_repository.dart`, `model.dart`, `fake_repository.dart`, `list_screen.dart` | strongest co-change (0.88 to 0.95); 3 conflict events | Blocked: job 212 owns these files and jobs 221 and 222 wait for it |
| `FEATURES-FOR-WRITERS.md` and the verify feature files | 11 events in 9 jobs; #405 conflicted in three of them on 13 November | Not append-only: jobs edit a feature's section in place, so the driver does not fit. Job 219 works on the verify skill; left to it |
| Goldens (`app/test/design/goldens/*.png`) | 4 events in 3 jobs per file | Inherent to binary files: regenerate after the rebase. No refactor helps |
| `scripts/gates/db.sh` | 27 commits for 62 lines, 3 events, 3 replayed conflicts: every new integration test adds itself to one list | PR 2, after #405 and #431 (each added to the list) |
| `more_screen.dart` with `more_harness.dart` and `router.dart` | 0.73 to 0.76 | Blocked: #281 and job 206 |
| `app.dart` with `main.dart` | 0.67 | Blocked: `main.dart` is job 212's |
| `ci.yml` with `verify.sh` | 1.00 | By design: `scripts/check-gates.sh` ties one CI job to one gate script. Job 221 owns iteration speed |
| ARB and generated l10n | 73 commits, 2 replayed conflicts | Many edits, few collisions (keys are spread over the file). Nothing to fix |
| `e2e/tests/helpers.ts` | 41 commits, 1 replayed conflict | Few collisions, and little to dedupe: 13 spare copies of helpers in the specs, 44 lines (below). Not done |
| `merge-pr.sh` right after `push-pr.sh` | 17 lands in 16 jobs refused as "behind main" on GitHub's stale record of the head | PR 3 |
| `scripts/gates/lint.sh` | 15 commits, 3 events in 1 job; a header sentence and a line per script test | Left: PR #420 edited it and was open until 14 November 09:09 (PR 3, below) |

### PR 2: the db gate finds its integration tests by pattern

`scripts/gates/db.sh` ran the functions' integration tests from a list of file names, with a
comment line per job above it. A job with a new `*_integration_test.ts` added a name at the end
of the list and a comment at the end of the block, the same two places as every other such job.

- 17 of the 27 commits on main that touch the file add a name to the list, and 15 of them
  change nothing else in it. 2 more only add to the comment block (`git log --first-parent
  7bfae2ed -- scripts/gates/db.sh`, counted on each commit's diff of the file). The transcripts
  hold 3 conflict events in the file and the replay 3 conflicts, with 6 more PRs it could not
  rebuild. #405 (`95316b50`, 14 November) was commit 28, the 18th to add a name (the list's
  19th: one commit, `6d2a193e`, had added two). It added
  `_shared/default_list_integration_test.ts` and two comment lines, and this PR's rebase
  conflicted with it in both places. #431 (`b97deee7`, the same morning) added
  `feedback-digest/digest_integration_test.ts` and one comment line while this PR waited for
  PR 1 in the merge queue: the next rebase conflicted in both places again.
- A test file that nobody added to the list was never run, without a message. None was missing
  at `7bfae2ed`: the list and `find supabase/functions -name '*_integration_test.ts'` both name
  the same 18 files.

Now the step is `deno test ... '**/*_integration_test.ts'`. The pattern is quoted: deno expands
it, so the step does not depend on the shell's `globstar` setting. The comment block is gone;
every one of the files says in its header what it proves, and two lines in the gate say where
to look. A new integration test needs no edit of the gate.

The same tests run, measured on a fresh local stack on hz (block 628, the step cut out of both
versions of the script at `8c1a9177`, which has main's migrations up to `7bfae2ed`, `db reset`
in between):

| | Files | Tests passed | Failed | Ignored | Time |
| --- | ---: | ---: | ---: | ---: | ---: |
| The list (before) | 18 | 118 | 0 | 0 | 31 s |
| The pattern (after) | 18 | 118 | 0 | 0 | 31 s |

The 118 pairs of file and test name are the same in both runs. The order of the files is not.
Deno ran the listed files grouped by directory (`purchases`, `waitlist`, `_shared`, `alexa`,
`voice`, `api`, `mcp`), in the list's order inside a directory; it runs the pattern's files
sorted by path. Both orders pass, one run each. With no match the step fails ("No test modules
found", exit 1), so a typo in the pattern cannot pass as an empty run.

On main there were 19 files with #405 and 20 with #431. No local stack ran for them (the box
was short of memory on 14 November); the comparison is main's CI against the pattern's listing:

- The list, in CI's db job on `055d33ec` (PR 1's head on #431, run 43568327834, deno 2.9.8):
  20 files, 128 passed, 0 failed, 31 s.
- The pattern on that tree, run without a stack, so every test reports as ignored: the same 20
  files, 128 tests, and the same 128 pairs of file and test name as in the CI log. (Compared the
  same way at #405: 19 files, 127 tests, run 43561038725.)
- That the 128 pass in path order is for the db job of this PR's own CI run to show; its
  counts are in the job's done summary.

One check is new. The list failed the gate when a listed file was renamed or deleted (deno
found no such file); the pattern runs what matches, so a file renamed off the suffix would drop
out without a message. The functions gate skips these tests (they read `FG_DB_TEST`), so no gate
would run it. The gate now stops when a file under `supabase/functions` reads `FG_DB_TEST` and
is not named `*_integration_test.ts`. All 20 that read it have the suffix; renaming one, and
adding one in a new directory under another name, each stopped the check (run by hand on the
18 before #405, then undone).

Limits: a test that only passes after another file's leftovers shows up when the order changes,
and a new file now changes the order where it sorts in; no such pair showed in the one sorted
run of the 18 on a fresh database. The new check finds a misnamed test only if it is a tracked
`.ts` file that reads `FG_DB_TEST` itself. A deleted test file no longer fails the gate: the
list did when the name stayed behind, and nothing does now (a job that deleted both the file and
its name passed before too). The rest of the gate (pgTAP, the classifier checks, the latency
benches, db lint, the backup drill, the fixtures test) is untouched.

**Measured and not done: helpers copied between e2e specs.** `tool/hotspots/e2e-duplicates.mjs`
parses `e2e/tests/*.ts` and prints the top-level functions whose code is the same in several
files: 13 spare copies, 44 lines of the 11,741 in those files (`cat e2e/tests/*.ts | wc -l`,
0.4 %), 6 of the copies between `club.spec.ts` and `invite-loop.spec.ts`. Eight specs have a
`newPage`, in four variants (the viewport or the options they take differ). Moving them is a PR
that runs the whole e2e gate and takes a place in the merge queue for 44 lines, and
`invite-loop.spec.ts` is in open PR #429. Left as it is; the script is there to see whether the
number grows.

### PR 3: merge-pr.sh waits for GitHub's record of the pushed head

A land is `scripts/push-pr.sh && scripts/merge-pr.sh --wait <n>` in one hold of the merge lock.
push-pr.sh rebases onto `origin/main` and pushes. merge-pr.sh then asked GitHub for the PR's head
(`gh pr view --json headRefOid`), and for some seconds after a push that record still names the
head before it. The old head is not on top of main, so merge-pr.sh stopped with "is behind main;
run scripts/push-pr.sh", the lock was released, and the land went back to the end of the queue.

- `tool/hotspots/stale-head.py ~/groceries-ops/jobs` (14 November, 07:05, 211 jobs with
  transcripts): 17 pushes in 16 jobs were refused that way in the same tool result as the push.
  That the record lagged is inferred from the order of the two lines, not read from GitHub.
  Review 1 checked the other reading, a main that moved between the two scripts: each of the 17
  pushed commits has its parent on main, and main's next commit came after the refusal. 30 more
  "behind main" results in 17 jobs have no push before them (main had moved, two separate
  commands, a log read again, or this job's own test output) and are not counted.
- This job's PR 1 was one of the 17: queued at 23:09, at the lock at 01:40, pushed `6845602d`,
  refused right after the push, back to the queue (2 h 31 min for nothing).
- Jobs had started to work around it one by one. Of the 9 other job directories with a land
  script in `/tmp` on hz that morning, 4 had a `sleep 20` between the two scripts (jobs 201,
  208, 219 and 220). Job 219's also retried on "is behind main"; that the other sleeps were for
  the record is inferred, their scripts do not say. Scratch files, not versioned: seen, not
  reproducible later.

Now merge-pr.sh takes the head from the branch (`git fetch origin <branch>`, `FETCH_HEAD`) and
waits until the record names it: 5 s between two looks, 24 times (2 min), then it stops with a
message that says what to check. With the record current, as in every later run, the loop ends
at its first look. Nothing else in the script changed: the checks on the head, the wait for
`ci-ok` and `gh pr merge --match-head-commit` are as before, now on the branch's head.

`scripts/landing-test.sh` (lint gate) has three cases against its fake `gh`: a record that
names the old head for two looks (the PR merges, after two 5 s sleeps), one that never follows
(exit 1 after 24 sleeps, nothing merged), and a main that moved after the push with the record
current (still "is behind main", no sleep, nothing merged; no case covered that refusal
before). Six mutants of merge-pr.sh each fail it: main's script as it was, the head read from
the record again, giving up after 2 looks, never giving up, a 1 s sleep, and no check for
"behind main". The test ran 5.4 to 7.1 s with the three cases and 3.8 to 4.0 s before them
(three runs each, at different times on a box whose load changes: about two seconds more).

Limits: how long the record lags was not measured (the 20 s sleeps of the other jobs worked for
them). The wait covers the head only. A description edited after the push is still refused, as
before. Whether `gh pr checks` can show the old head's `ci-ok` for a moment after the record
names the new head was not tested; `gh pr merge --match-head-commit` names the head either way.

Two more places where lands meet, measured and left:

- `scripts/gates/lint.sh`: one header sentence names every script test and one line per test
  runs it, so two jobs with a new test conflict twice. 15 commits on main, 3 conflict events in
  1 job in the transcripts (job 219, whose land script then redid its edit of the file by
  itself), and this job's PR 1 met #423's test in the same sentence on 14 November. The tests
  have no common name (`landing-test.sh`, `release/test.sh`, `ci/download-test.sh`), so a
  pattern as in PR 2 needs renames first. PR #420 edited the file and was open until 09:09 on
  14 November, when this job's last PR was reviewed; not done, recorded in
  `docs/NEEDS_LEAD.md`.
- The merge queue itself. A land holds the lock from its push to the merge, so through one CI
  run. Between 13 November 23:12 and 14 November 06:40 main took 17 commits, a median 25 min
  apart, with jobs waiting all night; the last 26 green CI runs on PRs took a median 23.8 min
  from creation to green (2 min for a docs-only PR, 49.5 for one with a rerun). The queue moves
  at one CI run per land. Changing that (CI before the lock, or a merge queue on GitHub) is the
  lead's design and no refactor; the number is here for it.

### Landing and totals, 2026-11-14

| PR | Review rounds | Rebases that stopped | CI on the landed head | On main |
| --- | --- | --- | --- | --- |
| 1, #426: merge driver `append-log` | 7 (0 to 6: six FIX, then PASS) | 1, in `scripts/gates/lint.sh` | 26 min, first attempt | `fe56ff6e`, 14 November 08:17 |
| 2, #438: db gate by pattern | 3 (FIX, FIX, FIX on one clause, then PASS) | 2, both in the list it removes (#405, #431) | 31 min, first attempt (33 min on the head before it, `7eaff830`) | `5c83230d`, 14 November 12:16 |
| 3: merge-pr.sh waits for the record | 3 (FIX, PASS, and PASS on the closing docs) | 0 | in the job's done summary | in the job's done summary |

PR 2's own CI shows what its section left open: the db job on its landed head (`5642a208`, run
43586832198) ran the pattern's 20 files in path order, 128 passed, 0 failed, 27 s, the same
128 pairs of file and test name as the list's run on `055d33ec`. So did the run on the head
before it (`7eaff830`, run 43574486351, 30 s).

Every review ran on `claude-fable-5-2`, as did the build. No review found a change in what
the app or a gate does beyond what its PR says; the must-fixes were three in PR 1's review 0
(the driver's guards), none after.

**PR 1's way to main** took 9 h 8 min from its PASS (queued at the merge lock at 23:09 on 13
November) to the merge at 08:17:

- 2 h 31 min in the queue, then the push and the refusal on GitHub's stale record (PR 3).
- 4 h 55 min in which nobody queued it again: the job was stopped by its usage limit from 23:37
  to 06:32, and the land script had ended at 01:41.
- 1 h 16 min for the second try, 36 min of it the wait for the Mac's lock, which was not
  reachable, and 40 min behind two other lands (#431, and a try of #420 that failed in CI).
- 26 min for CI (run 43568327834, green at the first attempt), inside the lock.

The driver worked on its own PR. Before it was on main, this job's worktree had it through a
scratch entry in the clone's config (removed after the merge). The last rebase, from `95316b50`
onto `b97deee7`, met job 225's new section at the end of `docs/DECISIONS.md`: plain git stops
there (`git merge-tree` in a clone without the driver), the land's rebase did not, and main has
both sections, job 225's first. The hand rebase before it stopped once, in
`scripts/gates/lint.sh` on #423's test, and not in the logs.

It worked a second time from main, on PR 2's last rebase (from `86d5d8c5` onto `f80960a7`,
inside the lock at 11:46). Main had a new section at the end of `docs/DECISIONS.md` (job 225's
review 0), where PR 2 adds its own. Plain git stops there (`git merge-tree
--merge-base=86d5d8c5 f80960a7 7eaff830` in a clone without the driver); `push-pr.sh` ran
through and pushed. A stop would have cost that turn at the lock.

**The baseline for a later rerun.** `tool/hotspots/conflicts.py ~/groceries-ops/jobs
218-fable-hotspot-refactor` at 08:22 on 14 November, five minutes after the driver reached main:
168 conflict events in 210 jobs, 115 of them in the logs alone, 86 jobs with a conflict in a log
(145, 102 and 79 of 198 jobs at 20:51 the evening before). What the driver saves is the growth
of the 115 from here on; not measurable yet. Clones that have not run `push-pr.sh` from a branch
with PR 1 still stop as before.

**Cost of the whole job**, measured at 11:50 on 14 November (PR 3's own land is not in
it):

- Wall time: 16 h 3 min from the start at 19:47 on 13 November, 6 h 55 min of it stopped by the
  usage limit. Most of the rest of the second day was waiting for the merge lock and CI.
- Tokens, from the usage fields of the transcripts, each message id counted once, every model
  message on `claude-fable-5-2` (the two other entries are the harness's limit notices, without
  tokens): the main session wrote 1.56 M tokens to the cache, read 46.6 M from it and put out
  532 k; the 15 subagent runs (three evidence searches, the reviews; a
  reviewer asked again counts once) wrote 2.47 M, read 49.1 M and put out 678 k. Uncached
  input is about 1,000 tokens in each.
- Gates: the lint gates (`scripts/verify.sh --only gitleaks,lint,changelog,nexus`) ran before
  every push, 1.5 to 2 min each. The db gate did not run locally for PR 2's final base (no
  memory for a second stack on 14 November); CI's db job ran it.
- Flakes: none in this job's CI runs, each green at its first attempt.
- Failures: one land lost to the stale record (above); one usage-limit stop; a rebase of PR 2
  twice into the list it removes; and PR 2's first turn at the lock, which ended without a
  merge. Its CI run (43574486351) took 33 min, 33 of them the iOS job, and `merge-pr.sh --wait`
  gives up after 30. The run turned green 3 min later; the merge had to queue for the lock
  again (2 h 5 min, behind five other lands). By then main had moved, so the second turn was
  one more push and CI run (43586832198).
