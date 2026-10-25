# Stores

A row of chips under the add field picks the store: "Alle", "dm", "Lidl" or "Edeka". "Alle" shows the household's route order. A store sorts the list in that store's walking order and shows the items tagged to it plus untagged ones. Items tagged to another store are hidden. In dm, untagged items from categories dm doesn't carry fold behind one button. Ticking or adding an item in a store view tags it to that store, and the household remembers where each item was bought, so a later re-add lands in that store again. The edit sheet sets or clears the store, and each store's layout is editable.

## Sub-features

- `st-picker` shows the chips "Alle", "dm", "Lidl", "Edeka" under the add field, with "Alle" selected after every start.
- `st-order` sorts a store view by the store's category order (Lidl: "Brot & Backwaren" before "Obst & Gemüse"; Edeka: "Fleisch/Wurst/Fisch" before "Kühlregal").
- `st-filter` shows a store's tagged items and untagged items, never items tagged to another store.
- `st-dm-hidden` folds untagged items in categories dm doesn't carry behind "<n> Artikel, die es bei dm meist nicht gibt, anzeigen"; the same button then reads "… ausblenden".
- `st-tick-tags` tags an item ticked in a store view to that store and remembers it for the item's name.
- `st-memory` puts a re-added item (from "Alle") back in the store it was last bought at.
- `st-add-in-store` tags an item added in a store view to that store.
- `st-sheet` sets the store in the edit sheet ("Geschäft"); "Alle Geschäfte" clears the tag and the memory.
- `st-layout` opens "<Store>: Reihenfolge" (tooltip "Reihenfolge bearbeiten", store views only), where a switch per category ("<category> gibt es bei <store>") shows or hides it in that store. Every change saves at once.
- `st-layout-reorder` reorders a store's categories by dragging their handles ("<category> verschieben").

## How to get to it (user POV)

- On the list screen, tap a chip under the add field.
- In a store view, tap the icon at the right end of the chip row ("Reihenfolge bearbeiten").
- Tap an item's name and pick a store in "Geschäft".
- In dm, tap the "… anzeigen" line under the list.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in on the list. `fg up --fresh` if earlier runs tagged these items or changed a store layout: tags, memory and layouts survive `fg up`.
- A short list: `fg db query "update items set status = 'bought' where status = 'active'" --write`, then add the test items: `fg type --key add-item-field --input <item> --submit` for Äpfel, Brot, Milch, Hack, Zahnpasta and Klopapier, and `fg wait --contains "Wird einsortiert" --gone`.

- **Picker and order.** `fg find --tooltip "Reihenfolge bearbeiten"` counts 0 under "Alle". Run `fg tap --text Lidl`. `fg find --type Text | jq -c '[.elements[].text]'` lists "Brot & Backwaren" before "Obst & Gemüse" (the reverse of "Alle"), and the tooltip now counts 1. `fg tap --text Edeka` lists "Fleisch/Wurst/Fisch" before "Kühlregal".
- **dm.** Run `fg tap --text dm`. Only "👶 Drogerie" (Zahnpasta) and "Haushalt" (Klopapier) show. Run `fg tap --text "4 Artikel, die es bei dm meist nicht gibt, anzeigen"` and `fg wait --text Milch`; then `fg tap --text "4 Artikel, die es bei dm meist nicht gibt, ausblenden"` and `fg wait --text Milch --gone`. Take `fg screenshot --name st-dm`.
- **Layout switch.** In dm, run `fg tap --tooltip "Reihenfolge bearbeiten"`, `fg wait --text "dm: Reihenfolge"` and `fg tap --label "Kühlregal gibt es bei dm"`. `fg db query "select o.hidden from store_category_order o join stores s on s.id = o.store_id join categories c on c.id = o.category_id join households h on h.id = s.household_id where h.name = 'Familie Test' and s.name = 'dm' and c.name = 'Kühlregal'"` turns from true to false (repeat it if it lags a second). Run `fg back` and `fg wait --text Milch`: Milch now shows in dm. Tap the switch again to restore it.
- **Tick tags.** Run `fg tap --text Lidl`, `fg tap --row Hack --type Checkbox` and `fg wait --text Hack --gone`. `fg db query "select s.name from item_store_memory m join stores s on s.id = m.store_id where m.item_key = item_key('Hack')"` returns Lidl.
- **Memory.** Run `fg tap --text Alle`, `fg type --key add-item-field --input Hack --submit` and `fg wait --text Hack`. With `fg tap --text Edeka`, `fg find --text Hack` counts 0 and `fg find --text Klopapier` counts 1; with `fg tap --text Lidl`, Hack counts 1. `fg db query "select i.name, s.name as store from items i left join stores s on s.id = i.store_id where i.status = 'active' order by 1"` shows Hack with Lidl and the rest with null.
- **Edit sheet.** Under "Alle", run `fg tap --text Zahnpasta`, `fg wait --label Name`, `fg tap --type "DropdownButton<String?>"`, `fg wait --text "Alle Geschäfte"`, `fg tap --text dm`, `fg tap --text Speichern` and `fg wait --label Name --gone`. The store query shows dm, and the Lidl view no longer lists Zahnpasta. Repeat with `fg tap --text "Alle Geschäfte"`: `fg db query "select i.store_id is null as untagged, (select count(*) from item_store_memory where item_key = item_key('Zahnpasta')) as memory from items i where i.name = 'Zahnpasta' and i.status = 'active'"` returns true and 0.
- **Add in a store view.** Run `fg tap --text Edeka`, `fg type --key add-item-field --input Butter --submit` and `fg wait --text Butter`. In the Lidl view `fg find --text Butter` counts 0, and the store query shows Edeka for Butter.
- **Picker resets.** Run `fg restart` and `fg wait --key add-item-field`. `fg find --tooltip "Reihenfolge bearbeiten"` counts 0: the list is back on "Alle".
- **Reorder.** Not drivable with fg: the order changes only by a long-press drag on a handle, and Marionette has no press-and-drag gesture. Report `st-layout-reorder` as skipped; `e2e/tests/stores.spec.ts` drags the handles in CI.
- **Proof.** Screenshot each store view and the layout screen, and save the store and memory queries.

## Gotchas

- The chips are buttons: `fg find --text dm` does not list them, but `fg tap --text dm` reaches them. With the edit sheet's store menu open, `fg tap --text dm` hits the menu entry. Check the result with the store query.
- `fg find` lists the layout switches as `Semantics` with the label "<category> gibt es bei <store>"; tap them with `--label`.
- The dm button's count ("4 Artikel …") depends on what is on the list. Read it from a screenshot, or keep the item set above.
- Store memory and layouts persist across `fg up`. A layout switched off in an earlier run hides that category in the store view.
- The picker isn't saved: after `fg restart` (or any relaunch) the list shows "Alle".
- `classifier.md` covers categories under "Alle"; `categories.md` covers renaming, adding and deleting them, which also changes every store's order.
