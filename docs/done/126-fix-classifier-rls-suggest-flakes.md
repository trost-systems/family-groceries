# Job 126: classifier learning, RLS and due-again suggestions hold under load

PR: https://github.com/trost-systems/family-groceries/pull/267 (PR only; the lead reviews and merges). Closes #61, #73 and #77.

## What was built
- **App fix (#61).** An add from the add sheet whose category the user did not pick sends no category (`AddItem.autoCategory` in `app/lib/list/model.dart`, set by `AddSheetCubit.take`, sent by `SupabaseListRepository._add` as `p_category: null`). The insert trigger classifies it after the ops queued ahead of it. Before, the sheet's guess was sent. A correction still in flight then lost to the old guess, and `items_learn_insert` learned the old guess as a pick. The row still shows the guess until the server answers. No migration, and queued ops from older apps behave as before.
- **Spec fixes (#77, #73).** `suggestions.spec.ts:68` waits for the tick on the server before it moves the `bought` event back. `rls.spec.ts:4` waits for „Geheimzutat“ on the server before it reads the row. Assertions and coverage are unchanged.
- **Tests.** Op JSON round trip (`model_test.dart`), `put_item` params for a guess and a pick (`list_repository_test.dart`), and the add sheet's flag with and without a chip pick (`add_sheet_test.dart`).
- **Docs.** `docs/DECISIONS.md` "Job 126" (cause per test, numbers), `docs/NEEDS_LEAD.md` "Job 126" (the store-guess follow-up, long specs under heavy load, a realtime note for job 120), and the classifier feature files (verify-hummlist and verify-family-groceries) plus FEATURES-FOR-WRITERS.

## How to verify
1. Hold one server answer in a copy of a spec with `page.route`: the tick PATCH +3 s (suggestions), a category change +3 s (classifier), `put_item` for „Geheimzutat“ +10 s (rls). Main fails each 2 of 2. This PR passes each 2 of 2.
2. `flock /tmp/fg-e2e.lock npx playwright test tests/classifier.spec.ts tests/rls.spec.ts tests/suggestions.spec.ts --repeat-each=20 --workers=1 --retries=0`.

## Results
- Main 1ba6dc51 under load and pauses alone (plain, runner+Chromium stopped 8 s/6 s and 3 s/4 s, stack containers paused 8 s/6 s, 12 CPU burners): 45 of 45 passed. The logged failures fell in host pauses.
- Slow-answer probes: 0 of 6 pass on main (1ba6dc51 and 26223b44), 6 of 6 with the fix.
- The race also fired once on main with no synthesized delay, under 8 s stack pauses (`classifier.spec.ts:20`).
- 20x: `180 passed (30.4m)`.
- A/B of the learning test at loadavg 13 to 41 plus 12 burners: main 19 of 24, this PR 17 of 24. The common failures are 60 s test timeouts at the test's end (main 3, PR 5) and a realtime miss after stack pauses (1 each). The race is main-only.
- `scripts/verify.sh --only gitleaks,lint,flutter` passed (1853 app tests). ci-ok: see the PR.

## Missing or blocked
- The store guess has the same race. It needs a trigger change (NEEDS_LEAD Job 126).
- Under 2.5 to 3 times CPU oversubscription the 28 s learning test can run out of its 60 s budget on either build. The budget stays; `test.slow()` is the lead's call.
- No screenshots: nothing looks different.

## Review 0 fixes (2026-11-06)
- **Rebased onto main 605ad96d**, after #237. The appended DECISIONS, NEEDS_LEAD and FEATURES-FOR-WRITERS sections are merged. In `rls.spec.ts` the server poll comes before #237's null guard. `deno run -A tool/lint/ts/strict.ts`: `241 files clean`.
- **Dictated adds** (`ListCubit.addSpoken`) now send no category either. The splitter's category is a guess, never a pick. A new cubit test fails without the change and passes with it.
- **NEEDS_LEAD** names the sibling test-wait in `suggestions.spec.ts:13` and `:45`, which the reviewer saw fail once under stack pauses. It is out of scope for #77.
- **The PR body** says the logged failures were host pauses and the fixed races are latent, so the lead can choose `Fixes` or `Refs`. It also points to the landing commit's ci-ok.
- **Checks.** `flutter analyze` is clean. `flutter test test/list test/fuzz` passed 531. `scripts/verify.sh --only gitleaks,lint,changelog` passed. ci-ok on the new head is in the PR comment.

## Review 1 fixes (2026-11-06)
- **#61's logged `toBeNull`.** This is `expect(error).toBeNull()` on `add_items`, so `add_items` answered an error. The fixed race does not explain it (DECISIONS 126.6). Against this job's stack, no pause shape made `add_items` fail:
  - db frozen 10 s mid-call: 0 errors in 22.
  - Whole stack frozen 10 s: 0 errors in 10.
  - Runner stopped 75 and 200 s: 0 errors in 2.

  It stays an unproven host-pause effect. The script and logs are in the ops dir, `evidence/addpause/`. The PR body says so, and NEEDS_LEAD lists it as open evidence.
- The line-48 realtime note now says line 49 (after the #237 rebase) and points to the BOARD line for job 120 (02:26).
- No code change in this round.
