# Job 59: fuzzy suggestions while typing (2026-11-01)

Peter asked for suggestions while typing that come from what the household used before and from
pattern matching: a tap adds one, and the field clears for the next item.

## What was built

- **Server (PR #177, merged as 113e756).** `public.suggest_entries` matches history and catalog
  rows by `public.suggest_match`, in this order: same name, prefix, in-word (from 4 letters), then
  typo (from 3 letters: same first letter, one edit up to 5 letters, two from 6). Under 3
  characters it matches prefixes only. "Hafermlch" and "milch" find Hafermilch, "Jogurt" finds
  Joghurt. Within a source the better match comes first. History still ranks above the catalog,
  and the caps are unchanged. Migration `20261101155624_fuzzy_suggest.sql` puts pg_trgm in
  `extensions`; pg_trgm only orders in-word and typo matches.
- **App (Part B PR).** Offline rows match the same way (`suggestionMatch` in
  `app/lib/list/model.dart`). An empty field shows the due rows, then "Zuletzt verwendet" /
  "Recently used" rows: usuals used in the last 30 days that are not due and not on the list, 10
  rows in all. These come from `suggest_items`' `last_used`, cached on the device, so online and
  offline agree. The first row's Enter mark shows only while text is typed. Tap-to-add, clear and
  refocus are unchanged, and the tests now lock them in.
- Decisions: `docs/DECISIONS.md`, "Job 59" (edit distance rather than trigram scores, in-word
  from 4 letters, catalog typo fixes only for one-word names, the security-definer history read,
  no trigram index, recent rows from the usuals).

## How to verify

- `supabase test db` (`supabase/tests/fuzzy_suggest.test.sql`, `suggest_entries.test.sql`).
- `supabase/bench/suggest_latency.sh` (runs in the db gate; fails at a p95 of 50 ms or more), and
  `--show` to print the rows per input.
- `cd app && flutter test test/list` (model, cubit and add-sheet widget tests).
- `scripts/verify.sh --only e2e -- tests/suggestions.spec.ts`.
- In the app: `features/quick-add.md` `qa-fuzzy` and `qa-due` (verify-family-groceries), and
  `quick-add.md` and `usuals.md` (verify-hummlist).

## Numbers

`suggest_entries` on 5000 items over a year in one household, 20 inputs × 5 rounds, with RLS on:

| | p50 | p95 |
| --- | --- | --- |
| before (prefix only) | 7.6 ms | 21.1 ms |
| after, local | 16.8 ms | 28.7 ms |
| after, CI | 18.5 ms | 32.0 ms |

## Screenshots

`docs/screenshots/59/`: `qa-fuzzy-*.png` (server rows on the old design), `b-*.png` (Part B on
job 57's design: recent rows, a typo row, and the field after a tap).

## Open

Nothing is blocked. The device can't be taken offline on the linux surface, so the offline path is
proven by widget tests and the existing offline e2e test.
