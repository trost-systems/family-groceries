# Done: Family Groceries design prototypes

## Round 3 (2026-10-24)

One new variant, **H · Satz · Laufweg** (`#/h-satz-final`). It is E finished according to Peter's round-2 review. It
is first on the index under "Runde 3", followed by Runde 2 (E/F/G) and Runde 1 (A–D), all unchanged. How H answers
each point, the tradeoffs and the Flutter mapping are in `DESIGN_NOTES.md` under "Round 3".

### What changed compared with E

- **Walk order.** Items are listed in the order you walk the store. Hold and drag an item onto another row to put it
  right before or after that row, with an insertion line. A row in another category or store makes the item adopt it.
- **Nothing sticky.** Stores and categories are plain dividers that scroll away. The store divider (badge, name, a
  rule in the store colour, "8 Artikel") is stronger than the category divider (small, faded, with a hairline, no
  emoji, no count).
- **Folded store.** It shows only the name and count, with no emoji strip. Taps, persistence and drops onto folded
  stores work as before.
- **Edit.** Edit has separate prefilled fields: Bezeichnung, Marke, Eigenschaften and Menge (with −/+), plus the store
  and category chips. Löschen and Fertig sit in the thumb zone. Fertig saves only what changed and never applies a
  suggestion.
- **Sheet size.** The add sheet opens at 50 % and grows with the suggestions up to full height. Only at full height
  does the list scroll. The input never moves, and the edit sheet is exactly as tall as its fields.
- **Critique fixes.** Chips and options are 44 px, and the "S" badge is gone from rows. The gesture card stays at the
  top. Add is unchanged.

### Test results (last run, 2026-10-24)

- `npx tsc -b` is clean.
- `npx vitest run`: **41 passed**. That is 35 earlier plus 6 new walk-order (`place`) cases in `src/shared/store.test.ts`.
- `npm run build`: dist/ is **568 KB** with `base: './'`, and it has no CDN URLs.
- Playwright ran with `--workers=1` against `vite preview --strictPort` on **4189**, serialized behind the box-wide
  `/tmp/fg-e2e.lock` and `scripts/e2e.sh`'s wait. **172 passed, 0 failed** over two runs:
  - Run 1, flows plus round 2: 111 passed in 1.6 min.
  - Run 2, touch plus H plus screenshots: 61 passed in 1.3 min.
  - That covers H with 19 mouse tests and 4 touch tests, round 2 with 51, round 1 with 60 flow tests and 20 touch
    tests, and 18 screenshot tests.
- The H tests cover:
  - the parse as the first tappable suggestion for "Windeln Pampers Größe 3", a chip pick applied to the tapped
    suggestion, and Enter adding the first;
  - the sheet at 40–60 % with 2 suggestions, taller with 6 and no scrolling below max, at max with 8 where it
    scrolls, and the input within 2 px whether open, grown, full or closed;
  - tabs hidden while open, and reduced motion;
  - dividers moving by exactly the scroll delta and not sticky;
  - a folded head reading "Edeka 8 Artikel" after a reload, and a drop onto a folded store;
  - walk order kept through check, Undo and edit, a drop before a row, a drop into another category, and store and
    category reorder;
  - right-click edit with prefilled fields, where changing only Marke changes nothing else;
  - store chip, empty name, Löschen plus Undo, and Escape cancelling an edit;
  - tap plus Undo, no check circle or member badge, the long name in full, DE by default with EN complete, the index
    order, and the More tab.
  - The touch tests (`hasTouch`/`isMobile`, CDP touches) cover a tap with Undo in place, long-press edit with fields,
    and long-press drag into another category and within a store.
- I fixed three test-side problems along the way:
  - A "Brötchen" locator also matched the long Toastbrötchen name.
  - A `textContent` read dropped a space.
  - The drag helper now re-aims at the target before release when a drop fraction is given, because edge auto-scroll
    was still moving the target.
  - The product code was not the cause of any of these.
- No vite or preview server is left running.

### Screenshots (390×844, `shots/`)

- `h-satz-final-list.png`
- `h-satz-final-list-collapsed.png`: dm and Edeka folded.
- `h-satz-final-add.png`: "Spülmittel", 2 suggestions, sheet at 50 %.
- `h-satz-final-add-grown.png`: "Windeln Pampers Größe 3", full height.
- `h-satz-final-edit.png`: Milch with separate fields.
- `index.png` was refreshed. The same spec re-rendered the A–G shots, and they came out byte-identical apart from `a-grid-add.png` (render noise).

I looked at each H shot. Two fixes came out of that. The folded stores had about 70 px of air between them, now
2 px. The collapsed shot had been taken mid-caret-rotation and scrolled away from the top.

### What's mocked

These are the same as in round 2: the in-memory list plus the long name (it resets on reload), the fixed `HISTORY`,
the parser's ~40-product catalogue, and no keyboard (the band under the input is where it would be). The walk order
is only the order of the list. Nothing learns a store's real layout.

### Known gaps

- Nothing has run on a real phone. Touch is CDP-emulated in Chromium, and the smoothness of the height animation was
  judged from screenshots and timings.
- Dropping on a category divider (not a row) appends to the end of that category.
- The category divider is 32 px, under the 44 px guideline. That is deliberate, to keep it quiet.
- With 1–2 suggestions, the 50 % minimum leaves about 150 px of mostly empty space above the input.

### Open questions for Peter

1. Inside one store, should a category always stay one block (as now), or should items follow a free sequence, with
   the same category divider allowed to appear twice if the walk goes back to it?
2. With only one or two suggestions, should the sheet still open at 50 %, or hug its content as edit does?
3. Is the added-by initial ("S") missed on the rows, or can it live only in the edit sheet?

## Round 2 (2026-10-24)

Three variations of D · Satz, each answering Peter's round-1 review. They put the categories inline in different ways. Everything else is
one shared implementation (`src/shared/round2/`): collapsible store bands, full-width rows without check circles, the
bottom input, and an add/edit sheet that grows upwards around that input. Round 1 is unchanged on the index under
"Runde 1". Rationale, tradeoffs and the Flutter mapping are in `DESIGN_NOTES.md` under "Round 2".

### Variants

- **E · Satz · Zwischenzeilen** (`#/e-satz-zeilen`): each category is a slim sticky heading row inside the store's flow. It is the clearest, and it costs one thin row per category.
- **F · Satz · Etikett** (`#/f-satz-etikett`): no category rows. The first row of each group carries a small category tag, and a tinted band separates groups. It costs zero extra rows.
- **G · Satz · Fließtext** (`#/g-satz-fliesstext`): each category is one paragraph ("🥦 OBST & GEMÜSE: 🍌 6× Bananen · 🥒 2× Gurken"). It is the densest and most sentence-like, and it gives up the row grid.

All three share these behaviours:
- **Store bands.** Tap a store band to fold it. The count and an emoji strip stay, and the fold survives a reload within the session (`sessionStorage`). Hold and drag a band to reorder stores.
- **Items.** Tap checks off with Undo. Hold and release, or right-click, edits. Hold and drag moves an item to another category or store, including onto a folded store.
- **Add sheet.** Typing shows only selectable suggestions: the parse first, then past purchases, other packs, sizes and brands, and catalogue matches. Enter takes the first. The fold-out `dm ▾` / `👶 Drogerie ▾` chips apply to the tapped suggestion.
- **Edit sheet.** Edit uses the same sheet, prefilled with the item's words and its store and category.

### Test results (last run, 2026-10-24)

- `npx tsc -b`: clean.
- `npx vitest run`: **35 passed**. That is 27 parser cases plus 8 new `suggestionsFor` cases. The brief's "Windeln Pampers Größe 3" gives the parse first plus 7 alternatives: history, 2 packs, 2 sizes and 2 brands.
- `npm run build`: dist/ is **540 KB**, with `base: './'`. The only URLs in the bundle are XML namespaces and React's error-docs link, so there is no CDN.
- Playwright, `--workers=1`, against `vite preview --strictPort` on **4187**: **146 passed, 0 failed**:
  - round 2: 51 (17 tests × 3 variants). The tests cover parse as first suggestion with Windeln / Pampers / Größe 3 / dm, the store chip folding out inline with the pick applied to the tapped suggestion, Enter adding the first, input bar position within 2 px after opening and after closing (measured after the animation), tabs hidden while open, reduced motion, fold with count and persistence across reload, a drop onto a folded store, tap-check with Undo, right-click edit prefilled with a chip change applied, retyping in edit, the long name shown in full, dragging to another category and another store, reordering stores and categories, DE default with no mixed language in EN, and the More/licenses page.
  - round 1: 60 flow tests plus 20 touch tests.
  - screenshots: 15.
- Round 1 was **not** green when round 2 started. On the "Round 1 fixes" commit, 7 tests failed in a separate worktree (D category reorder and six touch tests). The cause was in the tests. The new gesture-hint banner pushed rows down, and the tests pressed rows that were now under D's dock or the tab bar. The touch probe hit `tab-more`. The tests now scroll the pressed element to the middle of the list. Round-1 code is untouched.
- `scripts/e2e.sh` now ignores the CDP-attached `sand-playwright-runtime` daemon when it waits for other runs. The daemon lives for the whole session and owns no browser, and it had blocked the wait loop indefinitely. Real runs from other jobs are still waited out.
- No vite server is left running.

### Screenshots (390×844, `shots/`)

`index.png`, plus `{e-satz-zeilen,f-satz-etikett,g-satz-fliesstext}-list.png`, `-add.png` ("Windeln Pampers Größe 3"
typed, suggestions visible), `-add-chip-open.png` (store chip folded out) and `-edit.png`. The round-1 shots were
regenerated too.

### What's mocked

- **Data and history.** The data is the round-1 mock list plus one long name ("Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen"), and it resets on reload. Purchase history is a fixed `HISTORY` list in `mockData.ts` plus whatever was checked off in this session.
- **Catalogue.** The catalogue and brand alternatives come from the parser's ~40-product table, which has a new `brands` field. Sizes are simply ±1.
- **Keyboard.** There is no keyboard. On a phone, the band under the input that shows the Enter hint is where the keyboard would be.

### Known gaps

- Touch is tested for round 1 only, through CDP touch events. The round-2 variants use the same gesture hooks but have no touch e2e of their own, and none of it has run on a real phone.
- The sheet animation is a CSS `clip-path` transition with an easing curve, not a physics spring. Smoothness was judged on screenshots and transition timings, not on a device.
- In G, a long item wraps across lines, so it is harder to hit precisely than a row.
- In F, the category tag is a drag handle nested inside the first item's row. That is a gesture subtlety the Flutter build must keep.
- The catalogue prefix match includes English aliases, so "Mi" also offers Hackfleisch (via "mince").

### Open questions for Peter

1. Which inline grouping reads best in the aisle: heading rows (E), a tag on the first row (F), or a paragraph per category (G)? My guess is E for scanning and F for density. G is the experiment.
2. Edit is retyping plus chips, the same as add, instead of C's labelled fields. Is that enough, or do you want per-field editing (name, brand, details, quantity) back in the edit sheet?
3. Should the add sheet open full height right away (as now), or open low and grow as suggestions arrive?

## Round 1

Throwaway Vite + React + TypeScript sandbox with four clickable design directions for the list and the add flow.
Rationale, research and Flutter mapping are in `DESIGN_NOTES.md`. Research sources with URLs are in `research/RESEARCH.md`.

## Directions

- **A · Regal** (`#/a-grid`): an illustrated 3-column tile grid. The add preview is one big tile that fills in, and store/category open as an accordion under it.
- **B · Zettel** (`#/b-paper`): a classic ruled paper list with one line per item and a tiny emoji. It is the densest. Store/category are always-visible chip rails in the add sheet.
- **C · Karten** (`#/c-cards`): calm M3 cards per category with two-line rows and a sticky store jump bar. Store/category tokens morph in place into a segmented row.
- **D · Satz** (`#/d-sentence`): bold and thumb-first, with the add bar at the bottom and sticky store bands. The preview is a sentence with tap-cycling store/category pills plus a jump rail.

All four share one gesture model. Tap checks the item off, with Undo. Hold and release (300 ms, under 8 px of movement) or right-click edits inline, never in a sheet. Hold and move drags an item to another category or store. Store and category headers drag to reorder, and while one is dragged its siblings collapse to headers. The tabs are List and More (settings, logout, legal, Flutter-style licenses page). Every screen has a DE/EN toggle, with German as the default.

## How to run

```sh
cd /workspace/fg-design-sandbox
npm install
npm run dev            # http://localhost:5173/#/  (Agentation toolbar in dev only)
npm test               # vitest: parser
npm run build          # tsc -b && vite build -> dist/ (relative base, open from any path)
npm run e2e            # builds, then Playwright vs vite preview :4185, serialized by a lock
```

## Test results (last run, 2026-10-23)

- `npx tsc -b`: clean.
- `npx vitest run`: 22 passed (parser: the brief's Windeln example, every typing prefix, quantity, size/pack/amount patterns, compounds, English, brand-only, fallback, household memory, suggestions).
- `npm run build`: passes. dist/ is 496 KB total (JS 426 KB, 123 KB gzipped). No CDN or font URLs, and Agentation is not in the bundle.
- Playwright, `--workers=1`, against `vite preview` on 4185: **45 passed**. That is 10 flow tests × 4 directions plus 5 screenshot tests. Each direction is tested for: live parse preview (Windeln / Pampers / Größe 3 / dm), suggestion adds under dm, inline store change to Edeka before adding, tap check plus undo, right-click inline editor, drag item to another category, drag-reorder stores, drag-reorder categories, the DE/EN toggle, and the More → licenses page.
- No vite dev or preview server is left running. Playwright's webServer starts and stops preview for each run.

## Screenshots (390×844)

`shots/index.png`, `shots/{a-grid,b-paper,c-cards,d-sentence}-list.png`, and `shots/{a-grid,b-paper,c-cards,d-sentence}-add.png`. The add shots have "Windeln Pampers Größe 3" typed and the parsed preview visible.

## What's mocked

- All data is in-memory mock data (`src/shared/mockData.ts`). It resets on reload. There is no backend, auth, sync or real household.
- The parser is a heuristic with about 40 products, about 30 brands and the regex patterns. It is not the SPEC's server-side classifier, and the learned memory is just the last store/category per product within the session.
- The mic icons (A, C), settings rows, logout (returns to the List tab), imprint/privacy and license texts are placeholders.

## Known gaps

- Drag was tested with a mouse in Playwright only. Touch hold-and-drag uses dnd-kit's TouchSensor with the same 300 ms / 8 px constraint, but nobody has tried it on a real phone.
- There is no keyboard drag and only minimal ARIA. The inline editors were checked through tests, plus temporary screenshots in C, and are not in `shots/`.
- An item can be dragged only to stores that already have items, because empty stores are hidden. Moving to an empty store goes through the editor's store picker.
- Checked items vanish with Undo in A, C and D. B also keeps an "Erledigt" list where a tap restores the item.

## Open questions for Peter

1. Which inline store/category fix feels best in hand: always-visible rails (B), morph in place (C), or tap-cycle (D)? My recommendation is C's structure with B's row density and D's sentence preview. See DESIGN_NOTES.md.
2. Is "hold and release to edit" discoverable enough, or do you want a visible "⋯" per item?
3. Should the add bar sit at the bottom in the thumb zone (C, D) or at the top under the title (B)?
