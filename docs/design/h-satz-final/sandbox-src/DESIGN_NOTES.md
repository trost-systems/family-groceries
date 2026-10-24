# Family Groceries: design notes

Prototype sandbox for the redesign Peter asked for ("The app is ugly"). Four directions share one data model, one
parser, one gesture model and one e2e contract. Only the presentation and the inline-picker pattern differ. The
prototypes are throwaway instruments for picking a direction; the real build happens in the Flutter app.

## Round 3 (2026-10-24): H · Satz · Laufweg (`#/h-satz-final`)

Peter picked E's layout and gave a list of changes. That feedback is the spec. H is one new variant built on E. A to G
are unchanged on the index under "Runde 2" and "Runde 1". The new code lives in `src/prototypes/h-satz-final/`, because
H is its only consumer. Shared code only gained additive pieces that E/F/G and round 1 never call.

### How H answers each point

- **Walk order is the list (his "most important").** A store's list is its items in the order you meet them: the
  store's category order (`layout[storeId]`, already per store) and, within a category, the item order. Hold and drag
  an item onto another row to put it right before or after that row. A 3 px insertion line shows where. A row in
  another category or store makes the item adopt that category and store. This is the new `place(id, anchorId, edge)`
  reducer action in `store.ts` (6 vitest cases). Check plus Undo, edit and move keep the position.
  Decision: categories stay contiguous runs. A divider never repeats, and a dropped item joins the run it lands in.
  The alternative was a free per-store sequence with a divider wherever the category changes. It is closer to
  "sequence first", but the same category could then appear twice in one store. That is open question 1.
- **Quiet categories.** The category divider is 11.5 px uppercase in a faded variant colour with a hairline. It has
  no emoji, no count and no fill. It is still the drag handle for reordering categories. It is 32 px tall, below
  44 px. Category reorder is a rare, deliberate gesture, and a taller row would make the categories louder, so I traded
  that hit area away.
- **Nothing sticks.** Store and category dividers are plain flow elements, and the e2e asserts both move by the
  scroll delta and are not `sticky`/`fixed`. The store divider is the same pattern as the category divider, only
  stronger: the store badge, the name at 20 px/800, a 2 px rule in the store's colour, "8 Artikel" and a caret. It has
  no tinted band. There is 20 px of air above each store. Between folded stores the gap drops to 2 px, so folded
  stores stack like a compact index.
- **Folded store.** It shows the name, the count and a caret, with no emoji strip. The e2e asserts the head text is
  exactly "Edeka 8 Artikel". The fold still persists in `sessionStorage` (`fg-r2-collapsed:h`), and a folded store
  still accepts drops.
- **Edit with separate fields.** Right-click, or hold and release, opens the same bottom surface in edit mode. It has
  labelled, prefilled fields: Bezeichnung, Marke, Eigenschaften and Menge (with 44 px −/+ steppers when the quantity
  is a plain count). Below them sit the store and category fold-out chips. Löschen and Fertig sit where the input bar
  is, in the thumb zone. Fertig saves only the fields that differ from the opened item (`editPatch`), so a field you
  didn't touch is never rewritten and no suggestion is ever applied. Escape, the scrim or "Abbrechen" cancel. An empty
  name disables Fertig. Properties are one text field joined with ", ". It splits on ", " (comma plus space), "·" or
  ";", so "1,5 %" stays one property. When the name changes to a product the catalogue knows, only the emoji follows
  it.
- **Add as before.** Type, then tap any suggestion. The parse comes first and Enter takes it. The fold-out chips apply
  to the tapped suggestion, and the inline "Hinzugefügt … Rückgängig" note stays.
- **Content-sized sheet.** The surface's height is `clamp(min, content, max)`, transitioned over 280 ms with M3
  emphasized easing. `content` comes from a ResizeObserver over the header, the chips and the suggestions' natural
  height. For add, `min` is 50 % of the screen. For edit it is 0, so edit is exactly as tall as its fields. `max`
  reaches the top minus 28 px, which is the only height at which the list scrolls. These heights were measured at
  390×844:

  | Query | Suggestions | Sheet height |
  | --- | --- | --- |
  | "Spülmittel" | 2 | 422 px (50 %) |
  | "Kaffee" | 4 | 497 px |
  | "Milch" | 6 | 617 px |
  | "Windeln Pampers Größe 3" | 8 | 816 px (full height, scrolls) |

  The rows are top-aligned under the chips, so growing moves the header up smoothly and reveals new rows above the
  input. Nothing that is already shown jumps. The input is its own layer and never moves (asserted within 2 px).
  The tabs slide away. Under reduced motion every duration is 0.
- **Explainer card.** The existing one-time gesture card stays at the top of the list. There is no onboarding system.
- **Critique must-fixes.** Chips and options are now 44 px. The unexplained "L" (added-by) badge is dropped from rows.
  Nobody asked for who-added-what on the shopping walk, and it cost width. The sheet has no dead area, and edit is per
  field.

### Tradeoffs

- With 1–2 suggestions, the 50 % minimum leaves about 150 px between the last row and the input. I kept it because
  Peter asked for 50 %. The fill area repeats the Enter hint rather than being blank.
- Animating `height` reflows the sheet's contents each frame, where round 2 used `clip-path` and did not reflow. With a
  header, two chips and at most 8 rows this was smooth in Chromium. I judged that from the screenshots and the e2e
  timings, not on a device.
- Dropping onto a category divider (not a row) still appends to the end of that category, the round-2 rule. Rows
  cover almost all of a category, so this rarely matters.

### Flutter mapping

- **List.** One `CustomScrollView` with a plain `SliverList.builder`. Store and category dividers are ordinary list
  children, not `SliverPersistentHeader`s, so nothing pins. A folded store emits only its divider. Fold state is a
  `Set<StoreId>` in `PageStorage`, or `shared_preferences` for longer-lived state.
- **Walk-order drag.** Each row is a `LongPressDraggable` plus a `DragTarget` that reads `details.offset` against
  the row's half height for before/after and draws the insertion line. On drop, call the same `place` repository
  method (the item adopts the anchor's store and category and is inserted before or after it). Store and category
  reorder stays `ReorderableListView` with delayed drag listeners.
- **Sheet.** A `Stack` with the input bar as a fixed `Positioned` child. The surface behind it is an `AnimatedSize`
  (or an `AnimatedContainer` whose height is `clamp(minFraction * h, measured, maxH)`, measured with a
  `LayoutBuilder` + `IntrinsicHeight` or a `SizeChangedLayoutNotifier`). Use `Easing.emphasizedDecelerate`, 280 ms, and
  honour `MediaQuery.disableAnimations`. A `DraggableScrollableSheet(minChildSize: 0.5, maxChildSize: 1,
  initialChildSize: <measured>)` is the alternative if Peter wants drag-to-resize, but the input must stay outside
  it. The suggestion list is a `ListView(shrinkWrap: true)` inside a `Flexible`, so it only scrolls at max.
- **Edit.** A `Form` with four `TextFormField`s (`initialValue` prefilled, `textInputAction: next`), an
  `IconButton.filledTonal` stepper for counts, the two `InputChip` fold-outs, and Löschen/Fertig in the bottom bar.
  Save diffs the controllers against the original item and sends only the changed columns.

### Round-3 decisions taken without asking (reversible)

- H is self-contained in its folder. A shared "round 3" module would have one consumer.
- Categories stay contiguous inside a store (see open question 1).
- The added-by badge is gone from rows rather than labelled.
- Edit has no suggestion list. Peter asked for fields, and suggestions in edit were what made round 2's Fertig risky.
- `scripts/e2e.sh` and the Playwright config moved to port 4189. My runs also took the box-wide `/tmp/fg-e2e.lock`
  that other jobs use.

## Round 2 (2026-10-24): three inline-category variations of D · Satz

Peter's round-1 review is the spec. He picked D for accessibility, asked for categories inline instead of in a left
gutter, collapsible stores, the input at the bottom, full-width rows without check circles, C's add and edit, A's
fold-out store/category tags, and an add sheet where every preview is a tappable suggestion. Round 1 stays untouched
under "Runde 1" on the index for reference.

### What all three share (`src/shared/round2/`, `src/shared/suggestions.ts`)

The variants differ only in how a store's categories sit inline. Everything else is one implementation, so Peter
compares the one thing that differs and the three cannot drift apart.

- **Shell** (`Shell.tsx`). It holds the data (`useGroceries(round2State)`: the round-1 list plus one long name), top
  bar, List/More tabs, snackbar, collapse state and the composer. A variant passes in one `List` component.
- **Store bands** (`StoreBlock.tsx`). These are D's tinted, sticky bands at a smaller size (24 px name, 56 px band). Tap a band to fold the
  store. Folded, it keeps the count ("8 Artikel") and a strip of the items' emoji, and the caret turns. Hold and drag
  the band to reorder stores, and a folded band still takes dropped items. Fold state is a `Set<StoreId>` in
  `sessionStorage` (`fg-r2-collapsed:<variant>`), so it survives a reload but not a new session.
  `useHeaderTap` in `dnd.tsx` swallows the click that ends a hold-drag on the same band. Decision: the band itself is
  the tap target, with no separate chevron button. A whole-band target is easier to hit in a moving cart, and drag
  stays on hold, so the two gestures don't collide.
- **Rows.** Full width with no cards. There are no check circles, which saves 48 px per row horizontally and lets names wrap.
  Each row has a small leading emoji (18 px), a bold `2×` only when the quantity isn't 1, a 19 px name that wraps
  (`overflow-wrap: anywhere`, never truncated), and one muted detail line. Tap strikes the row through and checks it off with
  Undo. Hold-release or right-click opens edit, and hold-move drags.
- **Suggestions** (`suggestionsFor`, 8 vitest cases). The function returns a typed list of `{ key, source, draft }`, where `source` is one
  of `current | typed | history | pack | variant | size | brand | catalog`. The order is the literal parse (Enter takes it), then the household's
  past purchases of the same product, then the product's other packs and kinds, then the neighbouring sizes (Größe 3 gives 4 and 2), then
  other brands, then catalogue products that match the word being typed ("2 Mi" gives "2× Milch"). The list is de-duplicated
  by name, brand and props, with 8 rows at most. "Windeln Pampers Größe 3" gives 8 rows: As typed, Bought before (Größe 4 Big
  Pack), Big Pack, Maxi Pack, Größe 4, Größe 2, Babylove, Huggies. Product knowledge lives in the `PRODUCTS` table
  (`brands` was added next to `variants`), and history is `HISTORY` in the mock data plus anything checked off this session.
- **Composer** (`Composer.tsx`, `useComposer.ts`). The state is one reducer, `{ open, target: add | edit(item), text, storeId?, categoryId?, fold }`.
  The bottom input bar is the add field itself: focusing it opens the sheet, so there is no separate "open" button. From
  top to bottom the sheet holds:
  1. **Fold-out chips** (A-style). `dm ▾` and `👶 Drogerie ▾` show the first suggestion's guess, or "automatisch" before
     typing. Tapping a chip unfolds its options inline below it (`grid-template-rows: 0fr → 1fr`). A pick folds it back and
     applies to whichever suggestion is tapped next. There is no second sheet and no menu. A chip changed by hand gets a
     primary outline. While no store is picked, a row whose own store differs from the chip (e.g. history from Lidl)
     shows a tiny store badge, so a tap never adds somewhere unexpected.
  2. **Suggestions.** C-style two-line rows: emoji, name, then "WHY · brand · details" with what differs from the
     first row in bold. A few rows sit right above the input and many rows scroll. Nothing in the sheet is a non-interactive
     preview, so the round-1 preview card is gone. After an add the input clears, keeps focus, and the list area
     shows "✓ Hinzugefügt: Windeln → Edeka · Rückgängig" until the next keystroke. That replaces the global snackbar while the
     sheet is open, which would otherwise cover the rows nearest the thumb.
  3. **The input**, sticky at the bottom.
- **Edit uses the same sheet** (right-click, or hold and release). The input is prefilled with the item as words
  (`itemToText`: "2x Milch Weihenstephan 1,5 % 1 l"), the chips are preset to the item's store and category, and the first row
  is the item "Unverändert". Changing a chip and pressing Fertig moves the item. Retyping ("3 Gurken Bio") makes the
  parse the first row, and tapping any row replaces the item. Löschen sits in the header. Decision: C's edit had
  labelled fields. Here edit is retyping plus chips, because then add and edit are the same 2-step gesture and the
  parser does the field split. The cost is that correcting one property means editing text. Open question 2.
- **The grow-around-input animation.** There is one surface from near the top to the bottom edge. Closed, it is clipped
  (`clip-path: inset(...)`) to exactly the band behind the input bar and the tabs. Open, the clip lifts to the top with
  rounded corners in 320 ms (M3 emphasized decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)`), and closing reverses it in 250 ms
  (emphasized accelerate). The input is a separate layer that never moves. The tabs slide down and fade under the
  surface. The band they leave carries the Enter hint, which the keyboard covers on a phone. Content fades and rises
  24 px. Clipping instead of resizing means nothing inside reflows during the animation. Under `prefers-reduced-motion`
  every duration is 0. The e2e measures the input's bounding box before and after opening and after closing, within 2 px.

### E · Satz · Zwischenzeilen (`e-satz-zeilen`): inline heading rows

- **Categories.** A slim 32 px heading row inside the store's flow ("🥦 OBST & GEMÜSE ──── 3") that sticks under the
  store band while its rows scroll. The heading is the category's drag handle.
- **Answers.** It is the clearest inline grouping and the closest to A's "headings, not repeated per item". It scans like a
  printed supermarket list.
- **Tradeoff.** It costs one 32 px row per category: about 350 px for the eleven category groups in the mock list (11 × 32 px, computed from the CSS, not measured).
- **Flutter.** `CustomScrollView` with `SliverMainAxisGroup` per store and per category, and pinned `SliverPersistentHeader`s
  for the band (top) and the category heading (pinned under it). Rows are a `SliverList.builder`.

### F · Satz · Etikett (`f-satz-etikett`): tag on the first row

- **Categories.** No heading rows. The first row of each category run carries the category as a small tonal tag on its
  right ("👶 DROGERIE"), capped at 40 % width. Later rows carry nothing. Runs are separated by a 6 px tinted band
  instead of a rule. The tag is the drag handle, and a tap on it is swallowed, so it neither checks nor edits the row.
  While a category is being reordered, each run shrinks to a one-line marker (tag plus count).
- **Answers.** Zero extra rows, so it is the densest of the row layouts, and the category is still a label, not part of the item text.
- **Tradeoff.** The category reads weaker than a heading, and the first row of each run is narrower for its name. A
  nested handle inside a tappable row is a gesture subtlety the Flutter build has to keep (inner `GestureDetector` wins).
- **Flutter.** The same slivers as E without the category header. The tag is a `Positioned`/`Row` trailing `Chip`, and
  the band divider is a `SliverToBoxAdapter(SizedBox(height: 6))` with a tinted `ColoredBox`.

### G · Satz · Fließtext (`g-satz-fliesstext`): each category is a sentence

- **Categories.** Each category is one paragraph. A run-in label ("🥦 OBST & GEMÜSE:") is followed by the items
  inline like words: "🍌 6× Bananen Bio · 🥒 2× Gurken". The line height is about 40 px, so every wrapped line is a thumb target.
  Item details use commas, because " · " separates items. The label is the drag handle. Items are inline boxes, so a long name
  wraps across lines like text.
- **Answers.** It is the most literal "sentence" and the densest overall. A short category takes one line.
- **Tradeoff.** There is no row grid: the eye can't run down a column, tap targets have uneven widths, and a wrapped long item
  is harder to hit precisely. It is the most experimental of the three, like D was in round 1.
- **Flutter.** `Text.rich` cannot carry per-word gestures and drag well. Use a `Wrap` of `LongPressDraggable` word
  widgets, with `RichText` per item for wrapping long names, inside one `DragTarget` per paragraph.

### Round-2 Flutter mapping (shared parts)

- **The sheet growing around the input.** Do not use `showModalBottomSheet`, which slides a new route up from the bottom and
  would move the input. Use a `Stack` in the list `Scaffold`'s body: the input bar is a fixed `Positioned` child, and
  the surface behind it is an `AnimatedContainer` or a `ClipRect` + `Align(heightFactor:)` driven by an
  `AnimationController` (320 ms, `Curves.easeOutCubic` / `Easing.emphasizedDecelerate`) from bar height to full height.
  Hide the `NavigationBar` with an `AnimatedSlide` + `AnimatedOpacity` in the same controller. Honour
  `MediaQuery.disableAnimations`. A `DraggableScrollableSheet` with `snap: true` is the fallback if Peter wants drag-to-resize.
  It changes size rather than clip, so the input must live outside it to stay put.
- **Fold-out chips.** Two `InputChip`s plus an `AnimatedSize` containing a `Wrap` of `ChoiceChip`s.
- **Suggestions.** A `ListView` of `ListTile(isThreeLine: false)` rows. The source label is `Text.rich` in `labelSmall`.
- **Store fold.** A `SliverMainAxisGroup` whose child list is empty when folded. State goes in a `Set<StoreId>` persisted with
  `shared_preferences`, or `PageStorage` for session-only like the prototype.
- **Drag.** As in round 1: hand-rolled `LongPressDraggable` + `DragTarget` rather than `drag_and_drop_lists`. The
  package is two-level (list > item), while we need store > category > item plus folded stores as targets. It also
  lacks the hold-release-to-edit hook. Store and category reordering uses `ReorderableListView` with
  `ReorderableDelayedDragStartListener` on the band and heading (E) or tag (F) or label (G).


### Round-2 decisions taken without asking (reversible)

- Round 2 seeds its own list (`round2State`) with the long name, so the round-1 references render exactly as before.
- Suggestions sit right above the input in reading order (the parse on top, alternatives below), and many rows scroll.
  I rejected reversed order, with the parse nearest the thumb, because the brief says "parse first", and a reversed list reads upside down.
- While the sheet is open, the "added" confirmation sits inline in the empty suggestion area with Undo, instead of the
  global snackbar, which would cover the rows nearest the input.
- Store and category reordering keeps round 1's collision rules. An e2e failure looked like a stale-rect problem in
  `closestCenter`, so I tried pointer-first collision. A probe showed the real cause was the tests pressing elements under the dock, so I
  reverted that change.

## Round 1

## What every direction shares (and why)

- **Data shape** (`src/shared/types.ts`). `ListState = { stores[], categories, layout: storeId -> categoryId[], items[] }`.
  Store order is the array order. Category order is per store, matching SPEC req. 3 ("each store has its own category order").
  An item carries `name` (Bezeichnung), `brand` (Marke), `props[]` (Eigenschaften), `qty` (Menge), `emoji`, `storeId`,
  `categoryId`, `addedBy`, `checked`. Moving an item into a store whose layout lacks its category appends the category
  there, so nothing can become invisible.
- **Parser** (`src/shared/parser.ts`, 27 vitest cases). One pass over whitespace tokens on every keystroke:
  multi-word patterns are joined first ("Größe 3", "4er Pack", "3 Stück", "500 g"), then each token is classified as
  quantity, property, amount, brand (dictionary of ~30), product (~40 products with German and English names, aliases,
  and German compound matching by longest suffix, so "Vollkornbrot" lands in Brot), descriptor (Bio, vegan), or
  part of the name. Product lines ("Cola Zero") stay in the name; container counts ("3 Packungen", "3 packs of",
  "2 Dosen") are quantity; pack facts ("16 Rollen", "3-lagig") are properties. Inflections normalize ("windel" to
  "Windeln"), synonyms keep the user's word ("Klopapier" stays Klopapier, but classifies as Haushalt). Household memory (last store and category per product) beats the dictionary, which beats the
  fallback (Sonstiges, Edeka; Drogerie defaults to dm). `suggest()` returns the parse first, then one-tap variants
  (pack sizes, the alternative diaper brand). The real classifier lives server-side per SPEC req. 2; this mock only
  has to make the UI feel live.
- **Language of data vs. UI.** Properties are stored in canonical German and shown in the UI language
  (`localizeProps`: "Größe 3" to "Size 3", "4er Pack" to "4-pack", "1,5 %" to "1.5 %", "Bio" to "Organic"); English
  typed or edited in EN is stored canonically (`canonicalProps`). Snackbars store a typed message (`added`, `checked`,
  `deleted`) instead of a string, so switching DE/EN re-renders an open snackbar in the new language. Item names stay
  as typed: they are the family's words, not UI.
- **Gesture model** (`src/shared/dnd.tsx`, dnd-kit `MouseSensor` + `TouchSensor`, both `delay: 300ms, tolerance: 8px`):
  - tap = check off (snackbar with Undo, 5 s);
  - press and hold, release without moving = edit (inline, in place);
  - press and hold, then move = drag (items to another category or store; store and category headers reorder);
  - right-click (mouse) = edit; the touch long-press `contextmenu` event is ignored because hold-release owns that case;
  - a quick swipe exceeds the 8 px tolerance before the hold completes, so the list still scrolls on touch.

  Decision: **hold-release edits, hold-move drags**, rather than a drag handle. A handle costs horizontal space on every
  row and is a small target in a moving cart; Apple Reminders' grocery list already teaches press-hold-drag to correct
  a section. The cost is discoverability of edit. Mitigations: a one-time, non-blocking hint banner at the top of every list
  ("Tippen hakt ab · Halten bearbeitet · Halten und ziehen verschiebt", dismissed with "Verstanden"), the footnote, and
  right-click on desktop. The drag
  activates at 300 ms (haptic tick via `navigator.vibrate`); if the pointer is released within 8 px the drag is turned
  into an edit in `onDragEnd`. Clicks are suppressed for 250 ms after any drag so the release never also checks the item.
- **Auto-scroll while dragging.** Holding a dragged item near the top or bottom 8% of the list scrolls it (dnd-kit
  `autoScroll` threshold, down from its 20% default, which scrolled the list away under a thumb aiming at a nearby
  category). The e2e drags across stores in both directions by parking the pointer at the edge, as a thumb would.
- **Inline editors** scroll themselves fully into view when they open (`useRevealOnMount`, `scroll-margin-bottom`
  clears D's floating dock), and the e2e asserts every editor's content stays inside its card and that "Fertig" is
  the element a tap would hit.
- **Reorder mode**. While a store header is dragged, every store collapses to its header; while a category header is
  dragged, that store's categories collapse to headers. Reordering tall sections otherwise means dragging across a
  screen and a half of content.
- **Add flow** (`src/shared/useAddFlow.ts`). Two steps: type, tap a suggestion. The user's inline store/category
  override survives further typing and applies to every suggestion. Tapping a suggestion adds, clears and refocuses the
  input; the sheet stays open for the next item (SPEC req. 1: "Enter adds the item and keeps focus"). Enter adds the
  first suggestion.
- **More tab** (`src/shared/ui/MoreScreen.tsx`). Settings rows, logout, legal, and a mock of Flutter's `LicensePage`
  (app name, version, "Powered by Flutter", package list with license counts, tap for the text).
- **Tokens** (`src/tokens.ts`). Generated at runtime from the app's seed `Color(0xFF2E7D32)` with
  `@material/material-color-utilities` `SchemeTonalSpot`, the same algorithm as `ColorScheme.fromSeed`, exposed as
  `--md-*` CSS variables. Every direction uses only these, plus store brand colors on the tiny store badges.
- **i18n**. German default, DE/EN toggle on the index and in every direction, persisted in localStorage.

## Research

Full notes with URLs: `research/RESEARCH.md`. Sources looked at: Bring! feature pages, AnyList help center
(adding items), Todoist help (Quick Add date recognition), Apple support HT213830 (Reminders grocery lists), Listonic
feature pages, OurGroceries user guide, Material 3 chips/bottom-sheet/list guideline pages (client-rendered, titles
only), Flutter API docs for `InputChip`, `SnackBar`, `showModalBottomSheet`, `ReorderableListView`,
`LongPressDraggable`, and pub.dev for `drag_and_drop_lists`, `reorderables`, `super_drag_and_drop`.

What changed the designs:

- Todoist highlights parsed tokens live and lets one tap reject a token. All directions color or slot the parsed fields
  live; D colors words by field the way Todoist does.
- Apple Reminders corrects a wrong section by press-hold-drag and remembers it. That is our drag model.
- OurGroceries has no undo and offers "hold to cross off" because accidental taps are a complaint. We keep tap (speed)
  and add Undo, plus a short check animation before the item leaves.
- AnyList puts store and category behind a pencil icon before adding, and charges for stores. Our add sheet shows the
  guessed store and category in the preview and makes them editable inline, with no extra screen.
- Bring! is the illustrated-tile precedent (A). Bring! has no structured brand or size; we do, so tiles need room for a
  second line.
- Stores as the top level is a differentiator: Bring! models stores as separate lists, AnyList paywalls stores.

## Directions

Each is a full clickable flow at `#/<folder>`. The four differ in information hierarchy and in how the guessed
store and category are corrected inline in the add sheet. That correction is the part of Peter's brief (2b) with the
most open design space, so each direction tries a different answer.

### A · Regal (`a-grid`): illustrated grid

- **Hierarchy.** Store card > category heading (emoji, label, count) > 3-column tiles. A tile is a big emoji on a
  tonal well (tint fixed per category), the name, brand and properties muted below, a quantity badge only when not 1,
  and an "S" dot for Sam's items.
- **Add.** The preview is one large tile that fills slot by slot (emoji pops in, brand/property chips spring in).
  Store and category are two pill chips under it; tapping one opens an **accordion row right below** (store logos or
  category chips), and picking closes it. Suggestions are four small tiles; the differing property is outlined.
- **Edit.** The tile grows to span the full grid row and becomes an editor card with a quantity stepper; fields
  stack in one column so the card never exceeds a 390 px phone (review 0 found the two-column grid overflowing).
- **Check.** A check draws over the tile, then it shrinks out.
- **Tradeoffs.** Most recognisable at a glance and the friendliest for kids or a partner who scans by picture. Least
  dense: categories with one item leave empty columns, and dm alone fills the first screen. Tile names wrap to two lines before truncating.
- **Flutter.** `SliverGrid`/`GridView.count(crossAxisCount: 3)` per category; `Card.filled` tiles with `Badge.count`;
  accordion via `AnimatedSize`; the full-row editor needs `flutter_staggered_grid_view` (`StaggeredGridTile.fit(crossAxisCellCount: 3)`).

### B · Zettel (`b-paper`): classic paper list

- **Hierarchy.** One ruled line per item on a white "sheet" with a margin line: check circle, 15 px emoji, **name** with
  brand · properties inline in muted text (wraps to a second line only when needed), Sam dot, quantity right-aligned in
  tabular figures (`2×`, `500 g`). Category labels are small caps. Densest: about 12 items per screen.
- **Add.** The preview is the exact list row plus a six-slot breakdown (Bezeichnung, Marke, Eigenschaften, Menge, Laden,
  Kategorie) that shows the parse. Store and category are **two always-visible horizontal chip rails**: zero taps to see
  the options, one tap to change. Tapping the store/category slot highlights its rail. Suggestion rows emphasise the
  differing property and show a `↵` hint on the first.
- **Edit.** The row turns into an inline form (fields in a grid plus the same rails), outlined in primary.
- **Check.** The circle fills, the name strikes through, the row fades; checked items collect in "Erledigt" at the
  bottom, where a tap restores them.
- **Tradeoffs.** Fastest to scan and check in the aisle, closest to the paper list families already use. Plain: it wins
  on speed, not on delight. Rails cost vertical space in the sheet even when the guess is right.
- **Flutter.** `ListView` of `ListTile(dense)`-like rows (custom `Row`, `FontFeature.tabularFigures()`); rails are
  horizontal `ListView`s of `ChoiceChip`; margin line via a `CustomPaint` or `DecoratedBox` on the sheet.

### C · Karten (`c-cards`): compact cards

- **Hierarchy.** Sticky store jump bar (chips with counts; tap scrolls, the current store highlights) > store header >
  one rounded card per category > two-line rows: 32 px emoji circle, name, line 2 = brand · properties · "von Sam",
  quantity pill only when not 1. Calm Google Tasks/Keep feel.
- **Add.** The preview is the same row in a card with two small outlined tokens `dm ▾` and `👶 Drogerie ▾`. Tapping a
  token **morphs line 2 in place** into a horizontally scrolling segmented row of options; picking morphs back. A token
  changed by hand gets a primary outline. Suggestions are full-width rows with the difference in bold.
- **Edit.** The row expands inside its card; the rest of the list dims. Changes commit on Fertig, so the item does not
  jump sections mid-edit.
- **Check.** The emoji circle becomes a filled check while a strike draws across the name.
- **Tradeoffs.** Good balance of density and structure; the jump bar makes "what's left at Lidl" one tap. Cards add
  chrome, and the two-line row is taller than B's line.
- **Flutter.** `Card.filled` with `ListTile`s and `Divider(indent: 60)`; `CircleAvatar`; jump bar as a pinned
  `SliverPersistentHeader` with `FilterChip`s and `Scrollable.ensureVisible`; picker swap with `AnimatedSwitcher`
  around a `SegmentedButton` in a horizontal scroll view.

### D · Satz (`d-sentence`): bold, thumb-first, experimental

- **Hierarchy.** Full-bleed sticky store bands in the store's colour (28 px name, big count). A sticky left gutter shows
  the category emoji large; items on the right lead with a bold quantity numeral (`2×`), then a 19 px name, then one
  muted detail line. The add bar is docked at the bottom above the tabs, in the thumb zone.
- **Add.** The preview is a **sentence** that assembles itself: "1× Windeln von Pampers, Größe 3, Standard Pack · bei
  [dm] · in [👶 Drogerie]". Words are tinted by field, the way Todoist highlights parsed dates. Store and category are
  pills that **tap-cycle** to the next option with a slide, and while cycling a slim rail of all options appears under
  the sentence for a direct jump. Suggestions are pills naming only the difference ("+ Big Pack", "+ Babylove").
- **Edit.** The row becomes the same sentence in place, with editable words. A small legend under the add
  preview (2× Menge, Name, Marke, Eigenschaften) explains the field tints, so the property underline doesn't read as a link.
- **Tradeoffs.** Most distinctive and the most legible in a moving cart; teaches the parser's model by showing it as
  language. About 8 rows per screen. Tap-cycling is blind for far-away categories (the rail covers that). Sentence
  grammar must be localised carefully (DE/EN differ in word order).
- **Flutter.** `CustomScrollView` with `SliverMainAxisGroup` per store and a pinned `SliverPersistentHeader` band;
  the sentence is `Text.rich` with `TextSpan`s per field and `WidgetSpan(ActionChip)` pills in an `AnimatedSwitcher`;
  suggestions a `Wrap` of `FilledButton.tonal`.

### Recommendation

Build **C's structure with B's row density and D's sentence preview**. C's store jump bar and per-category cards
make the store > category hierarchy legible. B's single-line row is the fastest to check off. D's sentence is the
clearest live parse, and its bottom-docked add bar puts capture in the thumb zone. For the store/category correction,
B's always-visible rails need no extra tap, and C's morph-in-place keeps the sheet short. Peter should try both on a
phone (open question 4).

## Flutter mapping (all directions)

- Tabs: `NavigationBar` with two `NavigationDestination`s inside a `Scaffold`.
- Add bar: a read-only `TextField`-looking `InkWell` that calls `showModalBottomSheet(isScrollControlled: true,
  useSafeArea: true, showDragHandle: true)`; the sheet is a `Column` with an autofocused `TextField` on top and a
  `ListView` body. Parsing runs in `onChanged` (pure Dart port of `parser.ts`, same tests as table-driven `test()`s).
- Inline pickers: `ChoiceChip`s in a horizontal `ListView` (rails) or an `AnimatedSize` + `AnimatedSwitcher` for the
  expand-in-place variants. No second sheet, no `PopupMenuButton`.
- Snackbar: `ScaffoldMessenger.of(context)..clearSnackBars()..showSnackBar(SnackBar(action: SnackBarAction(label: 'Rückgängig')))`.
- Edit: the item widget swaps to an editor via `AnimatedSwitcher`/`AnimatedSize` in place, keyed by item id.
- Right-click: `GestureDetector(onSecondaryTap: ...)` on web/desktop.
- Drag: two candidates, see open questions. `drag_and_drop_lists` matches store > category > item only if one level is
  flattened (it is two-level). A hand-rolled `LongPressDraggable<Item>` (with `delay: 300ms`, `hapticFeedbackOnStart`)
  plus `DragTarget<Item>` per category gives the hold-release = edit trick: `onDragEnd` with an offset under 8 px calls
  edit, `onDraggableCanceled` likewise. Stores and categories reorder with `ReorderableListView.builder(buildDefaultDragHandles: false)`
  plus `ReorderableDelayedDragStartListener` on the header, collapsing children while `onReorderStart` is active
  (Flutter 3.13+ has `onReorderStart`/`onReorderEnd`). Auto-scroll near edges: `Scrollable.ensureVisible` or a ticker
  in `onDragUpdate`; `drag_and_drop_lists` has it built in.

## Review 0 follow-up (2026-10-24)

Fixed: A's editor overflow, stale German snackbar after switching to EN, missing cross-store drag coverage (now
mouse and touch, both directions with auto-scroll), missing touch e2e (a `touch` Playwright project with
`hasTouch`/`isMobile` driving CDP touch events), editor actions hidden under the dock, parser edge cases, German
properties in EN, B's truncating slots and sheet height, A's one-line tile names, D's gutter label under the band and
unexplained underline, and the cold-start discoverability of hold-to-edit (hint banner). Touch is still synthetic:
CDP touch events in headless Chromium, never a real phone browser.

## Open questions

1. Is hold-release-to-edit discoverable enough, or does Peter want a visible affordance (a trailing "⋯" or a swipe)?
2. `drag_and_drop_lists` (ready-made, about two years since last publish) or hand-rolled `LongPressDraggable` +
   `DragTarget` (full control, we own auto-scroll)? Recommendation: hand-roll; the gesture model above needs the
   hold-release hook that the package does not expose.
3. Should checked items vanish (A, C, D: gone with Undo; B also keeps an "Erledigt" list) or stay struck through at the bottom
   of their category until the trip ends?
4. Inline store/category correction: always-visible rails (B), accordion (A), morph in place (C), or tap-cycle (D)?
   They tie on taps for the common case; the difference is sheet height versus discoverability.
5. Should the add bar live at the bottom (C, D; thumb zone) or top (B; SPEC req. 1 says the list stays visible)?
