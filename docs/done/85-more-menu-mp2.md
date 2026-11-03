# Job 85: More is M-P2

Peter picked M-P2 from job 79's prototypes (PR #206, `docs/design/menu-research.md`). Decisions:
`docs/DECISIONS.md`, Job 85 (and addendum 1). Legal: `docs/NEEDS_LEAD.md`, Job 85.

## What was built

- **The menu** (`app/lib/more/more_screen.dart`). Inset groups (2 px contour, small sticker
  shadow, hairlines between rows) with a hex icon per row and one line per row, no hints:
  Konto and Hummlist Premium; Partner einladen, Anderem Haushalt beitreten, Archivierte
  Haushalte; Zugänge; Einstellungen and Nutzungsdaten; Feedback senden and Hilfe & Kontakt;
  then „Rechtliches“ with Impressum, Datenschutzerklärung, „Nutzungsbedingungen (EULA)“ and
  Lizenzen as direct rows (addendum 1: the imprint is two taps from the list, §5 DDG);
  Abmelden alone in the error colour. Then the version (long press for an internal install, as
  before). The order is data (`_Item.groups`); rows that may not show (Premium before the
  offer, invite outside a household, Nutzungsdaten without an analytics key, flags) drop out,
  and an empty group with them.
- **Nutzungsdaten** (`/more/usage-data`): the same switch, hint and consent semantics as before,
  named as the consent text and the privacy policy name it (Mehr → Nutzungsdaten). A page of the
  More branch: back, reload, deep links, sign-in `next` links and the wide layout work; screen
  name `usage_data`. `/more/legal`, the Rechtliches page of the first round, redirects to
  `/more`.
- **Update card slot** (`app/lib/more/app_update.dart`): `AppUpdates` with `PatchReady` and
  `StoreVersion`; the app has no update check, so `NoAppUpdates` never offers one and the card
  never shows. The card (lemon sticker, one action, close) is tested and in the goldens.
- Stores and Categories are not in More (job 78). Job 79's prototype switcher never landed on
  main, so nothing to remove.

## How to verify

```sh
cd app && flutter test test/more test/analytics/more_toggle_test.dart test/app/router_test.dart
flutter test test/design/screens_golden_test.dart --plain-name more
cd .. && scripts/verify.sh --only e2e -- shell-more.spec.ts analytics.spec.ts
```

Goldens: `app/test/design/goldens/more-{light,dark,en-light,en-dark}.png`, `more-end-{de,en}-{light,dark}.png` (scrolled to the legal rows and sign-out), `more-usage-data-{light,dark}.png`, `more-update-{light,dark}.png`.
Screenshots of the web build: `docs/screenshots/85/`.
