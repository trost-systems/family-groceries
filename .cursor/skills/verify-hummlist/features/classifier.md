# Automatic category (the classifier)

Every new item gets a category without the user choosing one: the server looks at the name the moment the item is saved and files it under a category divider. It uses what the household taught it, then a built-in German word list of about 1,250 terms (compound words, plurals, umlauts, quantities in front of the name), then synonyms and typos, and finally „Sonstiges“. The same server logic runs for every way of adding: typing in the app, voice dictation, the MCP assistant connection, Siri (voice endpoint) and Alexa. A user can override the guess; the household remembers the correction.

## Sub-features

- `cl-auto` an item without a category lands under the matching divider, e.g. Hafermilch → „Kühlregal“, Apfelsaft → „Getränke“, Zahnbürste → „👶 Drogerie“, Vollkornbrot → „Brot & Backwaren“, Spülmaschinentabs → „Haushalt“, Fischstäbchen → „Tiefkühl“, Gummibärchen → „Süßes & Snacks“, Kichererbsen → „Vorrat & Konserven“, Rinderhack → „Fleisch/Wurst/Fisch“, „Aepfel 2 kg“ → „Obst & Gemüse“ (name „Aepfel“, quantity „2 kg“). The word list is German; English words work only where they are synonyms ("toilet paper" → „Haushalt“).
- `cl-fallback` an unknown word lands under „Sonstiges“ / "Other" (the household's fallback category), shown last.
- `cl-sorting` while the server has not answered yet, the new item shows at the top of its section under a divider „Wird einsortiert …“ / "Sorting …", then moves under its category.
- `cl-learn-edit` the user moves an item to another category in the edit sheet (chip „Kategorie: …“, pick, „Fertig“) or by dragging it onto a category divider or a row of another category. The household learns it: the next add of that item (and its plural, e.g. „Zahnbürste“ → „Zahnbürsten“) lands there.
- `cl-learn-pick` a category chosen on the add sheet's category chip (default label „Kategorie: automatisch“ / "Category: automatic") is learned when it differs from the guess; „Rückgängig“ on that add removes the item and the lesson again.
- `cl-variants` spelling variants, regional and English synonyms and typos land with the word they mean, the name stays as typed: „Karrotten“ → „Obst & Gemüse“ (Möhren), „Paradeiser“ → „Obst & Gemüse“, „Semmeln“ → „Brot & Backwaren“, „Mlich“ → „Kühlregal“, „Schokolde“ → „Süßes & Snacks“, "toilet paper" → „Haushalt“.
- `cl-variant-learn` a correction for one spelling holds for the word's synonyms and spellings in that household only: „Karrotten“ moved to „Getränke“, then „Möhren“ lands in „Getränke“.
- `cl-household-only` learning is per household; another household with the same word still gets the default category.
- `cl-delete-category` deleting a category moves its items and forgets what was learned for it; the move itself teaches nothing.
- `cl-same-everywhere` the app, the MCP assistant connection, Siri and Alexa all add through the same server logic (categories and learned corrections apply the same).
- `cl-store` a new item also lands in the store the household remembers for that name; there is no store guess from the category on the server (the add sheet guesses dm for drugstore items).

## How to get to it (user POV)

- Type an item in the add bar at the bottom of the list and add it: it appears under its category divider (in its store's section if the household remembers one, otherwise under „Ohne Laden“).
- To correct: hold the item (or right click, or swipe left) to open „Bearbeiten“, tap the chip „Kategorie: …“, pick a category, tap „Fertig“. Or hold the item and drag it onto another category divider.
- To choose before adding: tap the category chip in the add sheet.

## Driving it with Playwright

Preconditions:

- A fresh account in its own household: `signUpWithHousehold(page, newEmail('learn'))` (default stores on). Learning is per household and persistent, so do not reuse a household for first-guess checks.
- Seeded categories untouched (a renamed category changes the divider text).

- **Auto-categorize.** `addItem(page, 'Hafermilch')`, then `expectGroup(page, 'Hafermilch', 'Kühlregal')` (nearest level-2 heading above the row, `e2e/tests/catalog.ts`). Observable: also `groupHeadings(page)`. A word not in the list (`Quietscheentchen`) → heading „Sonstiges“.
- **Correct by drag.** `dragItemTo(page, 'Hafermilch', 'Getränke')` (needs the target divider on screen, so add `Apfelsaft` first). Observable: `expectGroup(page, 'Hafermilch', 'Getränke')`.
- **Correct in the sheet.** `openEdit(page, 'Zahnbürste')`, `pickInSheet(page, 'Kategorie', 'Haushalt')`, `saveEdit(page)`; heading becomes „Haushalt“.
- **Learn.** `tick(page, 'Zahnbürste')` then `addItem(page, 'Zahnbürsten')` → `expectGroup(page, 'Zahnbürsten', 'Haushalt')`. Or delete the first item (`deleteItem`) and add `2 Hafermilch` → „Getränke“.
- **Variants.** `addItem` for `Karrotten`, `Paradeiser`, `Semmeln`, `Mlich`, `Schokolde`, `toilet paper`; headings as in `cl-variants`; the row names stay as typed. Second view: `api.from('items').select('name, categorized_via')` returns exact / synonym / exact / fuzzy / fuzzy / synonym for those names.
- **Variant learn.** Move `Karrotten` to „Getränke“ in the sheet, then `addItem(page, 'Möhren')` → „Getränke“. A second account adding `Möhren` gets „Obst & Gemüse“.
- **API view.** `apiAs(email)` then `rpc('add_items', { p_household, p_names: ['Hafermilch', '1 Packung Kaffee'] })` returns name and quantity split (`Kaffee`, `1 Packung`).
- **Spec.** `e2e/tests/classifier.spec.ts` (three tests: learning, dictionary spot checks, spelling variants). Run `scripts/verify.sh --only e2e -- tests/classifier.spec.ts`.

## Gotchas

- The divider shows its category without a leading emoji, but the heading's accessible name keeps the full name ("👶 Drogerie"); Playwright `getByRole('heading', { level: 2 })` reads the full name, as the specs assert.
- Categorization happens when the server saves the item. The row first appears under „Wird einsortiert …“; wait for the heading before asserting a category.
- Typo matching is deliberately shy: never under 5 letters, same first letter; only neighbouring-letter swaps for 5-letter words, one edit for longer words, two edits from 8 letters up; and only when nearby words agree on a category. „Mehk“ or „Kaffe“ stay in „Sonstiges“ on purpose.
- Matching folds case, umlauts and one plural ending. Names with numbers fold the numbers away: a learned „Xylophon“ also catches „Xylophon-123“. Use distinct words in tests.
- Household learning beats the word list. A test that moves an item changes later adds in the same household; use a new household per test.
- Dictionary-matched compounds prefer the head word: „Ziegenmilch“ → „Kühlregal“, „Milchschokolade“ → „Süßes & Snacks“.
- Shown category names follow the app language only for seeded, unrenamed categories; the harness runs German.
- The classifier does not read a brand's category; brands only guess a store (dm items) in the add sheet. unverified for non-dm brands.
- The offline behaviour while sorting (add with no network): the item shows under „Wird einsortiert …“ until the op syncs. unverified (inferred from the pending-op design; no spec).
