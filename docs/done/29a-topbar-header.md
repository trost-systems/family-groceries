# Job 29a: fixed-height top bar, no household name or count on the list

PR: https://github.com/trost-systems/family-groceries/pull/113

Peter, 2026-10-29: "the cloud icon in the top right increases the top bar height for the blink of an eye leading to the whole view jumping. That shouldn't happen." And: "showing the household name all the time doesn't add value and I'm also unsure if the number of items is actually interesting."

## What changed for users

- **The list no longer jumps.** The bar above the list is 44 px tall (below the phone's top inset) in every state. The sync icon (cloud with arrow while a change is on its way, crossed-out cloud offline) appears and disappears inside a fixed 44 x 44 slot. Before, the header grew by 10 px whenever the icon showed, which happens briefly after every tick or add until the server confirms it, and the whole list moved with it.
- **No household name, no item count on the list.** The bar only holds what changes: "N neu (von X)" when a partner's adds came in live (left) and the sync icon (right). While neither shows, it is an empty band with its bottom line, kept so the list never moves. The household name stays in Mehr (household section, invite, join); the per-store counts stay on the store dividers.

## Why it jumped

`_SyncIndicator` was `SizedBox.shrink()` while synced and a 48 px padded icon otherwise; the header's height followed its taller child (two text lines, about 36 px, or the icon). Measured in Chrome on main (probe run 41030250403): the header's bottom line moved from y 51 to 61 when the pending icon showed.

## Where

- `app/lib/list/list_screen.dart`: `_Header` (key `list-header`, `_Header.height` = 44) and `_SyncIndicator` (centred in its slot); `ShoppingList` no longer takes `household`.
- Widget tests, `app/test/list/list_screen_test.dart`, group "the bar above the list": the bar's height and the list's top stay equal through synced, pending (a held write), offline with a pending change, reconnecting, synced again, a partner add, and a partner add offline, with a 47 px notch; the bar holds no text, no `list-title`/`list-count` and no heading. `shell_test`, `add_sheet_test`, `dictation_test`, `add_field_autofocus_test`: one `household:` line less each.
- e2e: new `list-header.spec.ts` (no household name or "N Artikel"; the first entry under the bar keeps its y while a held write shows the pending icon, after it syncs, while offline and back online; screenshots). `helpers.ts`: `listBarHeight`, `listArea` no longer reads the count. `web-build.ts` `signIn` and `edit-sheet.spec.ts` wait for the add field / a row instead of "N Artikel". `perf.spec.ts` times the list by the "Ohne Laden, 200 Artikel" divider. `catalog.ts` `groupHeadings` no longer drops the household heading.
- Recipes: `SKILL.md` handle table, `features/list-walk-order.md` (`lw-top-bar` and a "Top bar" step), `features/auth.md`, `features/household.md`, `features/live-sync.md` (no more `list-title` checks).
- Decisions: `docs/DECISIONS.md`, "Job 29a". `listItemCount` stays in the arb files (19 and 29b own them), to be removed in a later cleanup.

## How to verify

```bash
(cd app && flutter analyze && flutter test test/list/list_screen_test.dart --plain-name 'the bar above the list')
scripts/ci-e2e.sh --spec tests/list-header.spec.ts --no-db
```

## Test results

- Locally (Mac): `flutter analyze` no issues; `flutter test` 686 passed (after rebasing onto 29e).
- The new height test fails against the old layout: with the old padded icon and no fixed height, the bar measures 95 px instead of 91 while pending ("Expected: 91.0, Actual: 95.0, pending").
- Before (main's app, probe branch since deleted, run 41030250403): the first divider at y 280 synced, 290 pending; screenshots `docs/screenshots/29a/before-*.png`.
- CI on the PR, run 41031392863 on head 5cf966a: every gate green, e2e 117 passed (58 + 59) with no flaky retry, `ci-ok` green. The first PR run (41030234639) failed three e2e tests: `list-header.spec.ts` (my bound assumed the first divider right under the bar, but the explainer card sits there; it now measures the card) and `edit-sheet.spec.ts` (29c's spec, which landed meanwhile, waited for "N Artikel"; it now waits for a row). `stores.spec.ts` failed once on a drag scrolling up to Lidl. The drag geometry is unchanged (`listArea`'s top is still the bar's bottom), and it passed in the next run.
- Screenshots: `docs/screenshots/29a/` (before: synced, pending, offline with the household name and count; after: the same three states).

## Missing or blocked

Nothing known.
