# Working offline

The list keeps working without a connection. Adding, ticking, putting back, editing, moving and deleting items all happen on screen at once, wait in a queue on the device and are sent once the connection returns. The last synced list is stored on the device, so the app starts and shows it even with no network, and the queue survives reloads and restarts. A cloud icon with the text „Offline: …“ tells the user they are offline. A few things need a connection and say so (below). Signing out drops the stored list.

## Sub-features

- `offline-queue` item changes (add, tick, put back, edit, move, delete) show at once, are queued and retried until the server confirms; the same change is applied once even when an answer was lost.
- `offline-indicator` crossed-out cloud at the right of the bar above the list, accessible name „Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist“ (EN "Offline: changes will sync once the connection is back"); while online with unsent changes: „1 Änderung wird synchronisiert“ / „{n} Änderungen werden synchronisiert“ (EN "Syncing 1 change" / "Syncing {n} changes").
- `offline-start` cold start without network (even with a lapsed login token) shows the cached list within seconds, the add field focused, the indicator at once.
- `offline-retry` while offline the app retries about every 3 s and on app resume; the indicator disappears when the queue is empty and the connection is back.
- `offline-suggestions` while offline the add sheet's rows come from the cached usuals: typing offers the typed line and „Schon mal gekauft“ / "Bought before" rows matched as the server matches, typos and parts of words included ("Duschgl" offers „Duschgel, Schon mal gekauft“); the empty field still shows „Wieder fällig“ / "Due again" and „Zuletzt verwendet“ / "Recently used" rows. Enter waits up to 3 s for the server, then takes the device's first row. Details in quick-add (`qa-offline`) and usuals (`us-recent`).
- `offline-sorting` an item added offline has no category yet; it sits under „Wird einsortiert …“ (EN "Sorting …") until the server has classified it (the classifier runs in the database when the add arrives).
- `offline-needs-connection` things that refuse offline, below.
- `offline-signout` signing out removes the cached list and household from the device.

Needs a connection, exact texts (DE / EN):

- Reordering stores or categories, also moving or hiding categories in a store's own order: „Die Reihenfolge lässt sich nur mit Verbindung ändern.“ / "Reordering needs a connection." (snackbar; nothing changes).
- Adding, renaming or deleting a store (in Mehr → Läden or inline in the store picker): „Läden lassen sich nur mit Verbindung anlegen, umbenennen oder löschen.“ / "Adding, renaming or deleting stores needs a connection." (snackbar; nothing changes).
- Creating, renaming or deleting categories: the change shows, the write fails and the screen reverts with „Die Änderung konnte nicht gespeichert werden.“ / "The change could not be saved." (the same text for any catalog edit the server refuses). Before the app has noticed it is offline, a store change takes this path too.
- Creating or joining a household: „Keine Internetverbindung. Versuche es erneut, sobald du online bist.“ / "No internet connection. Try again once you're online."
- Export your data: „Keine Internetverbindung. Deine Daten wurden nicht exportiert.“ / "No internet connection. Your data was not exported."
- Delete account: „Keine Internetverbindung. Dein Konto wurde nicht gelöscht. Versuche es erneut, sobald du online bist.“ / "No internet connection. Your account was not deleted. Try again once you're online." and, when the household's fate cannot load: „Keine Internetverbindung. Was mit deinem Haushalt passiert, konnte nicht geladen werden.“ / "No internet connection. Couldn't load what happens to your household."
- Feedback: „Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.“ / "Not sent. Check your connection and try again." (note stays, button „Erneut senden“ / "Retry").
- Dictation text split: „Keine Verbindung. Der Text steht im Feld; prüfe ihn und tippe auf Hinzufügen.“ / "No connection. The text is in the field; check it and tap Add."
- Premium store: „Der Store ist gerade nicht erreichbar. Prüfe die Verbindung.“ / "The store can't be reached right now. Check your connection."

## How to get to it (user POV)

- Switch the phone to airplane mode (or lose signal) with the list open; keep using „Liste“. Look at the right end of the bar above the list for the cloud icon.
- Cold start offline: open the app with no network; the list from last time shows.

## Driving it with Playwright

Preconditions:

- Seeded household (`demo-familie`: Bananen, Vollmilch, Apfelsaft, Reis …), signed in, on „Liste“, and the list cached (wait until the synced list is stored; the spec polls localStorage for the key matching `/\blist\./`).
- Two ways to go offline: `context.setOffline(true)` (whole browser context; `setOffline(false)` to come back) or `const network = await cutOff(page)` (aborts every request to Supabase and closes its WebSocket; `network.restore()` reconnects), which also lets a reload happen with the app server reachable.

- **Queue while offline.** `cutOff(page)` or `setOffline(true)`; `addItem(page,'Käse')`, `tick(page,'Apfelsaft')`. Observable: `itemRow(page,'Käse')` visible, `itemRow(page,'Apfelsaft')` count 0, `page.getByText(/^Offline:/)` count 1 within 10 s.
- **Survives a reload.** `page.reload()` while still cut off: the same rows, add field focused, `getByText(/^Offline:/)` within 3 s.
- **Cold start offline with a lapsed token.** Also set `session.expires_at` in the `sb-*-auth-token` localStorage entry to the past (as `expireStoredSession` in `e2e/tests/offline-start.spec.ts`), `cutOff`, reload: `itemRow(page,'Reis')` visible within 3 s.
- **Sync back.** `network.restore()`: poll the API as the user (`apiAs(email)` then `from('items').select('name, status')`) until it shows Apfelsaft `bought`, Käse `active`, Reis `active`; `getByText(/^Offline:/)` count 0 within 15 s. Another session of the same user sees the result.
- **Suggestions offline.** Needs a history, so use `launch.sh --scenario heavy-history` (items on the list are not offered). While cut off, `typeInto(addField(page), 'Duschgl')`: a row button whose name contains `Duschgel, Schon mal gekauft` shows. Clear the field: the „Wieder fällig“ rows still show.
- **Store needs a connection.** While cut off, add a store in Mehr → Läden: `getByText('Läden lassen sich nur mit Verbindung anlegen, umbenennen oder löschen.')` and no new store.
- **Pending state.** Hold item writes with `page.route('**/rest/v1/items**', ...)` for non-GET methods; `tick(...)` shows `getByText(/^\d+ Änderung(en)? w(ird|erden) synchronisiert$/)`; release it and it disappears.
- **Sign-out clears cache.** `openMore(page,'Abmelden')`; `Object.keys(localStorage).filter(k => /\b(list|household)\./.test(k)).length` is 0.
- **Expired token retried.** Fake a 401 JWT answer on item writes with `page.route`; the write retries with a fresh token and no „Änderung abgelehnt“ snackbar (test in `offline-start.spec.ts`).
- **Needs-connection example (feedback).** Open Feedback, type a note, `context.setOffline(true)`, click „Senden“: `getByText('Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.')`, then restore and „Erneut senden“.
- Specs: `scripts/verify.sh --only e2e -- tests/offline-start.spec.ts`, `tests/live-sync.spec.ts` (tick while offline), `tests/list-header.spec.ts` (icons), `tests/feedback.spec.ts`.

## Gotchas

- An item added offline has no category yet, so it shows under the heading „Wird einsortiert …“ until the connection returns; do not assert its category while offline.
- Offline matching: `getByText(/^Offline:/)` also matches the tooltip/semantic label; expect count 1.
- Sign-in, sign-up, accepting an invite and password reset need the server: offline behaviour of the login screen is unverified (not read in detail).
- An offline start before the first ever sync shows nothing cached: unverified (not exercised in specs).
- Item order changes by dragging items between categories/stores use item moves (queued); reordering the stores or categories themselves needs a connection.
- Queued changes are tied to the device: a second device only sees them after sync.
