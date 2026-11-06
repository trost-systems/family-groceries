# Job 119: stores.spec.ts flakes (#74, #75, #76)

**What.** Each of the three flaky stores.spec.ts tests was reproduced under stress on main's code
with retries off. The one that still failed got a root-cause fix. PR #261. Details are in
DECISIONS "Job 119".

- **#76 STORE ORDERING (fixed).** This was a test race. `dragHandle` returned once the mouse was
  up, but the drop writes the new order in the background. The test then reloaded the page, and
  when the write was slow the reload cancelled it, so "the EDEKA order was saved" failed. By
  default `dragHandle` now waits for the server's answer to the drop's write and checks that it
  succeeded. STORE ORDERING and the categories test use that.
- **#74's budget unchanged (review 0).** #74's 3 s check counts Peter's write plus the fan-out to
  Lea, as on main. It calls `dragHandle(..., { untilSaved: false })`, which returns at the
  mouse-up. A probe that holds the write for 4 s fails #74's check (2 of 2), as on main; the
  save-wait would have passed it (2 of 2). No timeout, budget or assertion changed in any test.
- **#74 live layout sync and #75 categories (host pause only, left open).** Neither failed in
  24 of 24 stressed runs each on main's code. Every recorded failure fell in a VM hole of 403 to
  2613 s. DECISIONS 119.4 also records what was checked in #75's delete-with-reassignment step.
  NEEDS_LEAD "Job 119" asks the lead to close or keep both issues, and whether reorders should be
  queued like item ops (a reload right after a drop loses the reorder).

**Where.**
- `e2e/tests/catalog.ts`: `dragHandle` with `untilSaved` (default true).
- `e2e/tests/stores.spec.ts`: #74 passes `untilSaved: false`.
- `scripts/e2e-stress.sh`: the stressed repro. `--on S --every P` pauses the browser, the runner
  or the stack S s of every P s. `--cpus` pins the run to fewer CPUs. An exit trap unpauses
  everything.
- `AGENTS.md` (scripts list), `docs/DECISIONS.md` "Job 119", `docs/NEEDS_LEAD.md` "Job 119".

**Evidence.** The runs used the release web build on hz, `--workers=1 --retries=0`, under
`/tmp/fg-e2e.lock`. "S of P" means paused S s of every P s.

| Run | Main's test code | Final code (after review 0) |
| --- | --- | --- |
| STORE ORDERING, stack 2 of 8 | 5 of 12 failed ("the EDEKA order was saved") | 8 of 8 passed |
| #74 and #75, runner 3 of 8 | 8 of 8 | 8 of 8 |
| #74 and #75, browser 3 of 8 | 8 of 8 | 7 of 8 (the pause covered the budget, DECISIONS 119.7) |
| #74 and #75, stack 2 of 8 / 3 of 8 | 8 / 8 of 8 | 8 / 8 of 8 |
| #74 and #75: browser 5 of 10, runner 8 of 14, one CPU | 6 of 6, 6 of 6, 4 of 4 | not rerun |
| #74 probe, `set_store_layout` held 4 s | | fails 2 of 2 (budget kept) |
| `tests/stores.spec.ts --repeat-each=20`, no stress | | `60 passed (27.8m)` |

The first round, before review 0, also passed `60 passed (24.5m)`.

**Verify.** Start the job's stack and web build (`scripts/gates/e2e.sh` does both). Then run
`flock /tmp/fg-e2e.lock scripts/e2e-stress.sh --target stack --on 2 --every 8 --
tests/stores.spec.ts -g 'STORE ORDERING' --workers=1 --retries=0 --repeat-each=8`. With main's
`dragHandle` it fails at "the EDEKA order was saved"; with the fix it passes.

**Open.**
- #74 and #75 stay open for the lead.
- The reorder-queue question is in NEEDS_LEAD.
- Catalog reloads are not ordered. A slow older fetch can show a stale catalog until the next
  change. This was checked and not observed, so nothing changed (DECISIONS 119.5).
- Job 122 kept its own `scripts/e2e-pause.sh` local, not in its PR (#263). BOARD note posted.

**Review 1 (2026-11-06): rebase only.** Rebased onto aae7fb34. `dragHandle` keeps main's new body
lines: #288's `clearOfBottom` and #237's `boxOf`. On top of them sit this PR's `untilSaved` wait
and #74's opt-out. The DECISIONS and NEEDS_LEAD sections stay after main's newer ones.
`deno run -A tool/lint/ts/strict.ts` reports 246 files clean, and the gitleaks and lint gates pass.
CI's e2e on the new head is the e2e proof for this round. The local e2e lock queue was not waited
on for a rebase that changes no logic.

**Review 2 (2026-11-06): rebase only.** Rebased onto 5e639d3a, after #249, #285 and #289. Only
the DECISIONS append conflicted, and Job 119's section stays after main's newer ones. The PR's
diff is unchanged: 7 files, the same lines in `catalog.ts` and `stores.spec.ts`.
`tool/lint/ts/strict.ts` reports 247 files clean, and the gitleaks and lint gates pass. CI's e2e
on the new head is this round's e2e proof.
