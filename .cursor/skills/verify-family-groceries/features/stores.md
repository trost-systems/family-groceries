# Stores

Every store of the household is a section of the list: a divider "<Store>, N Artikel", then the items tagged to that store in the store's walking order. Items without a store sit in a last section, "Ohne Laden", in the household's route order. There is no store picker and no store view (job 16): an item gets its store when it is dragged onto a store or into another store's rows, or in the edit sheet. The household remembers where each item was put, so a later re-add lands in that store again. Each store's category order is editable from its divider's menu.

## Sub-features

- `st-sections` shows one divider per store in store order ("dm, 0 Artikel" too) and "Ohne Laden" last while it has items. The list without any item shows only the empty state.
- `st-order` sorts a store's section by that store's category order (Lidl: "Brot & Backwaren" before "Obst & Gemüse"; Edeka: "Fleisch/Wurst/Fisch" before "Kühlregal"), and "Ohne Laden" by the route.
- `st-drop-tags` tags an item dropped on a store divider (folded or not) or on a row of another store to that store, keeps its category, and remembers the store for the item's name.
- `st-memory` puts a re-added item back in the store it was last tagged to.
- `st-tick-no-tag` leaves an untagged item untagged when it is ticked; nothing is remembered.
- `st-sheet` sets the store in the edit sheet (store chip, key `chip-store`); "Ohne Laden" (`store-option-none`) clears the tag and the memory.
- `st-layout` opens "<Store>: Reihenfolge" from the store divider's menu ("Reihenfolge bearbeiten", key `section-menu-layout`). The screen lists the categories with drag handles only; the "gibt es bei" switches are gone. Every change saves at once.
- `st-layout-reorder` reorders a store's categories by dragging their handles ("<category> verschieben").
- `st-store-order` reorders the stores: `features/list-walk-order.md` (drag a store divider, or "Laden nach oben/unten").

## How to get to it (user POV)

- Scroll the list: each store is a section with its own divider.
- Press and hold an item, drag it onto a store's divider or among that store's items, and let go.
- Hold an item without moving (or right-click it), then pick a store under "Laden".
- Hold a store's divider without moving (or right-click it), then tap "Reihenfolge bearbeiten".

## Driving it with fg

Preconditions:

- Baseline from `features/README.md` on the linux surface (`fg drag`); peter signed in on the list. `fg up --fresh` if earlier runs tagged these items or changed a store layout: tags, memory and layouts survive `fg up`.
- A short list: `fg db query "update items set status = 'bought' where status = 'active'" --write`, then `fg type --key add-item-field --input <item> --submit` for Äpfel, Brot, Milch, Hack, Zahnpasta and Klopapier, and `fg wait --contains "Wird einsortiert" --gone`. Tap `--key list-hint-dismiss` if the card shows, so all sections fit.
- The store ids: `fg db query "select name, id from stores order by sort_order" --as peter`. The store query used below: `S="select i.name, s.name as store, c.name as category from items i left join stores s on s.id = i.store_id join categories c on c.id = i.category_id where i.status = 'active' order by 1"`.

- **Sections.** `fg find --contains Artikel | jq -c '[.elements[] | select(.type == "Semantics") | .label]'` returns "dm, 0 Artikel", "Lidl, 0 Artikel", "Edeka, 0 Artikel", "Ohne Laden, 6 Artikel": new items from the app have no store. `fg find --type Text` lists the Ohne Laden dividers in route order: OBST & GEMÜSE, BROT & BACKWAREN, KÜHLREGAL, FLEISCH/WURST/FISCH, HAUSHALT, DROGERIE.
- **Drop on a store.** Run `fg drag --from-text Brot --to-key store-<Lidl id>`, `fg drag --from-text Äpfel --to-key store-<Lidl id>` and `fg drag --from-text Milch --to-key store-<Edeka id>`. `fg db query "$S" --as peter` shows Äpfel and Brot with Lidl, Milch with Edeka, each with its old category.
- **Edit sheet.** Run `fg marionette -- long-press --text Hack`, `fg wait --key edit-sheet`, `fg tap --key chip-store`, `fg wait --key store-option-<Edeka id>`, `fg tap --key store-option-<Edeka id>`, `fg tap --key edit-done` and `fg wait --key edit-sheet --gone`. `$S` shows Hack with Edeka.
- **Order per store.** `fg find --type Text` now lists Lidl with BROT & BACKWAREN before OBST & GEMÜSE (the reverse of the route) and Edeka with FLEISCH/WURST/FISCH before KÜHLREGAL. Take `fg screenshot --name st-sections`.
- **Memory.** `fg db query "select m.item_key, s.name from item_store_memory m join stores s on s.id = m.store_id order by 1" --as peter` returns apfel and brot with Lidl, hack and milch with Edeka. Run `fg tap --text Hack` (a tick), `fg wait --text Hack --gone`, `fg type --key add-item-field --input Hack --submit`, `fg wait --text Hack` and `fg wait --contains "Wird einsortiert" --gone`. `fg db query "select s.name from items i join stores s on s.id = i.store_id where i.status = 'active' and i.name = 'Hack'" --as peter` returns Edeka, and the row sits under the Edeka divider.
- **Clear the store.** Open Milch the same way and pick `store-option-none`, then `edit-done`. `fg db query "select i.store_id is null as untagged, (select count(*) from item_store_memory where item_key = item_key('Milch')) as memory from items i where i.name = 'Milch' and i.status = 'active'" --as peter` returns true and 0, and the labels read "Edeka, 1 Artikel", "Ohne Laden, 3 Artikel".
- **A tick doesn't tag.** Run `fg tap --text Klopapier` and `fg wait --text Klopapier --gone`. `fg db query "select count(*) from item_store_memory where item_key = item_key('Klopapier')" --as peter` returns 0. `fg tap --text Rückgängig` puts it back.
- **Layout screen.** Run `fg marionette -- long-press --key store-<dm id>` and `fg wait --key section-menu` (dm, the first store, has `section-menu-down` and `section-menu-layout` but no up). Run `fg tap --key section-menu-layout` and `fg wait --text "dm: Reihenfolge"`. `fg find --contains "gibt es bei"` counts 0.
- **Reorder.** On "dm: Reihenfolge", the handle starts a drag at once (no long press), so a coordinate swipe drives it, as in `features/categories.md` (Reorder). `fg find --contains verschieben` lists the handles top to bottom ("👶 Drogerie verschieben" first, at y 104; rows are 48 px apart). `fg marionette -- swipe --start-x 368 --start-y 116 --end-x 368 --end-y 230` moves "👶 Drogerie" below "Süßes & Snacks", and `fg db query "select c.name from store_category_order o join stores s on s.id = o.store_id join categories c on c.id = o.category_id where s.name = 'dm' order by o.sort_order limit 3" --as peter` returns Vorrat & Konserven, Süßes & Snacks, 👶 Drogerie (repeat it if it lags a second). Restore it with `fg marionette -- swipe --start-x 368 --start-y 212 --end-x 368 --end-y 98`, then `fg back`.
- **Proof.** Screenshot the sections before and after the drops, the menu and the layout screen, and save the store and memory queries.

## Gotchas

- The store chips "Alle/dm/Lidl/Edeka", store views, the dm "… anzeigen" button and the "gibt es bei" switches are gone (job 16). `fg tap --text dm` now hits the dm divider's name or the edit sheet's store option, not a chip.
- With the edit sheet's store options open, the store names show twice (the option and the divider behind the sheet). Tap options by key (`store-option-<id>`).
- A new item takes the store memory holds for its name, from the app, MCP and Siri alike (`features/edit-item.md`). Earlier runs' memory therefore puts the test items into stores at once; start from `fg up --fresh` when "Ohne Laden, 6 Artikel" matters.
- Store memory and layouts persist across `fg up`. `fg up --fresh` restores them.
- `fg back` on the list screen closes the Linux app. Use it only on the layout screen.
- The `hidden` flags in `store_category_order` stay in the database but change nothing in the app.
- `classifier.md` covers categories; `categories.md` covers renaming, adding and deleting them, which also changes every store's order; `list-walk-order.md` covers dragging, folding and the store order.
