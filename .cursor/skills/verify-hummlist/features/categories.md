# Categories

Every household starts with 11 categories (fruit and veg, bread, chilled, …, „Sonstiges“ last). They group the list under small dividers. Under Mehr → „Kategorien verwalten“ the household can add its own, rename any, delete any except „Sonstiges“, and put them in a different order. That order (the "route") sorts the „Ohne Laden“ section and the categories a store has no order for; stores have their own order too (see stores and walk order).

## Sub-features

- `cat-seed` a new household gets these categories, in this order. DE (as stored and shown in German): Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven, Süßes & Snacks, Getränke, Tiefkühl, Haushalt, 👶 Drogerie, Sonstiges. EN (shown when the app language is English and the category was not renamed): Fruit & veg, Bread & bakery, Chilled, Meat & fish, Pantry, Sweets & snacks, Drinks, Frozen, Household, 👶 Drugstore, Other. A renamed or self-made category shows exactly what the household typed, in both languages. Each category also has a fixed emoji on its items' rows (🥕 🥖 🥛 🥩 🥫 🍫 🧃 🧊 🧽 🧴 🛒); the divider text drops a leading emoji.
- `cat-open` Mehr → „Kategorien verwalten“ / "Manage categories" opens „Kategorien“ / "Categories" with the hint „In dieser Reihenfolge stehen die Kategorien unter „Ohne Laden“ und bei Läden ohne eigene Reihenfolge. Tippe auf eine Kategorie, um sie umzubenennen.“ (EN: "Items without a store, and stores without their own order, follow this order. Tap a category to rename it."). The „Ohne Laden“ divider's menu entry „Kategorien verwalten“ and a category divider's menu entry under „Ohne Laden“ open the same screen.
- `cat-add` button „Kategorie hinzufügen“ / "Add category" (bottom right) opens a dialog of the same title with a field „Name“ / "Name" and buttons „Abbrechen“ / „Speichern“ ("Cancel" / "Save"). The new category goes just before „Sonstiges“ in the route and in every store's order.
- `cat-duplicate` a name that already exists (add or rename) is refused with a snackbar „Eine Kategorie „<Name>“ gibt es schon.“ / "A category named “<name>” already exists." and the dialog closes.
- `cat-rename` a tap on a category opens „Kategorie umbenennen“ / "Rename category" with the name filled in; „Speichern“ saves. An empty name or an unchanged name does nothing. „Sonstiges“ can be renamed too.
- `cat-delete` the trash icon (tooltip „<Name> löschen“ / "Delete <name>") opens a dialog „<Name> löschen“ with a dropdown „Artikel verschieben nach“ / "Move items to" (default „Sonstiges“) and „Abbrechen“ / „Löschen“ ("Delete"). All its items, open and ticked, move to the chosen category; the move teaches the classifier nothing, and corrections learned for the deleted category go with it. „Sonstiges“ has no trash icon.
- `cat-reorder` the handle on each row („<Name> verschieben“ / "Move <name>") drags a category to a new place in the route. Dragging a category divider inside „Ohne Laden“ on the list, or the menu entries „Kategorie nach oben“ / „Kategorie nach unten“, does the same.
- `cat-live` additions, renames and order changes show on a partner's device without a reload.
- `cat-errors` a refused change shows „Die Änderung konnte nicht gespeichert werden.“ / "The change could not be saved."; a reorder without connection shows „Die Reihenfolge lässt sich nur mit Verbindung ändern.“ / "Reordering needs a connection."

## How to get to it (user POV)

- Tap „Mehr“ in the tab bar, then „Kategorien verwalten“.
- On the list, hold the „Ohne Laden“ divider (or right click it), then tap „Kategorien verwalten“.
- On the list, hold a category divider under „Ohne Laden“ (or right click) and tap „Kategorien verwalten“.
- Per-store category order is a different screen: a store divider's menu → „Reihenfolge bearbeiten“.

## Driving it with Playwright

Preconditions:

- Signed in on the list. For a deterministic route use a fresh account: `signUpWithHousehold(page, newEmail('categories'))` (default stores on, 11 seeded categories). A seeded „Familie Brandt“ may have renamed or extra categories: read the screen first.
- An item without a store to see route order (e2e adds Windeln with the add sheet's „Laden: …“ chip set to „Ohne Laden“, and Bier).

- **Open.** `openMore(page, 'Kategorien verwalten')`. Observable: title „Kategorien“; the 11 categories as buttons in route order; `page.getByRole('button', { name: 'Sonstiges löschen' })` count 0.
- **Add.** `page.getByRole('button', { name: 'Kategorie hinzufügen' }).click()`, `typeInto(page.getByRole('textbox', { name: 'Name' }), 'Baby')`, `page.getByRole('button', { name: 'Speichern' }).click()`. Observable: `page.getByRole('button', { name: 'Baby', exact: true })` visible, listed just above „Sonstiges“.
- **Duplicate.** Repeat the add with the same name. Observable: `page.getByText('Eine Kategorie „Baby“ gibt es schon.').first()` visible, dialog closed.
- **Rename.** `page.getByRole('button', { name: 'Baby', exact: true }).click()`, `typeInto(name field, 'Babysachen')`, „Speichern“. Observable: a button named „Babysachen“.
- **Reorder.** `dragHandle(page, 'Getränke verschieben', 'Obst & Gemüse verschieben')` (from `e2e/tests/catalog.ts`). Then `page.getByRole('button', { name: 'Zurück' }).click()`, `openTab(page, 'Liste')`: `groupHeadings(page)` shows the new route order for items without a store.
- **Move an item in.** `openEdit(page, 'Windeln')`, `pickInSheet(page, 'Kategorie', 'Baby')`, `saveEdit(page)`: the heading „Baby“ shows.
- **Delete.** `page.getByRole('button', { name: 'Babysachen löschen' }).click()`, `page.getByRole('button', { name: /Artikel verschieben nach/ }).click()`, `page.getByRole('menuitem', { name: '👶 Drogerie' }).click()`, `page.getByRole('button', { name: 'Löschen', exact: true }).click()`. Observable: the category button is gone; its items sit under „👶 Drogerie“ after `openTab(page, 'Liste')` and after `page.reload()`.
- **Spec.** `e2e/tests/stores.spec.ts` ("categories: add, move an item there, rename, reorder, delete with reassignment" and the live-sync test). Run `scripts/verify.sh --only e2e -- tests/stores.spec.ts`.

## Gotchas

- Rows are buttons whose name is the category name; „Baby“ with `exact: true` avoids hitting „Babysachen“ or the drag handle „Baby verschieben“.
- The new category dialog's title and the button share the text „Kategorie hinzufügen“; wait for the textbox „Name“.
- The delete dropdown opens as a menu: pick with `getByRole('menuitem', …)`.
- Category changes persist and change the divider order in „Ohne Laden“ and in every store; use a fresh account for order assertions.
- Seeded category names are stored in German. An English UI shows English names only for unrenamed seed categories; the Playwright harness runs de-DE.
- Adding a category while the household has stores also places it in every store's order (before „Sonstiges“, or last when „Sonstiges“ is not at the end).
- Deleting a category moves ticked items too (they are under „Zuletzt verwendet“), and puts the deleted category's identity on the target so the classifier keeps finding a home for the old words. unverified in the UI (SQL only).
- Free-form and overlong names: no length limit found in the UI. unverified.
