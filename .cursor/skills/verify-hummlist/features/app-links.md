# Links into the app (app.hummlist.com)

A link to `https://app.hummlist.com/<path>` opens that screen of Hummlist: in the installed iPhone or Android app when there is one, otherwise in the web app, with the same result. The paths are the list (`/list`), the add sheet (`/add`), one store's section (`/stores/<store id>`), the More tab (`/more`) and its pages (`/more/invites`, `/more/settings` and the others), and invites (`/join/<code>`). Any other path opens the list. Signed out, the link waits through sign-in (and, for an account without a household, through onboarding) and then opens its screen. The route table is `docs/DEEP_LINKS.md`.

## Sub-features

- `al-list` `/list` opens the list; the address becomes `/`.
- `al-add` `/add` opens the list with the add sheet open (group „Hinzufügen“ / "Add") and the field „Was brauchst du?“ / "What do you need?" focused; the address becomes `/`.
- `al-store` `/stores/<store id>` opens the list scrolled so that store's divider („<Store>, N Artikel“) is in view, unfolded if it was folded (the fold is then off for good, as after a tap). An id the household does not have, or a store without open items, opens the list as it is.
- `al-more` `/more`, `/more/invites` („Einladungen“), `/more/settings` („Einstellungen“), `/more/settings/language`, `/more/access` („Zugänge“), `/more/account` („Konto“), `/more/lifetime` (Premium page) open that page of the More tab; back goes to More.
- `al-join` `/join/<code>` opens the join screen with the code (see household-invites, `link-join`).
- `al-unknown` any other path, signed in, opens the list. Signed out it opens the sign-in page without carrying the path.
- `al-signed-out` signed out, a link above opens „Anmelden“ with `?next=<path>` in the address; after sign-in (and the usage-data question on a new device) the link's screen opens.
- `al-no-household` an account without a household goes through „Willkommen bei Hummlist“ and creating or joining a household, with `?next=` in the address, and then lands on the link's screen instead of the invite step.
- `al-sign-out` signing out never carries the current page: from Mehr → Konto, „Abmelden“ ends on plain `/login`.
- `al-apps` on the iPhone and Android apps the same paths open the app instead of the browser (universal links, App Links). `/`, the sign-in pages, onboarding and the MCP consent page always stay in the browser.

## How to get to it (user POV)

- Tap an app.hummlist.com link in an email, a message or a web page (for example the onboarding email's link to „Einladungen“).
- In a browser: type or paste the address.

## Driving it with Playwright

Preconditions:

- Baseline household signed in (`signIn` in `helpers/lib.mjs`) for the signed-in recipes; a fresh browser context for the signed-out ones. Store ids come from the API: `apiAs(inst, 'mia')` then `.from('stores').select('id, name')`.

- **Add sheet.** `page.goto('/add')`. Observable: URL ends in `/`, `addSheet(page)` visible, `addField(page)` focused.
- **Store.** Fold Edeka with `storeDivider(page, 'Edeka').click()`, then `page.goto('/stores/<edeka id>')`. Observable: URL `/`, `storeDivider(page, 'Edeka')` in the viewport, Edeka's items visible again.
- **More page.** `page.goto('/more/invites')`. Observable: URL stays `/more/invites`, button „Neue Einladung“ visible; „Zurück“ goes to `/more`.
- **Unknown.** `page.goto('/does/not/exist')`. Observable: URL `/`, the add field visible, no add sheet.
- **Signed out.** In a fresh context `page.goto('/more/invites')`. Observable: URL `/login?next=/more/invites`. Sign in with „E-Mail“, „Passwort“, „Anmelden“, answer the usage-data question (`answerConsent`): URL `/more/invites`.
- **Without a household.** `signUp(page, email, '/more/settings')`: URL `/welcome?next=/more/settings`; „Haushalt erstellen“, „Überspringen“: URL `/more/settings`.
- **Specs.** `e2e/tests/deep-links.spec.ts`; router cases in `app/test/app/router_test.dart`; the domain files in `app/test/app/deep_links_config_test.dart`. Run with `scripts/verify.sh --only e2e -- tests/deep-links.spec.ts`.

## Gotchas

- `page.goto` reloads the web app, as a tapped link does. Wait for the target screen before the next `goto`.
- `al-apps` cannot be driven on a box without simulators. The domain files are checked by `deep_links_config_test.dart`, the live ones by `node e2e/web-smoke.mjs https://app.hummlist.com`. The new paths reach the iPhone app only once app.hummlist.com serves the new association file, with the next store release (`docs/DEEP_LINKS.md`, "Rollout"). Until then only `/join/<code>` opens the iPhone app: unverified on a device.
- A sign-in that leaves the phone app (magic link, Apple on Android) keeps the link only while the app stays in memory; after the app is killed it opens the list. Invites survive (`link-join`).
- `/settings` (without `/more`) is the old address of Zugänge and Konto; it still works but does not open the phone app.
