# Job 140: list.spec.ts "adds are grouped by category" flake (#112)

**What.** No app change. #112's cause was an app bug that job 52 had already fixed (#156,
c4d4090d, 2026-11-01). On the web, a click can reach the add field as a semantics focus or tap,
which never calls `TextField.onTap`, and so it opened no sheet. This job shows that this was the
cause, adds an e2e guard that forces the trigger, and records the evidence in
`docs/DECISIONS.md` ("Job 140").

**Where.**
- `e2e/tests/add-sheet.spec.ts`: "after a close, a focus or click that skips pointer events opens
  the sheet".
- `docs/DECISIONS.md`: "Job 140", the cause, the CI history and the before/after counts.

**How to verify.** `scripts/verify.sh --only e2e -- tests/add-sheet.spec.ts -g skips` passes. On
8e72815f (before job 52) the same test fails at "a DOM focus opens it".

**Results.**
- CI history, 1,766 e2e job logs from 10-22 to 11-06: the grouping test failed 3 times with #112's
  signature, all on 10-30 and all before c4d4090d. After the fix, 458 jobs ran it and none failed.
- Guard: before job 52, 0 of 10 passed; on main, 10 of 10 (CI).
- The grouping test on main with retries off: 15 of 15 plain, 15 of 15 under 4 s SIGSTOP pauses
  and 15 of 15 under 8 s pauses every 6 s, and 68 of 68 for three specs at two workers (CI).
  Stress didn't fail it before job 52 either. The trigger is rare and comes from the browser.
- On hz, release build of c7b23813: the guard failed 5 of 5 before job 52 and passed 5 of 5 after.
  The grouping test passed 10 of 10 under each of these: 8 CPU burners, the stack's containers
  paused 4 s every 6 s, and the runner and Chromium paused 1 s every 1 s.
- 20× on hz under the e2e lock: `tests/list.spec.ts` 80 passed (14.6m), the guard 20 passed (2.8m).

**Missing or blocked.** Nothing.
