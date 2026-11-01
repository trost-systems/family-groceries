# Ticking items, "Zuletzt verwendet" and undo

A tap on an item's row ticks it off: the row leaves the list at once and no snackbar appears, so a tick has no "Rückgängig". Ticked items collect in a folded section at the bottom of the list, „Zuletzt verwendet“ (the 20 newest). A tap on an item there puts it back on the list, in the place it had, and shows a short note. Only some other actions carry an undo: deleting an item (from the edit sheet), the add sheet's „Hinzugefügt“ note, and a merge of duplicates.

## Sub-features

- `tu-tick` a tap on a row ticks it; the row leaves the list, no snackbar, no "abgehakt" text. The state is saved on the server and survives a reload.
- `tu-used-section` „Zuletzt verwendet“ / "Recently used" is a folded section below the list; it exists only while at least one item is ticked. It holds up to 20 ticked items, newest tick first, each drawn like the list's row (icon, name, brand · properties, quantity) but faded.
- `tu-put-back` a tap on a row under „Zuletzt verwendet“ puts it back on the list in its old store, category and position, and shows the snackbar „<Name> steht wieder auf der Liste“ / "<Name> is back on the list" (no action button).
- `tu-delete-undo` „Löschen“ / "Delete" at the bottom of the edit sheet removes the item and shows the snackbar „<Name> gelöscht“ / "<Name> deleted" with the action „Rückgängig“ / "Undo", which brings the item back (the server row is re-created).
- `tu-added-undo` after an add, the add sheet shows „✓ Hinzugefügt: <Name>“ (or „✓ Hinzugefügt: <Name> → <Store>“) with „Rückgängig“ until the next keystroke; Undo removes the item again (and forgets a category picked on that add, see classifier).
- `tu-merge-undo` when an add repeats an open item, the add note offers „Zusammenführen“ / "Merge"; afterwards „Zusammengeführt: <item>“ with „Rückgängig“ undoes the merge. Outside the add sheet the same offer is a snackbar „<Name> steht schon auf der Liste“ with „Zusammenführen“.
- `tu-no-swipe-delete` a swipe left on a row opens the edit sheet, it does not delete.

## How to get to it (user POV)

- Tick: tap an item row on the list tab.
- Put back: scroll to the bottom of the list, tap „Zuletzt verwendet“ / "Recently used" to unfold it, tap the item.
- Delete and its undo: hold the row (or right click, or swipe left) to open „Bearbeiten“, tap „Löschen“, then „Rückgängig“ in the snackbar.
- Add undo: type an item in the add bar and tap „Rückgängig“ in the note under it.
- Screen reader users: a row also offers the actions „Bearbeiten“ and „Löschen“ (delete without the sheet, same snackbar with „Rückgängig“).

## Driving it with Playwright

Preconditions:

- Seeded household „Familie Brandt“, signed in on the list, analytics declined, onboarded; the demo items include Butter, Nudeln and Reis without a quantity and „6× Bananen“ with one.
- Browser locale de-DE, viewport 480x900 or 390x844.

- **Tick.** Tap the row. `tick(page, 'Joghurt')` (reveals the row, clicks `itemRow(page, 'Joghurt')`). Observable result: `itemRow(page, 'Joghurt')` count drops by 1; `page.getByRole('button', { name: 'Rückgängig' })` count is 0 and `page.getByText('Joghurt abgehakt')` count is 0.
- **Open the used section.** `page.getByRole('button', { name: 'Zuletzt verwendet' }).click()` (`reveal` it first if off-screen). Observable result: `usedRow(page, 'Joghurt')` visible; its accessible name is the item name, then details/quantity, then „Wieder auf die Liste“, for example `Bananen 2 Wieder auf die Liste`.
- **Put back.** `putBack(page, 'Joghurt')` (or `usedRow(page, 'Joghurt').click()`). Observable result: `itemRow(page, 'Joghurt')` visible again, `usedRow(page, 'Joghurt')` count 0, snackbar text „Joghurt steht wieder auf der Liste“ (plain snackbar: `getByText` may hit only the announcement). In a store section the row returns to its old position (`list-walk-order.spec.ts` checks the row order).
- **Persistence.** After tick or put back, `page.reload()` then `expect(addField(page)).toBeFocused()`; the row is gone/back. A second view: the `items` row's `status` is `bought` / `active` through the API as the user.
- **Delete and undo.** `openEdit(page, 'Mineralwasser')`, then `editSheet(page).getByRole('button', { name: 'Löschen' }).click()`. Observable result: `itemRow` count 0; `actionSnackBar(page, 'Mineralwasser gelöscht')` visible. Then `page.getByRole('button', { name: 'Rückgängig' }).click()`: the row is visible again and still there after `page.reload()`.
- **Add undo.** Type with `typeInto(addField(page), 'Butter')` and press Enter; the note „✓ Hinzugefügt: Butter“ shows with button „Rückgängig“; click it and `itemRow(page, 'Butter')` is gone.
- **Spec coverage.** `e2e/tests/list.spec.ts` (tick without snackbar, put back, reload persistence, delete undo, duplicate add), `e2e/tests/list-walk-order.spec.ts` ("a tap ticks, a tap under Zuletzt verwendet puts it back in place"). Run `scripts/verify.sh --only e2e -- tests/list.spec.ts`.

## Gotchas

- A used row's gestures are off except the tap: no tick, swipe, hold or drag. Its accessible name ends in „Wieder auf die Liste“; `itemRow` excludes names ending that way, `usedRow` requires it.
- „Zuletzt verwendet“ is folded by default and the list is long: scroll to it (`reveal`) before clicking.
- `getByText` finds the screen-reader copy of a snackbar only briefly; use `actionSnackBar` for snackbars with an action.
- Putting an item back within 10 minutes of the tick counts as the tick's undo; later it counts as a new add for analytics only. The user sees no difference.
- No code path purges ticked items after a time (none found); the section keeps the 20 newest. unverified (no server job found, not run).
- The „Rückgängig“ in the add note disappears at the next keystroke; click it before typing again.
- Ticking has no undo snackbar since the job 29b release; old recipes that wait for „abgehakt“ or „Rückgängig“ after a tick are wrong.
