# Design H "Satz · Laufweg": build spec

Peter approved design variant H on 2026-10-24. Jobs 15, 16 and 17 build it in the Flutter app, and their reviewers check against this file. It has four parts:

1. Peter's decisions, verbatim. They win over everything else.
2. What the prototype shows that the decisions don't cover: layout, type, colour, motion, and where the app deliberately differs from the prototype.
3. The interfaces job 15 ships for jobs 16 and 17.
4. The interfaces job 16 ships for job 17.

Reference material in this folder:

- `sandbox-src/shots/h-satz-final-*.png` holds the prototype's own screenshots at 390×844 (DPR 2): `list`, `list-collapsed` (dm and Edeka folded), `add` ("Spülmittel", 2 suggestions), `add-grown` ("Windeln Pampers Größe 3", full height) and `edit` (Milch).
- `shots/h-*.png` holds the same views retaken from the anonymised build.
- `h-dist/` is the clickable build. Run `python3 -m http.server 55081 --directory docs/design/h-satz-final/h-dist` and open `#/h-satz-final`.
- `sandbox-src/src/prototypes/h-satz-final/` and `sandbox-src/src/shared/` are the React source. Read them for detail, but don't port the code.
- `design-job-round3/` holds Peter's round-2 feedback (`feedback.md`) and the round-3 review (`review.md`).

## 1. Peter's decisions (verbatim, all three jobs)

- List: stores are top-level sections. They are plain dividers that scroll away (NOT sticky): store badge, name, a line in the store colour, and the item count. Stores collapse. A collapsed store shows only its name and the count, with no item icons. The collapsed state is persisted, and items can still be dropped onto a collapsed store. Stores can be reordered by drag and drop. Categories are small, faded inline dividers, also not sticky, with no tags. Each category stays ONE block within its store. Items follow the store walk order. Drag and drop moves an item before or after a row, or into another category or store, and the order is persisted. Rows are full width with small leading icons. There are no check circles, no cards, and long names wrap in full. One tap checks an item off, with an Undo snackbar. Long-press (right-click on web) opens edit. NO added-by initial or badge on rows; keep who-added-it (added_by) in the database. The "N neu von Lea" new-since-last-visit highlight from job 8 stays unless it conflicts with the design. If it does, record the conflict in docs/NEEDS_PETER.md and keep it working; don't decide.
- Add: the input sits at the bottom for thumb reach. Typing opens a sheet that grows upward around the input, which stays in place, and the bottom tabs hide while it's open. The sheet SHRINKS TO FIT its content. It's at most about 50% of the screen at first, grows as suggestions arrive, and scrolls only at full height. Layout from top to bottom: store and category chips that fold out options when tapped, then a scrollable list of suggestions where EVERY suggestion is tappable (the parsed one first, then alternatives from history and the catalogue), then the sticky input. It's two steps: type, then tap a suggestion. The parser fills Bezeichnung, Marke, Eigenschaften, Menge and Laden ("Windeln Pampers Größe 3" → Bezeichnung Windeln, Marke Pampers, Eigenschaften Größe 3, Laden dm via item→store memory or the classifier).
- Edit: separate prefilled fields: Bezeichnung, Marke, Eigenschaften, and Menge with −/+. Store and category chips. Löschen and Fertig at the bottom. The sheet is exactly as tall as its content. Fertig saves only what changed.
- Tap targets are at least 44 px, except the category divider, which stays quiet.
- The temporary explainer card at the top is kept and can be dismissed. Spotlight onboarding comes later; don't build it.
- App shell: two tabs, "List" and "More". More holds settings, logout and legal, including Flutter's licenses page (showLicensePage).
- Localization: German and English from the start (app/l10n/app_de.arb and app_en.arb).
- iPad support stays. Wide layouts must use the space properly, not stretch a phone layout.
- The sheet animation should be smooth. Use a spring where Flutter makes that cheap.

## 2. What the prototype adds

Sizes are CSS pixels at a 390×844 phone, which map 1:1 to Flutter logical pixels. The prototype's colours are Material 3 roles from the same seed and algorithm the app uses: `ThemeData(colorSchemeSeed: Color(0xFF2E7D32))`, which gives the tonal-spot scheme. Every colour below is therefore a `ColorScheme` role name. The only fixed colours are the store badges.

### 2.1 Where the app deliberately differs from the prototype

Build the left column, not the right.

| Topic | App (decided) | Prototype |
| --- | --- | --- |
| Add sheet height | Shrinks to fit its content and is at most about 50 % of the screen at first. It grows with the suggestions up to full height and scrolls only there. Peter decided round-3 open question 2. | A 50 % minimum (`--hc-min: 50%`), which leaves about 150 px of empty sheet with 1 or 2 suggestions. |
| Categories in a store | Each category is one contiguous block in its store and never repeats. Items are in walk order inside it. This is the prototype's behaviour, decided as open question 1. | Same. |
| Added-by on rows | No initial and no badge. `added_by` stays in the database, and "N neu von Lea" stays. This is the prototype's behaviour, decided as open question 3. | Same, no badge. |
| Store fold state | Persisted across app restarts, per household on the device. | `sessionStorage`, lost with the tab. |
| Header title | The household name, or "Hummlist" when there is none. Never "Familieneinkauf" or "Family Groceries". | "FAMILIENEINKAUF" / "Family Groceries". |
| Language toggle and back link | Not in the header. Language is a setting under More (job 17). | A DE/EN pill and a "‹" link back to the index in the header. |
| Data | Real household data through Supabase. Brand, properties and walk order are real columns (part 3). The parser is server-side (part 3). | Mock data and a client-side mock parser with about 40 products. |
| Edit category chip | The household's categories, in route order. The chip leads with a generic category icon (`Icons.category_outlined`), because the app's categories carry no emoji of their own. The seeded "👶 Drogerie" has its emoji in the name, so that chip shows both. The add sheet (job 17) reuses `FoldoutChips` and inherits this; give categories their own emoji first if the prototype's look is wanted. | Each category's own emoji in the chip and the options. |

### 2.2 Screen layout (phone)

From top to bottom on the List tab:

1. **Header.** Padding is `safe top + 6`, 14 right, 8 bottom and 8 left, with a 1 px `outlineVariant` bottom border.
   - Title line: 13 px, weight 800, letter-spacing 0.08em, uppercase, `primary`.
   - Under it, the open-item count "15 Artikel" at 13 px in `onSurfaceVariant`.
2. **Scroll area.** One vertical scroll with nothing pinned. Its bottom padding is the bottom band plus 72 px, so the last row clears the input.
   - The explainer card is first.
   - Then the stores in household order.
   - The empty state is "🧺" at 56 px over the text at 22 px, weight 700, centred in `onSurfaceVariant`, with 80 px vertical and 32 px horizontal padding.
3. **Input bar.** It is 72 px tall and sits directly above the tabs, with a 12 px side margin.
4. **Tabs.** They are 62 px plus the safe-area bottom.

The bottom band (input plus tabs) is 134 px plus the safe-area bottom. The More tab shows only the tabs.

### 2.3 Store divider

- **Row.** Min height 52 px. Padding is 6 px top and bottom, 12 px right and 16 px left. Gap 10 px, radius 12 px. The whole row is the tap target: a tap folds or unfolds, and press-and-hold drags to reorder.
- **Contents, left to right:**
  - `StoreBadge` at 24 px
  - the store name at 20 px, weight 800, letter-spacing −0.015em, no wrap
  - a rule that fills the space: 2 px high, radius 1, in the store tint, at least 12 px wide
  - the count: the number at 17 px, weight 800, tabular figures, `onSurface`, then " Artikel" at 14 px, weight 600, `onSurfaceVariant`
  - a caret: an 8 px chevron drawn with 2 px strokes in `onSurfaceVariant`, pointing down when open and right when folded, rotating over 220 ms ease
- **Spacing.** There are 20 px of air above every store except the first. A folded store followed by another store leaves only 2 px, so folded stores stack like an index.
- **Folded.** Only the divider shows, with no rows, no category dividers and no emoji strip. A folded store still accepts dropped items.
- **Drop hover.** While an item hovers the store, the divider background is the store tint at 16 % over `surface`, with a 2 px inset ring in the store tint.
- **While dragging.** A dragged store is at 0.6 opacity. While any store is dragged, every store shows only its divider.
- **Semantics.** The label is "<name>, <n> Artikel. Aufklappen/Zuklappen". Expose the expanded state.

### 2.4 Category divider

- **Size.** 32 px tall. Padding is 0 16 px 0 20 px, gap 10 px. This is the one target allowed under 44 px. Make the drag hit area taller with transparent padding if that keeps the line quiet.
- **Text.** 11.5 px, weight 700, letter-spacing 0.09em, uppercase, no wrap. The colour is `onSurfaceVariant` blended 75 % over `surface`, so it reads faded.
- **Rule.** A 1 px hairline in `outlineVariant` that fills the remaining width.
- **Leaves out.** No emoji, no count, no tag, no fill, not sticky.
- **Behaviour.** It is the handle for reordering categories inside its store (press and hold). While an item hovers it, the text and the rule turn `primary`. A dragged category is at 0.5 opacity. While a category is dragged, its siblings in the same store show only their dividers.

### 2.5 Item row

- **Row.** Full width, min height 52 px, aligned to the top. Padding is 12 px top, 16 px right, 11 px bottom and 20 px left, gap 12 px. There is a 1 px `outlineVariant` bottom border, except on the last row of a category.
- **Icon.** The leading emoji at 18 px in a 22 px wide box, line height 26 px.
- **Name line.**
  - 19 px, weight 650, line height 26 px, letter-spacing −0.01em.
  - It wraps in full (break anywhere if needed) and is never ellipsised.
  - When the quantity isn't 1, a quantity prefix comes before the name: a count shows as "6×", any other quantity as typed ("500 g"). It is weight 900 in `primary` with tabular figures and a 6 px right margin.
- **Second line.** Only shown when set: brand and properties joined with " · " ("Babylove · 4er Pack"), 14 px, line height 1.3, `onSurfaceVariant`.
- **Leaves out.** No check circle, no card, no added-by badge. Pressed, the row turns `surfaceContainer`.
- **Gestures.**
  - A tap ticks the item.
  - Press for 300 ms and release within 8 px opens edit. A right click with a mouse does the same.
  - Press and then move more than 8 px drags. A quick swipe passes 8 px before the hold completes, so the list still scrolls.
  - The click that ends a drag is swallowed for 250 ms.
- **Tick animation.** The row goes to 0.35 opacity on `primaryContainer`. A 2.5 px `primary` strike line grows from left to right across the name over 200 ms ease. The tick commits after 260 ms, then the Undo snackbar shows.
- **Drag.**
  - The dragged row stays in place at 0.3 opacity.
  - The overlay is a pill: emoji, quantity and name at 18 px, weight 650, padding 10 by 16 px, radius 24, `surfaceContainerLowest`, elevation 3, at most 320 px wide.
  - A 3 px `primary` insertion line, radius 2, 12 px in from each side, sits at the top or bottom edge of the hovered row. Which edge depends on the pointer against the row's half height.
  - Edge auto-scroll starts in the outer 8 % of the list only.
- **New from the partner (job 8, not in the prototype).** Keep the `tertiaryContainer` tint and the "Neu" semantics on unseen partner rows. It adds no glyph to the row, so it doesn't conflict with "no badge".

### 2.6 Explainer card

- **Box.** A margin of 8 by 12 px. Padding is 8 px right and 14 px left, with 8 px top and bottom. Radius 12. `tertiaryContainer` background, `onTertiaryContainer` text at 13 px, line height 1.35.
- **Contents.** "👆", then "Tippen hakt ab · Halten bearbeitet · Halten und ziehen verschiebt" (since job 29c "Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt": the swipe edits), then a "Verstanden" text button: min height 36 px, radius 18, weight 700.
- **Behaviour.** It sits in the list flow, not as an overlay. Dismissing it is persisted.

### 2.7 Bottom composer: input bar, tabs, sheet

The surface is one sheet behind the input. Closed, it is exactly the bottom band: `surfaceContainerLow` with a 1 px `outlineVariant` top line. Open, it grows upwards around the input to the height its content needs, with a 28 px top radius. It is never more than the screen height minus the safe top minus 28 px. The input is its own layer and never moves: it stays within 2 px open, grown, full or closed.

- **Input bar.**
  - The field is 48 px high at 18 px. Its placeholder is "Was brauchst du?" in `onSurfaceVariant`.
  - The bar's pill is inset 10 px top and bottom, with a 2 px `primary` border, radius 26, on `surfaceContainerLowest`.
  - Leading disc: 38 px, `primary` with "+" in `onPrimary` at 24 px. While the sheet is open it shows the first suggestion's emoji on `secondaryContainer`. It pops in from 0.6 scale over 220 ms.
  - With text in the open sheet, a 44 px "✕" clear button shows.
  - Enter takes the first suggestion.
- **Tabs.** "Liste" 🛒 and "Mehr" ☰, each half the width.
  - The label is 13 px, weight 700.
  - The icon sits in a 56×28 pill, radius 14. The active tab's pill is `secondaryContainer` and its label is `onSurface`. The inactive label is `onSurfaceVariant`.
  - While the sheet is open, the tabs slide down by their own height and fade out, and they are not focusable. The band they leave shows a hint at 13 px in `onSurfaceVariant`: "Antippen fügt hinzu · ↵ nimmt den ersten Vorschlag" for add, "Gespeichert wird nur, was du änderst" for edit.
- **Scrim.** Black at 40 %. A tap on it, Escape, "Schließen" or "Abbrechen" closes the sheet.
- **Sheet header.**
  - A 32×4 grab handle in `outlineVariant`, 7 px from the top.
  - The title at 15 px, weight 700, `onSurfaceVariant`: "Hinzufügen" for add, "Bearbeiten: <name>" for edit. Let a long edit title wrap to two lines instead of ellipsising (review note 4).
  - A text button on the right: "Schließen" for add, "Abbrechen" for edit. Min height 44 px, radius 22, 15 px, weight 700, `primary`.
  - Padding is 16 px top, 8 px right and 20 px left.
- **Chips.** These are the store chip and the category chip, in a wrapping row with an 8 px gap and 8 px top, 12 px sides and 10 px bottom padding, closed off by a 1 px `outlineVariant` line.
  - Chip: min height 44 px, padding 0 14 px 0 12 px, radius 22, a 1 px `outline` border on `surfaceContainerLowest`, 15 px, weight 600.
  - Contents, left to right: the store badge at 20 px (or 🏬) or the category emoji (or 🗂️), the label, and a "▾" caret at 11 px that rotates 180° when open.
  - When the value differs from the guess or the original, the border is `primary` with a 1 px inset ring. Open, the chip is `secondaryContainer` with `onSecondaryContainer` text and no border.
  - Tapping a chip unfolds its options inline below the chips, over 240 ms emphasized-decelerate. The options wrap with a 6 px gap and 10 px above them. Each option is 44 px high with padding 0 14 px 0 10 px, radius 8, `surfaceContainerHigh`, 15 px, weight 600. A store option carries its badge at 22 px. The selected option is `primary` with `onPrimary` text. Picking an option folds the chips back.
  - The chip labels before anything is picked are "Laden: automatisch" and "Kategorie: automatisch".
- **Suggestions (add).**
  - The rows are top-aligned under the chips and are all buttons.
  - A row is min 60 px high, with padding 8 by 16 px, gap 12 px and a 1 px `outlineVariant` bottom border.
  - Contents: the emoji at 20 px in a 24 px box; the name at 18 px, weight 650, line height 1.2, wrapping, with the quantity prefix in `primary` at weight 900; and a second line at 14 px in `onSurfaceVariant`.
  - The second line starts with the source label at 13 px, weight 700, in `tertiary`. Then come " · Marke · Eigenschaft …", with each part that differs from the first row in bold `primary`.
  - The first row has a `secondaryContainer` background and a trailing "↵" key cap: 32×28, a 1 px `outline` border with a 2 px bottom, radius 6.
  - When no store chip is picked, a row whose store differs from the chip's store shows that store's badge at 20 px.
  - The source labels are: Wie getippt, Schon mal gekauft, Andere Packung, Andere Sorte, Andere Größe, Andere Marke, Aus dem Katalog.
  - After an add, the list area shows "✓ Hinzugefügt: <name> → <store>" at 16 px with an inline "Rückgängig" until the next keystroke. While the sheet is open it replaces the global snackbar.
- **Edit fields.**
  - The column has a 10 px gap and padding of 6 px top, 16 px sides and 12 px bottom.
  - Each label sits above its field at 13 px, weight 700, `onSurfaceVariant`, with 4 px left padding and a 4 px gap to the field.
  - A field is 48 px high with 12 px horizontal padding, a 1 px `outline` border, radius 8, on `surfaceContainerLowest`, at 18 px. Focused, the border is `primary` with a 1 px inset ring. Placeholders are at 70 % opacity.
  - The layout, top to bottom: Bezeichnung at full width in weight 650. Then a row with a 10 px gap holding Marke (flexible, placeholder "ohne Marke") and Menge (72 px, centred, tabular). Then the steppers − and +: 44×48, radius 8, `surfaceContainerHigh`, 22 px, weight 600, with − disabled at 1 and shown at 38 % opacity. Then Eigenschaften at full width, placeholder "z. B. Bio, 1 l". Then the chips.
  - Löschen and Fertig sit in the input bar's place, at opposite ends.
    - Löschen is a text button at 17 px in `error`, min height 52 px.
    - Fertig is filled `primary`, min 132×52, radius 26, at 17 px, weight 700. It is disabled while the name is empty, shown as `onSurface` at 12 % with text at 38 %.
- **Properties text.** It is one field, joined with ", ". It splits on ", " (a comma and a space), "·" or ";", so "1,5 %" stays one property.

### 2.8 Motion

| What | Duration | Curve |
| --- | --- | --- |
| Sheet opening and growing | 280 ms | `cubic-bezier(0.05, 0.7, 0.1, 1)`, which is M3 emphasized decelerate (`Easing.emphasizedDecelerate`). A critically damped spring with a similar settle time is fine, and Peter prefers one where cheap. |
| Sheet closing | 280 ms | `cubic-bezier(0.3, 0, 0.8, 0.15)`, which is M3 emphasized accelerate (`Easing.emphasizedAccelerate`). |
| Sheet content | 180 ms ease-out after 40 ms when opening, 120 ms ease-in when closing | The content stays rendered while the sheet shrinks back, then clears 40 ms after the sheet settles. |
| Tabs | 280 ms slide, 150 to 200 ms fade | Same curves as the sheet. |
| Hint in the tab band | 200 ms fade after 150 ms | ease |
| Scrim | 280 ms | Same curves as the sheet. |
| Chip fold-out | 240 ms | emphasized decelerate. The caret turns over 200 ms ease. |
| Store caret | 220 ms | ease |
| Tick strike line, row fade | 200 ms and 240 ms, commit at 260 ms | ease |
| Hover colours | 120 ms | ease |
| Disc and "added" note pop | 220 ms, from scale 0.6 | emphasized decelerate |

Reduced motion (`MediaQuery.disableAnimations`) sets every duration to 0. The review flagged that animating height reflows the sheet each frame. In Flutter, animate the sheet surface's size (for example `AnimatedSize`, or a height tween on one `SizedBox`) over content that has already been laid out. Don't relayout the suggestion rows per frame.

### 2.9 Store badges and tints

The badge is a rounded square with radius 6, a 1 px inset ring in black at 8 %, the label at 0.48 × its size and weight 800, letter-spacing −0.03em. Sizes are 24 px on the store divider, 20 px in a chip or on a suggestion row, and 22 px in the store options.

| Store (`stores.seed_key`) | Background | Label colour | Label |
| --- | --- | --- | --- |
| `dm` | `#ffffff` | `#d6001c` | dm |
| `edeka` | `#1d4ea3` | `#ffd400` | E |
| `lidl` | `#0050aa` | `#fff000` | L |
| `rewe` | `#cc071e` | `#ffffff` | R |
| `aldi` | `#00005f` | `#ff9a00` | A |

A store the household created has no seed key. It gets the first letter of its name on a colour picked deterministically from the name. The store tint, used for the divider rule and the drop hover, is the badge background, or the label colour when the background is white (dm).

### 2.10 Type and shape scale

The font is the platform system font: the Material default on Android and web, San Francisco on iOS. There are no web fonts.

| Use | Size, weight |
| --- | --- |
| Store name | 20 px, 800 |
| Item name | 19 px, 650 |
| Suggestion name, edit fields, input | 18 px (suggestion name 650) |
| Store count number | 17 px, 800 |
| Edit buttons | 17 px, 700 |
| Chips, options, sheet title, text buttons | 15 px, 600 or 700 |
| Second lines, store count word | 14 px, 400 or 600 |
| Header title, tabs, field labels, hint | 13 px, 700 or 800 |
| Category divider | 11.5 px, 700, uppercase, letter-spacing 0.09em |

Radii are 4, 8, 12, 16 and 28 px (xs to xl): 8 for fields, steppers and options, 12 for the store divider and the explainer card, 22 for chips and text buttons, 26 for the input pill and Fertig, and 28 for the sheet's top corners. Spacing steps are 4, 8, 12, 16 and 24 px. Elevation 3, used for the drag overlay and the snackbar, is `0 4px 8px 3px` black at 12 % plus `0 1px 3px` black at 20 %.

### 2.11 Snackbar

The snackbar floats 12 px from each side and sits above the bottom band: 144 px up on the List tab, 72 px on More. It has min height 48, radius 8, `inverseSurface` with `inverseOnSurface` text at 14 px on one line, and elevation 3. The action, "Rückgängig", is 14 px, weight 600, in `inversePrimary`. Texts: "<name> abgehakt", "<name> gelöscht", "Hinzugefügt: <name> → <store>".

### 2.12 Icons

Item and category icons are emoji, as in the app. The divider caret and the chip carets are drawn chevrons or "▾". The tabs use 🛒 and ☰, the clear button "✕", the add disc "+", and the Enter hint "↵". Flutter may use the Material equivalents (`Icons.expand_more`, `Icons.shopping_cart_outlined`, `Icons.menu`, `Icons.close`, `Icons.add`, `Icons.keyboard_return`) at the same sizes, as long as each one sits where the prototype puts it.

### 2.13 Wide layouts

The prototype is phone-only. Peter's iPad decision applies, and job 16 and job 17 own the details:

- From 840 px wide, the store sections go in two independent columns, and from 1200 px in three. A store never splits across columns.
- Between 600 and 840 px, the list is one centred column with a maximum width.
- The add sheet is limited to about 640 px wide and aligns with the list column.
- From 840 px, the app uses a `NavigationRail`.

## 3. Interfaces job 15 ships (for jobs 16 and 17)

### Item columns (`public.items`)

| Column | Type | Rule |
| --- | --- | --- |
| `brand` | `text`, nullable | Marke. Trimmed, empty becomes null, at most 60 characters. |
| `properties` | `text`, nullable | Eigenschaften as one string, parts joined with `", "` (e.g. `"Größe 3, Standard Pack"`, `"1,5 %"`). Trimmed, empty becomes null, at most 120 characters. |
| `sort_key` | `double precision`, nullable on write, always set after | Walk order inside one group. A group is `(household_id, store_id, category_id)` with a null `store_id` as its own group. Lower comes first. Ties break by `created_at`, then `id`. |

The items trigger fills `sort_key`:

- On insert without a `sort_key`, the item goes to the end of its group (`max + 1024`).
- On an update that changes `store_id` or `category_id` but not `sort_key` (a plain edit), the item goes to the end of its new group. An update that sets `sort_key` to null goes to the end too.
- "The end" counts bought items as well, so an unticked item never collides with a newer one.
- A write that sets `sort_key` keeps it.
- Ticking and unticking leave `sort_key` alone, so Undo puts the item back where it was.

`added_by` is unchanged.

### RPCs

All of them are members only and raise `42501 not_a_member` otherwise. An item the caller cannot see raises `P0002 item_not_found`. They are in `supabase/migrations/20261025212052_item_details.sql`.

- `public.place_item(p_item uuid, p_anchor uuid, p_edge text) returns public.items`
  puts `p_item` directly before (`p_edge = 'before'`) or after (`'after'`) the active item `p_anchor`. A bad edge raises `22023 invalid_edge`. An anchor that is the item itself or is bought raises `22023 invalid_anchor`. The item takes the anchor's `store_id` and `category_id`. Only this row changes, unless the gap to the neighbour falls under 0.001. In that case the group's keys are renumbered (step 1024) in the same transaction first.
- `public.move_item(p_item uuid, p_store uuid, p_category uuid) returns public.items`
  puts the item at the end of group `(p_store, p_category)`. A null `p_store` means no store (the "Ohne Laden" section). A null `p_category` keeps the item's category. Use it for a drop on a category divider or on a store divider.
- `public.reorder_stores(p_household uuid, p_ids uuid[]) returns void`
  takes every store of the household exactly once, in the new order, and sets `stores.sort_order` to 10, 20, 30 and so on. It raises `22023` on anything that is not a permutation.
- `public.parse_item(p_household uuid, p_text text)` is the parser (see below). It returns one row `(name text, brand text, properties text, quantity text, store_id uuid, category_id uuid)`. A blank text gives `name = ''`.
- `public.add_item(p_household uuid, p_text text, p_store uuid default null, p_brand text default null, p_properties text default null, p_quantity text default null) returns setof public.items`
  is the server add path for MCP and Siri. It parses `p_text`, and every explicit argument replaces the parsed value. It returns the existing active row instead of inserting when the same item (name, brand and properties) is already on the list. `public.add_items(p_household, p_names text[], p_store)` keeps its signature and calls it per entry.

Learning stays in the triggers, so every path learns the same way:

- A category change (edit, `move_item`, `place_item`, MCP) feeds `category_memory`.
- A store change feeds `item_store_memory`.
- A brand the parser does not know, written on any item, feeds `household_brands`, unless it is an ordinary word (see the parser's Marke row).

### The parser (one implementation: `public.parse_item`)

It splits one entry into Bezeichnung (`name`), Marke (`brand`), Eigenschaften (`properties`), Menge (`quantity`) and Laden (`store_id`), plus the category the classifier picks for the name.

| Field | Rule |
| --- | --- |
| Menge | A leading count or amount (`2`, `2x`, `zwei`, `2 l`, `500 g`, `3 Packungen`, `3 Paar` (the counting nouns Paar, Dutzend, Laib and Kopf are units, as in the voice splitter), `1/2` from "ein halbes", `0,5 Kilo` from "ein halbes Kilo", `1,5 Liter` from "anderthalb Liter"), else the first amount with a unit wherever it stands (`Äpfel 1 kg bio` and `1 kg Mehl` both give `1 kg`; a glued `0,5l` is written `0,5 l`), else a count anywhere (`Spülmittel Pril 2x` gives `2`). Any further amount becomes a property (`2x Cola 0,5 l` gives Menge 2 and property `0,5 l`). Rolls at the end are a property (`16 Rollen`). |
| Marke | The longest run of 1 to 3 words that matches a known brand: the seeded `public.brands` (`supabase/classifier/brands.tsv`) or the household's learned `public.household_brands`. Matching ignores case, umlauts, spaces, dots and hyphens (`Coca Cola` = `Coca-Cola`). A text that is only a brand keeps the brand as its name, unless the brand names a product (`Pampers` gives Windeln + Pampers). When the brand names a product, what is left of the name is the variety if the dictionary knows none of it, or if it is one word of another kind than the product. The kinds are food, drinks and non-food (household and drugstore). The variety becomes the first property and the product the name: `Whiskas Lachs` gives Katzenfutter + Whiskas + Lachs, `Persil Color` gives Waschmittel + Persil + Color, and `Pampers Baby Dry` gives Windeln + Pampers + Baby Dry. Otherwise the word stays the name: `Pampers Feuchttücher`, `Zewa Feuchttücher` and `Krombacher Radler` keep theirs. A word the list already knows is never learned as a brand: a classifier term, a descriptor, a number, a number word or a unit (`public.is_ordinary_text`). The item keeps it as its Marke. A learned brand like that, from before its word reached the dictionary, is passed over. |
| Eigenschaften | Size (`Größe 3`, `Gr. 4`, `Größe 5+`, `Größe M`, `Größe XL`), multipacks as one property written `6x1,5 l` (from `6x1,5l`, `6 x 1,5 l`, `6×1,5 l`, `4x125g`), packs (`4er Pack`, `6er`, `Big Pack`, `Maxi Pack`), fat and alcohol percentages (`1,5 %`), rolls and plies (`16 Rollen`, `3-lagig`), descriptor words (`bio`, `laktosefrei`, `glutenfrei`, `vegan`, `zero`, `light`, `zuckerfrei`, `gerieben`, `geschnitten`, `gemahlen`, `ganze Bohne`, `still`, `medium`, ...) and flavours (`Erdbeere`, `Vanille`, ...) after the first name word. The plain descriptors (`Bio`, `laktosefrei`, `glutenfrei`, `vegan`, `vegetarisch`, `zuckerfrei`, `ohne Zucker`, `koffeinfrei`, `entkoffeiniert`, `alkoholfrei`, `fettarm`) count up front too (`Bio Eier` gives Eier + Bio). A flavour up front stays the name (`Paprika rot`). A property is taken only when a name word is left (`Bio` alone stays the name). |
| Bezeichnung | What is left, as typed. A list comma or semicolon stays in the name (`Tomaten, Gurke`), and so does "und" (`Milch und Brot`): `parse_item` reads ONE entry. Splitting a sentence into several entries is the voice splitter's job (`supabase/functions/voice/parse.ts`; the app reaches it through `ListRepository.splitSpoken`, voice `mode: parse`). The add sheet (job 17) splits there first when the text holds a list, so the app, MCP and Siri agree. |
| Caps | No field is ever longer than its column: name 120, brand 60, properties 120, quantity 40. Longer parsed text is cut at the last space that fits (`public.cap_text`). Explicit `add_item` arguments over the cap raise `22001 value_too_long` before anything is written; MCP's input schema refuses them first. |
| Laden | Item→store memory for the name (`suggest_store`), else the brand's store (`Balea` gives dm), else the category's store hint (drugstore gives the household's `dm` store), else null. |

Dart entry point: `ListRepository.parse(String text) → Future<ParsedEntry>` (`app/lib/list/list_repository.dart`), with `ParsedEntry` in `app/lib/list/model.dart`. It calls the RPC and throws when offline. The add sheet then falls back to `parseEntry` (name and quantity only).

### App model (`app/lib/list/model.dart`)

- `Item` gains `brand`, `properties` (`String?`) and `sortKey` (`double?`, null only for an optimistic add the server has not numbered yet; it sorts last).
- `groupActive` orders every group by `sortKey`, then `createdAt`, then `id`.
- `ItemOp` variants after job 15:
  - `AddItem(item)`
  - `SetStatus`
  - `EditItem(id, ItemChanges)`: only the changed columns, sent as one PATCH. In `ItemChanges`, `name` and `categoryId` are `String?`, with null meaning unchanged. `quantity`, `brand`, `properties` and `storeId` are `SetTo<String?>?`: null means unchanged, and `SetTo(null)` clears the column.
  - `MoveItem(id, categoryId:, storeId:)` calls `move_item`. Its optimistic key is null, so the item shows last until the server numbers it.
  - `PlaceItem(id, anchorId:, edge:, categoryId:, storeId:, sortKey:)` calls `place_item`. It carries the anchor's store and category and a provisional key, the midpoint computed by `placeKey(group, anchor, edge)`, for the optimistic view.
  - When `move_item` or `place_item` answers `P0002` (for example, the anchor was deleted meanwhile), the app re-reads the row and treats that as the acknowledgement.
  - `compareWalk(a, b)` is the walk order: sort key (null last), then `createdAt`, then `id`.
  - `DeleteItem`
- `ListCubit`: `edit(id, ItemChanges)`, `move(id, categoryId:, storeId:)`, `place(id, anchorId:, edge:)`, `reorderStores(ids)`.
- The offline snapshot is `ListSnapshot` version 3. The v2 to v3 migrator turns queued v2 edit ops into full `ItemChanges` and v2 move ops into category-only `ItemChanges`.

### Widgets and keys

- `app/lib/list/edit_item_sheet.dart`: `showEditItemSheet(context, item:, catalog:) → Future<EditResult?>`. On web its content is the semantics group "Bearbeiten", whose rect is the sheet. The e2e helpers are `editSheet`, `openEdit`, `editField`, `pickInSheet` and `saveEdit` in `e2e/tests/helpers.ts`.
  - Menge −/+ goes through `stepQuantity(text, up:)` in `entry.dart`. It changes only the leading number and keeps the unit and the decimal comma. The step is 1, or 100 for g and ml from 100 up. An empty Menge counts as 1. − is off when the result would fall below one step. The steppers are hidden when the Menge does not start with a number.
  - `EditSaved(ItemChanges)` is only returned when something changed. The other results are `EditDeleted` and null (cancelled).
  - Keys:
    - `edit-sheet` (the sheet's content column)
    - `edit-name`, `edit-brand`, `edit-properties`, `edit-quantity`
    - `edit-quantity-minus`, `edit-quantity-plus`
    - `edit-delete`, `edit-done`, `edit-cancel`
- `app/lib/list/foldout_chips.dart`: `FoldoutChips(catalog:, storeId:, categoryId:, onStore: ValueChanged<String?>, onCategory: ValueChanged<String>, storeLabel:, categoryLabel:, storeChanged:, categoryChanged:)` is the store and category chips that fold out their options inline, 44 px. The add sheet in job 17 reuses it.
  - `storeLabel` is the text for "no store", on the chip and on the no-store option. `categoryLabel` is the chip text without a category, for example "Kategorie: automatisch".
  - `storeChanged` and `categoryChanged` draw the primary outline.
  - The chips' semantics names are "Laden: <name>" and "Kategorie: <name>".
  - Keys:
    - `chip-store`, `chip-category`
    - `store-option-<id>`, `store-option-none`
    - `category-option-<id>`
- `app/lib/list/store_badge.dart`: `StoreBadge(store, size:)` and `storeTint(store)`, with the colours from part 2. Job 16 uses them on the store dividers.
- Rows (`_ItemTile`): long-press and release without moving, or a right click, opens the edit sheet. A tap still opens it too, until job 16 makes the tap tick the item. No added-by initial. `new-<id>` and `new-items-subtitle` are unchanged.

## 4. Job 16 interfaces (for job 17)

Job 16 built everything between the header and the add bar. The code is in `app/lib/list/list_view/`; `list_screen.dart` keeps only the scaffold, the add field, the usual chips, the title, the sync indicator and the menu, which job 17 replaces. The reasons are in `docs/DECISIONS.md`, "Job 16".

### The widget

`ShoppingListView({double bottomInset = 24, VoidCallback? onInteract})` in `list_view/shopping_list_view.dart` needs a `ListCubit` above it and a `ScaffoldMessenger` (it shows the tick, delete and re-add snackbars itself).

- `bottomInset` is the room under the last row. Job 17 passes the height of the bottom band (input bar plus tabs, 134 px plus the safe area in the prototype) so the last row scrolls clear of it. The snackbars are the scaffold's: give them the same offset (prototype: 144 px up on the List tab).
- `onInteract` is called when the user ticks, edits, deletes, re-adds, drops or opens a divider's menu. `list_screen.dart` passes `_leaveField`, so the keyboard goes down while shopping.
- It owns the "Neu" seen timers (job 8) and opens the edit sheet (job 15) itself. The title's "N neu von Lea" (`new-items-subtitle`) still reads `ListCubit.fresh`.
- Widths: one column up to 840 px, centred at 640 px from 600 px on; two columns from 840 px and three from 1200 px, each at most 560 px (`ShoppingListView.twoColumns`, `threeColumns`, `columnWidth`, `wideColumnWidth`). The add sheet (about 640 px wide) can align with `columnWidth`.

### State

- `ListState.prefs` is a `ListPrefs(folded: Set<String>, hintDismissed: bool)` from `list_cache.dart`, saved on the device per user and household (`listprefs.<user>.<household>`). `ListCubit.toggleFold(key)` and `ListCubit.dismissHint()` change it. A section's key is the store id, or `noStoreKey` (`'none'`) for "Ohne Laden".
- `NeedsConnection` is a new `Rejected`: a store or category reorder made offline. `list_screen.dart` shows `reorderNeedsConnection` for it; keep that when the scaffold moves.
- The store filter is gone: no `StoreFilter`, `ListCubit.selectStore`, `ListState.filter` or `showHidden`. `ListCubit.add` no longer takes a store from a view; the add sheet's store chip sets it.
- `sectionsOf(items, catalog)` in `list_view/sections.dart` groups the list (stores in order, then no store; one block per category). The header's "15 Artikel" count is the sum of `StoreSection.count`.

### Where the reorder screens are

- The store layout screen (`openStoreLayout(context, storeId)`, a store's category order) opens from a store divider's menu: hold the divider without moving, or right click, then "Reihenfolge bearbeiten". It no longer has the "gibt es bei" switches.
- The categories screen (`openCategories(context)`, rename, add, delete, route order) opens from the menu of the "Ohne Laden" divider and from the app menu. Job 17 can move the app menu entry to More.
- Store order has no screen of its own: drag a store divider, or use "Laden nach oben/unten" in its menu or as a semantics action.

### Keys (for `scripts/fg` and widget tests)

| Key | Widget |
| --- | --- |
| `<item id>` | an item row (`ItemRow`) |
| `dismiss-<id>`, `new-<id>`, `bought-<id>` | swipe to delete, the unseen tint, a recently bought row (unchanged) |
| `drop-line-<id or section key>` | the insertion line while a drag hovers a row or divider |
| `store-<store id>`, `store-none` | a store divider, and the one for no store |
| `category-<section key>-<category id>` | a category divider |
| `list-hint`, `list-hint-dismiss` | the explainer card and its "Verstanden" |
| `list-empty` | the empty state |
| `recently-bought` | "Zuletzt gekauft" |
| `section-menu`, `section-menu-up`, `section-menu-down`, `section-menu-layout` | a divider's menu |

### Strings

New in both `app_de.arb` and `app_en.arb`: `storeSectionLabel`, `itemsWord`, `expandSection`, `collapseSection`, `moveStoreUp`, `moveStoreDown`, `moveCategoryUp`, `moveCategoryDown`, `listHint`, `listHintDismiss`, `reorderNeedsConnection`. English was added for the existing strings the list shows (`emptyList`, `sortingItem`, `recentlyBought`, `readd`, `itemTicked`, `itemDeleted`, `itemReadded`, `undo`, `newItem`, `editStoreLayout`, `manageCategories`, `storeLayoutTitle`, `storeLayoutHint`, `dragCategory`, `syncFailed`, `catalogSaveFailed`). `emptyList` still says "Tippe oben ein": job 17 changes it to "unten" when it moves the input down. Removed: `tickItem`, `allStores`, `showHiddenItems`, `hideHiddenItems`, `emptyAtStore`, `storeCarries`.

