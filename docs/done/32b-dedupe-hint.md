# Job 32b: duplicate hint with one-tap merge (Spec #8 Part B)

PR: https://github.com/trost-systems/family-groceries/pull/118

Adding "Karotten" while "Möhren" is open still adds it, and the list then says "Möhren steht
schon auf der Liste" with "Zusammenführen". Ignoring keeps both items. Merging keeps Möhren with
its text and the quantities merged on the server in one transaction (500 g + 1 kg = 1,5 kg;
1 Bund + 500 g = "1 Bund + 500 g"), and "Rückgängig" brings both items back exactly, also for
the partner who synced the merge. MCP, Siri/voice and Alexa add normally and report the similar item.
Nothing is merged silently, typed text is never rewritten. Decisions: [DECISIONS.md](../DECISIONS.md),
"Job 32b".

## Where

- `supabase/migrations/20261030160000_dedupe_merge.sql`: `merge_quantities(open, other)` (the
  PM's merge rule, with `quantity_unit`, `quantity_number`, `quantity_format`),
  `details_differ`, **`similar_items(p_item)`** (the non-UI paths' note), table **`item_merges`**
  (both rows as they were; RLS select for members, no client writes), **`merge_items(p_merge,
  p_keep, p_other)`** and **`unmerge_items(p_merge)`**, both returning `{kept, merged}` and
  idempotent by the client's merge id.
- `supabase/tests/merge_quantities.tsv`: the one table of quantity cases for the server and the
  app.
- App: `app/lib/list/quantity.dart` (the rule mirrored for the optimistic view),
  `Item.canonicalKey`, ops `MergeItems`/`UnmergeItems` and `ItemOp.applyTo`, `similarItems`/
  `detailsDiffer` (`model.dart`); `ListCubit.hints`, `merge`, `unmerge`, `hintShown`,
  `hintIgnored`, rejection `MergeRefused`; `ListRepository.send` answers the rows an op touched
  by id; the hint and the merge as a line in the add sheet's note while it is open
  (`AddSheetCubit.offer`, `mergeHint`, `undoMerge`, `handOver`) and as snackbars otherwise
  (`list_screen.dart`; keys `dedupe-hint`, `dedupe-merge`, `dedupe-merged`, `dedupe-undo` in
  both); ARB `dedupeMerge`, `dedupeMerged`, `mergeRefused` (DE and EN).
- MCP `add_items` returns `similarOnList: [{added, onList}]` (`mcp/list.ts`, tool description in
  `mcp/tools.ts`); voice items carry `similarOnList: [names]` and Siri says "Möhren steht schon
  auf der Liste." (`voice/items.ts`, `voice/handler.ts` `similarNote`); Alexa says "Möhren steht
  schon auf der Hummlist." (`alexa/speech.ts`).
- Analytics: `dedupe_hint_shown`, then `dedupe_hint_merged` or `dedupe_hint_ignored`, with
  `actor_role` and `household_size` only (`docs/ANALYTICS.md`).
- Docs: `docs/MCP.md`, `docs/SIRI_SHORTCUT.md`, recipe `qa-dedupe-hint` in
  `.cursor/skills/verify-family-groceries/features/quick-add.md`.

## Tests

- pgTAP `supabase/tests/dedupe_merge.test.sql` (48): similar items (details, ticked, other
  household), merge rule cases, merge in one transaction and its retry, undo restores both rows
  exactly (id, text, quantity, category, store, place, author, time, `categorized_via`, canonical
  key), undo by the other member, edit-after-merge and deleted-kept cases, refusals (same item,
  gone, ticked, too long), RLS (no merge, undo, replay or read across households). Plus two cases
  in `rls.test.sql`.
- `supabase/functions/_shared/dedupe_integration_test.ts` (db gate): MCP and voice add Karotten
  with Möhren open, report Möhren and keep both; `merge_quantities` gives every row of the TSV.
- Deno unit tests: `voice/handler_test.ts` (the Siri sentence, several similar items),
  `alexa/handler_test.ts` (Alexa's sentence); `alexa/store_integration_test.ts` (db gate: Alexa
  adds Karotten with Möhren open and keeps both).
- Flutter: `test/list/quantity_test.dart` (the TSV, 49 rows), `dedupe_hint_test.dart` (hint in
  the sheet and as a snackbar, hand-over on close, ignore, merge and undo in both places, with
  animations off too, note rule, never rewritten, stale hints dropped, refused merge), `list_cubit_test.dart`
  (hint only after the ack and only for own adds, offline merge + undo, lost answer retried as
  the same merge, ticked item, too long, restart), `model_test.dart` (ops JSON, folding,
  similar matching), `analytics/list_events_test.dart` (events, no names).
- e2e `e2e/tests/dedupe.spec.ts`: ignore -> two items; merge -> one (also for the partner);
  undo -> two with Karotten exactly as before; a bunch merges as a note.

## Results

- Local (Mac, Postgres 17 without Docker, all migrations): pgTAP suite green (dedupe_merge 48/48,
  rls 59/59, account_deletion 43/43, the rest unchanged); db-gate integration tests 10/10;
  `flutter test` 900/900; `flutter analyze` and `scripts/lint.sh` clean; deno tests green.
- Landed on main as `0b47f91`, the rebase-merge of PR head `e3af581` (identical tree), with
  `ci-ok` green on that head (run 41069795841, every job). GitHub answered the merge call with a
  502 after the commit was on main, so PR #118 shows Closed, not Merged; the PR carries a note.
  Main's CI after the merge: green on d76ce11, a506b70 and 258d8c0; 559f9d1 failed once on the
  known add-sheet-open flake in `classifier.spec.ts` (issue #109), not on anything similar.
- CI rounds before landing: the backup drill wanted a fixture row for `item_merges`; account
  deletion's table list needed it; `supabase db lint` flagged `merge_quantities`; on the web
  the merged snackbar was closed by the hint's own hide. All fixed in the landed commit.
- Review 0 (FIX) asked to rebase and land: the work was already on main (above); main's copies of
  the reviewed files are byte-identical to `e3af581`, DECISIONS and DONE_SUMMARY hold main's and
  32b's sections without conflict, and `20261030160000_dedupe_merge.sql` is the newest
  migration. The PR body now names the landing and lists ACs 9-11 with their screenshots.
- Screenshots: `docs/screenshots/32b/` (hint in the sheet, as a snackbar, ignored, merged, the
  partner's view, undo, the note rule).

## Missing or blocked

Nothing.
