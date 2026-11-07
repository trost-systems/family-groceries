# Live sync between household members

Members of one household see each other's changes without reloading: an item one adds appears on the other's list, a tick makes it vanish, edits and moves show in the new place, a delete removes it. Partner adds the user has not looked at yet are tinted and the bar above the list says „1 neu von Noah Brandt“ (the partner's display name) until each item has been more than half on screen for 3 seconds. A small icon between that text and „Anpassen“ / "Edit" (since job 78) shows the sync state: nothing when synced, a cloud with an arrow when changes are being sent, a crossed-out cloud when offline.

## Sub-features

- `sync-add` / `sync-tick` / `sync-edit` / `sync-delete` a partner's add, tick, edit or delete shows on the other list within a couple of seconds.
- `sync-move` a partner's move of an item to another category or store shows in its new place.
- `news-subtitle` bar text „{n} neu von {name}“ (EN "{n} new from {name}") when the unseen adds are all from one partner; „{n} neu“ / "{n} new" when from several; empty otherwise. The bar floats over the top of the list (job 148): „Anpassen“ at the top right is a raised button with no frame around it (job 152); this text and the sync icon sit in their own small hex capsule to its left, shown only while there is something to say. The bar keeps its height and „Anpassen“ its place in every state, and the rows scroll on under it.
- `news-row` an unseen partner item's row is tinted honey (since job 57) and "Neu" (EN "New") ends its accessible name, after the details and quantity: "Kaffee Neu", "Bananen 6 Neu".
- `news-clear` an item stops being new after 3 s more than half on screen while the app is showing; stays cleared after reload. A ticked item is not counted while it is ticked; put back before it was seen, it is new again. Own adds are never new. On first start nothing old is new. Items added while the app was closed are new on the next open.
- `sync-status-icon` pending „1 Änderung wird synchronisiert“ / „{n} Änderungen werden synchronisiert“ (EN "Syncing 1 change" / "Syncing {n} changes"); offline „Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist“ (EN "Offline: changes will sync once the connection is back"). Offline wins over pending.
- `sync-reconnect` changes made offline go out when the connection returns; the other side's changes come in (resync); also on app resume and after Realtime drops (retry about 3 s, backing off to 30 s). A Realtime error, timeout or close, or a failed resync, shows the offline icon until the channel is live again or a write is acknowledged.
- `sync-rejected` a write the server refuses shows a snackbar „Änderung abgelehnt: {name}“ (EN "Change refused: {name}") and the item reverts; the snackbar shows above an open sheet or dialog (job 116). A lapsed token is retried, not refused.

## How to get to it (user POV)

- No screen of its own: two members signed in to the same household (one invites with „Mehr“ → „Partner einladen“, the other joins with the link or code), both on „Liste“. The bar is the strip at the top of the list; the icon sits in a small capsule just left of „Anpassen“ / "Edit" at its right end.

## Driving it with Playwright

Preconditions:

- The seeded household „Familie Brandt“ (`demo-familie`) with its three demo members (Mia, Noah, Ida; `member(inst, 'noah')` in `helpers/lib.mjs`). Use two browser contexts (`browser.newContext()`), A signed in as Noah, B as Mia (or: member A signs up with `signUpWithHousehold`, `createInviteCode`, member B `signUp` + `joinWithCode`, as the specs do). Both pages on „Liste“. The steps below use seeded items (Bananen, Mineralwasser, Apfelsaft, Spülmittel) plus Kaffee, Tomaten and Eier, which A adds.
- Names: the partner's display name appears in the bar, „Noah Brandt“ in the seed; with sign-up accounts it is the email's local part.

- **Add.** On A `addItem(a, 'Kaffee')`. On B observe `itemRow(b, 'Kaffee')` visible within 2 s (`within(2_000, ...)`). Its accessible name is "Kaffee Neu" until seen.
- **Partner news.** On B `getByText('1 neu von Noah Brandt')` visible while the row has "Neu" in its name; after about 3 s on screen `itemRow(b,'Kaffee')` loses "Neu" (`not.toHaveAccessibleName(/Neu/)`) and the text is gone (`getByText(/ neu( von|$)/)` count 0; allow 15 s). Reload: still cleared.
- **Added while away.** Close B's page, A adds Tomaten, open a new page in B's context: `itemRow(b,'Tomaten')` has "Neu" and the subtitle shows; the add field stays focused (the highlight never takes focus).
- **Tick.** `tick(a, 'Mineralwasser')`; on B `itemRow(b,'Mineralwasser')` count 0 within 2 s.
- **Edit.** On A `openEdit(a,'Bananen')`, `typeInto(editField(a,'Menge'),'8')`, `saveEdit(a)`; on B `itemRow(b,'Bananen')` has accessible name `/^Bananen 8( Neu)?$/` ("Neu" comes last).
- **Delete.** The app has no delete button since job 149, so delete as B through the API: `(await apiAs(inst, member(inst, 'mia'))).from('items').delete().eq('name', 'Spülmittel')` (`helpers/lib.mjs`; in a spec `apiAs(email)` from `e2e/tests/helpers.ts`); on A `itemRow(a,'Spülmittel')` count 0.
- **Offline then back.** `const network = await cutOff(a)` (or A's `context.setOffline(true)`) then `tick(a,'Apfelsaft')` and `addItem(a,'Eier')`: A shows both at once, `a.getByText(/^Offline:/)` count 1, B still shows Apfelsaft. `network.restore()`: within 15 s B loses Apfelsaft and shows Eier.
- **Sync icon.** `page.getByText(/^\d+ Änderung(en)? w(ird|erden) synchronisiert$/)` for pending (hold item writes with `page.route('**/rest/v1/items**', ...)` until released), `getByText(/^Offline:/)` for offline (`cutOff(page)` then `restore()`).
- Specs: `scripts/verify.sh --only e2e -- tests/live-sync.spec.ts` (also: Realtime drops, a phone that sleeps through a drop, a change made before the channel is live), `tests/partner-news.spec.ts`, `tests/list-header.spec.ts`.

## Gotchas

- The 3 s "Neu" clock runs only while the row is more than half on screen and the app is showing; a 2 s sync assertion must allow the name to end in "Neu" (regex `( Neu)?$`).
- Deletes land a second or so later on the server; allow a longer timeout than for adds.
- The bar never shows the household name or an item count (checked by the spec).
- A change from the viewer's own other session counts as theirs: only a different user's adds are news.
- Realtime joins before its database listener is live; the app resyncs when the listener is live, so an add made right after opening still appears (e2e covers it).
- Hetzner containers cannot reach host ports, so specs that need fake OIDC time out there; the sync specs above do not.
- Ordering moves of stores/categories (not items) need a connection; see offline.
