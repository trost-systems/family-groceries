# Home Screen widgets (held)

On iPhone and Android, Hummlist has a Home Screen widget: how many items are open, the next items with their quantity and the store's full name in a hex pill, and in the medium size a „Hinzufügen“ / "Add" button. A tap opens the list; Add opens it with the add sheet. The widget shows what the app last saw and works offline from that; it never ticks items off. Its announcement is held (`home-widgets` hold in releases/flags.json) until Peter's device test on iPhone and Android.

## Sub-features

- `widget-small` small (iPhone systemSmall, Android 2x2): the count („3 offen“ / "3 open") and three items.
- `widget-medium` medium (iPhone systemMedium, Android 4 columns): the count, five items with store pills, the Add button, „+N weitere“ / "+N more".
- `widget-empty` „Alles erledigt“ / "All done" when nothing is open.
- `widget-prompts` „Melde dich in Hummlist an“ / "Sign in to Hummlist"; „Richte deinen Haushalt in Hummlist ein“ / "Set up your household in Hummlist"; „Öffne Hummlist, um deine Liste zu sehen“ / "Open Hummlist to see your list" before the app ever ran.
- `widget-open` tap: the list. `widget-add` Add: the list with the add sheet open and the keyboard up.

## How to get to it (user POV)

- iPhone: hold an empty spot on the Home Screen → „Bearbeiten“ → „Widget hinzufügen“ → Hummlist → small or medium → „Widget hinzufügen“.
- Android: hold an empty spot → „Widgets“ → Hummlist → drag it to the Home Screen; make it four columns wide for the medium layout.
- Guides (drafts until the hold ends): „Hummlist auf dem Home-Bildschirm: das Widget“ (`/de/anleitungen/widget`), "Hummlist on your Home Screen: the widget" (`/en/guides/widget`).

## Driving it with Playwright

Preconditions:

- Not on the web: the web build has no widgets and ignores the widget links. Nothing here is drivable with Playwright.

- **App side.** `cd app && flutter test test/home_widget` (what the widget gets, when, and what a tap opens). Details: `.cursor/skills/verify-family-groceries/features/home-widgets.md`.
- **Guides.** On a local or preview site build both guides show with the draft banner; production leaves them out.

## Gotchas

- Unverified on devices until Peter's test (docs/NEEDS_PETER.md, job 63). Describe the widget as coming, never as released.
- The widget follows the phone's light or dark mode, not the app's theme setting.
- A partner's adds appear in the widget after Hummlist was open on this phone again; there is no background refresh.
- No ticking from the widget.
