# Job 57: list rows without a check box, a polished strike-through, design alignment

Decisions: [DECISIONS.md](../DECISIONS.md) "Job 57". Screenshots and tick clips:
[`docs/screenshots/57/`](../screenshots/57/). Open questions for Peter: NEEDS_PETER "Job 57".

## What changed for users

- **Ticking off.** A tap draws a line across the item's words, left to right and line by line on
  a wrapped name, while the row turns mint and its text muted (the site's done row). Then the row
  closes and the rows below move up; a category or store heading whose last item goes closes with
  it. The tick commits 440 ms after the tap (`HlDuration.short + medium`). With reduced motion
  the struck row shows at once, holds 260 ms and goes. Screen readers hear the row as a checkbox
  (unchecked, then checked) and "Milch abgehakt" / "Milk ticked off".
- **Peter's calls on job 56 items 31 to 34 (addendum 5).** The empty list shows a honey hex
  with the cart; stores show their full name in a hex badge (no retailer colours, a cobalt rule;
  logos wait for the Legal Review); every single-line text field is a hex; a partner's new row
  is honey (new) and a ticked row mint (done).
- **No check box on list rows** anywhere in the app or Widgetbook (there was none since design
  H). Consent and opt-in check boxes stay hexagons (Peter 13:01), now `HexCheckbox`.
- **More room for names.** Rows follow the site: Bricolage 17 px names, a 28 px emoji column,
  48 px rows (52 before), 13 px details.
- **The theme is one hex segmented control**, System / Hell / Dunkel (Peter 14:20), radio-group
  semantics, a sliding honey indicator; the stored value is unchanged.
- **Job 56's design review, 29 of 30 SAFE items:** hex compose field and "+", hex chips and
  stepper, sticker explainer, store rules and labels, sticker drag pills, a deduplicated "Zuletzt
  verwendet", hex checkbox, honey hex rail indicator, floating sticker snackbars, contoured and
  sticker cards, the Premium card, stacked consent buttons at 360 px and an icon without
  sparkles, the app icon brand block on login and welcome, a shorter join title, a clean OAuth
  error, hex pill rows with numbered steps for store layout and categories, section labels,
  equal provider buttons, token motion and radii, a framed wide list. Item 6 (household name and
  count over the list) is left to Peter: it reverses his job 29a call.

## Where

- Rows: `app/lib/list/list_view/item_row.dart` (`StrikePainter`, the leave controller),
  `dividers.dart` (`_ClosesWithRows`), `drag.dart` (`DragSession.leaving`), `model.dart`
  (`recentlyUsed`).
- Design system (`app/lib/design/`): `hex_segmented.dart`, `hex_switch.dart`, `hex_radio.dart`,
  `hex_checkbox.dart`, `sticker.dart` (+ `HlShadow` from `design/tokens/build.mjs`),
  `hex_pill.dart`, `pointy_hex.dart`, `hex_input_border.dart`, `section_label.dart`,
  `brand_block.dart` (+ `app/assets/brand/` from `design/app-icon/build.mjs`),
  `field_border.dart` (the hex input theme); `app/lib/list/store_badge.dart`.
- Widgetbook: "Liste → Abhaken (Animation)" (a synthetic finger ticks a row in a loop),
  "Abgehakt", and stories for every new component.

## How to verify

- `cd app && flutter test` (row tests in `test/list/item_row_test.dart`, the divider close and
  the reduced-motion path in `test/list/list_screen_test.dart`, theme mapping in
  `test/app/theme_test.dart`, segmented control in `test/settings/` and `test/design/`).
- Goldens: `test/design/goldens/list-rows-{light,dark}.png` (open, a quarter into the line,
  struck, wrapped), `list-*`, `add-sheet-*`, `settings-*`, `components-*`, `more-*`,
  `store-layout-*`, `categories-*`, `stores-*`.
- e2e: rows are found by role `checkbox`, the theme by role `radio`
  (`e2e/tests/helpers.ts`, `catalog.ts`, `theme.spec.ts`, `shell-more.spec.ts`).

## Not done here (site follow-up)

See DONE_SUMMARY "Job 57", section "Site follow-up (not done)".
