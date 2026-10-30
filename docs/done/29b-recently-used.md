# Job 29b: no undo snackbar on a tick, "Zuletzt verwendet" with the list's row

PR: https://github.com/trost-systems/family-groceries/pull/104

Peter, 2026-10-29 20:49: "remove the 'undo' snackbar. If someone wants to undo a checked off item, they can click on it in the 'recently bought' section to bring it back. Let's also rename to 'recently used'." 20:50: "for the 'recently used' section let's use the same element with icon as in the normal list."

## What changed for users

- **A tick shows no snackbar.** The row's leave animation is the only feedback. Deleting from the edit sheet still shows "<name> gelöscht" with "Rückgängig", and the add sheet keeps its note with "Rückgängig".
- **"Zuletzt gekauft" is now "Zuletzt verwendet"** ("Recently used" in English), also in the MCP `tick_items` description and the docs.
- **The section shows the list's own rows**: the same `ItemRow` widget with its icon, quantity, brand and details, faded (opacity 0.55). The old small grey text rows with a "+" button are gone.
- **A tap on an item there puts it back** in its old place, with "<name> steht wieder auf der Liste". This is the tick's undo now. A still hold does the same. A swipe, a right click or a drag on a used row does nothing; the row's own tick, edit, delete and drag gestures are off there.
- **Screen readers** get one button per used item, e.g. "Bananen, 2, Wieder auf die Liste", whose tap puts it back.
- **Analytics:** putting an item back within 10 minutes of its tick counts as the undo and sends no `item_added`, the same 10-minute window `suggest_items` uses to not count it as a purchase. Later it is an add (source `suggestion`), as before.

## Where

- `app/lib/list/list_view/shopping_list_view.dart`: `_tick` without the snackbar, `_usedRow` (wraps `ItemRow` in `Semantics` + `GestureDetector` + `IgnorePointer` + `Opacity`), the section key `recently-used`, row keys `used-<id>`. `item_row.dart` is unchanged.
- `app/lib/list/model.dart`: `recentlyBought()` is `recentlyUsed()`.
- `app/lib/list/list_cubit.dart`: `readd` treats a put-back within `ListCubit.undoWindow` (10 min) of `bought_at` as the undo (no event).
- `app/l10n/app_de.arb`, `app_en.arb` + generated `app/lib/l10n/`: `recentlyBought` became `recentlyUsed` ("Zuletzt verwendet" / "Recently used"); `itemTicked` is removed (nothing shows it).
- Tests: `app/test/list/list_screen_test.dart` (a tick without a snackbar and the put-back in place; the used row is an `ItemRow` with the item's category and icon, faded, newest first; a swipe or right click does nothing, a hold puts back, the screen-reader label and tap; ticking the last item of a store and putting it back shows the store again), `app/test/analytics/list_events_test.dart` (put-back within 10 minutes sends nothing, also for a partner's tick; after 10 minutes it is an add), `model_test.dart` (rename).
- e2e: `helpers.ts` (`tick` waits for the row to go instead of the snackbar, `itemRow` skips used rows, new `usedRow` and `putBack`), `list.spec.ts`, `list-walk-order.spec.ts`, `edit-sheet.spec.ts`, `analytics.spec.ts`, `suggestions.spec.ts`, `catalog.ts`.
- Recipes: `features/quick-add.md`, `list-walk-order.md`, `classifier.md`, `stores.md`, `analytics.md`, `SKILL.md`.
- Docs: `docs/DECISIONS.md` "Job 29b", `docs/ANALYTICS.md`, `docs/SPEC.md` (dated note), `docs/MCP.md`, `docs/TEST_FIXTURES.md`, scenario comments.

## How to verify

```bash
(cd app && flutter analyze && flutter test test/list/ test/analytics/list_events_test.dart)
scripts/ci-e2e.sh --spec "tests/list.spec.ts tests/list-walk-order.spec.ts tests/analytics.spec.ts tests/edit-sheet.spec.ts" --no-db
```

## Test results

- Locally (Mac): `flutter analyze` no issues; `flutter test` 525 passed; `scripts/lint.sh`, `check-gates.sh`, e2e `tsc`, the functions and flutter gates pass (the lint gate's shellcheck SC2218 findings come from macOS shellcheck 0.11 on untouched scripts and don't occur on CI).
- PR CI run 41017423635 on the first head: every job green except one e2e test, `add-sheet.spec.ts:212` ("after Schließen…": the first typed letter is lost, "rot" for "Brot"). main hit the identical failure on 7df4763 (run 41011756707), and this PR doesn't touch the add sheet. The changed specs all passed there: `list.spec.ts` (4), `list-walk-order.spec.ts:261`, `analytics.spec.ts:104`, `edit-sheet.spec.ts`. The final green `ci-ok` run is linked in the PR body.
- Screenshots in `docs/screenshots/29b/`: before (main's run 41015300447: the "Joghurt abgehakt / Rückgängig" snackbar; a throwaway spec on main, run 41017481069: the old expanded "Zuletzt gekauft" with plain grey rows and "+"), after (the tick leaves no snackbar and "Zuletzt verwendet" shows the list's rows with icons, faded; a tap put Joghurt back).

## Missing or blocked

Nothing.
