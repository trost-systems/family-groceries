# Job 141: feedback.spec.ts "a note from More": the add sheet that did not open (issue #137)

**What.** No code change. The flake in `feedback.spec.ts:55` was an app bug that job 52 fixed
(#156, c4d4090d, 2026-11-01). Job 76 (#205) hardened the fix. This PR records the cause and the
proof, and closes #137.

**Root cause** (DECISIONS, Job 141). In #137's run (head b1c1aa8, 2026-10-31), the test's third
`addItem` clicked the add field 64 ms after Escape closed the sheet. The field got a cursor, but
no sheet opened. That build opened the sheet only from `TextField.onTap`. On the web with
semantics on, a click on the field sometimes arrives as a semantics tap or focus action, which
focuses the field and never calls `onTap`. Since c4d4090d, the field's next focus after a close
opens the sheet, whatever route the click takes.

**Where.**
- `docs/DECISIONS.md`: Job 141.
- `docs/screenshots/141/ci-137-frames.png`: the CI trace's frames around the failing click. The
  sheet closes, then the field shows a cursor and no sheet.

**Verify.**
- CI history: 1,291 `e2e-results` artifacts from 2026-10-28 to 2026-11-06, split by whether the
  head contains c4d4090d. Without it, feedback.spec.ts:55 failed 16 of 160 results, and the sheet
  did not open 48 times in six tests of four spec files. With it, feedback:55 failed 0 of 118, and the sheet did
  not open once, in job 135's new gutter test on its own branch.
- Regression guard: `add_sheet_test.dart` "after closing, a semantics tap/focus on the field
  opens the sheet again" fails 2 of 2 with the open-on-focus branch removed, and passes 2 of 2
  as on main.
- Local, retries off, 10 runs per condition (none, 12 CPU burners, 1 s pause every 2 s, 4 s
  pause every 6 s, pauses plus burners): before (8e72815f, just before c4d4090d) 5 of 50 failed,
  2 of them with no stress, all at `enterItem` waiting for the sheet
  (`docs/screenshots/141/before-c4d4090d-local-failed.png`). After (main ec0a49e7) 50 of 50 passed.
- `flock /tmp/fg-e2e.lock npx playwright test tests/feedback.spec.ts --repeat-each=20 --workers=1
  --retries=0` on main ec0a49e7: 160 passed (28.3 min, host load 22).
- GitHub Actions, main 6da4267: `tests/feedback.spec.ts --repeat-each=20 --workers=1
  --retries=0` passed 160 of 160 (run 42155516483).

**For job 142.** #111, #131 and #159 are the same `enterItem` step and all predate c4d4090d.

**Missing or blocked.** Nothing. Which of the two semantics routes a click takes was not traced,
here or in job 52. The app no longer depends on it.
