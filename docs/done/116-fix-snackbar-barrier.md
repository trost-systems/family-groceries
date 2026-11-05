# Job 116: rejection messages above open dialogs

**What.** Before this fix, a snackbar shown while a dialog or sheet stayed open sat dimmed under the popup's barrier. The user couldn't see it or tap it, and it was missing from the semantics tree. Examples: a refused store save in the name dialog, a refused item write while the item sheet was open, and "Kopiert" in the new-token dialog. Such messages now show above the dialog or sheet, and above the keyboard. The fix is one shared mechanism with no per-dialog code. No strings changed. PR #256 (DO NOT MERGE, the lead merges).

**Where.**
- `app/lib/app/notices.dart` holds the mechanism.
  - `Popups` is an observer on the root navigator.
  - `NoticesHost` is a messenger layer above the navigator, in `MaterialApp.builder`. Only a hit on a snackbar stops there.
  - `Notices.of(context)` stands in for `ScaffoldMessenger.of(context)`. It decides when the snackbar shows.
- Wiring: `app.dart` and `router.dart` (`buildRouter(..., popups)`), and the test harness `test/more/more_harness.dart`.
- All 10 snackbar callers in `app/lib` now use `Notices`.
- Lint rules: `snackbars-through-notices` and `popups-on-root-navigator` (ast-grep), with tests and AGENTS.md rows.
- Reasons are in `docs/DECISIONS.md`, "Job 116".
- Feature map: `offline.md`, `stores-walk-order.md`, and "Working offline" in FEATURES-FOR-WRITERS.md.

**Verify.**
- `cd app && flutter test test/app/notices_test.dart test/list/rejection_over_popup_test.dart test/list/stores_screen_test.dart`
- Live repro on the Linux debug build (verify-family-groceries): Liste → Anpassen → Laden hinzufügen, stop the local PostgREST container, then Laden anlegen.
  - Before: the message is under the barrier, and `fg find` returns count 0.
  - After: the message is above the barrier, and `fg find` returns count 1.
  - Screenshots: `docs/screenshots/116/`.

**Tests.**
- `flutter analyze`: clean.
- `flutter test`: 1827 passed, 90 skipped.
- ast-grep: 16 rule tests passed, and the scan is clean. The new rule flags the 4 old call sites at the parent commit.
- Local e2e on hz: 185 passed. The 9 failures are fake-OIDC specs (id-token, AC6, social-sign-in), which can't reach host ports on hz.
- CI e2e: both shards green. ci-ok is green on 78dbac23.
- The new tests fail without the fix (`Found 0 widgets … hit-testable`). Two mutations of `notices.dart` are caught.

**Review 0 (FIX), both must-fix items done.**
1. **Leftover message over the tabs.** Before this round, a message shown above a dialog stayed there after the dialog closed. It covered the tab bar for its 4 s and took the tab taps. Now `Popups` notifies when the last dialog or sheet leaves, and `NoticesHost` clears the top messenger right away, with no exit animation. Widget tests in `notices_test.dart` cover this: after a close the tabs are hit-testable and only one snackbar shows, a dialog closed while its message comes in leaves nothing behind, and a stacked second dialog keeps the message until the last one closes. With the clearing disabled, 3 tests fail.
2. **The app's own wiring had no test.** `e2e/tests/stores-add.spec.ts` "REFUSED STORE" now covers it. It refuses `add_store`, then checks that the message is visible, in the ARIA tree and not covered (`elementFromPoint`) while the dialog is open. After "Abbrechen", it checks that "Mehr" can be clicked within 1.5 s.
   - On the release web build with the fix it passes.
   - With `buildRouter`'s observer and `App`'s `NoticesHost` removed, it fails: the message is not found.
   - With the clearing removed, it fails: `flt-semantics … intercepts pointer events` on the tab.
3. Nice-to-haves: the `Popups` doc now says it sees only the root navigator, and a comment explains why the hit test probes the layer instead of using `IgnorePointer`. On #257 (job 117): whoever lands second rebases and reruns `scripts/ast-grep.sh`.

Tests after review 0:
- `flutter test`: 1830 passed.
- `flutter analyze`: clean.
- The lint gate passed.
- The new e2e spec passed locally.

**Review 1 (FIX), the must-fix item done.** `Popups` followed the top route through `didPush`/`didPop`/`didRemove`/`didReplace`. The Navigator calls `didPush` for a page the router adds *below* an open dialog, so `open` turned false with the dialog still showing, and messages went under the barrier again. `Popups` now uses `didChangeTop`, which the Navigator calls once per history flush with the real top route, and the code is 30 lines shorter. The reviewer's probe is now a regression test, "a page the router adds below an open dialog leaves the message above it" in `notices_test.dart`. It fails on the old tracking (`Found 0 widgets with text "refused"`) and passes with the fix.

Nice-to-haves from review 1:
- `Notices.maybeOf` now reuses `of`.
- The PR's screenshot links point at `refs/pull/256/head`, so they keep working after the branch is deleted.
- The sheet overlap is noted as a trade-off in DECISIONS point 8. Over the item sheet, the snackbar covers the bottom ~14 px of Fertig/Löschen for 4 s; the rest of the buttons still take taps, and the snackbar can be swiped away.
- The lint gap for popups pushed directly (`showMenu`, `Navigator.push(PopupRoute)`) stays as documented in the `Popups` doc comment.

Tests after review 1: `flutter test` 1831 passed; `flutter analyze` clean; the lint gate passed; `stores-add.spec.ts` passed 3 of 3 on the release web build.

**Open.** Nothing blocked. While a dialog is open, the message shows at the very bottom of the screen; the tabs there are covered by the barrier anyway. It goes when the last dialog or sheet closes.
