# Categories

Menü → "Kategorien verwalten", or the menu of the list's "Ohne Laden" divider, opens "Kategorien": the household's route order, which sorts the "Ohne Laden" section and the categories a store's layout leaves out. A tap on a category renames it. "Kategorie hinzufügen" adds one before "Sonstiges", in the route and in every store. The trash icon deletes a category after asking where its items go. "Sonstiges" can't be deleted. The drag handle reorders the route.

## Sub-features

- `cat-open` lists the household's categories in route order under the hint "In dieser Reihenfolge stehen die Kategorien unter „Ohne Laden“ …". It opens from the app menu and from the "Ohne Laden" divider's menu.
- `cat-add` adds a category ("Kategorie hinzufügen", field "Name") just before "Sonstiges" and into every store's order.
- `cat-duplicate` refuses an existing name with "Eine Kategorie „<name>“ gibt es schon." and closes the dialog.
- `cat-rename` renames a category ("Kategorie umbenennen").
- `cat-delete` deletes a category ("<name> löschen") and moves its items to the category chosen in "Artikel verschieben nach" (default "Sonstiges"). It teaches the classifier nothing, and the learned corrections that pointed at the deleted category go with it.
- `cat-other-fixed` gives "Sonstiges" no delete button.
- `cat-reorder` reorders the route by dragging a handle ("<name> verschieben"). Dragging a category divider inside "Ohne Laden" on the list does the same (`features/list-walk-order.md`).

## How to get to it (user POV)

- On the list screen, tap "Menü" (top right), then "Kategorien verwalten".
- On the list, hold the "Ohne Laden" divider (or right-click it), then tap "Kategorien verwalten".

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter signed in on the list. No category named "Baby" or "Babysachen" (`fg up --fresh` restores the seeded 11).

- **Open.** Run `fg tap --tooltip Menü`, `fg wait --text "Kategorien verwalten"`, `fg tap --text "Kategorien verwalten"` and `fg wait --text Kategorien`. `fg find --type Text` lists the 11 seeded categories in route order. `fg find --tooltip "Sonstiges löschen"` counts 0, and `fg find --tooltip "Haushalt löschen"` counts 1. The second entry point: `fg back`, `fg marionette -- scroll-to --key store-none`, `fg marionette -- secondary-tap --key store-none`, `fg wait --key section-menu` (only `section-menu-layout` shows), `fg tap --key section-menu-layout` and `fg wait --text Kategorien`. "Ohne Laden" shows only while items have no store; add one first if the list has none.
- **Add.** Run `fg tap --text "Kategorie hinzufügen"`, `fg wait --label Name`, `fg type --label Name --input Baby --submit` and `fg wait --text Baby`. `fg db query "select name from categories order by sort_order desc limit 2" --as peter` returns Sonstiges, then Baby. `fg db query "select count(*) from store_category_order o join categories c on c.id = o.category_id where c.name = 'Baby'" --as peter` returns 3.
- **Duplicate.** Add Baby again the same way. `fg wait --contains "gibt es schon"` matches, and the dialog is already closed (`fg find --label Name` counts 0).
- **Rename.** Run `fg tap --text Baby`, `fg wait --text "Kategorie umbenennen"`, `fg type --label Name --input Babysachen --submit` and `fg wait --text Babysachen`. `fg type` replaces the pre-filled name. `fg db query "select name from categories where name like 'Baby%'" --as peter` returns Babysachen.
- **Delete.** Put an item in it first: `fg db query "update items set category_id = (select id from categories where name = 'Babysachen' and household_id = items.household_id) where name = '<an active item>' and status = 'active' and household_id = (select id from households where name = 'Familie Test')" --write`. Run `fg tap --tooltip "Babysachen löschen"`, `fg wait --text "Babysachen löschen"`, `fg tap --text Löschen` and `fg wait --text Babysachen --gone`. The item's category query (`select c.name from items i join categories c on c.id = i.category_id where i.name = '<item>' and i.status = 'active'`, `--as peter`) returns Sonstiges, and `fg db query "select count(*) from category_memory m join categories c on c.id = m.category_id where c.name = 'Sonstiges'" --as peter` did not grow.
- **Reorder.** The handle starts a drag at once (no long press), so a coordinate swipe drives it. `fg find --contains verschieben` lists the handles ("<name> verschieben") top to bottom with their bounds; rows are 48 px apart. Run `fg marionette -- swipe --start-x 368 --start-y 136 --end-x 368 --end-y 250`: from the first handle's centre (x + 12, y + 12) to just past the third row. `fg find --contains verschieben` now starts with "Brot & Backwaren", "Kühlregal", "Obst & Gemüse", and `fg db query "select name from categories order by sort_order limit 3" --as peter` returns the same order (repeat it if it lags a second). Restore the route with `fg marionette -- swipe --start-x 368 --start-y 232 --end-x 368 --end-y 118`.
- **Proof.** Screenshot the screen after each step and save the category queries. Run `fg back` to return to the list.

## Gotchas

- The duplicate snackbar closes the dialog. A `fg back` after it leaves the categories screen, not the dialog.
- "Kategorie hinzufügen" is both the button and the open dialog's title. Wait for the field (`--label Name`) instead of the text.
- The delete dialog's "Artikel verschieben nach" dropdown is not listed by `fg find`. Leave it on "Sonstiges" or check the result in the database.
- A precondition written with `fg db query --write` that changes an item's category counts as a correction: the household learns it, like a move in the edit sheet. Deleting the category removes that learned row again.
- Category changes survive `fg up` and change the divider order in "Ohne Laden" and in every store in other recipes. Restore with `fg up --fresh`.
- `fg back` on the categories screen returns to the list; a second one closes the Linux app.
- Seeded scenario runs share the stack. A query without `--as peter` (or a household filter) also counts their categories and items.
