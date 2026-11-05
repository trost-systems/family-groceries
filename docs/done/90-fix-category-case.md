# Job 90: category names unique ignoring case and spacing

PR #220, merged 2026-11-05 (29d505fb).

Bug (Peter, 2026-11-03 20:07): a household could have both „baby“ and „Baby“ as categories.

## What was built

**Server** (`supabase/migrations/20261105070000_category_name_key.sql`)
- `public.category_name_key(name)`: trimmed, inner whitespace collapsed, lower case (the
  `store_name_key` rule).
- `public.merge_duplicate_categories()` merges the duplicates households already have. It runs in
  the migration before the index; only its owner (postgres) may call it, execute is revoked from
  anon, authenticated and service_role. Per household and name key the
  keeper is „Sonstiges“ if it is in the group, else the oldest (`created_at`, then `sort_order`,
  then id). Moved to the keeper: items, open and ticked, with learning off; their history
  (`item_events`); store layout rows (a store that had only the duplicate gives its place, and a
  store that had both shows the keeper if either was shown); learned corrections, added up; the
  duplicate's seed keys, into `absorbed_seed_keys` (only real keys, each once, never the keeper's
  own; review addendum 1 caught a NULL element there). Then the duplicate goes. A second run merges 0.
- A unique index on `(household_id, category_name_key(name))` covers every writer: the RPC, the
  app's direct rename update, the API and raw inserts.
- `create_category` returns the existing category for a name the household has in any case or
  spacing, and stores new names trimmed and collapsed.

**App**
- The add and rename dialogs under Liste › Anpassen check the name against the catalog
  (`showNameDialog`'s new `validate`). A taken name keeps the dialog open with „Eine Kategorie
  „Baby“ gibt es schon.“ under the field. It compares stored and shown names, so in English
  "other" is taken by „Sonstiges“, which shows as "Other".
- The store rename on the same screen gets the same in-dialog check. Its refusal used to be a
  snackbar hidden behind the dialog's barrier, and so did the category refusal.
- `storeNameKey` is renamed `nameKey` and shared by stores and categories. The cubit sends cleaned
  names and returns whether the server took them.
- The add sheet only picks categories. The classifier, Siri, dictation, Alexa, MCP and the API
  never create categories. Rules and reasons: docs/DECISIONS.md, "Job 90".

## Tests
- pgTAP `supabase/tests/category_names.test.sql` has 42 checks: the constraint, create and rename,
  two households, and the merge (keeper rule, items, history, layouts, memory, seed keys,
  idempotence, no grant, no NULL seed keys, tabs and newlines at the ends, the caller's learning
  setting restored). On main it fails 7 of the first 8 checks, then aborts.
  `classifier.test.sql` now expects create_category to return an existing name instead of raising
  23505.
- Widget tests in `store_details_screen_test.dart`: add „sonstiges “, a rename onto „obst &
  GEMÜSE“, a rename onto a store's name, the English seed label, own case change. All four
  refusal tests fail on main. Cubit test: names are cleaned and a server refusal is reported.
- e2e `stores.spec.ts` covers adding „ BABY“ next to „Baby“ and renaming to „getränke“.
- Drill fixtures proof: `scripts/backup/fixtures.sql` on main's schema, plus duplicates written
  through the old `create_category` in both households, then the migration. Same 12 items with the
  same category key, same summed corrections, no store missing a row, no duplicate left, second
  run 0. Script and output are in the ops job dir under `proof/`.
- Local: `flutter analyze` clean, `flutter test` 1651 passed; `scripts/verify.sh --only db`
  passed (all pgTAP, backup drill, fixtures); `--only e2e -- tests/stores.spec.ts` 3 passed;
  lint and gitleaks passed.

## Screenshots
docs/screenshots/90/10a-category-name-taken.png, docs/screenshots/90/10b-category-rename-taken.png

## Missing or blocked
Nothing. supabase-deploy ships the migration once the PR is merged.
