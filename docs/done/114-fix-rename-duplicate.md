# Job 114: renaming an item onto an already-open item merges instead of duplicating

**What.** vmaint-20261105 #12 was found on c5a580a8, before job 104 (#236). On main, the online
case was already fixed: `ListCubit.edit` folds the rename, and the server refuses a duplicate
(`items_rename_duplicate`). What was still open: when the server refused a rename because another
member's copy got there first, the app put the old name back and said „… steht schon auf der
Liste“. That happens with a rename made offline, or with two phones renaming at once. Now the app
fetches the list and folds the item into that copy. It uses the same merge, the same
„Zusammengeführt“ snackbar and the same Rückgängig as the online rename. Ops queued after the
rename go to the copy, by the rule an offline add already follows. No migration, no new strings.

**Where.**
- `app/lib/list/list_cubit.dart`: `_foldRefusedRename` (the flush waits for a resync, then folds),
  `_openCopy`, `_renameOnto`. `resync()` now returns whether it fetched. Only the quantity goes
  ahead of the merge, because a brand sent on its own was the refused rename again.
- `app/test/list/list_cubit_test.dart` has 7 cases in the job-104 group: server copy first,
  offline with the quantity in the same edit, two phones with Rückgängig, offline then a tick
  (the tick goes to the copy), offline then a delete, the copy ticked before the resync (the
  rename lands), and too long. `fake_repository.dart` gains `itemsGate`.
- `app/test/fuzz/`: the fake server gets `items_rename_duplicate` and the delete-first order of
  `merge_items`. The oracle fails on two open rows with one key, and a device fails on any
  `RenameTaken`.
- `e2e/tests/rename-onto-open.spec.ts`: the vmaint scenario online, offline then the other phone
  adds, and two phones renaming.
- Docs: `docs/DECISIONS.md` (Job 114), `docs/NEEDS_LEAD.md` (Job 114: the untick question),
  `edit-item.md` and FEATURES-FOR-WRITERS.

**Verify.**
- `cd app && flutter test test/list test/fuzz`.
- `FUZZ_SEEDS=1-1000 flutter test test/fuzz/sync_fuzz_test.dart --plain-name FUZZ_SEEDS`.
- `scripts/verify.sh --only e2e -- tests/rename-onto-open.spec.ts`.

**Results.**
- Unit: the new cases failed on main (3 of 4 written first) and pass with the fix. The full
  `flutter test` passes (1825).
- Fuzz, seeds 1 to 100 on main's cubit with the enforcing fake server: 7 seeds kept a rename apart
  from its copy. With the fix: 0 of 1000.
- e2e on main's cubit: offline and two phones fail, with Apfelsaft 2 and Mineralwasser 6 left on
  the server. With the fix: 3 of 3 pass. Screenshots are in `docs/screenshots/114/`.
- Local gates: lint and flutter pass.

**Open.** NEEDS_LEAD: an untick (a re-add from „Zuletzt verwendet“) made offline while another
phone adds the same item still gives two open rows. Job 104 lets unticking through on purpose, and
this job leaves it alone. The fuzz counts it in strict mode.

## Review 0 fixes

- **Must fix: the livelock is bounded.** A refused rename that the list can't match to a copy
  after the resync is sent once more at most. The second refusal is final: „… steht schon auf der
  Liste“, and the old name stays, as on main. Cause: Postgres `lower()` folds about 410 letters
  that Dart leaves alone (U+13A0 Ꭰ). The reviewer's probe is now a cubit test, with a tick queued
  behind the rename. On the fix it gives 2 refusals, then `RenameTaken`, and the queue drains. On
  the previous head (fcdd8dca) the job-104 group hangs until killed at 300 s.
- **A later rename wins** (nice 2): offline Apfelsaft → Mineralwasser → Orangensaft while the
  partner adds Mineralwasser ends with the partner's Mineralwasser 6 untouched and Orangensaft 3.
  Before, the partner's item was renamed.
- **A fold whose merge is refused sends the rename alone** (nice 3), once. A test ticks the copy
  just before `merge_items`.
- **NEEDS_LEAD** now names the API's `POST /v1/items/{id}/untick` (nice 1). The screenshots are
  three distinct states (nice 4). The PR says the repository side (23505 → `nameTaken`) is
  job 104's and unchanged (nice 5).
- Verified: full `flutter test` 1828 passed, fuzz seeds 1 to 1000 with 0 failures, e2e 3/3 locally.

## Review 1 fixes

- **Must fix: rename then delete, offline.** A refused rename with a delete of the same item queued
  behind it no longer folds. The rename is dropped and the delete removes the original row. The
  partner's Mineralwasser stays at 6, no merge is sent, and no „Zusammengeführt“ shows. The unit
  test now checks the quantity, that no `MergeItems` was sent and that no merge was announced; it
  fails on the previous head (67b34b3e). The new e2e case
  (`renamed and deleted offline while the other phone adds Mineralwasser`) proves it on the real
  server.
- **The snackbar waits for the merge** (nice 2). A fold made after a refusal announces
  „Zusammengeführt“ on the merge's acknowledgement. A merge refused in between shows nothing.
  Job 104's online fold still announces at once.
- **The fuzz oracle is narrower again** (nice 1). Only renames the server refused with 23505 let
  later ops on that item move to the copy. Other refused edits get no excuse.
- **Clearer test name** (nice 3): the sequential "two phones" test is now named for what it does.
- Verified: full `flutter test` 1828 passed, fuzz seeds 1 to 1000 with 0 failures, e2e 4/4 locally.

## Lead review fixes (review 3)

- **Must fix: brand and details are kept when a later rename wins.** Offline, Apfelsaft →
  Mineralwasser with Gerolsteiner and still, then → Orangensaft, while the partner adds
  Mineralwasser Gerolsteiner. The server now ends as the list showed offline: Orangensaft 3
  Gerolsteiner still. The refused rename's brand and details ride with the later rename, unless it
  sets its own. Quantity, category and store go ahead of it. They are not resent with the old name,
  which could hit another open twin. The test has one ("Apfelsaft Gerolsteiner still" is open
  too). The extended unit test fails on the previous head (63984387).
- **No flicker.** A refused rename stays queued and shown until the resync answers. If the resync
  fails, it stays queued and is sent again once back online (new test).
- **DECISIONS 5 and 8**: brand and details go through. They also cover the snackbar quantity next
  to a later quantity edit, and what a restart between the fold and the merge's acknowledgement
  loses (only the snackbar, or the rename-alone resend).
- Rebased onto main (DECISIONS conflict with Job 118, both kept). Full `flutter test`: 1841 passed.

## Review 4 fixes

- **Rebased onto main** (8 commits, including #247 job 111). DECISIONS and NEEDS_LEAD conflicts:
  kept both sides. `fake_repository.dart` hands `beforeSend` the op as sent (`sentOp`), since
  #247 declares the parsed op later.
- **Offline-typed renames fold too.** A rename of an add typed offline (`EditItem.deviceParsed`)
  that the server refuses is compared as the server parsed it (`parse(...).ontoRename`). So
  „Windeln Pampers Größe 3“ renamed to „… Größe 4“ while Windeln / Pampers / Größe 4 is open
  folds into it (one row, quantity 2) instead of ending in „… steht schon auf der Liste“. Job 111's
  test now expects the fold. A later rename keeps its `deviceParsed`, and its parsed brand and
  details win. `edit`'s local fold keeps the flag on the rename it may send alone. Two tests, both
  failing on b333c8a5. A guard test fails when the brand is carried onto a parsed later rename.
- **Fuzz oracle narrower** (nice 1). After a refused rename, an op may leave the queue unanswered
  in two cases only. Either a new edit of the same item replaced it, or the item was really merged
  into a copy on the server (checked at the end against the fake's merge records). Before, every op
  of that item was exempt. It still compares no item's final row with its offline view, so a
  dropped column inside a replaced edit stays the unit tests' job.
- Docs: DECISIONS item 1 reworded (the rename stays queued), item 9 new (parsed names). The
  `edit-item.md` feature notes keeping brand and details and parsing offline lines.
- Verified: full `flutter test` 1863 passed, fuzz 1000 seeds 0 failures. Local e2e skipped again:
  the box-wide e2e lock had 8 holders and waiters. CI runs the spec.
