# Edit an item

Every item on the list has a name („Bezeichnung“ / "Name"), an optional brand („Marke“ / "Brand"), details („Eigenschaften“ / "Details", like "Größe 3" or "1,5 %") and a quantity („Menge“ / "Qty"). The row shows the name, and under it "Marke · Eigenschaften" when either is set, with the quantity on the right. A swipe to the left, a right click or a hold on a row opens the edit sheet from the bottom. A plain tap does something else: it ticks the item off. The sheet edits fields, moves the item to another store or category, and deletes it.

## Sub-features

- `ed-row-details` the row's second line is "<Marke> · <Eigenschaften>" (either part alone, or no line when both are empty). Its accessible name is the name, then the details, then the quantity: „Milch Weihenstephan 2“, „Windeln Pampers · Größe 3“, „Milch 2 l“.
- `ed-open` the sheet (accessible group „Bearbeiten“ / "Edit", title „Bearbeiten: <name>“ / "Edit: <name>") opens on a swipe to the left past 40 % of the row (mouse drag, finger), a hold that stays put, or a right click. A shorter swipe springs back. The row stays where it was and nothing is written. Screen readers get „Bearbeiten“ / "Edit" and „Löschen“ / "Delete" as actions on the row.
- `ed-fields` four prefilled text fields: „Bezeichnung“ / "Name" (120 characters), „Marke“ / "Brand" (60; placeholder „ohne Marke“ / "no brand"), „Menge“ / "Qty" (40), „Eigenschaften“ / "Details" (120; placeholder „z. B. Bio, 1 l“ / "e.g. organic, 1 l"). Fertig is disabled while the name is empty.
- `ed-steppers` next to „Menge“ two buttons, „Eins weniger“ / "One less" and „Eins mehr“ / "One more", change only the number and keep the unit: "2" gives "3", "2 l" gives "3 l", "1,5 l" gives "2,5 l", "500 g" gives "600 g" (grams and millilitres step by 100 from 100). An empty quantity counts as 1, so plus gives 2. „Eins weniger“ is disabled at 1 and at 100 g. Both buttons are hidden when the quantity does not start with a number ("eine Packung").
- `ed-chips` the store chip („Laden: <store>“ / "Store: <store>", for example „Laden: Ohne Laden“ / "Store: No store") and the category chip („Kategorie: <category>“ / "Category: <category>", for example „Kategorie: Kühlregal“ / "Category: Chilled") fold out their options inline: the stores plus „Ohne Laden“ / "No store", or the categories. A pick folds them back; the sheet grows and shrinks to its content.
- `ed-save` „Fertig“ / "Done" saves only the fields that changed (shown under the buttons: „Gespeichert wird nur, was du änderst“ / "Only what you change is saved"). Without a change it just closes and writes nothing.
- `ed-cancel` „Abbrechen“ / "Cancel" closes the sheet and writes nothing.
- `ed-delete` „Löschen“ / "Delete" closes the sheet and removes the item. A snackbar says „<name> gelöscht“ / "<name> deleted" with „Rückgängig“ / "Undo", which brings the item back.
- `ed-parse` entries added by MCP or Siri (and the add sheet) are split into these fields by the server: "Windeln Pampers Größe 3" gives Windeln, Marke Pampers, Eigenschaften Größe 3, Laden dm (see the quick add feature).

## How to get to it (user POV)

- Swipe a list row to the left (phone, or mouse drag on web and desktop). A pencil icon shows behind the row.
- Press and hold a row, then let go without moving.
- Right-click a row (web and desktop).
- Screen reader: the row's custom action „Bearbeiten“ / "Edit".

## Driving it with Playwright

Preconditions:

- Signed in, on the list tab, an item without a brand on the list (for example `addItem(page, 'Milch')` from helpers, which types it, presses Enter and closes the sheet). Stores: the e2e household has the default stores; the baseline „Familie Brandt“ has dm, Lidl and Edeka, and none of its items has a store yet.
- Existing coverage: `e2e/tests/edit-sheet.spec.ts` (right click, steppers, height, swipe, hold, Löschen with undo, Abbrechen, touch variants in a phone browser) and `e2e/tests/item-details.spec.ts` (row second line). Run via `scripts/verify.sh --only e2e -- tests/edit-sheet.spec.ts`.
- Helpers: `openEdit(page, 'Milch')` right-clicks the row and waits for `editSheet(page)` (`getByRole('group', { name: 'Bearbeiten', exact: true })`); `editField(page, 'Marke')` is `editSheet(page).getByRole('textbox', { name: 'Marke' })`; `expectFieldValue(field, value)` reads a prefilled value; `pickInSheet(page, 'Laden' | 'Kategorie', '<option>')`; `saveEdit(page)` clicks „Fertig“ and waits for the sheet to go.

- **Open.** `await openEdit(page, 'Milch')`. Observable result: `editSheet(page)` is visible; `expectFieldValue(editField(page, 'Bezeichnung'), 'Milch')`, and empty values for 'Marke', 'Menge', 'Eigenschaften'; buttons `Laden: Ohne Laden` and `Kategorie: Kühlregal` are visible in the sheet.
- **Edit and step.** `await typeInto(editField(page, 'Marke'), 'Weihenstephan')`, click `editSheet(page).getByRole('button', { name: 'Eins mehr' })` twice and `'Eins weniger'` once. Observable result: `expectFieldValue(editField(page, 'Menge'), '2')`.
- **Save.** `await saveEdit(page)`. Observable result: `itemRow(page, 'Milch')` has the accessible name `Milch Weihenstephan 2`, also after `page.reload()`; a read of the item through the API shows only brand, quantity and updated_at changed.
- **Move store or category.** `await pickInSheet(page, 'Laden', 'dm')` (or `'Kategorie'` with a category name such as 'Getränke'), then `saveEdit(page)`. Observable result: the item sits under that store's divider (`storeDivider(page, 'dm')`, accessible name `dm, <n> Artikel`) or in that category; the API row has the new `store_id` / `category_id`.
- **Cancel.** Open, change a field, click `editSheet(page).getByRole('button', { name: 'Abbrechen' })`. Observable result: sheet gone, row unchanged. An open-then-„Fertig“ without changes also writes nothing.
- **Delete with undo.** Open, click `editSheet(page).getByRole('button', { name: 'Löschen' })`. Observable result: `itemRow(page, 'Zahnpasta')` count 0 and `actionSnackBar(page, 'Zahnpasta gelöscht')` is visible; click its `getByRole('button', { name: 'Rückgängig' })`, the row is back, and after `page.reload()` it is still there.
- **Swipe.** With the mouse move to the row's right end, press, move left in about 12 steps at 25 ms each, release (the pace matters, see Gotchas). Observable result: `editSheet(page)` is visible, the row is still in the list and springs back to its x position after Abbrechen. Hold: press, wait 450 ms, release also opens it.

## Gotchas

- A tap or click on a row ticks the item. Open the sheet with a right click (`openEdit`), a slow swipe or a hold, never a left click.
- A press and release on a row within 200 ms is a click to the engine, so a mouse swipe must move at a hand's pace (about 25 ms per step), or the row is ticked instead.
- Flutter web fills a text field's input only while it is focused, so a prefilled value reads empty until the field is clicked; use `expectFieldValue`.
- The chip and its option can show the same text ("dm"); only the chip's accessible name has the prefix „Laden: “ / „Kategorie: “. Pick options with `getByRole('button', { name: '<option>', exact: true })` after unfolding the chip.
- Use `typeInto` for typing, as umlauts are dropped by synthetic key events.
- A row that has just arrived from the partner shows „Neu“ / "New" in its screen-reader name for a few seconds (the row's accessible name gains a line); match rows with `itemRow`, which ignores trailing text.
- Items under „Zuletzt verwendet“ cannot be edited: a swipe or right click does nothing there, only a tap puts them back.
- The sheet's exact height (hugging its content, buttons 44 px) is pinned by `expectHugsContent` in the spec; do not assert pixel sizes in other recipes.
- The delete snackbar has no set duration, so it shows for Flutter's default 4 seconds and does not wait for the action (`persist: false`); click Rückgängig promptly.
- The iPhone (WebKit) touch variant lives in `e2e/tests/iphone.spec.ts` ("a finger swipe to the left opens the edit sheet and the row stays; Löschen in it deletes").
