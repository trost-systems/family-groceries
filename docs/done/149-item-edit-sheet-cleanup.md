# Job 149: item edit sheet cleanup (2026-11-06)

Peter (t612u) asked for a quieter item edit sheet.

## What changed

- **No header.** The title „Bearbeiten: <Artikel>“ and the top Abbrechen are gone. The hint
  „Gespeichert wird nur, was du änderst“ is gone too, and `editTitle` and `editHint` were removed
  from both ARB files. Files: `app/lib/list/edit_item_sheet.dart`, `app/l10n/`.
- **Abbrechen replaces Löschen.** It sits bottom left, keeps the key `edit-cancel`, discards every
  edit and closes the sheet without a snackbar. `showEditItemSheet` returns `ItemChanges?`.
- **No chip icons in the edit sheet.** `FoldoutChips(chipIcons: false)`. The add sheet keeps its
  icons, and so do the options.
- **Other delete paths.** The row's screen-reader action Löschen stays. On the web, ticking is the
  only way to take an item off the list.
- **Tests and docs.**
  - e2e: deletes that only set up a state now go through the API. Two scenarios that no longer
    exist on the web were removed.
  - The fg sync `delete` step is gone.
  - The feature map, FEATURES-FOR-WRITERS and `konto-loeschen.html` (single data) are updated.

## How to verify

- `cd app && flutter test test/list/edit_item_sheet_test.dart test/list/list_screen_test.dart`.
- `verify-hummlist` `launch.sh`, then right-click an item. The sheet has no title, no hint and no
  Löschen. Abbrechen leaves the database row unchanged.

## Results

- `flutter analyze` is clean, and `flutter test` passed 2026 (90 skipped).
- `scripts/lint.sh` is ok. e2e `tsc` is ok, and the fg-cli deno tests pass (60).
- Web build drive in DE light, DE dark and EN: PASS. The database row was identical after
  Abbrechen (`updated_at` included), and no Rückgängig showed.
- Screenshots are in `docs/screenshots/149/`. The full e2e suite ran on CI (ci-ok) and was not
  run locally, because the e2e lock had a queue.

## Open

- docs/NEEDS_PETER.md, „Job 149“: check the deletion page's new wording (Legal N-11), and decide
  whether sighted users need a single-item delete somewhere else.

## Review 0 fixes (2026-11-06)

- **Must fix 1.** `verify-hummlist/features/edit-item.md`: the `ed-delete` bullet now says it is
  gone since job 149 (tick off; the screen-reader „Löschen“ remains).
- **Must fix 2.** FEATURES-FOR-WRITERS „Ticking items“ and „Edit an item“ are stamped with this
  branch (252bfb5f), 2026-11-06. This rests on new web-build drives, logged in
  `~/groceries-ops/evidence/149/review0`: cancel in DE and EN with the row unchanged, and
  `journeys/tick-and-undo.mjs` PASS.
- **Nice to haves.**
  - `ed-cancel` notes that a store made with „+ Neuer Laden“ stays.
  - `ed-open` says „the only delete in the UI“.
  - The weak reopen half of the widget test is gone; `result == null` is the proof.
  - DECISIONS and the PR body now say plainly that the category options never had icons.
    Emojis there would be a new call for Peter.
- `flutter test test/list/edit_item_sheet_test.dart`: 21 passed.
