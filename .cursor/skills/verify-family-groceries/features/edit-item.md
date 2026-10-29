# Edit an item

An item on the list has a Bezeichnung (name), an optional Marke (brand), Eigenschaften (properties such as "Größe 3" or "1,5 %") and a Menge (quantity). The list row shows the name, and under it "Marke · Eigenschaften" when either is set. A hold that doesn't move or a right click opens the edit sheet from the bottom; a tap ticks the item instead (job 16). It is exactly as tall as its content. Each field is prefilled and edits separately. Menge has −/+ buttons that change only the number and keep the unit. The store chip and the category chip fold their options out inline. Fertig saves only the fields that changed, Löschen deletes with an undo snackbar, and Abbrechen discards. MCP and Siri entries are split into these fields by the server's parser ("Windeln Pampers Größe 3" gives Windeln, Pampers, Größe 3, Laden dm).

## Sub-features

- `ed-row-details` shows "Marke · Eigenschaften" as the row's second line when either is set, and no added-by initial on any row.
- `ed-open` opens the sheet (key `edit-sheet`) on a hold that does not move or a right click. A tap on the row ticks the item.
- `ed-prefill` prefills `edit-name`, `edit-brand`, `edit-quantity` and `edit-properties`, sets the store chip (`chip-store`, "Laden: <store>" or "Ohne Laden") and the category chip (`chip-category`, "Kategorie: <name>").
- `ed-steppers` changes the Menge with `edit-quantity-minus` and `edit-quantity-plus`: "2" gives "3", "2 l" gives "3 l", "500 g" gives "600 g", and an empty Menge counts as 1. The steppers hide for a Menge that does not start with a number. "−" is disabled at 1.
- `ed-chips` folds out `store-option-<id>` (plus `store-option-none`) or `category-option-<id>`. A pick folds them back, and the sheet grows and shrinks with them.
- `ed-patch` makes Fertig (`edit-done`) write only the changed columns. An unchanged Fertig writes nothing, and Fertig is disabled while the name is empty.
- `ed-delete` makes Löschen (`edit-delete`) delete the item with "<name> gelöscht" and "Rückgängig".
- `ed-cancel` makes Abbrechen (`edit-cancel`) close the sheet without writing.
- `ed-size` keeps the sheet's height equal to its content, with every button at least 44 px (Fertig 52 px), also on the Linux and web builds.
- `ed-parse` makes MCP `add_items`, Siri and `public.add_items` split an entry into the fields and pick the Laden from item→store memory, then the brand's store, then the category's (Drogerie gives dm).

## How to get to it (user POV)

- Press and hold an item on the list, then let go without moving.
- Right-click an item (web and desktop).
- Add an entry through Siri or an MCP app and look at its row.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter and lea signed in.
- No active Windeln or Milch: `fg db query "update items set status = 'bought' where status = 'active' and name in ('Windeln', 'Milch')" --write`.

- **Add split entries the way Siri and MCP do.** Run `fg db query "select name, brand, properties, quantity from public.add_items((select household_id from household_members where user_id = auth.uid()), array['Windeln Pampers Größe 3', '2 l Milch 1,5 %'])" --write --as lea`. The output is `Windeln|Pampers|Größe 3|` and `Milch||1,5 %|2 l`. peter's list shows "Windeln" with "Pampers · Größe 3" under it and no initial (`fg screenshot --name ed-row-details`).
- **Open the sheet.** Run `fg marionette -- long-press --text Windeln` (a hold without moving), then `fg wait --key edit-sheet`. `fg marionette -- secondary-tap --text Windeln` (a right click) opens it too. Run `fg screenshot --name ed-prefill`: Bezeichnung Windeln, Marke Pampers, Eigenschaften Größe 3, the chips "dm" and "👶 Drogerie".
- **Step the Menge and save.** Save the row first: `fg db query "select to_jsonb(i) - 'updated_at' from items i where name = 'Windeln' and status = 'active'"`. Run `fg tap --key edit-quantity-plus`: the Menge shows 2. Run `fg tap --key edit-done`, then `fg wait --key edit-sheet --gone`. Query the row again. Only `quantity` differs (null before, "2" now), and the row now reads "2× Windeln": use that text from here on.
- **Fold out a chip.** Open the sheet again (`fg marionette -- long-press --text "2× Windeln"`), run `fg tap --key chip-category` and `fg screenshot --name ed-chips`. The categories show as options under the chips, and the sheet has grown upwards. Run `fg tap --key chip-category` again to fold them back. Then run `fg tap --key edit-cancel`.
- **Check the partner highlight is kept.** Run `fg peer lea add Kaffee`, then `fg wait --text "1 neu von Lea" --timeout 5`. Take a screenshot at once, because the highlight clears after 3 s on screen. Kaffee is tinted, and no row carries an initial.
- **Delete with undo.** Open "2× Windeln" (long-press), run `fg tap --key edit-delete`, then `fg wait --text "Windeln gelöscht"` and `fg tap --text Rückgängig`. `fg wait --text "2× Windeln"` shows it back.

## Gotchas

- `fg tap` on a row ticks the item. Open the sheet with `fg marionette -- long-press` or `secondary-tap`. The e2e spec `e2e/tests/edit-sheet.spec.ts` covers the long press and the right click on web.
- On Flutter web a text field's value is empty in the DOM until the field is focused. Read prefilled values after a click (`expectFieldValue` in `e2e/tests/helpers.ts`).
- The chip and the option of the same store share a name. The chips are named "Laden: …" and "Kategorie: …" for screen readers and Playwright.
- A fresh partner item stops being new 3 s after it is on screen. Screenshot right after `fg wait`.
- The row text starts with the quantity ("2× Windeln", "2 l Milch"); `--text` needs the whole of it.
