# Round 3 review: H · Satz · Laufweg (`#/h-satz-final`)

Reviewed: DONE_SUMMARY/DESIGN_NOTES (Round 3), `src/prototypes/h-satz-final/*`, shared `store.ts`/`dnd.tsx`/`i18n.tsx`/`bits.tsx`,
`e2e/h.spec.ts`, `e2e/h-touch.spec.ts`, and the screenshots `h-satz-final-{list,list-collapsed,add,add-grown,edit}.png` and `index.png`.
No project files were modified.

## Checks run

- `npx tsc -b`: clean.
- `npx vitest run`: 41 passed.
- Playwright `e2e/h.spec.ts` (19 mouse tests), `--workers=1`, `vite preview --strictPort` on 4190 from a build in `/tmp`, run under
  `/tmp/fg-e2e.lock`: **19 / 19 passed**. No other real Playwright run was active (the `pgrep -f 'playwright test'` hits were other
  jobs' prompt text and the idle sand runtime daemon, which owns no browser).
- `e2e/h-touch.spec.ts` (4 tests): 3 passed. "tap checks off" failed with "page does not support tap". This is an artefact of my
  throwaway `/tmp` config, which lacked the repo's `touch` project (`hasTouch`/`isMobile`). It is not a product bug, and the project's own
  config handles it. Not counted against H.
- Server stopped, `/tmp` build and results deleted, `git status` clean.

## Peter's points, checked against code and screenshots

| Point | Result |
| --- | --- |
| Sticky headers removed (store + category) | OK. `.h-store-head` and `.h-cat-head` have no `position: sticky`. The e2e asserts both move by the scroll delta. |
| No emoji strip in a collapsed store | OK. Head is badge, name, rule, "N Artikel", caret. Screenshot confirms it. The e2e asserts "Edeka 8 Artikel". |
| No category tags (F style) | OK. Plain divider lines only. |
| Light categories | OK. 11.5 px uppercase, faded, 1 px hairline, no emoji or count. Visually quiet in `list.png`; the store divider is clearly stronger (20 px/800, 2 px store-colour rule). |
| Edit with separate fields | OK. Bezeichnung, Marke, Eigenschaften and Menge (with −/+) are prefilled, plus the store and category chips. `editPatch` (`useComposer.ts:94`) saves only changed fields, and there is no suggestion list in edit, so nothing can be guessed. Löschen and Fertig sit in the thumb zone. |
| Add unchanged | OK. Parse first, Enter takes the first, every row is tappable, chips apply to the tapped row (e2e). |
| Sheet ~50%, grows, scrolls only when full, input fixed, tabs hidden | OK. Measured 422 px (50 %) at 2 rows, 497 px at 4, 617 px at 6, full height at 8 and scrolling only there. The input stays within 2 px, and the tabs are `inert`, hidden and translated away while open. `prefers-reduced-motion` zeroes the durations. |
| Edit sheet sized to content, no dead area | OK. `--hc-min: 0` for edit; `edit.png` shows no dead band. |
| Explainer card kept, no onboarding system | OK. The existing `GestureHint`, nothing new. |
| Tap targets ≥ 44 px | Mostly OK. Chips, options, steppers, text buttons and the clear button are 44 px or more, fields are 48 px, rows are at least 52 px and the store head is 52 px. The category head is 32 px (see Nice to have). |
| Long names | Wrap in full in rows (e2e). The edit-sheet title truncates, which is minor (see Nice to have). |
| DE/EN | DE by default. The new strings (`editHintFields`, `brandNone`, `propsExample`, `qtyMinus`, …) have EN. The e2e walks EN across the screens. No mixed-language text found in the screenshots. |
| Round-2 behaviours kept | Collapse (tap divider, count, sessionStorage), store drag, category reorder, drops onto a folded store, tap + Undo, long-press / right-click edit, no check circles, tabs, PhoneFrame: all covered by passing e2e. |

## Must fix

None. No point of Peter's spec fails, and no regression was found.

## Nice to have (ordered by importance)

1. **Walk order is still bounded by categories (decide with Peter).** `store.ts:59` (`place`) keeps categories as contiguous runs and a
   dropped item adopts the category of the row it lands on (DESIGN_NOTES, open question 1). Peter's "most important" point is that the
   order you placed things in is the order you walk. Today you cannot walk milk, then cheese, then milk again, and the store's category
   order decides the sequence. This is a defensible reading, since it is documented and the dividers stay light. But it is the only
   place where categories still shape the walk. The alternative is a free per-store sequence with a divider wherever the category
   changes. Ask Peter before round 4.
2. **Category divider is 32 px** (`h.css:85`, also the reorder handle), below 44 px. The reorder is rare and the trade-off is documented.
   If it is ever a problem, make the hit area taller with padding and keep the visible line thin.
3. **Dead space at 1–2 suggestions.** About 150 px of empty sheet above the input, filled only by the Enter hint
   (`composer.css:301`). It follows Peter's "about 50 %" literally and is acknowledged in the notes. It is worth a quick look on a real phone.
4. **Edit title truncates** a long item name with an ellipsis (`composer.css:104`, `Composer.tsx:74`). Let the title wrap to two lines
   or drop the name from it, since the Bezeichnung field already shows it in full.
5. **Height animation reflows each frame** (`composer.css:50`). It looked smooth in Chromium, but nobody has checked a low-end phone.
   Keep it on the list for the Flutter port.
6. **Index blurb for E** still says its categories "kleben oben". That is correct for E but could be confused with H. Consider a
   short "(in H nicht mehr)" note.

VERDICT: PASS
