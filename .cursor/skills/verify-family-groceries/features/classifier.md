# Classifier

Every new item lands in a category without the user choosing one. The list groups items under small category dividers: inside a store in that store's order, under "Ohne Laden" in the household's route order (Obst & Gemüse first, Sonstiges last). The user can move an item to another category in its edit sheet or by dragging it onto a category divider, and the household remembers the move: the next time that item is added, it lands in the category it was moved to. Classification runs on the server (`classify_item`: learned corrections, then a German dictionary of about 1200 terms, then "Sonstiges"), so the app, MCP and Siri agree.

## Sub-features

- `cls-auto` puts a new item under a category divider from the dictionary, including compound endings ("Ziegenmilch" → Kühlregal, through "milch").
- `cls-fallback` puts an unknown item under "Sonstiges", shown last.
- `cls-order` shows the dividers of "Ohne Laden" in route order (uppercase, without the emoji): Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven, Süßes & Snacks, Getränke, Tiefkühl, Haushalt, 👶 Drogerie, Sonstiges.
- `cls-move` moves an item to another category through the edit sheet's category chip ("Fertig").
- `cls-drag` moves an item by holding it and dropping it on another category divider (the end of that category); the household learns it like a move in the edit sheet.
- `cls-learn` puts a re-added item into the category it was last moved to.

## How to get to it (user POV)

- Add an item in the field at the top of the list. Without a store it appears under its category divider in "Ohne Laden".
- Hold the item without moving to open the edit sheet, tap the category chip, pick another category from the options that fold out, and tap "Fertig".
- Hold an item and drag it onto another category divider.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in on the list.
- The test items are not active and have no store memory, so they land in "Ohne Laden": `fg db query "update items set status = 'bought' where status = 'active' and name in ('Ziegenmilch', 'Windeln', 'Xylophon')" --write`. Seeded runs share the stack, so read with `--as peter`.
- The linux surface for the drag (`fg drag`).

- **Auto-categorize.** Run `fg type --key add-item-field --input Ziegenmilch --submit`, then the same for `Windeln` and `Xylophon`. `fg wait --text Xylophon` succeeds. `fg find --type Text` lists "Ohne Laden", then each item after its divider (KÜHLREGAL, DROGERIE, SONSTIGES). The stored view: `fg db query "select i.name, c.name as category from items i join categories c on c.id = i.category_id where i.status = 'active' and i.name in ('Ziegenmilch', 'Windeln', 'Xylophon') order by i.name" --as peter` returns 👶 Drogerie, Sonstiges and Kühlregal.
- **Divider order.** In "Ohne Laden", the `y` bounds of the divider texts in `fg find --type Text` increase in route order. SONSTIGES is the last divider, above "Zuletzt gekauft".
- **Move.** Run `fg marionette -- long-press --text Xylophon`, then `fg wait --key edit-sheet` (the sheet is open). Run `fg tap --key chip-category` (`chip-store` is the store chip), `fg wait --key category-option-<Süßes & Snacks id>` (`fg db query "select id from categories where name = 'Süßes & Snacks'" --as peter`), `fg tap --key category-option-<id>`, `fg tap --key edit-done` and `fg wait --key edit-sheet --gone`. `fg wait --text "SÜSSES & SNACKS"` matches (ß turns into SS on the divider), Xylophon shows under it, and the category query above returns that category for it. `fg db query "select c.name, m.corrections from category_memory m join categories c on c.id = m.category_id where m.item_key = 'xylophon'" --as peter` returns Süßes & Snacks with a count.
- **Learn.** Tick Xylophon (`fg tap --text Xylophon`, then `fg wait --contains "Xylophon abgehakt"`) and add it again with `fg type --key add-item-field --input Xylophon --submit`. It lands under "Süßes & Snacks". `fg db query "select c.name from items i join categories c on c.id = i.category_id where i.name = 'Xylophon' and i.status = 'active'" --as peter` returns Süßes & Snacks.
- **Drag.** Run `fg drag --from-text Ziegenmilch --to-text DROGERIE`. Ziegenmilch now shows last under DROGERIE, `fg db query "select c.name from items i join categories c on c.id = i.category_id where i.name = 'Ziegenmilch' and i.status = 'active'" --as peter` returns 👶 Drogerie, and `fg db query "select c.name, m.corrections from category_memory m join categories c on c.id = m.category_id where m.item_key = item_key('Ziegenmilch')" --as peter` returns 👶 Drogerie with a count. Take `fg screenshot --name cls-drag`.
- **Proof.** Take `fg screenshot --name cls-after-add` and `--name cls-after-move`, and save the category query output for both states.

## Gotchas

- The category options carry keys (`category-option-<id>`); tap them by key. Their names also appear as divider labels on the list behind the sheet.
- Divider texts are uppercase and drop a leading emoji ("👶 Drogerie" reads DROGERIE, "Süßes & Snacks" reads SÜSSES & SNACKS); the full name is the divider's semantics label. `fg drag --to-text` takes the divider text.
- Household and drugstore goods (bags, cleaning brands, Kleber, Taschentuch) are covered since job 2b: "Mülltüten" → Haushalt, "Sekundenkleber" → Haushalt (not Fleisch via "leber"), "Elmex" → Drogerie. A quick check: `fg db query "select c.name from categories c where c.id = classify_item((select id from households where name = 'Familie Test'), 'Mülltüten')"` returns Haushalt.
- `supabase/classifier/sweep.sh` reruns the 345-item non-food sweep (`sweep.tsv`) on the checkout's own stack (the `project_id` in `supabase/config.toml`, not an `fg` instance) and prints every item whose category moved; it exits 1 if any did. Run it after a dictionary change; refresh the list with `sweep.sh --print` only when the move is intended.
- Matching folds case, umlauts and one plural ending ("Gurken" = "Gurke") and prefers the head of a compound ("Ziegenmilch" → Kühlregal, "Milchschokolade" → Süßes & Snacks). Common compounds such as "Vollmilch" and "Hafermilch" are dictionary terms of their own, so they don't prove compound matching. The dictionary is `supabase/classifier/dictionary.tsv`.
- Item names fold numbers away: after a move of "Xylophon", "Xylophon-123" lands in the learned category too. Use distinct words, not numbered variants, when the first category matters.
- Learning is per household and survives `fg up` but not `fg up --fresh`. A move taught in an earlier run changes where the item lands. Start from `--fresh` when the first category matters.
- New items briefly show under "Wird einsortiert …" until the server returns the category, and can't be dragged until then. Wait with `fg wait --contains "Wird einsortiert" --gone` before you assert or drag.
- A new item that store memory knows lands in that store's section, not in "Ohne Laden"; its category divider then follows the store's order.
- The edit sheet's fields have keys (`edit-name`, `edit-quantity`, …; `features/edit-item.md`).
