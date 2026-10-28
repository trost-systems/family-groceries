# Classifier

Every new item lands in a category without the user choosing one. The list groups items under category headers in the household's route order (Obst & Gemüse first, Sonstiges last). The user can move an item to another category in its edit sheet, and the household remembers the move: the next time that item is added, it lands in the category it was moved to. Classification runs on the server (`classify_item`: learned corrections, then a German dictionary of about 1160 terms, then "Sonstiges"), so the app, MCP and Siri agree.

## Sub-features

- `cls-auto` puts a new item under a category header from the dictionary, including compound endings ("Ziegenmilch" → Kühlregal, through "milch").
- `cls-fallback` puts an unknown item under "Sonstiges", shown last.
- `cls-order` shows the headers in route order: Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven, Süßes & Snacks, Getränke, Tiefkühl, Haushalt, 👶 Drogerie, Sonstiges.
- `cls-move` moves an item to another category through the edit sheet's category chip ("Fertig").
- `cls-drag` moves an item by long-pressing it and dropping it on another category header; the household learns it like a move in the edit sheet.
- `cls-learn` puts a re-added item into the category it was last moved to.

## How to get to it (user POV)

- Add an item in the field at the top of the list. It appears under its category header (with "Alle" selected in the store picker below the field).
- Tap the item's name to open the edit sheet, tap the category chip, pick another category from the options that fold out, and tap "Fertig".
- Long-press an item and drag it onto another category header.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in on the list.
- The test items are not active: `fg db query "update items set status = 'bought' where status = 'active' and name in ('Ziegenmilch', 'Windeln', 'Xylophon')" --write`.

- **Auto-categorize.** Run `fg type --key add-item-field --input Ziegenmilch --submit`, then the same for `Windeln` and `Xylophon`. `fg wait --text Xylophon` succeeds. `fg find --type Text` lists each item after its header (Kühlregal, 👶 Drogerie, Sonstiges). The stored view: `fg db query "select i.name, c.name as category from items i join categories c on c.id = i.category_id where i.status = 'active' and i.name in ('Ziegenmilch', 'Windeln', 'Xylophon') order by i.name"` returns 👶 Drogerie, Sonstiges and Kühlregal.
- **Header order.** With "Alle" selected, the `y` bounds of the header texts in `fg find --type Text` increase in route order. Sonstiges is the last header, above "Zuletzt gekauft".
- **Move.** Run `fg tap --text Xylophon`, then `fg wait --key edit-sheet` (the sheet is open). Run `fg tap --key chip-category` (`chip-store` is the store chip), `fg wait --text "Süßes & Snacks"`, `fg tap --text "Süßes & Snacks"`, `fg tap --key edit-done` and `fg wait --key edit-sheet --gone`. Xylophon now shows under "Süßes & Snacks", and the category query above returns that category for it. `fg db query "select c.name, m.corrections from category_memory m join categories c on c.id = m.category_id where m.item_key = 'xylophon'"` returns Süßes & Snacks with a count.
- **Learn.** Tick Xylophon (`fg tap --row Xylophon --type Checkbox`, then `fg wait --text Xylophon --gone`) and add it again with `fg type --key add-item-field --input Xylophon --submit`. It lands under "Süßes & Snacks". `fg db query "select c.name from items i join categories c on c.id = i.category_id where i.name = 'Xylophon' and i.status = 'active'"` returns Süßes & Snacks.
- **Drag.** Not drivable with fg: Marionette has no press-and-drag gesture. Report `cls-drag` as skipped.
- **Proof.** Take `fg screenshot --name cls-after-add` and `--name cls-after-move`, and save the category query output for both states.

## Gotchas

- With the dropdown open, category names appear twice: in the menu and as headers on the list behind the sheet. `fg tap --text` takes the first match. Choose a category with no items on the list, or check the result with the category query.
- Household and drugstore goods (bags, cleaning brands, Kleber, Taschentuch) are covered since job 2b: "Mülltüten" → Haushalt, "Sekundenkleber" → Haushalt (not Fleisch via "leber"), "Elmex" → Drogerie. A quick check: `fg db query "select c.name from categories c where c.id = classify_item((select id from households where name = 'Familie Test'), 'Mülltüten')"` returns Haushalt.
- `supabase/classifier/sweep.sh` reruns the 345-item non-food sweep (`sweep.tsv`) on the checkout's own stack (the `project_id` in `supabase/config.toml`, not an `fg` instance) and prints every item whose category moved; it exits 1 if any did. Run it after a dictionary change; refresh the list with `sweep.sh --print` only when the move is intended.
- Matching folds case, umlauts and one plural ending ("Gurken" = "Gurke") and prefers the head of a compound ("Ziegenmilch" → Kühlregal, "Milchschokolade" → Süßes & Snacks). Common compounds such as "Vollmilch" and "Hafermilch" are dictionary terms of their own, so they don't prove compound matching. The dictionary is `supabase/classifier/dictionary.tsv`.
- Item names fold numbers away: after a move of "Xylophon", "Xylophon-123" lands in the learned category too. Use distinct words, not numbered variants, when the first category matters.
- Learning is per household and survives `fg up` but not `fg up --fresh`. A move taught in an earlier run changes where the item lands. Start from `--fresh` when the first category matters.
- New items briefly show under "Wird einsortiert …" until the server returns the category. Wait for the item under its final header before you assert.
- The edit sheet's fields have labels (`Name`, `Menge`) but no keys. Use `fg type --label Name --input ...`.
