# Job 64: polish from the Play reshoot (2026-11-02)

Five findings from the Play screenshot reshoot: seeds still gave every household dm, Lidl and
Edeka; Mehr showed Hummlist Premium to everyone; a second member's parallel add got past the
duplicate check; „Wieder fällig“ showed one item; the last row sat half behind the input.

## What was built

1. **No default stores** (`supabase/migrations/20261102000100_no_default_stores.sql`).
   `create_household`'s `p_default_stores` defaults to false. Production: the app sends `false`
   since job 22 (`SessionCubit.createHousehold`), and household creation has no other path (no
   trigger on `auth.users` or `households` seeds stores), so a real new household gets only the
   stores picked in onboarding. Fixtures (`fg seed`, all 11 scenarios), the e2e `createHousehold`
   helper, pgTAP, Deno integration tests, the backup drill fixtures and the smoke scripts now
   create generic stores (Supermarkt, Drogerie, Bäckerei, Wochenmarkt, …); chain tests pick dm,
   Lidl and Edeka explicitly (`chainStores`, `p_stores`).
2. **Premium hidden before the launch** (`app/lib/more/more_screen.dart`, `_PremiumRow`). Listed
   only when `premium_offer` is on and, in the store apps, `REVENUECAT_PURCHASES`; or for a
   household that has Premium. No flag changed.
3. **One open item per name, a real race** (`20261102000200_one_open_item.sql`). Not a helper
   shortcut: the app checks only its own list, so two members adding at once both inserted. A
   BEFORE INSERT trigger with a per-household advisory lock skips the second open copy; the app
   acknowledges it like a replayed add; `add_item` (MCP, Siri, Alexa) takes the lock and returns
   the open row. Job 61's files untouched (`parse_item` stays theirs).
4. **„Wieder fällig“: the rule was right, the sheet hid it.** `suggest_items` returned 11 due
   items for heavy-history; the empty sheet's half-screen cap left one row on a 360 px phone
   (wrapped chips), cut by the input, and after an add the note took its place. The rule is
   documented in the usuals feature map (`us-rule`).
5. **Last row behind the input** is the same cap: before typing the sheet now shows its notes and
   at most three whole rows (`add_sheet.dart`, `_firstOpenRows`); the list itself was checked at
   360×640 to 1280×800 and with a keyboard inset, and keeps its 72 px above the bar.

6. **Escape right after a tap** on a suggestion closes the sheet (CI found it on the first push:
   an Escape within 50 ms of a tap was lost on the web and the sheet reopened blank).
   `list_screen.dart`: the add bar's own focus node holds the gap and the closed state, a
   non-focusable `Focus` around the sheet takes Escape from rows. Widget test "Escape closes the
   sheet while a row has focus" (red before); web probe: 4/4 closed, was 0/4.

Decisions: `docs/DECISIONS.md`, "Job 64".

## How to verify

- `cd app && flutter test test/list/add_sheet_test.dart test/more/more_screen_test.dart` (three
  whole due rows at 360×640 and 390×844, also after an add; Premium row cases). Both failed on the
  old code (row bottom 580 vs input top 534.5; the row listed with the switch off).
- `cd supabase/functions && FG_DB_TEST=1 SUPABASE_DB_URL=… deno test --allow-all
  _shared/one_open_item_integration_test.ts` (two connections, the first insert held open). All
  three failed with the trigger dropped and the old `add_item`.
- `supabase test db` (households/invites: no store by default, `p_default_stores => true` still
  seeds the chains).
- `scripts/fg seed <scenario>` for each scenario: checks pass, generic stores only.
- Web build (verify-hummlist, heavy-history): screenshots in `docs/screenshots/64/`.

## Results

Local: flutter gate (1413 tests + goldens), db gate (pgTAP 30 files / 1544 tests, Deno integration
22, backup drill, fixtures integration), lint, functions, fg-cli, changelog, gitleaks all passed.
The e2e suite runs in CI on the PR.

## Open

- Nothing blocked. The reshoot images themselves are on the box (not reachable from hz); the
  symptoms were reproduced on the web build at the Play capture size instead.
