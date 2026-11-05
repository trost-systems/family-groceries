# Job 104: gap fixes from the daily verification (2026-11-05)

PR: https://github.com/trost-systems/family-groceries/pull/236, titled "fix: rename dedupe,
offline number words, last-member Premium warning". It was merged 2026-11-05
(0bf5d45b). `job/104-gap-fixes-ordered` keeps one commit per fix. `push-pr.sh`
squashed them into the one commit `main` takes.

## What was built

1. **A rename onto an open item merges into it** (vmaint-20261105 #12).
   - Renaming Apfelsaft to „Mineralwasser“ while Mineralwasser is open now folds Apfelsaft into
     it. This works in any case, spacing or umlaut spelling. A synonym only gets add's duplicate
     hint (review 1, Addendum 3).
   - Quantities add up. „Zusammengeführt: …“ shows with Rückgängig. If the merge can't be done,
     „… steht schon auf der Liste“ shows.
   - App: `ListCubit.edit`, `_mergeRename`, `_fold`, the `EditItem` acknowledgement, and
     `EditItem.keyBefore`.
   - Server: the trigger `items_rename_duplicate` returns 23505 for every writer. `merge_items`
     now deletes the merged row first (migration `20261105060950`).
2. **Offline adds read number words like online adds** (vmaint-20261102 #11, vmaint-20261105 #11).
   - One table, `supabase/tests/number_words.tsv`, holds German and English count words, names
     that start with one („Drei Glocken“), and the units.
   - The server reads it through `item_number_words()`, `item_number_names()` and
     `parse_item` (migration `20261105061045`). The app reads it through `number_words.dart` and
     `parseEntry`.
   - A Dart test and a db-gate test catch drift between the two sides. `quantity_parse.tsv` is
     the offline/online parity table.
   - Online behaviour changes too: typed „Gurken zwei“ and „two apples“ now have a quantity.
3. **The last member is warned about Premium in every build** (vmaint-20261102 (a),
   vmaint-20261103 #1).
   - `delete_account_dialog.dart` shows the card whenever `leaves_unlocked()` is true. That
     covers gifted, Lifetime and yearly.
   - The flags and their defaults are unchanged. They now gate only the archive texts.
   - One new string, `accountDeletePremiumLastMember`: the existing text without its archive
     sentence (NEEDS_COPY_REVIEW in the PR).

## How to verify

- `scripts/verify.sh --only lint,functions,flutter,db,fg-cli`.
- Live, after `.cursor/skills/verify-hummlist/helpers/launch.sh`:
  - `drive.sh edit-item`, also with `--to MINERALWASSER`, and with `--to Semmeln --onto
    Brötchen`.
  - `drive.sh offline`.
  - `drive.sh account-deletion --dialog premium|none`. This needs `--scenario solo-long-list` and
    a grant (features/account-deletion.md).

## Test results (hz, 2026-11-05)

- `verify.sh` passed for lint, functions, flutter, db and fg-cli.
  - flutter: `+1797 ~88: All tests passed!` and `flutter analyze` clean.
  - db: pgTAP `Tests=1741 PASS`, plus the integration tests (34, 2 and 59 passed).
- e2e (local): the dedupe, edit-sheet, household-bound, already-on-list and account specs, 21
  passed.
- Live journeys PASS: rename (exact, case, synonym), offline parity (8 lines over two runs), and
  the Premium dialog (gifted, Lifetime and yearly show the card; none and a shared household
  don't).
- Fail first:
  - The rename and the gifted case were reproduced live before the fixes.
  - pgTAP failed 4/12 before the trigger.
  - The widget tests failed 5 before the dialog change.
  - `entry_test` failed 16 rows before the parser change.
  - The review's echo case failed on the old cubit.
- CI: see the PR's `ci-ok`.

## Screenshots

`docs/screenshots/104/`, before and after for each fix, embedded in the PR.

## Review 0 (2026-11-05): fixed

- **Must fix, an offline add edited before it synced was merged into a synonym.** Reproduced
  with the reviewer's probe: go offline, add „Semmeln“, set the brand Kamps, go online. Brötchen
  became ×5 (Kamps) and Semmeln was gone, without a word.
  - Now only a changed name merges on the server's confirmation.
  - When the key before the rename is unknown (the add was still queued), the app offers the
    duplicate hint, as an add does.
  - Rerun live after the fix: Brötchen ×4 and „Semmeln“ (Kamps) both stay open.
  - New cubit tests cover a queued add followed by a brand edit (no merge) and followed by a
    rename (hint, no merge). Both fail on the reviewed code.
- **Nice to have, done.**
  - (Removed in review 1 with the synonym merge.) Rückgängig on a synonym merge also renamed the item back. Live:
    Apfelsaft → „Semmeln“ merged into Brötchen ×5, then Rückgängig brought Apfelsaft back with
    one Brötchen.
  - The three identical widget cases are now one, and the kinds are proven in pgTAP.
  - `RejectedOp.nameTaken` doc comment fixed. EN ARB description added.
  - `is_ordinary_text` noted in DECISIONS.
  - The gifted-household refund copy is noted in NEEDS_LEAD.
  - The changelog hold is explained in the PR.
  - `journeys/offline.mjs` pairs online rows by line, waits longer, explains a skipped line, and
    deletes its rows in `finally`.
- **Tests after the round.** `flutter test` gives `+1798 ~88`, `flutter analyze` is clean and
  `scripts/lint.sh` passes. Live journeys PASS: rename, synonym with undo, and offline.

## Review 1 (2026-11-05): fixed (lead Addenda 3 and 5)

- **Must fix 1, Addendum 3 (exact-name-only rename merge).** A rename merges only when the new
  name, brand and details match an open item after folding (case, spacing, umlauts), as add's
  duplicate check does.
  - A synonym („Semmeln“ while Brötchen is open) or a name whose open item has a brand („Butter“
    while „Butter“ Kerrygold is open) stays a second row. Once the server has keyed the new name,
    add's duplicate hint shows.
  - The synonym merge, its undo-rename (`EditItem.nameBefore`, `Merge.renamedFrom`) and the
    merge after the server's confirmation are removed. `EditItem.keyBefore` stays: it decides
    when the hint is offered.
  - Tests: the cubit's synonym tests now assert "offered, never merged". New cases cover
    „Butter“ next to „Butter“ Kerrygold (two rows) and „Broetchen“ onto Brötchen (merges). The
    widget test checks that the synonym only gets the hint.
  - Live:
    - Exact: merged, and Rückgängig brings Apfelsaft back.
    - „Broetchen“: merged.
    - „Semmeln“: no merge, the hint shows, Brötchen stays ×4.
    - The reviewer's Butter probe: two open rows (Kerrygold and plain), no merge.
- **Must fix 2, Addendum 5 (Peter's copy).** `accountDeletePremiumLastMember` and
  `accountDeletePremiumAck` now hold Peter's DE and EN texts exactly.
  - `accountDeletePremium` is unchanged.
  - Updated to match: the widget tests (plus a new English release-card test),
    `household-bound.spec.ts`, `features/account-deletion.md` (now points to the ARB keys), and
    the DE and EN screenshots.
  - NEEDS_COPY_REVIEW lists both keys and marks `accountDeletePremiumAck` as an edit of an
    existing string.
  - Live, gifted grant: the card and the tick box show the new texts in DE and EN.
- **Docs.** DECISIONS 104.2, 104.3 and 104.8, NEEDS_LEAD, `features/edit-item.md`, the writers'
  file, `journeys/edit-item.mjs` (`--onto` proves no merge and the hint, and it fails on an
  ambiguous target) and the SKILL row are updated. The changelog `hold:` line now sits under
  `fixed`.
- **Tests.** `flutter test` gives `+1800 ~88` and `flutter analyze` is clean. `scripts/lint.sh`
  passes. The e2e `household-bound`, `dedupe` and `edit-sheet` specs: 13 passed. No SQL changed
  in this round.

## Missing, blocked or follow-up (docs/NEEDS_LEAD.md "Job 104")

- The voice splitters (Siri, Alexa, dictation) don't read the number-word names yet: spoken
  „Seven Up“ gives 7 × Up. Voice code was off-limits for this job.
- The copy review of `accountDeletePremiumLastMember`. It shows in releases now, though its
  job-68 siblings waited for Legal Review.
- Typed number words counting online too was confirmed by the lead (Addendum 3).
- Offline, a multipack („6 x 1,5 l“) and the brand and details split still need the server.
