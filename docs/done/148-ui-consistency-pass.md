# Job 148: UI consistency pass

PR [#294](https://github.com/trost-systems/family-groceries/pull/294), branch
`job/148-ui-consistency-pass`. Not merged: the lead merges after review. Reasons are in
`docs/DECISIONS.md`, "Job 148".

## What was built

- **Floating top bar.** The list's top bar is a hex capsule at the top right with the tab pill's
  height, contour and sticker shadow. It holds the new-items line, the sync icon and Anpassen.
  It is the list's pinned header (`ShoppingListView.header`, `_Header` in
  `app/lib/list/list_screen.dart`), so rows scroll on under it and a row brought into view stops
  below it. It stays while the list first loads.
- **Anpassen** is the theme's tactile secondary button inside the capsule.
- **One depth switch.** `raisedFaces` in `app/lib/design/tactile.dart` (true, 3D). `AddButton`
  replaces the flat FAB on „Läden“ and a store's page. The add and edit sheets' store and
  category chips and „Konto löschen“ are tactile. `HexPill` and the theme buttons follow the
  switch. Value controls, text buttons and brand sign-in buttons stay flat (DECISIONS 148.3).
- **Category rows have no numbers.** `HexStep` is deleted. The place is the row's semantics hint
  („2 von 11“, `aria-description` on the web).
- **One hex per store row.** The name is plain text in the row and on a store's name pill.
  „Ohne Laden“'s hint sits below its row.
- **Centred text in hex fields.** `ContourInputBorder` is an outline for hex fields. Labels sit
  above the field in `LabeledField` (9 fields). The new lint `no-label-in-hex-field` keeps them
  out of the hex. Theme text uses even leading. „Menge“ is left-aligned.

## How to verify

- `cd app && flutter test test/design/hex_text_centring_test.dart test/list/list_screen_test.dart test/list/store_details_screen_test.dart test/list/stores_screen_test.dart test/list/list_link_test.dart`
- `scripts/verify.sh --only lint,flutter,changelog` (green locally on 2026-11-06)
- `.cursor/skills/verify-hummlist/helpers/launch.sh`, then
  `node .cursor/skills/verify-hummlist/journeys/hex-surfaces.mjs <dir> [--dark]`
- Screenshots: `docs/screenshots/148/` (before and after side by side, DE, light and dark).
  Raw captures are in `/workspace/hummlist/research/148/evidence/`.

## Open

- e2e runs in the PR's CI (ci-ok). It was not run locally, because the box-wide e2e lock queue
  was long.
- Peter may want the value controls (chips, switch, segments, checkbox) raised too. The switch
  and DECISIONS 148.3 name where to start.
- Job 149 (edit sheet cleanup) touches the same `_Field` and `_Chip`. Whichever lands second
  rebases.
