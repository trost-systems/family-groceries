# Live sync between household members

Members of one household see each other's changes without reloading: an item one adds appears on the other's list, a tick makes it vanish, edits and moves show in the new place, a delete removes it. Partner adds the user has not looked at yet are tinted and the bar above the list says „1 neu von Lea“ (the partner's display name) until each item has been on screen for 3 seconds. A small icon at the right of that bar shows the sync state: nothing when synced, a cloud with an arrow when changes are being sent, a crossed-out cloud when offline.

## Sub-features

- `sync-add` / `sync-tick` / `sync-edit` / `sync-delete` a partner's add, tick, edit or delete shows on the other list within a couple of seconds.
- `sync-move` a partner's move of an item to another category or store shows in its new place.
- `news-subtitle` bar text „{n} neu von {name}“ (EN "{n} new from {name}") when the unseen adds are all from one partner; „{n} neu“ / "{n} new" when from several; empty otherwise. The bar keeps its height in every state.
- `news-row` an unseen partner item's row is tinted honey (since job 57) and has accessible name "<Name>\nNeu" (EN "New").
- `news-clear` an item stops being new after 3 s on screen while the app is showing, or when it is ticked; stays cleared after reload. Own adds are never new. On first start nothing old is new. Items added while the app was closed are new on the next open.
- `sync-status-icon` pending „1 Änderung wird synchronisiert“ / „{n} Änderungen werden synchronisiert“ (EN "Syncing 1 change" / "Syncing {n} changes"); offline „Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist“ (EN "Offline: changes will sync once the connection is back"). Offline wins over pending.
- `sync-reconnect` changes made offline go out when the connection returns; the other side's changes come in (resync); also on app resume and after Realtime drops (retry about 3 s, backing off to 30 s).
- `sync-rejected` a write the server refuses shows a snackbar „Änderung abgelehnt: {name}“ (EN "Change refused: {name}") and the item reverts. A lapsed token is retried, not refused.

## How to get to it (user POV)

- No screen of its own: two members signed in to the same household (one invites with „Mehr“ → „Partner einladen“, the other joins with the link or code), both on „Liste“. The bar is the strip at the top of the list; the icon sits at its right end.

## Driving it with Playwright

Preconditions:

- The seeded household „Familie Brandt“ with its three demo members (Mia, Noah, Ida; `member(inst, 'noah')` in `helpers/lib.mjs`). Use two browser contexts (`browser.newContext()`), one page per member, each signed in as a different member (or: member A signs up with `signUpWithHousehold`, `createInviteCode`, member B `signUp` + `joinWithCode`, as the specs do). Both pages on „Liste“.
- Names: the partner's display name appears in the bar; with sign-up accounts it is the email's local part.

- **Add.** On A `addItem(a, 'Bananen')`. On B observe `itemRow(b, 'Bananen')` visible within 2 s (`within(2_000, ...)`). Row name is "Bananen\nNeu" until seen.
- **Partner news.** On B `getByText('1 neu von <name>')` visible while the row has "Neu" in its name; after about 3 s `itemRow(b,'Bananen')` loses "Neu" (`not.toHaveAccessibleName(/Neu/)`) and the text is gone (`getByText(/ neu( von|$)/)` count 0). Reload: still cleared.
- **Added while away.** Close B's page, A adds, open a new page in B's context: `itemRow(b,'Kaffee')` has "Neu" and the subtitle shows; the add field stays focused (the highlight never takes focus).
- **Tick.** `tick(b, 'Milch')`; on A `itemRow(a,'Milch')` count 0 within 2 s.
- **Edit.** On A `openEdit(a,'Bananen')`, `typeInto(editField(a,'Menge'),'6')`, `saveEdit(a)`; on B `itemRow(b,'Bananen')` has accessible name `/^Bananen (Neu )?6$/`.
- **Delete.** On B `openEdit(b,'Windeln')`, click `editSheet(b).getByRole('button',{name:'Löschen'})`; on A `itemRow(a,'Windeln')` count 0.
- **Offline then back.** `peterContext.setOffline(true)` then `tick(a,'Brot')` and `addItem(a,'Eier')`: A shows both optimistic, `a.getByText(/^Offline:/)` count 1, B still shows Brot. `setOffline(false)`: within 15 s B loses Brot and shows Eier.
- **Sync icon.** `page.getByText(/^\d+ Änderung(en)? w(ird|erden) synchronisiert$/)` for pending (hold item writes with `page.route('**/rest/v1/items**', ...)` until released), `getByText(/^Offline:/)` for offline (`cutOff(page)` then `restore()`).
- Specs: `scripts/verify.sh --only e2e -- tests/live-sync.spec.ts` (also: Realtime drops, a phone that sleeps through a drop, a change made before the channel is live), `tests/partner-news.spec.ts`, `tests/list-header.spec.ts`.

## Gotchas

- The 3 s "Neu" clock runs only while the row is on screen and the app is showing; a 2 s sync assertion must allow the name to carry "Neu" (regex `(Neu )?`).
- Deletes land a second or so later on the server; allow a longer timeout than for adds.
- The bar never shows the household name or an item count (checked by the spec).
- A change from the viewer's own other session counts as theirs: only a different user's adds are news.
- Realtime joins before its database listener is live; the app resyncs when the listener is live, so an add made right after opening still appears (e2e covers it).
- Hetzner containers cannot reach host ports, so specs that need fake OIDC time out there; the sync specs above do not.
- Ordering moves of stores/categories (not items) need a connection; see offline.
