# Family Groceries verification map

This directory is the maintained source for verifying the user-facing behavior of Family Groceries. Read this index before driving the app, then use the matching feature file as the recipe. Each recipe drives the real app through `fg` (run it as `scripts/fg` from the repo root).

## Baseline preconditions

- Set your port block: `export FG_PORT_PREFIX=<prefix>` (548 for job 05; never 543 on the shared box, which belongs to job 1).
- Run `fg up --clients peter,lea`. It exits 0 when the stack, the seed and both apps are usable.
- Run `fg doctor` and require `"ok": true` (exit code 0). On a failure it prints `"ok": false` with `error.code` `unhealthy` and every check, each failed one with its `fix`.
- Sign both apps in: `fg login peter` and `fg login lea`. Both users are in the household "Familie Test", password `test-password-123`.
- The seed has no items. Recipes create their own and mark them bought afterwards.
- For any other state (long lists, weeks of history with usuals, many stores, three members mid-shop, awkward names, a pending invite, a user without a household), seed a scenario instead: `fg scenario list`, `fg seed <scenario>`, then `--as <run>:<handle>` on any user flag, and `fg teardown <run>` at the end. Scenario runs never reset the database. See `docs/TEST_FIXTURES.md`.
- Sync between two or three members is driven on web with `fg sync <scenario> --clients 2|3 --script <file>`, which captures frames, videos and latencies by itself (see [Live sync](./live-sync.md)).
- Never drive an instance that this run did not start.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise. `fg up --fresh` restores the baseline: database reset and both users reseeded. Then `fg login` each client again.
- Prefer ValueKeys (`--key`), then field labels (`--label`), tooltips (`--tooltip`), exact text (`--text`), and coordinates last.
- A list row is one button: `fg tap --text "<row text>"` ticks it, `fg marionette -- long-press --text "<row text>"` opens its edit sheet, and `fg drag` moves it. The row text reads the quantity first ("2 l Milch", "6× Bananen"), a row without a quantity the name. To act on something inside a row, scope to it: `--row "<row text>"`.
- Seeded scenario runs share the stack with the baseline household. Read with `--as peter` (or `--as <run>:<handle>`) so a query sees one household, and filter `--write` preconditions by household.
- Wait for state with `fg wait`. Never use sleep.
- `fg type --key add-item-field --input <item> --submit` adds through the add sheet, which stays open after the add: wait for its note (`fg wait --contains "Hinzugefügt: <item>"`), then `fg press escape` before you check or touch the list. While the sheet is open, `fg find` and `fg wait` don't see the list's rows, and the tabs don't take taps.
- Screens of the More tab open from `fg tap --key tab-more`. The tab reopens the page it last showed (Konto after an `acct-*` recipe, Zugänge after an `mcp-*` one): when `fg wait --key more-screen` times out, tap `tab-more` once more, which goes to the More list. More is a lazy list: run `fg marionette -- scroll-to --key <entry>` before tapping an entry below the fold (`menu-account`, `more-sign-out` and everything after them on a 412×892 client).
- `fg find` and `fg wait` see only widgets the list has built, so a row below the fold doesn't exist for them. Keep the list short (mark earlier items bought with `fg db query --write`) or bring the row in with `fg marionette -- scroll-to --text <name>`.
- Treat every command as literal. Keep quoted names, umlauts and flags unchanged.
- Set preconditions with `fg db query --write` or `fg peer`. Prove the behavior under test only through the app UI.

## Proof and skip reporting

- Capture the user action and the resulting state: a screenshot before and after, and `fg record start/stop` across the action.
- A mutation needs a second, read-only view of the stored value: `fg db query`, or the other client.
- Sync proofs show the change on the client that did not act.
- Record the feature ID and the entry point with every artifact (use them in `--name`).
- Report an unreachable path with the command you attempted and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with fg` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands and observable proof.

## Features

- [List and walk order](./list-walk-order.md) covers design H's list: store sections and category dividers, walk order, a tap that ticks with undo, dragging rows onto rows, category and store dividers, reordering stores and categories by drag or divider menu, folds and the explainer card kept per device, and a partner's adds and moves.
- [Quick add](./quick-add.md) covers the add bar and the add sheet: autofocus on desktop, rows with their sources, Enter for the first row, store and category chips, the added note with undo, due usuals, closing, and tick with undo, delete and re-add from history.
- [Shell and More](./shell-more.md) covers the tabs (Liste, Mehr; a rail from 840 px), every entry of the More tab, the language switch kept on the device, the licenses, the privacy draft and the imprint link.
- [Edit an item](./edit-item.md) covers the edit sheet (Bezeichnung, Marke, Eigenschaften, Menge with −/+, store and category chips, Fertig saving only changes, Löschen with undo), the row's "Marke · Eigenschaften" line, and how Siri and MCP entries are split into those fields.
- [Live sync](./live-sync.md) covers two members seeing each other's adds and ticks without reloading.
- [Sign-in](./auth.md) covers email and password, sign-up, magic link through the local inbox, sign-out, and the Google and Apple buttons (web build only).
- [Household](./household.md) covers creating a household, inviting by code and joining with it.
- [Classifier](./classifier.md) covers automatic categories for new items, moving an item to another category, and learning from the move.
- [Stores](./stores.md) covers stores as list sections in their own category order, "Ohne Laden", tagging items to a store by drag or edit sheet and remembering it, and each store's layout screen.
- [Categories](./categories.md) covers Mehr → Kategorien verwalten (also from the "Ohne Laden" divider): adding, renaming, deleting and reordering categories.
- [Analytics and error tracking](./analytics.md) covers the analytics question after the first sign-in (before onboarding or the list), what is sent after a yes and that nothing is sent after a no, Mehr → Nutzungsdaten, the internal device mark with "Testfehler senden", and error tracking from the app and the edge functions.
- [Feedback](./feedback.md) covers Mehr → Feedback senden: the note with optional kind and contact, what is attached, the length limits, the error with Retry, and the row in `public.feedback` (insert-only).
- [MCP access](./mcp-access.md) covers the consent page an AI app opens (web build only) and Mehr → Zugänge: the MCP URL, creating and revoking access tokens, and disconnecting OAuth apps, each cut off on the next request.
- [Voice](./voice.md) covers the Siri endpoint (JSON and the spoken text format, duplicates, German errors, 30-item limit, personal access tokens) and the app's on-device microphone.
- [Account](./account.md) covers Mehr → Konto: exporting your data as JSON and deleting your account, with the household kept for the other members or deleted with the last one.
- [Hosted backend](./hosted-backend.md) covers the hosted project: the health check that reads Postgres, the smoke test after every deploy, the daily keepalive, nightly encrypted backups with their restore drill, and rolling edge functions back.
- [Hosted web app](./web-hosting.md) covers the production web app on Vercel: deep links, cache headers, the Google and Apple sign-in pages, and the build Vercel runs.
