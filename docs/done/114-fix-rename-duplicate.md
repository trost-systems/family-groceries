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
