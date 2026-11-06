# Job 122: offline-start, list and edit-sheet flakes (2026-11-05)

PR: https://github.com/trost-systems/family-groceries/pull/263, titled "fix: offline-start, list
and edit-sheet flakes (queued sync, sign-out, edit writes)". It is ready for review and not
merged: the lead reviews and merges.

## What was built

1. **#63 fixed, in the app.** On the web, a click into the edit sheet's „Menge“ right after
   hovering or pressing „Eins mehr“ / „Eins weniger“ lost its focus. While a Material `Tooltip`
   shows, `OverlayPortal` grafts its overlay into the semantics tree, and the web engine moves
   the `<flt-semantics>` subtree holding the sheet into the graft and back. Chrome blurs the
   focused `<input>` on that move. The steppers (`_Stepper` in
   `app/lib/list/edit_item_sheet.dart`) now have no tooltip. Their icons keep the semantic
   labels. The e2e test passed only because `expectFieldValue`'s `toPass` clicked again after a
   10 s wait, twice per run.
2. **#62, #64, #71, #72: host pauses only.** No failure on main under pauses shorter than each
   test's budget, and no hidden wait in traces of passing runs. Evidence in
   `docs/DECISIONS.md` (Job 122) and `docs/NEEDS_LEAD.md`. The issues stay open for the lead.
3. **The offline queue stalls on a send that never answers, and stays that way (reviews 0
   and 1).** Review 0 asked for a fix; a 15 s timeout went in and review 1 proved it reorders
   writes (a late tick overwrote a later untick, since writes are last-write-wins). It is
   reverted: `list_cubit.dart` equals main. The cubit test „a later op waits for a slow send,
   so the last change wins“ keeps the order covered and fails with a timeout. The safe fix
   needs the server to ignore stale writes; it is a proposal in `docs/NEEDS_LEAD.md`, next to
   the refused-refresh call, the hover-hint trade-off and the other tooltips to check.
4. **`e2e/trace-slow-steps.mjs`** lists the slow steps in the traces of a run (passing runs
   too). It found #63.

## How to verify

- `cd app && flutter test test/list/edit_item_sheet_test.dart`. The test "hovering a stepper
  leaves the semantics tree as it is" fails on main and passes here.
- `cd e2e && npx playwright test tests/edit-sheet.spec.ts:46 --retries=0` on the release web
  build. On main it fails at "a click into Menge right after a stepper focuses it".
- `cd app && flutter test test/list/list_cubit_test.dart --plain-name "last change wins"`. It
  fails if `send` gets a timeout.
- `npx playwright test tests/edit-sheet.spec.ts:46 --trace on --output /tmp/r && node
  trace-slow-steps.mjs /tmp/r 3000`. On main this shows two 10 s `toBeFocused` waits on Menge.
  With the fix it shows none.

## Test results

- Widget test: fails on main, passes with the fix. `scripts/verify.sh --only
  gitleaks,lint,flutter` passed (1,846 + 336 tests).
- e2e on CI: the new check fails on main 2 of 2 and passes with the fix. The test takes 11 s
  instead of 33 s.
- #63 under 8 s SIGSTOP pauses every 6 s on CI (8 runs each): main 31.6 to 59.4 s, 4 of 8
  within 2.6 s of the 60 s timeout. With the fix 33.5 to 43.0 s.
- Main, retries off, all passed:
  - hz, 4 s every 6 s: 25 of 25.
  - CI, 2 s every 3 s: 30 of 30.
  - CI, 8 s every 6 s: 32 of 32.
- 20× on hz under the e2e lock, release web build with the fix: 240 passed (38.0 min) on
  7d2f3392 (offline-start 60, edit-sheet 100, list 80, 0 failed). Its app code is the final
  one: the stepper fix only, `list_cubit.dart` as on main. A second 20× on d3fc860d, with the
  review-0 send timeout that review 1 had reverted, also passed 240 (44.4 min).
- Screenshots: `docs/screenshots/122/menge-after-stepper-{before,after}.png` (main: Menge
  unfocused after a stepper; with the fix: focused).
- Review 1 round: the timeout reverted, `flutter test test/list test/fuzz` 531 passed, the order
  test fails with a timeout put back; `scripts/verify.sh --only gitleaks,lint,flutter` passed;
  ci-ok on the PR head (see the PR checks).
- Review 2 round: rebased onto main after #282 (vmaint-20261106), which changed the edit-item
  „Last verified“ paragraph in FEATURES-FOR-WRITERS.md; job 122's sentence now sits in front of
  main's vmaint entry. ci-ok green on adfa7a34 (run 42170376250) and ef98c8e4 (run
  42171765104).
- Review 3 round: rebased onto main after #237 (strict TypeScript lint, 9a1dec19). The
  edit-sheet spec's import list keeps main's names plus `within`;
  `e2e/trace-slow-steps.mjs` imports `process` from `node:process` (its `no-process-global`
  rule). `deno run -A tool/lint/ts/strict.ts` is clean (242 files), `scripts/verify.sh --only
  gitleaks,lint` passed, the list cubit and edit sheet tests pass (112). ci-ok green on
  cf2a6416 (run 42185961078) and d55f24cf (run 42187793051).
- Review 4: PASS, no must-fix. The reviewer drove the release web build (focus held 6/6 on the
  head, 0/6 with main's sheet) and ran the e2e on GitHub (165 + 50 passed, 0 failed). Main moved
  again (#286, #288), so the PR was rebased once more; only DECISIONS needed the usual
  keep-both merge. Nice-to-have 1 done: the edit-item „Last verified“ line in
  FEATURES-FOR-WRITERS names commit d55f24cf and 2026-11-06, newest first. Not done: a second
  focus check after `nextFrames` (two frames end before the blur at about 100 ms, so it would
  not close the window); deleting the `probe/122*` branches waits for the merge; a stack-pause
  stress pass. ci-ok on the PR head (see the PR checks). Earlier ci-ok runs: 7d2f3392 (42088953326),
  1c3c54b4 (42110887315), d3fc860d (42132319105), 9bcc1f19 (42159393149), 15c722e1
  (42163298825). The reviewer's own
  on-demand e2e run on 9bcc1f19 passed the three specs ×5 (run 42161077722).

## Missing or blocked

- #62, #64, #71 and #72 stay open for the lead (host pause only).
- The hz e2e lock was 7 to 9 deep for hours. Most stressed repros ran on GitHub Actions instead,
  on the scratch branches `probe/122*` (seven of them). Delete them once the PR is merged.
- The stress paused the runner and Chromium only, not the local stack. Job 119's
  `scripts/e2e-stress.sh --target stack` (#261) would be the stronger negative for #62 and #71.
- Mouse users lose the hover hint over + and −. Other tooltips in the app can move the DOM the
  same way. The add sheet's clear button was checked: text typed after it still lands in the
  field.
