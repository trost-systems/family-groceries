# Brief for direction builders

You build ONE design direction of the Family Groceries prototype sandbox at /workspace/fg-design-sandbox.
Peter (owner) says the current app is ugly. See /workspace/fg-design-job/current-list.png and current-add-sheet.png.
Research on real apps: research/RESEARCH.md. Product spec (read-only): ~/groceries-ops/SPEC.md.

## Read first
- src/shared/types.ts, mockData.ts, parser.ts (parse/suggest), store.ts (useGroceries, sectionsOf), useAddFlow.ts,
  i18n.tsx, dnd.tsx (gesture model + hooks), ui/Sheet.tsx, ui/Snackbar.tsx, ui/bits.tsx (LangToggle, StoreBadge, BackToIndex),
  ui/MoreScreen.tsx, src/registry.ts, src/tokens.ts, src/PhoneFrame.tsx.
- e2e/flows.spec.ts and e2e/shots.spec.ts: the test contract (data-testids). Your direction must pass every test in it.

## Rules
- Write ONLY inside src/prototypes/<your-dir>/ (index.tsx plus any .tsx/.css files). Do not edit src/shared, e2e, configs,
  or other prototypes. If a shared file has a bug or is missing something you need, work around it locally if trivial and
  REPORT it in your final reply (file, line, what and why). No new npm dependencies. No git commits.
- `index.tsx` exports `meta: PrototypeMeta` (letter, title, rationale as {de,en}) and a default component (the whole phone screen).
- Colors only from CSS vars (--md-*, generated from the app seed) except StoreBadge brand colors. Type: var(--font). No web fonts,
  no external images; emoji and small inline SVG are fine. Prefix your CSS classes with your direction letter to avoid collisions.
- Mobile first: the screen is 390x844 (PhoneFrame); respect var(--safe-top)/var(--safe-bottom). No hover-only affordances.
  Touch targets >= 44px where it matters (check circles, chips).
- German default, every visible string via useI18n().t / l() or local {de,en} literals. A LangToggle must be visible on the List tab.

## Required behavior (all directions)
- Top-level groups are stores (useStoreSortable: spread containerProps on the section, handleProps on the store header);
  categories inside (useCategorySortable: containerProps on the category wrapper, handleProps on its header). Wrap in
  <ListDnd groceries onEdit renderItemOverlay>, <SortableStores ids>, <SortableCategories storeId ids>. When `collapsed`
  is true render only headers (reorder mode). Show `isItemOver` as a clear drop highlight.
- Items: `const { itemProps, isDragging } = useItemGesture(item, onTap)`; spread itemProps on the item root.
  Tap = check off via actions.check(id, `${item.name} ${t('checkedOff')}`) (snackbar with undo). Hold+release or
  right-click = edit, via ListDnd's onEdit. Hold+move = drag. Do not add other click handlers that fight this.
- Edit is INLINE in the list (data-testid="item-editor"), rendered in place of / expanding the item. Never a sheet.
  Fields: name, brand, props, qty, store, category; Done and Delete (actions.remove with undo). Store/category in the editor
  use your direction's inline picker style.
- Add: an input-looking bar on the list (data-testid="add-open") opens <Sheet> with the input at the top
  (data-testid="add-input", autoFocus). Below it the live preview (data-testid="preview") shows the parsed item filling in
  per keystroke (name, brand, props, qty, emoji, store, category). The preview's store control is data-testid="preview-store";
  after clicking it, store choices data-testid="store-option-<storeId>" must be visible and clickable, inline in the sheet
  (no second sheet, no popup menu). Same for category with "preview-category" / "category-option-<id>".
  Suggestions (data-testid="suggestion", from useAddFlow().suggestions) add the item on one tap and keep the sheet open
  for the next item (input cleared and focused). Enter in the input adds suggestions[0].
- Bottom tabs: data-testid="tab-list" ("Liste"/"List") and "tab-more"; More tab renders <MoreScreen onLogout>.
- <Snackbar snack onDismiss bottom> for undo.

## Verify
- `npx tsc -b` must pass.
- `npm run e2e -- flows.spec.ts -g <your-dir>` builds dist and runs Playwright; it is serialized by a lock and may wait for
  other runs, that is expected. All tests for your dir must pass. Never run playwright any other way.
- `npm run e2e -- shots.spec.ts -g <your-dir>` writes shots/<your-dir>-list.png and -add.png. Look at them with the Read
  tool and iterate on visual quality until it looks like a polished, distinctive app, not a wireframe. Then re-run flows.

## Final reply (under 40 lines)
What you built, the info hierarchy, the inline store/category pattern, the edit pattern, Flutter mapping (widgets/packages
per element), tradeoffs, test result line, shared-code issues found.
