# Decluttered list (behind a flag)

Behind the PostHog flag `list-declutter` (rollout off, internal installs only; job 229, Peter's pick from job 227's round 2), the list screen loses its second header row and the household sheet gains a page per household. With the flag off everything is as in [lists-and-claims](./lists-and-claims.md) and [household-invites](./household-invites.md).

## Sub-features

- `ld-switcher` top left of the list one raised button shows the household small and grey over the shown list in bold („Familie Brandt“ over „Einkaufsliste“), with an up-down icon. Its accessible name is „<list> · <household>“ („Einkaufsliste · Familie Brandt“), its hint „Liste oder Haushalt wechseln“ / "Switch list or household". It shows with one household and one list too. There is no row of list tabs under it.
- `ld-glass` the status bar area and the bar are one see-through layer: the rows scroll on under it, blurred, in light and dark, and a line marks its lower edge once the list has scrolled. Taps on the layer never reach a row under it.
- `ld-total` with the flag `prices-and-trip-total` on too: „Einkaufssumme“ / "Shopping total" with „<n> mit Preis · <n> offen“ and the sum is a row of the list after the last store section and before „Zuletzt verwendet“, not a bar over the add field.
- `ld-pill` the tab pill keeps „Liste“, „Verlauf“ and „Mehr“ at 130 % text also on a 358 px phone (its tabs' hexes narrow first); at larger text the unselected tabs show their icon only, as without the flag.
- `ld-sheet` a tap on the switcher opens the sheet on the shown household's page: „‹ Haushalte“ / "‹ Households"; the household's name with „<n> offen“ and the button „Einladen“ / "Invite" (no icon before the name); the members row „3 Mitglieder · 1 Einladung offen“ / "3 members · 1 open invite" (the invites part only with open person invites); „Listen“ / "Lists" with each list (open count, a check on the shown one, a menu „Aktionen für „<name>““ with „Umbenennen“ and „Löschen“, not on the last list); „Neue Liste“. A tap on a list shows it and closes the sheet; on another household's page it switches to that household and shows that list.
- `ld-households` „‹ Haushalte“ shows today's „Deine Haushalte“ without the invite buttons: each household with a chevron, a tap opens its page (it does not switch). Pending join requests, „Neuer Haushalt“, „Mit Code beitreten“ and „Siri, Alexa & KI nutzen: …“ (with `default-list-voice-target` also „Liste: …“) are as today.
- `ld-members` the members row opens „Mitglieder“ / "Members" with „‹ <household>“: each member with their role and, for the owner and admins, the same menu as on More's household page (remove asks „<Name> entfernen?“); „Leute einladen“ / "Invite people" (the invite sheet); „Offene Einladungen“ / "Open invites" with each open person invite's code, „gültig bis …“ and „Widerrufen“ / "Revoke" (no confirm, as on the invite sheet).
- `ld-back` back goes members → household page → households. The system back (Android) goes the same way. A tap beside the sheet, Escape or dragging it down closes it from any page.
- `ld-reorder` press and hold a list or a household, then drag it up or down. The lists' order is the household's (as „Nach oben“ / „Nach unten“ on More's page); the households' order is each member's own, kept on the server, and also orders them in MCP and the API. Screen readers in the phone apps get „Nach oben“ / „Nach unten“ actions on each row (not on the web, whose engine has no custom actions). Moving another list first never changes the list on screen. Offline, changing lists is refused with „Listen lassen sich nur mit Verbindung anlegen, umbenennen, sortieren oder löschen.“, also for another household's lists.

## How to get to it (user POV)

- Only with the flag `list-declutter` on (PostHog; internal installs). A local web build: `VH_DEFINES="FLAGS_ON=list-declutter,prices-and-trip-total" helpers/launch.sh` (on the Hetzner runner with `FLUTTER_DIR=~/flutter-3.50.0`).
- Tab „Liste“ → the switcher top left → the shown household's page; „‹ Haushalte“ → all households; the members row → „Mitglieder“.

## Driving it with Playwright

- `node journeys/list-declutter.mjs <dir> [--lang de|en] [--dark] [--scale 1.3]` on `demo-familie` or `demo-family-en` (not through drive.sh: a sub-feature journey). It adds two lists, a second household and an open person invite through the API, shoots the list (top, scrolled, end with the total), the three sheet pages and the members page, drags a list and a household by real touch (CDP touch events, 700 ms hold) and checks the new orders through `lists` and `my_households`, and that the switcher still names the same list. It removes what it added.
- The switcher: `page.getByRole('button', { name: / · Familie Brandt$/ })`. With the sheet open the header is under the barrier and has no role: read the switcher before opening or after closing (Escape).
- Text size 130 %: set `document.documentElement.style.fontSize = '130%'` at DOMContentLoaded (`context.addInitScript`).
- Widget tests: `app/test/list/list_declutter_test.dart` (header, glass, total row, pill labels), `app/test/household/switcher_sheet_test.dart` (pages, back, reorder, semantics actions, invite, members, 130/160 %).

## Gotchas

- A first list stored as „Einkaufsliste“ shows as "Shopping list" in English (`listName`): compare what the switcher shows, not the database name.
- `ReorderableDelayedDragStartListener` needs the hold to stay still for the long-press time; a mouse drag without the hold scrolls the sheet instead.

**Last verified.** branch job/229-list-declutter-impl, 2026-11-14 (CET), driven on the web build with `FLAGS_ON=list-declutter,grocery-log,prices-and-trip-total`, German light and English dark at 100 % and 130 %, PASS (`docs/screenshots/229/`).
