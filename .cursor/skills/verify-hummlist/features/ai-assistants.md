# AI assistants (MCP) and access keys

An AI assistant such as Claude can read and change the household's shopping list through Hummlist's MCP server. The user connects it in one of two ways: signing in (OAuth) when the assistant asks, which opens a consent page „Zugriff erlauben?“; or with a personal access key that the user creates in the app (shown once). Everything is managed in Mehr → Zugänge: the server address with a copy button, the access keys, and the connected apps, each of which can be revoked or disconnected at once. Nothing needs Premium today.

## Sub-features

- `ai-url` the server address on Zugänge under „MCP-Server“ with a copy button (tooltip „Kopieren“, then „Kopiert“): `https://mcp.hummlist.com` in production builds.
- `ai-consent` the page an assistant opens to connect: „Zugriff erlauben?“ with „Angemeldet als <email>“, „Haushalt: <name>“, „<App> möchte:“ and what that includes; buttons „Erlauben“ and „Ablehnen“. A signed-out user signs in on the way and lands back on it. After a decision the page turns into „Verbunden“ with „Fertig, du kannst zu <App> zurückkehren.“ (EN "Connected", "Done, you can return to <App>.") or „Nicht verbunden“ with „Abgelehnt, du kannst zu <App> zurückkehren.“, and stays until the assistant's own page loads (Claude takes up to about 10 s).
- `ai-key-create` „Token erstellen“: name it, the key (`fgp_…`) is shown once, „Fertig“ closes it.
- `ai-key-list` keys list as „<Name>“ with „…<letzte 4> · Erstellt am <Datum> · Noch nie benutzt“ (or „Zuletzt benutzt <Datum>“).
- `ai-key-revoke` revoke a key: „<Name> widerrufen“ then „Widerrufen“; the next request with it is refused.
- `ai-key-limit` at most 20 active keys: „Höchstens 20 aktive Tokens.“
- `ai-key-retention` a key that has ended (revoked, or its owner left the household, or an automatic Siri key whose sign-in ended) disappears from the list at once and the stored record of it is deleted 30 days later by a daily clean-up. Leaving a household ends the keys made for it for good (rejoining does not bring them back).
- `ai-apps` „Verbundene Apps“ lists each approved assistant with „Verbunden am <Datum>“ and what it may do; empty state „Noch keine App verbunden.“
- `ai-disconnect` „<App> trennen“, confirm „Trennen“: access ends at once, also the refresh token.
- `ai-tools` what an assistant can do (six tools): show the open list (optionally one store or category) with brand and properties, plus how many items are open on the whole list and how many were ticked in the last 24 hours; add one or more items (the name is split into name, brand, properties, quantity; categories and stores are filled in automatically; an item already on the list is reported, not duplicated; a similar one like „Karotten“ next to „Möhren“ is added and reported); tick items off (they move to „Zuletzt verwendet“); move an item to another category and/or store (the household remembers it); list categories; list stores. Changes show up in the app on all phones within seconds.

## How to get to it (user POV)

- Tab „Mehr“ / "More" → section „Zugänge“ / "Access" → row „Zugänge“ / "Access" (hint „MCP-Server, Zugangsschlüssel, verbundene Apps“ / "MCP server, access tokens, connected apps"). The page has these headings in German: „MCP-Server“, (on iPhone builds also „Siri“, see the siri map), „Zugriffstoken“, „Verbundene Apps“. English: "MCP server", "Access tokens", "Connected apps" (empty: "No apps connected yet.").
- Text under „MCP-Server“: „Für Claude, ChatGPT und andere KI-Assistenten. Verbinde per Anmeldung (OAuth) oder mit einem Zugriffstoken.“ / "For Claude, ChatGPT and other AI assistants. Connect by signing in (OAuth) or with an access token."
- „Zugriffstoken“ empty state „Kein aktiver Token.“ / "No active token."; create dialog „Token erstellen“ with field „Name“ (hint „z. B. Claude oder Kurzbefehle“), buttons „Abbrechen“ / „Erstellen“; result dialog „Token erstellt“: „Kopiere den Token jetzt. Er wird nicht noch einmal angezeigt.“ / "Copy the token now. It won't be shown again."
- Revoke dialog „Token widerrufen?“: „Apps, die ihn benutzen, verlieren sofort den Zugriff.“ Disconnect dialog „<App> trennen?“: „Die App verliert sofort den Zugriff auf deine Liste.“
- Consent page lines: „<App> möchte:“ then „Einträge deiner Einkaufsliste lesen, hinzufügen, abhaken und verschieben. <App> und sein Anbieter erhalten dabei die Inhalte eurer Liste.“ (EN "Read, add, tick off and move items on your shopping list. <App> and its provider will receive your list contents."); invalid link: „Diese Anfrage ist ungültig oder abgelaufen. Starte die Verbindung in deiner App neu.“
- In the assistant (Claude): add a custom connector with the address; no client ID or secret. Tester guide: hummlist.com `/de/anleitungen/claude`, `/en/guides/claude`. Claude Code: `claude mcp add --transport http einkauf https://mcp.hummlist.com`. ChatGPT only on Business/Enterprise workspaces (docs); unverified on a live account.
- Privacy statement (quoted, do not edit): „Wir speichern zu jedem Schlüssel einen Namen, einen Hash, seine letzten vier Zeichen und den Zeitpunkt der letzten Nutzung. Endet ein Schlüssel, etwa weil du ihn widerrufst oder den Haushalt verlässt, löschen wir diese Angaben 30 Tage danach beim nächsten täglichen Aufräumen.“

## Driving it with Playwright

Preconditions:

- Seeded household „Familie Brandt“, signed in. For OAuth steps the browser context must be the one signed in to the app; the test registers an OAuth client with the official MCP SDK (`TestOAuthProvider`, `openAuthorization`, `callbackParams` in `e2e/tests/mcp-helpers.ts`). The Driving section may call the MCP endpoint over HTTP against the local stack only (`mcpUrl` = local `/functions/v1/mcp`), never production.
- Specs: `e2e/tests/mcp.spec.ts` (OAuth with consent, deny, sign-in on the way, access key lifecycle, cross-household, forged tokens), `e2e/tests/integration-lock.spec.ts`; run with `scripts/verify.sh --only e2e -- tests/mcp.spec.ts`.

- **Open Zugänge.** `await openMore(page, 'Zugänge')`. URL `/more/access`.
- **Create a key.** `page.getByRole('button', { name: 'Token erstellen' }).click()`, `typeInto(page.getByRole('textbox', { name: 'Name' }), 'Claude')`, `page.getByRole('button', { name: 'Erstellen' }).click()`. Observable: `page.getByText(/^fgp_[A-Za-z0-9_-]{43}$/)` visible. Click `page.getByRole('button', { name: 'Fertig' })`: `page.getByText(/fgp_/)` count 0 (shown once).
- **Use it (HTTP, local only).** `connectWithToken(token, 'legacy' | 'modern')`, then `call(client, 'add_items', { items: [{ name: 'Klopapier' }] })`, `call(client, 'list_items', {})`, `call(client, 'list_stores')`. In the app: `openTab(page, 'Liste')`, `itemRow(page, 'Klopapier')` visible without reload.
- **Key row.** After use: `page.getByRole('group', { name: /^Claude …\S{4} · Erstellt am .* · Zuletzt benutzt / })`.
- **Revoke.** `page.getByRole('button', { name: 'Claude widerrufen' }).click()`, then `page.getByRole('button', { name: 'Widerrufen' }).click()`; the button `Claude widerrufen` has count 0 and a `tools/list` POST with the key returns 401 with `www-authenticate` containing `error="invalid_token"`.
- **Consent.** Open the authorization URL returned by the SDK flow (`openAuthorization(page, url, baseURL)`): the page shows the app name (`getByText('Claude (E2E)')`) and the email; `page.getByRole('button', { name: 'Erlauben' }).click()` returns the callback with `code`; `Ablehnen` returns `access_denied`. While the callback is pending the page shows `getByText('Fertig, du kannst zu Claude (E2E) zurückkehren.')` (a `page.screenshot` waits for the navigation; capture over CDP, `Page.captureScreenshot`). Signed out: sign in on the way with `typeInto(getByRole('textbox', { name: 'E-Mail' }), …)`, `typeInto(getByRole('textbox', { name: 'Passwort' }), …)`, `getByRole('button', { name: 'Anmelden' }).last().click()`, then Erlauben.
- **Connected apps and disconnect.** Back in Zugänge: `getByRole('button', { name: 'Claude (E2E) trennen' }).click()`, `getByRole('button', { name: 'Trennen', exact: true }).click()`; `getByText('Noch keine App verbunden.')` visible; the access token and refresh token are refused.
- **Retention (database).** Admin client: after revoking, the row's `revoked_at` is set; the row is deleted 30 days later by the daily job `purge_access_tokens` (call it as postgres after setting `revoked_at` back 31 days to prove deletion). Leaving the household (delete the `household_members` row) sets `revoked_at` for that user's keys in that household. unverified in a live run (read from the migration only).

## Gotchas

- The app screen title is „Zugänge“ in German; in English the app calls it "Access" and the site copy (landing) says "More › Connections". Do not take one for the other.
- Keys are shown once: copy the `fgp_…` value before „Fertig“. A second key with the same name makes the button „<Name> widerrufen“ ambiguous.
- A key works only while its owner is a member of that household; revoked keys vanish from the list immediately, the record is deleted after 30 days.
- The consent page is part of the Flutter web build (route `/oauth/consent`), reachable from an authorization link only; use the e2e helper flow.
- With the e2e build `INTEGRATION_LOCK` is on; with the server switch on, Zugänge shows a Premium card and „Pausiert: braucht Hummlist Premium“ under every key and app, and tool calls answer that the household needs Premium. Production has both off: that never shows. Do not describe it.
- Tools answer in German (descriptions and error messages), e.g. unknown names come back as tool errors with the valid options. Results are JSON text.
- Alexa also shows under „Verbundene Apps“ as „Amazon Alexa“ (see the alexa map).
- unverified (third-party UIs): how ChatGPT and Claude present their connector screens.
