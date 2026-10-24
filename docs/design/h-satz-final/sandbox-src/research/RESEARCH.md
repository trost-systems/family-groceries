# Grocery list redesign: desk research

Method: WebSearch and WebFetch on public pages only. Every URL below was fetched or appeared in a search result this session.
Gaps are marked "not confirmed". The Material 3 guideline pages (m3.material.io) render client-side, so fetches returned only section titles. M3 claims therefore lean on Flutter API docs and the old material.io snackbar page.
No German-market review material was fetched. Nothing here is a first-hand app test.

## Bring!

- Items are added through search or a browsable catalog, then given details and photos. https://getbring.com/en/features
- Catalog is organized into food categories. Search shows personal recommendations and items matching what is already on the list. https://getbring.com/en/features (search summary)
- Each item gets an icon and a category automatically. Icons are the primary visual (tiles), with a list view as an option. https://www.getbring.com/en/features/organized
- Display options: light/dark and tiles or list. https://getbring.com/en/features
- Brand, flavor, quantity: no structured brand field was found. Users attach their own photo and free-text details to the item icon. https://getbring.com/en/features
- Category order can be customized to match supermarket aisles. https://www.getbring.com/en/features/organized
- Multiple lists, organized per store or event. Changes sync in real time to members. https://getbring.com/en/features
- Items can be marked with urgency labels. https://getbring.com/en/features
- Check-off gesture and undo: not confirmed on the pages fetched.
- A review noted items sometimes disappearing without reason (trust risk for sync). https://apps.apple.com/us/app/-/id580669177 (appeared in search results, not fetched)

## AnyList

- One "Add Item" bar. Typing shows suggestions from a built-in grocery database, favorites and recent items. Tapping a suggestion adds it. https://help.anylist.com/articles/feature-overview-adding-items/
- You can add an item straight into a chosen category from the bar. https://help.anylist.com/articles/feature-overview-adding-items/
- A pencil icon beside a suggestion opens details (category, store) before adding. https://help.anylist.com/articles/feature-overview-adding-items/
- Categories are automatic (typing "Milk" lands under Dairy), custom categories can be created and reordered to match a store. https://thesweetsetup.com/?p=3818 (search summary)
- Quantity, brand and coupons are mostly carried in a per-item note, not a dedicated field, per reviews. https://www.macworld.com/article/227699/anylist-review-grocery-app-crosses-off-nearly-everything-on-our-shopping-list.html (search summary)
- Store assignment per item and filtering the list by store is a paid feature ("Complete"). https://apps.apple.com/jp/app/anylist-grocery-shopping-list/id522167641 (search summary)
- Help center recommends one long-lived grocery list reused weekly, with favorites per list. https://help.anylist.com/articles/weekly-shopping/ (search summary)
- Paste a multi-line list from Notes to add many items at once. https://help.anylist.com/articles/feature-overview-adding-items/ (search summary)
- Check-off behavior: not covered by the pages fetched.

## Todoist (Quick Add)

- Free-text field. Date phrases ("tomorrow at 4 pm", recurring patterns) are recognized as you type and highlighted, then applied on save. https://todoist.com/help/articles/205325931
- False positives are handled by tapping the highlighted word to un-highlight it, so it stays in the title. Example: "monthly" in "Create monthly report". https://todoist.com/help/articles/205325931
- Recognition can be switched off globally. https://todoist.com/help/articles/205325931
- Non-English limits exist (Czech and Turkish noted as unsupported in one copy of the article). Verify German coverage before copying the model. https://todoist.com/Help/DatesTimes
- Pattern to steal: live highlight of parsed tokens plus one-tap reject. Labels, project and priority tokens are not covered by the page fetched.

## Apple Reminders (Groceries list type, iOS 17+)

- Create a list and choose List Type "Groceries". Items sort into sections (Produce, Meat, Frozen Foods, and so on) as you add them. https://support.apple.com/HT213830
- Sections seen in coverage: Produce, Breads & Cereals, Frozen Foods, Snacks & Candy, Meat, Dairy/Eggs/Cheese, Bakery, Baking Items, Household, Personal Care, Wine/Beer/Spirits. https://www.mactrast.com/2023/06/ios-17-reminders-app-auto-sorts-groceries-lists-into-categories/ (search summary)
- Correct a miss by press-and-hold then drag the item to another section. The list remembers the choice for that item next time. https://support.apple.com/HT213830
- Alternative to dragging: item info, Section, pick one or "New Section with Selection". https://support.apple.com/HT213830
- Sections are renameable by tapping the header. Unrecognized items stay uncategorized. https://support.apple.com/HT213830 and mactrast above
- Text-first, no per-item illustrations. Check-off not covered on the support page.

## Listonic

- Voice input understands quantities: "3 onions", "2kg of potatoes" become a quantity plus item, auto-sorted into aisle categories. https://listonic.com/ (search summary of https://cf.listonic.com/)
- Custom categories are free and unlimited. https://listonic.com/compare-apps/listonic-vs-our-groceries (search summary)
- Suggests frequently bought items. Prices tracked with running total. https://listonic.com/best-grocery-app-features
- Its own feature guide says items should be "grouped and sorted into the requisite aisles" for one-aisle-at-a-time shopping. https://listonic.com/best-grocery-app-features
- Vendor marketing only. Check-off and edit gestures not confirmed.

## OurGroceries

- Add row sits at the bottom of the list ("Add an item..."). Typing a name or tapping a past item from the master list adds it. https://ourgroceries.com/user-guide
- Quantity is a number in parentheses after the name, with Less/More buttons. A Note shows under the name and is remembered for next time. https://ourgroceries.com/user-guide
- Category is set in item details. A setting decides if uncategorized new items are auto-categorized, asked about, or left alone. https://ourgroceries.com/user-guide
- Default check-off: tap crosses the item off and moves it to the bottom. Tap again to uncross. https://ourgroceries.com/user-guide
- Settings let cross-off require press-and-hold (about 1 s iPhone) or swipe to prevent accidental taps. "Recently crossed-off at top" aids recovery. https://ourgroceries.com/user-guide
- No undo toast. Recovery is tap-again only. https://ourgroceries.com/user-guide
- Edit: a control right of the name opens details (name, quantity, category, barcode, note, star, photo, delete). https://ourgroceries.com/user-guide
- Reorder through a separate "Rearrange Items" mode on iPhone, drag handles on web. https://ourgroceries.com/user-guide
- Household sharing by entering the same email, changes visible within seconds. https://apps.apple.com/us/app/-/id325851015 (search summary)

## Material 3 and Flutter widget docs

- Chip types in M3: assist, filter, input, suggestion. Guidance text was not retrievable. https://m3.material.io/components/chips/guidelines
- Flutter InputChip: compact entity, selectable, deletable via `onDeleted`. FilterChip: tags to filter. ActionChip: action related to content. https://api.flutter.dev/flutter/material/InputChip-class.html
- Snackbar (older material.io): low priority, self-dismissing, one at a time, a single action. Action should reverse the change, not just close. https://material.io/components/snackbars
- Flutter SnackBar: optional action, `duration`, `persist`, `showCloseIcon`; with an action it does not time out under TalkBack or VoiceOver. https://api.flutter.dev/flutter/material/SnackBar-class.html
- Flutter docs frame undo-after-delete as the canonical snackbar action. https://docs.flutter.dev/cookbook/design/snackbars
- Bottom sheets: modal vs standard, drag handle (titles only). https://m3.material.io/components/bottom-sheets/guidelines
- `showModalBottomSheet`: `isScrollControlled: true` for tall or keyboard content, `useSafeArea`, `showDragHandle`. Keyboard inset handling is not documented on the page. https://api.flutter.dev/flutter/material/showModalBottomSheet.html
- M3 lists: one/two/three-line items, leading/trailing elements, swipe, selection (titles only). https://m3.material.io/components/lists/guidelines

## Takeaways for us

1. Make the add bar the hero. AnyList and OurGroceries both pair one field with suggestions from history. Rank our suggestions: household history first, then built-in German catalog. (AnyList, OurGroceries)
2. Do live parse chips like Todoist: highlight quantity, unit and brand tokens as the user types, and let one tap on a token reject it back into the title. This handles "Hafermilch 2x Alpro" false positives. (Todoist)
3. Parse quantity as a number plus unit in the same line ("3 Zwiebeln", "2 kg Kartoffeln"), as Listonic does by voice. Keep a free-text note for brand and spec, remembered per item, as OurGroceries does. (Listonic, OurGroceries)
4. Show quantity and note as a quiet second line or trailing text, not as a competing field. OurGroceries and AnyList both do this and users accept it.
5. Auto-categorize on add, remember user corrections per item, and leave unknowns in an "Unsortiert" bucket. Apple's remembered-drag model is the cleanest precedent. (Apple Reminders)
6. Stores as top-level groups is a differentiator. AnyList gates store assignment behind payment and Bring! treats stores as separate lists. Our store, then category hierarchy with drag between both is a real edge. Keep the category set per store editable in aisle order.
7. Check-off: tap to check is the default everywhere, but accidental taps are a known complaint (OurGroceries ships a hold/swipe option). Pair tap with a snackbar Undo, since OurGroceries has none. Move checked items to a collapsed "Erledigt" section at the bottom of each group.
8. Emoji per category plus text per item is cheaper than Bring!'s full illustration catalog, and avoids a large asset pipeline. Use emoji on category headers and optionally on item leading slot when matched.
9. Edit affordance: long-press opens a bottom sheet (name, quantity, unit, note, category, store, delete). OurGroceries uses a separate details control, Apple uses an info button. Long-press must not collide with drag, so decide below.
10. Drag between categories and stores should be the Apple pattern (press-hold, drag, drop, learned). Offer a second path in the edit sheet (category and store pickers) for accessibility and for long lists where dragging across stores is awkward.
11. Trust matters for a shared family list. Bring! reviews mention vanishing items. Show who added or checked what, and make deletes undoable.
12. Verify German parsing ourselves. Todoist notes non-supported languages, and no source here covers German NLP. Plan a small rule-based parser with unit tests on German phrases (Stück, Pck., EL, 500g, "ein halbes Pfund").

## Flutter mapping

| Package or widget | URL | Fit |
|---|---|---|
| `ReorderableListView` (SDK) | https://api.flutter.dev/flutter/material/ReorderableListView-class.html | Reorders within one list only. On mobile a long press anywhere starts the drag, which conflicts with a long-press-to-edit gesture. `buildDefaultDragHandles: false` plus an explicit `ReorderableDragStartListener` handle frees long-press. SDK-maintained. Cross-group moves are not covered by the docs. |
| `LongPressDraggable` + `DragTarget` (SDK) | https://api.flutter.dev/flutter/widgets/LongPressDraggable-class.html | Full control, any group count, delay and haptics configurable (`hapticFeedbackOnStart` default true). We build auto-scroll, insertion indicators and header drop targets ourselves. Occupies long-press, so edit must move to tap-on-details or a handle. SDK-maintained. |
| `drag_and_drop_lists` 0.4.2 | https://pub.dev/packages/drag_and_drop_lists | Closest ready-made fit: two-level lists, items move between lists, lists themselves reorder, handles or long/short press selectable. Last published about 23 months ago, unverified uploader, so budget for forking. Maps directly to store then category if we flatten to two levels per screen. |
| `reorderables` 0.6.0 | https://pub.dev/packages/reorderables | Reorders within a single widget (list, column, wrap, table). No cross-list support documented. Published about 3 years ago, author asks for PRs. Not a fit for cross-group drag. |
| `super_drag_and_drop` 0.9.1 | https://pub.dev/packages/super_drag_and_drop | Native drag between apps and windows (Rust-backed, from nativeshell.dev, verified publisher). Overkill for in-app category moves. Useful only if we want to drag text in from other apps. Published about 16 months ago. |
| `showModalBottomSheet` | https://api.flutter.dev/flutter/material/showModalBottomSheet.html | Edit sheet. Use `isScrollControlled: true`, `showDragHandle`, `useSafeArea`. Handle keyboard inset manually via `MediaQuery.viewInsets`. |
| `SnackBar` + `SnackBarAction` | https://api.flutter.dev/flutter/material/SnackBar-class.html | Undo after check-off or delete. Call `clearSnackBars` before showing the next so rapid check-offs do not queue. |
| `InputChip` / `FilterChip` / `ActionChip` | https://api.flutter.dev/flutter/material/InputChip-class.html | InputChip for parsed tokens (deletable = reject parse). FilterChip for store filter row. ActionChip for suggestions. |

Open question for a prototype: whether to build on `drag_and_drop_lists` or hand-roll with `LongPressDraggable` and `DragTarget`. The decision turns on observed behavior (auto-scroll across tall lists, long-press collision), which is cheap to test on a throwaway sketch.

## Sources not fetched but cited above from search results

- https://apps.apple.com/us/app/-/id580669177, https://apps.apple.com/us/app/-/id325851015, https://apps.apple.com/jp/app/anylist-grocery-shopping-list/id522167641
- https://thesweetsetup.com/?p=3818, https://www.macworld.com/article/227699/anylist-review-grocery-app-crosses-off-nearly-everything-on-our-shopping-list.html
- https://www.mactrast.com/2023/06/ios-17-reminders-app-auto-sorts-groceries-lists-into-categories/
- https://listonic.com/compare-apps/listonic-vs-our-groceries, https://cf.listonic.com/
- https://material.io/components/snackbars, https://docs.flutter.dev/cookbook/design/snackbars
