# Job 29c: swipe left opens edit instead of delete

PR: https://github.com/trost-systems/family-groceries/pull/98

Peter, 2026-10-29: "replace delete with edit in the swipe-left action. Tap and hold doesn't work on mobile browser, that always triggers the move action."

## What changed for users

- **A swipe to the left edits.** It opens the item's edit sheet, the same one a right click or a hold that stays put opens. The row springs back into place and nothing is written. Under the swipe there's a pencil on the secondary colour, no longer a bin on red. A short swipe springs back without opening anything. Items still being sorted swipe the same way.
- **Delete is in the edit sheet.** Löschen there deletes with the undo snackbar (unchanged since job 15). Screen readers also get "Bearbeiten" and "Löschen" as actions on the row.
- **No item action needs a hold.** Tick: tap. Edit: swipe left (or right click, or a still hold). Delete: Löschen in the sheet. Move to another category or store: the sheet's chips. Only reordering within a category is a hold and drag.
- **The explainer card names the swipe:** "Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt" (it said "Halten bearbeitet").
- **A hold that drifts a little still counts as a hold.** A lifted item used to count as moving after 8 px of travel. A finger waiting for a hold drifts further than that, so on a phone's browser the hold turned into a drag. A finger (touch, stylus) now gets Flutter's touch slop of 18 px; a mouse keeps 8 px. The same goes for store and category dividers, whose menus open on a still hold.

## Where

- `app/lib/list/list_view/item_row.dart`: `_swipeToEdit` (a `Dismissible` whose `confirmDismiss` calls `onEdit` and returns false), the pointer-kind slop, the screen-reader actions, and the `ItemRow` doc comment.
- `app/lib/list/list_view/drag.dart`: `holdSlop(kind)`. `app/lib/list/list_view/dividers.dart`: store and category dividers use it.
- `app/l10n/app_de.arb`, `app_en.arb` (and the generated `app/lib/l10n/`): only the value of `listHint`, no new key. `shopping_list_view.dart` and `edit_item_sheet.dart` are unchanged.
- Widget tests in `app/test/list/list_screen_test.dart`: swipe opens the sheet and the row stays, a short swipe springs back, delete from a swiped-open sheet with undo, a row still being sorted, every action without a hold (tick, edit, move category and store, delete), a drifting finger edits where a mouse drags, a drifting finger on a store and a category divider opens the menu, and the screen-reader actions. Drags in the tests move 24 px (past the touch slop).
- e2e: `edit-sheet.spec.ts` (a mouse swipe opens the sheet and the row stays; in Chrome as an Android phone with real touch over CDP: a finger swipe, a 12 px drifting hold, move with the chips, delete in the sheet, tick with a tap, all checked after a reload), `iphone.spec.ts` (finger swipe, drifting hold and delete in WebKit as an iPhone), `helpers.ts` (`finger`, `swipeLeft`), `list-walk-order.spec.ts` (the new hint text).
- Recipes: `features/edit-item.md` (`ed-open` with the swipe, new `ed-hold-drift` and `ed-a11y`, a swipe step), `features/classifier.md`, `features/list-walk-order.md`.
- Decisions: `docs/DECISIONS.md`, "Job 29c".

## How to verify

```bash
(cd app && flutter analyze && flutter test test/list/)
scripts/ci-e2e.sh --spec "tests/edit-sheet.spec.ts tests/iphone.spec.ts" --no-db
```

## Test results

- Locally: `flutter analyze --fatal-infos` no issues; `flutter test` 521 passed after rebasing onto job 19 (48 in `list_screen_test.dart`). Run against the old `item_row.dart`, 6 of the new widget tests fail; against the old 8 px slop, both drift tests fail.
- e2e on GitHub Actions, run 41008146969: `edit-sheet.spec.ts`, `iphone.spec.ts`, `list-walk-order.spec.ts`, 13 passed.
- Before: the same new swipe specs run on main's app (probe branch, deleted since), run 41007139422. All 3 fail at "a swipe to the left opens edit": the swipe showed the red bin and deleted.
- A WebKit-as-iPhone probe (run 41008144036, deleted branch): a still hold, 4 px and 12 px of drift open the sheet, 30 px drags.
- Full CI on the PR, the green `ci-ok` run on the merged head, is linked in the PR body.
- Screenshots: `docs/screenshots/29c/` (before: the red bin under a finger swipe in Chrome as Android and in WebKit as an iPhone; after: the pencil, and the sheet the swipe opened).

## Not done / blocked

- No real phone here. The drift explanation (an 8 px slop under a finger that waits for feedback) is the likely cause of "always triggers the move action", not a proven one. The e2e specs prove that a finger swipe edits and that a 12 px drifting hold edits, in Chrome as an Android phone and in WebKit as an iPhone. The swipe doesn't depend on the hold at all.
- The verify-skill recipe isn't run live: the Mac runner has no Docker. The widget tests and e2e cover the same steps.
- Locally the `lint` gate's shellcheck step fails on scripts this job doesn't touch (SC2218, shellcheck 0.11 on the Mac); its other steps (ast-grep rules, e2e tsc, actionlint, gate wiring, landing test) pass locally, and the gate passes on CI.
- On web, a mouse swipe whose press and release fall within 200 ms ticks the item instead of opening edit. That's Flutter web's click debouncer on tappable semantics nodes (DECISIONS 29c, 7), and it was the same for the old swipe-to-delete. Finger swipes and mouse drags at a normal pace are unaffected. The app never sees the dropped drag, so it can't be fixed here.
