# Job 109: delete_category NULL seed keys, store_name_key normalization order

PR #239. Not merged: the lead reviews and merges. Job 90's (PR #220, merged) two out-of-scope
follow-ups. Reasons: `docs/DECISIONS.md`, "Job 109".

## What was built (one commit per fix)

1. **`delete_category` never appends `{NULL}`** (`20261105074758_delete_category_seed_keys.sql`).
   It hands the target only non-NULL seed keys, each once, sorted, never the target's own seed
   key: the rule #220's `merge_duplicate_categories` uses. The migration strips the NULLs the old
   function left and adds the validated check `categories_absorbed_seed_keys_not_null`, so no
   writer can add one again. Grants are unchanged (create or replace). Main defines the function
   only in `20261022233800`, SECURITY INVOKER with `search_path = ''`; the new text keeps both
   and differs only in the `absorbed_seed_keys` update. pgTAP pins the security mode.
2. **`store_name_key` and `store_name` collapse whitespace first, then trim, then fold case**
   (`20261105074900_store_name_key_order.sql`), like #220's `category_name_key`. The old order
   trimmed spaces only, so `"\tLidl\n"` got the key `" lidl "` and passed the unique index next
   to „Lidl“, and `add_store("\tRewe\n")` stored „ Rewe “. Before the function changes, stores
   that share a key under the new rule are renamed with the first free „ (n)“ (Job 58's rule;
   every one but the first by sort order). No item, layout or memory moves or goes. Then the
   function is replaced, `stores_household_name_key` is rebuilt, and stored names with
   whitespace at their ends or in runs are cleaned. A whitespace-only name, which only a direct
   write can store, keeps its raw name (DECISIONS "Job 109" item 2).
3. **Dart.** `nameKey` trims, then collapses, but Dart's `trim()` removes all whitespace, so it
   was already equivalent. No app change; a test pins it to the same table as the pgTAP test.

Callers checked: `add_store` (on conflict on the index), `rename_store`, `create_household`
(through add_store) and the index are the only users of `store_name_key`/`store_name` in
migrations; the app uses `nameKey` in `model.dart`, `foldout_chips.dart`,
`create_household_screen.dart` and the test fake. The only edge function code that normalizes
store names is `resolve` in `_shared/list.ts`. It only looks names up, and its `trim()` gives the
same result.

## Tests

- `supabase/tests/delete_category_seed_keys.test.sql` (10). Against main's function 7 of the
  first 9 fail: have `{NULL}`, `{NULL,NULL,drugstore}`,
  `{NULL,NULL,drugstore,NULL,drugstore,other}`, `{sweets,drinks}`, no check (ops dir,
  `proof/fix1-old-function.txt`). The 10th pins SECURITY INVOKER and the empty search_path,
  which main's function has too.
- `supabase/tests/store_name_key_order.test.sql` (18): tab, newline, CRLF, double-space and case
  variants of the key, `store_name`, add_store, rename_store, a direct insert, no shared key, and
  `store_name_key` against #220's `category_name_key` on the same table. Against main's
  functions 9 fail (`" lidl "`, `" Lidl Express "`, `" Rewe "`, `" Aldi Süd "`, the insert is let
  in, and the old key disagrees with `category_name_key` on 3 of 7 cases; review 1's mutation
  check, `proof/fix2-old-function.txt` for the run before #220).
- `app/test/list/name_key_test.dart` (7): the same table against `nameKey`.
- Migration proofs on the local stack, data written through main's functions first:
  `{NULL,NULL,drugstore}` became `{drugstore}`, and „Duschgel“ still classifies into Sonstiges;
  stores `" Rewe "`, `"\tLidl\n"` (item Milch), „Lidl (2)“, `"edeka\t"` (item Brot) became
  „Rewe“, „Lidl (3)“ with Milch, „Lidl (2)“, „edeka (2)“ with Brot; 2 items before and after.
- Review round (independent reviewer): a legacy name of 55+ characters cut at 54 could end in a
  space, so the rename probe missed an existing „… (2)“ and the migration aborted on the index
  (transactional, no data lost). Fixed by trimming the cut base. Replayed with main's key restored
  in a rolled-back transaction: the first version fails with `duplicate key ... (aaa…a (2))`, the
  fixed one renames to „aaa…a (3)“ (`proof/fix2-long-name-old.txt`, `-fixed.txt`).
- `scripts/verify.sh --only db,lint`: passed (39 pgTAP files, 1813 checks, deno integration
  tests, db lint, backup drill, fixtures; lint incl. squawk and the schema check).
- `flutter analyze`: no issues. `flutter test`: 1826 passed, 90 skipped.

## Missing or blocked

- Whether production has stores that clash under the new key, or categories with NULL keys, was
  not checked (no hosted access in this job). The migration handles both; a renamed store shows
  as „Name (n)“ and keeps its items.
- The server key does not trim U+FEFF (byte-order mark), Dart's `trim()` does. Not a regression;
  left as is.
- The hosted database's locale was not checked; see DECISIONS "Job 109" item 4.
- Rebased onto main with #220 (its migration is now `20261105070000_category_name_key.sql`);
  ours sort after it. Main never redefined `delete_category` after its first migration
  (`20261022233800`), so the `create or replace` undoes nothing.

NEEDS_COPY_REVIEW: none. Changelog: none (reason in DECISIONS "Job 109" item 6).
