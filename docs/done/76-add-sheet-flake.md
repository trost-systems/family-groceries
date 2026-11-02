# Job 76: the add-sheet.spec.ts:139 flake

## What was broken

`add-sheet.spec.ts:139` failed on CI for #199 and #197 at its last step: Tab, Tab, Enter adds a
row, then Escape, and the sheet was still open 10 s later. The CI trace's frames show that Escape
did close the sheet. About 50 ms later it opened again, empty
(`docs/screenshots/76/before-ci-reopen.png`). A user who presses Escape right after an add on the
web saw the same thing.

## Root cause

Logging on a local release web build (wasm names kept), plus a hook on `HTMLElement.focus`, traced
the reopen to `TextField`'s semantics `onFocus`. After an add, the refocus timer (DECISIONS 8.8)
focuses the field. In the next frame the engine focuses the DOM input, and its `focus` listener
reports that back as `SemanticsAction.focus`. Because a frame is rendering, the engine defers the
report with `Timer.run` (`platform_dispatcher.dart`, `invokeOnSemanticsAction`). An Escape queued
before that timer closes the sheet and arms `_openOnFocus`. Then the stale report focuses the field,
and `_openOnFocus` opens the sheet.

There was a second way to the same reopen. Enter while the rows are still loading waits in
`takeFirst`. An Escape meanwhile closed the sheet, the rows came, the item was added into the
closed sheet, and `_afterAdd` refocused the field. Locally this reopened 7 of 16 times with Enter,
then Escape at once.

## Fix

- `app/lib/list/list_screen.dart`: `_close` parks focus on the bar as before, but `_settleClose`
  arms `_openOnFocus` only after the next frame and a zero-delay timer. Timers of equal delay run
  in start order, so a report from before the close lands first. If it took focus, focus goes back
  to the bar.
- `app/lib/list/add_sheet/add_sheet_cubit.dart`: `takeFirst` adds nothing once the sheet closed
  while it waited. Before, whether it added depended on server timing.
- The assertion in the original test is unchanged: the test was right.

Decisions and the options dropped are in DECISIONS.md, "Job 76".

## Tests and proof

- New e2e test in `add-sheet.spec.ts`, "an Escape between the refocus after a row and its focus
  report closes the sheet for good". It forces the race every time with a hook that sends Escape on
  a zero-delay timer when the engine focuses the input. Old build: fails 3 of 3 (the probe for the
  same trigger reopened 18 of 18 times). Fixed build: passes 3 of 3 (19 of 19 in the probe).
- New widget test in `add_sheet_test.dart`, "Escape while Enter waits for its rows cancels the
  add". It fails on the old code (the add was sent) and passes with the fix.
- `npx playwright test tests/add-sheet.spec.ts --repeat-each=20 --workers=1 --retries=0` on the
  fixed release build: 180 passed (all 9 tests, 20 times each), 18.1 min, Hetzner runner.
- `scripts/verify.sh --only lint,flutter`: passed.
- Screenshots: `docs/screenshots/76/before-ci-reopen.png` (CI frames: added, closing, closed,
  reopened) and `docs/screenshots/76/after-stays-closed.png` (local frames of the new test: row
  focused, added, closing, closed, still closed).

## The WebKit install hang on the second shard

That was not a hang in Playwright. The runner image lacks WebKit's and Firefox's libraries, so
every e2e job runs `playwright install --with-deps`, which fetches 181 apt packages (114 MB) from
the Azure Ubuntu mirror. In #197's run the mirror gave about 50 kB/s for 30 minutes, until the job
timed out. It is rare (1 of 132 e2e setups in the last 40 CI runs), but each one costs a rerun.
`.github/actions/e2e-setup` now points apt's archive directory at a directory cached with
`actions/cache` (key: runner image and version, `e2e/package-lock.json`, ffmpeg). apt then fetches
only what is missing, and only `apt-get update` still reads the mirror. The first run on a new
runner image or Playwright version fills the cache.

## Missing or blocked

Nothing. The cache helps once CI has saved it. The PR's first run saves it and a later run
restores it; check for `Need to get 0 B` in the "Install Playwright" step.
