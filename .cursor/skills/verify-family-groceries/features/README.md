# Family Groceries verification map

This directory is the maintained source for verifying the user-facing behavior of Family Groceries. Read this index before driving the app, then use the matching feature file as the recipe. Each recipe drives the real app through `fg` (run it as `scripts/fg` from the repo root).

## Baseline preconditions

- Set your port block: `export FG_PORT_PREFIX=<prefix>` (548 for job 05; never 543 on the shared box, which belongs to job 1).
- Run `fg up --clients peter,lea`. It exits 0 when the stack, the seed and both apps are usable.
- Run `fg doctor` and require `"ok": true` (exit code 0). On a failure it prints `"ok": false` with `error.code` `unhealthy` and every check, each failed one with its `fix`.
- Sign both apps in: `fg login peter` and `fg login lea`. Both users are in the household "Familie Test", password `test-password-123`.
- The seed has no items. Recipes create their own and mark them bought afterwards.
- Never drive an instance that this run did not start.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise. `fg up --fresh` restores the baseline: database reset and both users reseeded. Then `fg login` each client again.
- Prefer ValueKeys (`--key`), then field labels (`--label`), tooltips (`--tooltip`), exact text (`--text`), and coordinates last.
- To act on a list item, scope to its row: `--row <item name>`.
- Wait for state with `fg wait`. Never use sleep.
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

- [Quick add](./quick-add.md) covers the autofocused add field, Enter-to-add with focus kept, quantities, duplicates, tick with undo, delete and re-add from history.
- [Live sync](./live-sync.md) covers two members seeing each other's adds and ticks without reloading.
- [Sign-in](./auth.md) covers email and password, sign-up, magic link through the local inbox, sign-out, and the Google and Apple buttons (web build only).
- [Household](./household.md) covers creating a household, inviting by code and joining with it.
- [Classifier](./classifier.md) covers automatic categories for new items, moving an item to another category, and learning from the move.
- [Stores](./stores.md) covers the store picker "Alle/dm/Lidl/Edeka", store views and their order, dm's folded items, tagging items to a store and remembering it, and each store's layout.
- [Categories](./categories.md) covers Menü → Kategorien verwalten: adding, renaming, deleting and reordering categories.
- [MCP access](./mcp-access.md) covers the consent page an AI app opens (web build only) and Menü → Zugänge: the MCP URL, creating and revoking access tokens, and disconnecting OAuth apps, each cut off on the next request.
- [Voice](./voice.md) covers the Siri endpoint (JSON and the spoken text format, duplicates, German errors, 30-item limit, personal access tokens) and the app's on-device microphone.
- [Account](./account.md) covers Menü → Konto: exporting your data as JSON and deleting your account, with the household kept for the other members or deleted with the last one.
- [Hosted backend](./hosted-backend.md) covers the hosted project: the health check that reads Postgres, the smoke test after every deploy, the daily keepalive, nightly encrypted backups with their restore drill, and rolling edge functions back.
- [Hosted web app](./web-hosting.md) covers the production web app on Vercel: deep links, cache headers, the Google and Apple sign-in pages, and the build Vercel runs.
