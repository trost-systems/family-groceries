# Job 78: stores and categories under Liste → Anpassen, nothing on the list drags, a compact add sheet

PR [#207](https://github.com/trost-systems/family-groceries/pull/207). Peter's feedback of
2026-11-02 (20:38 CET). Decisions: `docs/DECISIONS.md`, Job 78. Calls made without Peter:
`docs/NEEDS_LEAD.md`, Job 78.

## What was built

- **A. Anpassen on the list.** The list header has „Anpassen“ / "Edit" top right
  (`app/lib/list/list_screen.dart`). It opens the stores screen at `/edit`, a child of the List
  branch's `/` route (`listTabRoutes()` in `app/lib/app/router.dart`), so back stays in the List
  tab and the tab bar stays. A store's details are `/edit/<id>`, the section without a store
  `/edit/none`. `authRedirect` keeps these paths for a member (`inListTab`); their analytics
  screen name is `stores`. More lost „Kategorien verwalten“ and „Läden“.
- **B. Stores screen** (`app/lib/list/stores_screen.dart`, moved from `more/`): no disclaimer, a
  reworded hint, store rows with a trash icon (existing confirm) and their drag handle, „Laden
  hinzufügen“ as a yellow extended FAB, „Ohne Laden“ pinned last as a flat muted row (no handle,
  no trash, no rename). **Store details** (`app/lib/list/store_details_screen.dart`) replace the
  categories screen and the store layout screen: rename at the top for a store, categories in
  walking order (route order for „Ohne Laden“) with handles, tap renames, a trash per category
  (not „Sonstiges“) whose dialog says it leaves every store, „Kategorie hinzufügen“. One name
  dialog (`app/lib/list/name_dialog.dart`) serves store and category add and rename.
- **C. No drag on the list.** Items, category dividers and store dividers no longer drag; the
  drag session shrank to the rows that are closing (`list_view/leaving_rows.dart`), the hold
  timing lives in `list_view/hold.dart`. A hold or right click on an item opens the edit sheet
  while the finger is down; on a divider it opens that section's store details. No menu, no
  up/down moves. The explainer card reads „Tippen hakt ab · Nach links wischen oder halten
  bearbeitet“.
- **Addendum 1 (Peter, 20:56 CET): no swipe-to-edit.** The row's `Dismissible` is gone; a hold or
  right click is the only edit gesture, a sideways drag does nothing, screen readers keep
  „Bearbeiten“ and „Löschen“. The explainer reads „Tippen hakt ab · Halten bearbeitet“ / "Tap
  ticks off · Hold to edit"; the account-deletion page and the Alexa guide say hold instead of
  swipe. Settings stays the style reference: no new control type was added (DECISIONS 16;
  NEEDS_LEAD 8 asks whether the rows should be lighter).
- **D. Add bar.** The „+“ disc is gone; a tap anywhere on the compose hex opens the sheet and
  focuses the field.
- **E. Add sheet.** No „Hinzufügen“ title and no leading icon. The store and category chips share
  the first line with a ✕ („Schließen“). Until the user picks, a chip shows Hummlist's guess
  muted with a small circled „A“; screen readers hear „Laden: automatisch“ /
  „Kategorie: automatisch, Kühlregal“.
- **F. Join from More** is `/more/join`, a page of the More branch: back returns to More, and the
  address bar, a reload and the screen name agree.
- **Found on the way:** the seeded „👶 Drogerie“ showed its baby twice in the categories list
  (icon plus name); the details rows use the label without the leading emoji. And with the join
  screen inside the More tab, the tabs stay mounted through a household switch, so the add sheet
  kept the old household's list and an add right after joining vanished (caught by
  `live-sync.spec.ts`); the list screen now starts over with the new household's list
  (`ShoppingList` keys its add-sheet provider by the `ListCubit`), which also covers restoring an
  archived household from More.

## How to verify

- Widget tests: `app/test/app/navigation_test.dart` (More → join → back; List → Anpassen → store
  → back → back), `app/test/list/stores_screen_test.dart`, `store_details_screen_test.dart`,
  `list_screen_test.dart` (holds, divider holds, nothing drags), `add_sheet_test.dart` (hex tap,
  chip semantics, no title).
- e2e: `stores.spec.ts`, `stores-add.spec.ts`, `list-walk-order.spec.ts`, `classifier.spec.ts`,
  `shell-more.spec.ts`, `live-sync.spec.ts`, `add-sheet.spec.ts`.
- Screenshots: `node .cursor/skills/verify-hummlist/journeys/list-manage.mjs <dir> [--lang en]
  [--dark]` after `helpers/launch.sh`; the before/after set is in `docs/screenshots/78/`.

## Test results

- `scripts/gates/flutter.sh` green: analyze, format, 1611 passed / 80 skipped, Widgetbook 336.
  `scripts/lint.sh` green.
- After review 0 (addendum): flutter gate (1610 passed, Widgetbook 336) and lint green; e2e
  edit-sheet, iphone, list-walk-order, list and add-sheet: 25 passed, including a finger swipe
  that opens and moves nothing.
- Local e2e (Hetzner, release web build): full run 178 passed; this PR's failures there
  (`add-sheet.spec.ts:61` scroll measurement, `live-sync.spec.ts:62` join URL, then the vanished
  add after joining) were fixed, and the reruns of add-sheet, live-sync, onboarding, shell-more,
  stores and stores-add passed. id-token, AC6 and social-sign-in time out on this runner (its
  containers can't reach the fake OIDC provider on a host port); CI runs them.
- An independent review found nothing blocking; its doc findings are fixed, its two judgment calls
  are DECISIONS Job 78 items 14 and the deep-link note below.

## Missing or blocked

- A signed-out deep link to `/edit/...` lands on the list after sign-in, not on the stores screen
  (`/edit` is not an app link). Not a regression: the old screens had no URL at all.
- Nothing blocked. Merge waits for the lead's review and green CI (brief); the NEEDS_LEAD items
  are reversible calls, not blockers.
