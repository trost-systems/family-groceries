# List and walk order

The list is one scroll of sections, one per store in the household's store order, then "Ohne Laden" for items without a store. Each store starts with a divider "<Store>, N Artikel" and a fold caret. Inside a store, small uppercase category dividers follow that store's walk order, and the rows under each follow the household's walk order (`sort_key`). A row is a full-width button: a tap ticks it, a hold without moving opens the edit sheet, and a hold that moves drags it onto a row, a category divider or a store divider. Store and category dividers can be dragged too, or moved through their menu. Folds and the explainer card are kept per device. A partner's adds and moves show live.

## Sub-features

- `lw-sections` shows a divider per store in store order (key `store-<store id>`, label "<Store>, N Artikel"), an empty store as "<Store>, 0 Artikel", and "Ohne Laden" last (key `store-none`) while it has items.
- `lw-category-dividers` shows a store's categories in its layout order as uppercase dividers (key `category-<store id or none>-<category id>`): the text drops a leading emoji and turns ß into SS ("👶 Drogerie" reads DROGERIE), the semantics label keeps the full name.
- `lw-rows` reads the quantity first ("2 l Milch", "6× Bananen", a bare "Gurke"), with "Marke · Eigenschaften" under it, an emoji at the left and no checkbox.
- `lw-walk` orders the rows of a category by `sort_key`, not by add order.
- `lw-tick` ticks an item with a tap on its row ("<name> abgehakt", "Rückgängig"); undo puts it back in the same place.
- `lw-drag-row` drops a dragged row before or after another row (by the half of the row the finger is in) and writes the new `sort_key`; a drop on a row of another category or store takes that category and store.
- `lw-drag-category` drops a row on a category divider: the end of that category in that store, which changes the item's category.
- `lw-drag-store` drops a row on a store divider, folded or not: the item keeps its category, goes to the end of it in that store, and the store memory learns it.
- `lw-store-order` reorders stores by dragging a store divider, or with "Laden nach oben/unten" in its menu.
- `lw-category-order` reorders a store's categories by dragging a category divider (the store's layout), or with "Kategorie nach oben/unten" in its menu; in "Ohne Laden" that reorders the household's route.
- `lw-menu` opens a divider's menu (`section-menu`) on a hold without moving or a right click: `section-menu-up`, `section-menu-down` (when there is room), and `section-menu-layout`, which opens "<Store>: Reihenfolge", or "Kategorien" from "Ohne Laden".
- `lw-fold` folds a store with a tap on its divider (the caret turns from ˅ to ›); the fold survives a restart.
- `lw-hint` shows the explainer card (key `list-hint`, "Tippen hakt ab · Halten bearbeitet · Halten und ziehen verschiebt") until "Verstanden" (`list-hint-dismiss`); it stays gone after a restart.
- `lw-empty` shows the empty state (key `list-empty`) when the list has no items.
- `lw-partner` tints a partner's new row (key `new-<id>`, label ends in "Neu") with "N neu von <name>" under the title (`new-items-subtitle`) and no initial; the tint clears after 3 s on screen.
- `lw-partner-move` shows a partner's drag on the other client without a reload.

## How to get to it (user POV)

- Open the app while signed in to a household. The list sits under the add field.
- Tap a row to tick it, tap "Rückgängig" in the snackbar to undo.
- Press and hold a row, then let go without moving to edit it, or keep holding and drag it.
- Tap a store divider to fold or unfold it. Hold it (or right-click) for its menu, or hold and drag it.
- Hold a category divider for its menu, or hold and drag it within its store.
- Tap "Verstanden" on the card above the list.

## Driving it with fg

Preconditions:

- `FG_SURFACE=linux` (`fg drag` drives the client's X display) and `fg up --clients peter,lea`.
- Seed the walk: `fg seed h-list-walk` (household "Familie Berg": Lidl, dm, Edeka plus "Ohne Laden", every item with brand, properties and `walkOrder`). Note the run id (`R`), then `fg login $R:hanna --client peter` and `fg login $R:jonas --client lea`. Use `--as $R:hanna` on every query, so it reads only this household.
- The ids for keys: `fg db query "select name, id from stores order by sort_order" --as $R:hanna`, and the divider keys from `fg find --contains store-` and `fg find --contains category-`.
- The order query used below: `Q="select s.name as store, c.name as category, i.name, i.sort_key from items i join categories c on c.id = i.category_id left join stores s on s.id = i.store_id where i.status = 'active' order by s.sort_order nulls last, i.sort_key"`.

- **Sections and dividers.** Run `fg find --contains "Artikel"`: the labels read "dm, 3 Artikel", "Lidl, 7 Artikel" (and "Edeka, 2 Artikel" further down). The store order follows `select name, sort_order from stores` (the seed's default: dm, Lidl, Edeka). `fg find --type Text` lists DROGERIE then HAUSHALT under dm, OBST & GEMÜSE, KÜHLREGAL, GETRÄNKE under Lidl. `fg find --contains "👶"` shows the Semantics label "👶 Drogerie" on the divider. `fg marionette -- scroll-to --key store-none` brings "Ohne Laden, 2 Artikel" with Brot and Eier into view. Take `fg screenshot --name lw-sections`.
- **Rows.** `fg find --type Text` lists "1 kg Äpfel" then "Elstar", "6× Bananen" then "Bio", "Gurke", "2 l Milch" then "Milbona · 1,5 %". `fg find --type Checkbox` counts 0.
- **Walk order.** Under OBST & GEMÜSE the rows read Äpfel, Bananen, Gurke (`sort_key` 1024, 2048, 3072), although Bananen was added first. `fg db query "$Q" --as $R:hanna` shows the same order.
- **Tick and undo in place.** Run `fg tap --text "6× Bananen"`, `fg wait --contains "Bananen abgehakt"` and `fg wait --text "6× Bananen" --gone`. `fg db query "select status from items where name = 'Bananen'" --as $R:hanna` returns bought. Run `fg tap --text Rückgängig` and `fg wait --text "6× Bananen"`: the texts read "1 kg Äpfel", "6× Bananen", "Gurke" again, and the status is active.
- **Hold edits.** Run `fg marionette -- long-press --text "2 l Milch"` and `fg wait --key edit-sheet`, then `fg tap --key edit-cancel`. `fg marionette -- secondary-tap --text Gurke` opens it the same way (a right click).
- **Drag before a row.** Run `fg drag --from-text Gurke --to-text "1 kg Äpfel" --edge before`. OBST & GEMÜSE now reads Gurke, Äpfel, Bananen, and `$Q` shows Gurke's `sort_key` below Äpfel's (0 against 1024). Run `fg drag --from-text Gurke --to-text "6× Bananen" --edge after`: Gurke is last again (3072).
- **Drag onto a category divider.** Run `fg drag --from-text Gurke --to-text KÜHLREGAL`. `$Q` shows Gurke under Lidl, Kühlregal, with a `sort_key` above Joghurt's (end of the category).
- **Drag onto a folded store.** Run `fg tap --key store-<dm id>` and `fg wait --text Windeln --gone` (dm folds; the caret turns to ›). Run `fg drag --from-text Gurke --to-key store-<dm id>`. The label reads "dm, 4 Artikel", `$Q` shows Gurke in dm, still Kühlregal, and `fg db query "select s.name from item_store_memory m join stores s on s.id = m.store_id where m.item_key = item_key('Gurke')" --as $R:hanna` returns dm.
- **Store order by drag.** With dm folded and first, run `fg drag --from-key store-<dm id> --to-key store-<Lidl id> --edge after`. `fg db query "select name, sort_order from stores order by sort_order" --as $R:hanna` returns Lidl, dm, Edeka.
- **Store order by menu.** Run `fg marionette -- long-press --key store-<dm id>`, `fg wait --key section-menu` (it lists `section-menu-up`, `section-menu-down` and `section-menu-layout`; `fg screenshot --name lw-store-menu`), then `fg tap --key section-menu-up` and `fg wait --key section-menu --gone`. The store query returns dm, Lidl, Edeka again.
- **Category order by drag.** Save Lidl's layout first: `L="select c.name from store_category_order o join stores s on s.id = o.store_id join categories c on c.id = o.category_id where s.name = 'Lidl' order by o.sort_order"`. Run `fg drag --from-text GETRÄNKE --to-text "OBST & GEMÜSE" --edge before`. `fg db query "$L" --as $R:hanna` starts with Getränke, Obst & Gemüse, and the dividers read GETRÄNKE, OBST & GEMÜSE, KÜHLREGAL.
- **Category order by menu.** Run `fg marionette -- long-press --key category-<Lidl id>-<Getränke id>`, `fg wait --key section-menu`, `fg tap --key section-menu-down`. `$L` now reads Obst & Gemüse, Getränke, …; a second "down" puts Getränke after Kühlregal (the menu steps over the categories the store shows, not its whole layout).
- **Route order in "Ohne Laden".** Fold every store first, so the list doesn't scroll (see Gotchas). Run `fg drag --from-key category-none-<Kühlregal id> --to-key category-none-<Brot & Backwaren id> --edge before`. `fg db query "select name from categories order by sort_order limit 3" --as $R:hanna` returns Obst & Gemüse, Kühlregal, Brot & Backwaren. Restore it with `fg marionette -- long-press --key category-none-<Brot & Backwaren id>`, `fg wait --key section-menu` and `fg tap --key section-menu-up`.
- **Layout screens from the menu.** Run `fg marionette -- secondary-tap --key store-<Lidl id>`, `fg wait --key section-menu`, `fg tap --key section-menu-layout` and `fg wait --text "Lidl: Reihenfolge"`. `fg find --contains "gibt es bei"` counts 0; `fg find --contains verschieben` lists the handles in Lidl's order. Run `fg back`. On "Ohne Laden" (`fg marionette -- scroll-to --key store-none`), `fg marionette -- secondary-tap --key store-none` opens a menu with only `section-menu-layout`; tapping it opens "Kategorien" (`fg find --tooltip "Haushalt löschen"` counts 1). Run `fg back`.
- **Fold persists.** Run `fg tap --key store-<dm id>`, `fg wait --text Windeln --gone`, `fg restart` and `fg wait --key add-item-field`. `fg find --text Windeln` counts 0, and the dm divider is still there. Tap it again to unfold.
- **Explainer.** `fg find --key list-hint` counts 1 on a fresh login. Run `fg tap --key list-hint-dismiss` and `fg wait --key list-hint --gone`. After `fg restart`, `fg find --key list-hint` counts 0.
- **Empty state.** On a household without items (the baseline peter after `fg up --fresh`), `fg find --key list-empty` counts 1.
- **Partner add.** With hanna's list open, run `fg peer $R:jonas add Haferflocken` and `fg wait --key new-items-subtitle --timeout 5`: it reads "1 neu von Jonas Berg". Run `fg marionette -- scroll-to --text Haferflocken`: `fg find --contains new-` lists `new-<id>`, the row's label reads "Haferflocken\nNeu", and `fg screenshot --name lw-partner-tint` shows the tint with no initial. `fg wait --key new-items-subtitle --gone --timeout 8` succeeds within about 3 s.
- **Partner move.** On lea (jonas), fold every store (`fg tap --key store-<id> --client lea` for each) so the Lidl divider and Haferflocken are both on screen. Start `fg record start --name lw-partner-move --client peter`, run `fg drag --client lea --from-text Haferflocken --to-key store-<Lidl id>`, then on peter `fg marionette -- scroll-to --text Haferflocken`: its `y` lies between the Lidl and the Edeka divider. `fg db query "select s.name from items i join stores s on s.id = i.store_id where i.name = 'Haferflocken'" --as $R:hanna` returns Lidl. `fg record stop`.
- **Proof.** Screenshot every state above, record across the drags, and save `$Q`, `$L` and the store query before and after. `fg teardown $R` at the end.

## Gotchas

- `fg drag` resolves both widgets before it lifts. Lifting a store divider folds every store, and lifting a category divider folds its siblings, so a target below the source moves before the drop. Aim at a target that stays put: `--edge after` on the store right below, or the first category divider of the section.
- At the end of the list (scrolled to the bottom), a lift that makes the list shorter scrolls it, and the drop lands elsewhere. Fold the stores above until the list fits the 892 px window, as in "Route order in Ohne Laden".
- `--from-text` and `--to-text` take the first widget that shows that exact text. Category dividers show capitals ("KÜHLREGAL"), and several sections can show the same one; use `--to-key category-<section>-<category id>` when two are on screen.
- A divider's menu opens on `fg marionette -- long-press` (a hold without moving) or `secondary-tap`. Holding "Ohne Laden" doesn't open its menu: it folds the section, as a tap does (reported to job 16). Use `secondary-tap` there.
- The store divider's key sits on its padding: the dividers after the first are 20 px taller than the line you see. Taps and drags at the key's centre still hit the divider.
- `fg up` starts the clients signed out, which clears the folds and the dismissed card. `fg restart` keeps them.
- `fg back` on the list screen closes the Linux app (there is no route below it). Use it only on a pushed screen; `fg doctor` then shows `peter.process: not running`, and `fg up` relaunches it.
- The X pointer stays where `fg drag` let go, so a row there shows a hover shade in screenshots. It is not the partner tint.
- A drop on a category divider changes the item's category, and the household learns it (`category_memory`). Use the h-list-walk run, which `fg teardown` removes, not the baseline household.
- The partner tint lasts 3 s on screen; take its screenshot in the same chain as the wait.
