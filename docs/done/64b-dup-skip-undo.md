# Job 64b: an add that is already on the list never vanishes (2026-11-02)

Follow-up to job 64 (#186). Branch `job/64b-dup-skip-undo`. Decisions: `docs/DECISIONS.md`,
"Job 64b".

## What was broken

Job 64's trigger `items_skip_duplicate` skips an open insert when the same item is already open.
The app's add was an upsert. When the trigger skipped it, the upsert got no row back, the app
looked up its own id, found nothing and dropped its copy.

- **Undo after a delete.** If another member put the item back in the meantime, the item
  disappeared after „Rückgängig“ until the next reload or realtime event.
- **Offline replay.** An add made offline, replayed after someone else added the same item, did
  the same. A tick or edit queued for it offline was lost.
- **Large text.** At the largest text scales the third „Wieder fällig“ row could not be reached.
  The list, the edit sheet and the Mehr tab also overflowed, and a store badge crashed with NaN.

## What changed

1. **The server answers with the row the add is.** Migration `20261102123856_put_item.sql`.
   - The trigger notes the open item it matched in the transaction setting
     `family_groceries.open_duplicate`.
   - `put_item` is the app's add from now on. It answers with the add's own row (a retry), or else
     with that noted open item.
   - `add_item` (MCP, Siri, Alexa) reads the same note instead of running its own fallback query.
   - The lock and `parse_item` are unchanged.
   - Old builds keep their upsert.
2. **The app folds its copy into that item.**
   - `ListRepository.send` answers `{own id: null, kept id: row}`.
   - The cubit shows the kept row at once.
   - Queued ops for the copy go to the kept item (`ItemOp.ontoKept`). A tick, edit, move or
     placement follows it. A delete of the copy is dropped.
   - The existing row is kept as it is. Quantities are not merged (DECISIONS explains why).
3. **"No store" is part of the add** (`AddItem.noStore`, `p_no_store`). Before, it was a second op,
   which would have cleared the kept item's store. A restored item without a store keeps having
   none.
4. **Large text.**
   - In the add sheet, a label's button takes at most half its row.
   - The "everything scrolls" threshold and the three-row cap scale with the text.
   - The explainer, store headers, dividers, Mehr headings and the edit sheet wrap or stack instead
     of overflowing.
   - A hexagon narrower than its tips is drawn as a rhombus.
5. **Docs.** The job 64 wording in DECISIONS and in `docs/done/64-polish-seed.md` was corrected; it
   said the app "acknowledges with the row that is there". The feature map was updated:
   - verify-hummlist `edit-item` (`ed-delete`) and `offline` (`offline-already-there`), and
     FEATURES-FOR-WRITERS (Edit an item, Working offline).
   - verify-family-groceries `edit-item` and `live-sync`.

## How to verify

- **pgTAP.** `supabase test db supabase/tests/put_item.test.sql` (17 checks).
- **Two connections.** `supabase/functions/_shared/one_open_item_integration_test.ts` (in the db
  gate):
  - an offline add replayed while the partner adds the same item;
  - an undo while the partner's copy is open.
- **Flutter.**
  - `app/test/list/list_cubit_test.dart`, group "an add that is already on the list (job 64b)":
    undo onto a partner's item; an offline add, edit, tick and delete replayed onto partner items;
    a lost answer keeps its own item.
  - `list_repository_test.dart`: the `put_item` answer mapping.
  - `add_sheet_test.dart`: the third due row at text scale 2.0 and 3.0, on 360×640 and 320×568.
  - `large_text_test.dart`, `more_large_text_test.dart` and `hex_border_test.dart`.
- **e2e.** `e2e/tests/already-on-list.spec.ts`:
  - Realtime item changes are muted, so only the add's answer can bring the item back.
  - Both tests failed on main's web build: an empty list after Rückgängig, and the offline tick
    never reached the server. They pass on this branch.

Screenshots: `docs/screenshots/64b/before-undo-vanished.png` (main) and
`after-undo-shows-open-item.png` (this branch).

## Open

Nothing known. The large-text tests cover the list, the add sheet, the edit sheet and the Mehr
tab. They do not cover the screens behind the Mehr rows or text scales between 1.5 and 2.0.
