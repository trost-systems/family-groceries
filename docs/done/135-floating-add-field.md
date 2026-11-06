# Job 135: the add field floats over the list

## What was built

The add field „Was brauchst du?“ no longer sits on a solid full-width bar. Its hex floats over the
list's bottom edge, 16 px from each side like the rows' content, with the small sticker shadow. The
list and „Zuletzt verwendet“ scroll on under it, and the list ends with room for the field plus
24 px, so the last row stops above it. The whole band around the hex, gutters included, is the
field's tap target: a near miss opens the field and never ticks a row hidden under it (review 0).
The tab bar is unchanged (job 136).

- `app/lib/list/list_screen.dart`. `extendBody: true` on the list's scaffold. `_AddBar` paints
  only the hex while closed; open, its column turns raised as before. Its `GestureDetector`
  covers the whole band, inside an opaque semantics node for the web. Inset `HlSpace.s4`, shadow `HlSticker.shadow(..., StickerDepth.s)`.
- `app/lib/list/list_view/shopping_list_view.dart`. The bottom spacer is the body's bottom padding
  (the bar's height) plus `HlSpace.s5`; the `bottomInset` parameter went.
- `app/lib/list/add_sheet/add_sheet.dart`. The sheet stands on that padding; its scrim reaches
  behind the bar.
- Decisions: `docs/DECISIONS.md`, "Job 135".

## How to verify

- `cd app && flutter test test/design/screens_golden_test.dart`: goldens `list-long-{light,dark}`
  (scrolled under the field) and the test "the list scrolls under the floating add field" (16 px
  insets, a row under the field, a tap beside the hex focuses the field and opens the sheet while
  that row stays on the list, the last row above the field at the end). The test fails on main
  (inset 12, no row under the field) and on the first cut of this PR (the tap ticked the row).
- e2e `add-sheet.spec.ts` "a tap beside the floating field opens it and leaves the row under it
  alone": the same near miss on the web release build, checked against the database.
- Screenshots: `docs/screenshots/135/` (before and after).

## Results

- `flutter analyze`: no issues. `flutter test`: 1855 passed, 90 skipped. `scripts/lint.sh`: ok.
- 14 screen goldens changed (the field's inset and shadow); 2 new.

## Review 0

- Must fix: a click 6 px left of the hex put a hidden „Zuletzt verwendet“ row back on the list.
  Fixed: the band is the field's tap target, and on the web an opaque semantics node over it
  (`SemanticsHitTestBehavior.opaque`) keeps the rows' tappable semantics elements behind it from
  taking the click. The first push of the fix failed the new e2e spec on CI for that reason, the
  second because the input lost DOM focus on the click; the band's tap now refocuses through
  `_refocusAfterTap`, and the spec types after the tap.
- The reviewer drove the web release build: insets match the rows at 390, 358 and 1280 px, rows
  and „Zuletzt verwendet“ scroll under the field, quick-add passes.
- Left for Peter: the ~8 px of list showing between the hex and the tab bar (a fade or no gap
  are both open; the brief allows either), and the web scrollbar's thumb running down behind the
  field. Neither was changed here.

## Review 1

- Must fix: the PR conflicted with main (#275 appended to `DONE_SUMMARY.md` and
  `docs/DECISIONS.md` too). Rebased onto ba82a7f9 with both sections kept; no code change.
  Analyze clean, 944 tests in design, list, app and the store-details tests pass, lint ok.
- The reviewer re-drove the web build at f72d9f3d: clicks in the left and right gutters, the slit
  under the hex and the band above it open the field, focus it, take typing and change no item;
  a click just above the band still ticks the row there. ✕, Escape, the list's end, wide and dark
  layouts are right. Web screenshots from that drive: `docs/screenshots/135/web-after-*.png`.
- Left open: the mouse wheel over the 72 px band does not scroll the list on desktop web (a polish
  call; drags there don't scroll either, DECISIONS item 5).

## Missing

- I did not drive the web build myself: the box-wide e2e lock had six holders queued, several of
  them 20x repeat runs. The reviewer's drive and the new e2e spec on CI cover it.
