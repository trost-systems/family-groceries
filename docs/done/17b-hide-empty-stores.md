# Job 17b: hide stores with no items on the list

PR: https://github.com/trost-systems/family-groceries/pull/94

Peter answered job 16's question: "we don't want to show stores that have 0 articles on the list." Until now an empty store showed as a divider with "0 Artikel".

## What changed for users

- **A store without open items doesn't show on the list:** no divider and no "0 Artikel". "Ohne Laden" follows the same rule, as it already did. Ticked items don't count. A store hides together with its last ticked row, and Rückgängig brings both back.
- **Drag and drop still reaches every store.** Once a dragged item moves, the hidden stores (and an empty "Ohne Laden") show as folded "<Store>, 0 Artikel" dividers you can drop on. A hold that stays put opens the edit sheet, so it shows nothing new. After the drop, a store that is still empty hides again. Moving a store's last item out hides that store once the drag ends.
- If the dividers that show push the dragged row down, the list scrolls it back under the finger, as far as the list can scroll.
- **Dragging a store divider** (reordering stores) shows only the stores with items. More > Läden still lists and reorders every store.
- **Wide screens** balance the columns over the stores with items, with no more columns than there are such stores (one reads as one centred column). During an item drag an empty store shows in the column of the store before it, so no store changes column under the finger.
- **Every store empty:** the usual empty-list state ("Die Liste ist leer…").

## Where

- `app/lib/list/list_view/sections.dart`: `shownSections` (which sections show, at rest and during a drag) and `withDropTargets` (empty sections joined to the resting columns).
- `app/lib/list/list_view/shopping_list_view.dart`: uses them, rebuilds on `DragSession.moved`, empty state on `shown.isEmpty`.
- `app/lib/list/list_view/item_row.dart`: `_stayUnderFinger` keeps the dragged row in place when dividers show above it; the list's cache extent grows during the drag so the row stays laid out.
- Tests: `app/test/list/sections_test.dart` (shown sections, empty stores in columns), `app/test/list/list_screen_test.dart` (hidden at rest, shown during a moved drag only, drop into an empty store, a drag that ends in place, last item moved out, tick/undo and the empty state, the row staying under the finger, wide columns during a drag). The widget-test `drag` helper measures its target after the lift.
- e2e: `list-walk-order.spec.ts` (Edeka hidden, no "0 Artikel"; mid-drag Edeka and Ohne Laden as drop targets; drop into Edeka; dm hides after its last item leaves; the store order without Edeka), `shell-more.spec.ts` (Läden lists the empty stores), `catalog.ts` (`holdAndDrop` asks `up` after the lift and takes `beforeDrop`; `dragItemToStore` waits for the target to show).
- `fg drag` (`.cursor/skills/verify-family-groceries/cli/drive.ts`) finds the drop target after the lift (test in `cli/fg_test.ts`). Recipes: `features/list-walk-order.md` (`lw-sections`, new `lw-drag-empty-store` and its steps), `features/stores.md`.
- Decisions: `docs/DECISIONS.md`, "Job 17b". The job 16 item in `docs/NEEDS_PETER.md` is marked done.

## How to verify

```bash
(cd app && flutter analyze && flutter test test/list/)
scripts/ci-e2e.sh --spec "tests/stores.spec.ts tests/list-walk-order.spec.ts tests/shell-more.spec.ts tests/classifier.spec.ts" --no-db
```

## Test results

- `flutter analyze`: no issues; `flutter test`: 383 passed.
- Full CI on the PR, the green `ci-ok` run on the merged head, is linked in the PR body. Before the review fixes, `ci-ok` was green on 8871b87 (run 40933422826, e2e 46 + 45 passed).
- Screenshots: `docs/screenshots/job-17b/` (before on main, after, during a drag, after the drop into an empty store).

## Not done / blocked

- I couldn't run `fg drag` against a live app (linux surface with a local stack) on the Mac runner, which has no Docker. A new unit test in `cli/fg_test.ts` covers its new order (lift, then find the target, then move and release; release the button if the target never shows). The widget tests and e2e prove the same flow. The next box job that runs the `list-walk-order` recipe will exercise it live.
- Locally the `lint` gate's shellcheck step fails on `scripts/release/report.sh` (SC2218). This Mac has shellcheck 0.11; CI runs green. The `fg-cli` gate's `sync_lock_test.ts` fails on macOS (it reads Linux `/proc`). Neither file is touched here, and both gates pass on CI.
