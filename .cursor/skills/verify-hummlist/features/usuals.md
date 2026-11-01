# Usuals and due items

Hummlist learns what the household buys regularly from its ticked-off history. When the add sheet is open with the field empty, it offers the items that are due again as rows labelled „Wieder fällig“ / "Due again" (with a 🔁 icon when the item has no category icon). A tap on such a row adds the item with the quantity it usually has. An item counts as due when it was bought on at least two different days and the usual gap between purchases has passed. There is no other place that shows due items: not the list, not a notification, not an email.

## Sub-features

- `us-due-rows` the empty-field add sheet lists up to 10 due items, each a button named "<quantity> <name>, Wieder fällig" (for example „Butter, Wieder fällig“, „4× Brötchen, Wieder fällig“).
- `us-rule` the rule behind "due": purchases (ticks) on at least 2 different calendar days (Berlin time) within the last year; the usual gap is the average number of days between the first and last purchase day (at least 1 day); the item is due from one gap after the last purchase until four gaps after it, then it drops out. A tick that was undone within 10 minutes is not a purchase. An item added and deleted without ever being bought does not count. Two ticks on the same day count as one day.
- `us-off-list` an item already open on the list (same name, any capitalisation) is not offered as due.
- `us-tap` a tap on a due row adds the item with its usual quantity and the note „✓ Hinzugefügt: <name>“; the field keeps the cursor, and the row is gone afterwards because the item is open.
- `us-empty` with nothing due the sheet shows „Tippe, um Vorschläge zu sehen“ / "Type to see suggestions".
- `us-typed-history` the same history feeds the rows „Schon mal gekauft“ / "Bought before" while typing (see the quick add feature), and the offline rows.
- `us-reload` the usuals are read when the app starts and again 1.5 s after the set of open item names changes.

## How to get to it (user POV)

- Tap the add bar „Was brauchst du?“ / "What do you need?" with nothing typed. The sheet opens with the due rows, if any.
- Tap a „Wieder fällig“ row to add it.

## Driving it with Playwright

Preconditions:

- Signed in, on the list tab, in a household with history. A fresh purchase history is not enough: the app needs two purchases on different days, which only the server clock writes. The e2e spec makes them by ticking an item once, then backdating its events through the service-role client (`adminClient().from('item_events')`) to 14 and 7 days ago and reloading. The baseline „Familie Brandt“ has no purchase history, so nothing is due there; `helpers/launch.sh --scenario heavy-history --fresh` seeds eight weeks of trips in which Milch, Brot, Eier, Windeln and Duschgel are due (`docs/TEST_FIXTURES.md`).
- Existing coverage: `e2e/tests/suggestions.spec.ts` (test "with the field empty, what is due again is offered; a tap adds it and typing goes on") and `e2e/tests/add-sheet.spec.ts` (test "with nothing typed, the open sheet offers what is due"), run via `scripts/verify.sh --only e2e -- tests/suggestions.spec.ts`.

- **One purchase is not due.** `addItem(page, '4 Brötchen')`, `tick(page, 'Brötchen')`, then `addField(page).click()`. Observable result: `addSheet(page)` is visible and no button named `4× Brötchen, Wieder fällig` exists; the sheet shows „Tippe, um Vorschläge zu sehen“ if nothing else is due.
- **Backdate.** Close the sheet (`closeSheet(page)`). With the service-role client set the item's `bought` event to 7 days ago (and its `added` event to 7 days and 1 hour ago) and insert an `added` event 14 days and 1 hour ago plus a `bought` event 14 days ago, same item and household. Then `await page.reload()`.
- **See the due row.** `await addField(page).click()`. Observable result: `addSheet(page).getByRole('button', { name: /^4× Brötchen, Wieder fällig/ })` is visible.
- **Tap it.** Click that row. Observable result: `addedNote(page, /^✓ Hinzugefügt: Brötchen\b/)` is visible, no `, Wieder fällig` button remains, `addField(page)` is focused; after `closeSheet(page)` the list row `itemRow(page, 'Brötchen')` has the accessible name starting `Brötchen 4`.

## Gotchas

- Due needs two purchase days a real gap apart; ticking twice in one test never makes an item due. Backdate events instead, then reload so the usuals are read again.
- A tick undone within 10 minutes (a tap on the item under „Zuletzt verwendet“) is not a purchase.
- Due rows show only while the field is empty. After a character is typed the sheet switches to the typed rows.
- The window closes: an item last bought more than four gaps ago is no longer due, so an item bought once a year never shows.
- The interface string „Brauchen wir wieder?“ / "Need these again?" exists in the language files but no screen shows it today; do not look for it.
- Not gated: no flag or Premium requirement.
