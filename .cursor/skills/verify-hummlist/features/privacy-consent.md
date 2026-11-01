# Analytics consent

Builds that carry an analytics key (the web app, TestFlight and Play builds) ask once per install, right after the first sign-in and before onboarding or the list: „Darf Hummlist Nutzungsdaten erfassen?“ / "May Hummlist collect usage data?" Two equal buttons answer it. A no sends nothing and stores no analytics ID on the device; a yes sends pseudonymous usage data and error reports to PostHog (EU servers). The answer can be changed any time in More.

## Sub-features

- `ask` the consent screen (app bar title „Nutzungsdaten“ / "Usage data", logout icon with tooltip „Abmelden“): heading „Darf Hummlist Nutzungsdaten erfassen?“ / "May Hummlist collect usage data?", the body below, a link „Datenschutzerklärung“ / "privacy policy" (opens the privacy page of hummlist.com in the app's language) and the two buttons „Nicht erlauben“ / "Don't allow" and „Erlauben“ / "Allow".
- `decline` „Nicht erlauben“: no events, no error reports, no ID stored; onboarding or the list works the same.
- `accept` „Erlauben“: events and error reports go out; the decision is stored with the version of the text it was given under.
- `change-later` More tab, section „Nutzungsdaten“ / "Usage data", switch „Nutzungsdaten und Fehlerberichte senden“ / "Send usage data and error reports", hint „Pseudonym an PostHog (Server in der EU), ohne Listeninhalte. Gilt für dieses Gerät. Ausschalten löscht die Kennung auf diesem Gerät.“ / "Pseudonymous, to PostHog (servers in the EU), never list contents. Applies to this device. Turning it off deletes the ID on this device."
- `asked-again` a yes given under an older version of the text counts as no decision; the app asks again (current version 2026-11-01).

## How to get to it (user POV)

- Right after the first sign-in or sign-up on a device: the question appears before „Willkommen bei Hummlist“ and before the list.
- Later: tab „Mehr“ / "More", scroll to „Nutzungsdaten“ / "Usage data", switch.
- The privacy page: the link „Datenschutzerklärung“ / "privacy policy" in the question, or More → „Datenschutz“ / "Privacy".

Exact text (DE, never paraphrase): „Hummlist (Anbieter: Peter Trost) möchte verstehen, welche Funktionen genutzt werden, Fehler finden, messen, ob sich Hummlist trägt, und neue Funktionen schrittweise freischalten. Dafür speichert Hummlist eine zufällige Kennung auf diesem Gerät und sendet damit pseudonyme Nutzungsdaten, Fehlerberichte, die Kennung deines Haushalts und technische Angaben zu Gerät oder Browser an unseren Dienstleister PostHog (Server in der EU). Listeninhalte, Namen und E-Mail-Adressen werden nie gesendet. Du kannst jederzeit unter Mehr → Nutzungsdaten widerrufen. Mehr in der Datenschutzerklärung.“

Exact text (EN): "Hummlist (run by Peter Trost) wants to see which features are used, find bugs, measure whether Hummlist pays for itself and switch new features on step by step. For that, Hummlist stores a random ID on this device and uses it to send pseudonymous usage data, error reports, your household's ID and technical details of your device or browser to our service provider PostHog (servers in the EU). List contents, names and e-mail addresses are never sent. You can withdraw any time under More → Usage data. More in the privacy policy."

## Driving it with Playwright

Preconditions:

- Local stack and the e2e web build (it carries a fake analytics key, so the question shows; the seeded baseline already declined it, so use a fresh sign-up or a fresh browser context for a user that has not answered).
- Fresh email via `newEmail(...)`.

- **See the question.** `signUp(page, email, '/', { consent: 'decline' })` ends by answering; to stop on the screen, do the sign-up steps by hand: `typeInto` the textboxes „E-Mail“ and „Passwort“, click button „Registrieren“. Observable result: URL `/analytics-consent`, `page.getByRole('heading', { name: 'Nutzungsdaten' })` visible, buttons `page.getByRole('button', { name: 'Nicht erlauben', exact: true })` and `{ name: 'Erlauben', exact: true }`.
- **Answer.** `answerConsent(page, 'decline' | 'accept')`; it scrolls on short screens and phones. Observable result: URL leaves `/analytics-consent`; on a no, no request reaches the collector and nothing is stored; on a yes, a `first_open` event reaches the fake collector (the spec captures it).
- **Change later.** `openTab(page, 'Mehr')`, then the switch `page.getByRole('switch', { name: /^Nutzungsdaten und Fehlerberichte senden/ })` (the spec also accepts `getByRole('checkbox', ...)` for some engines; More's list is long, the switch sits below the fold: wheel the list until it shows). Observable result: turning it off stops sending at once.
- **Privacy link.** The link „Datenschutzerklärung“ in the question has the privacy page URL of hummlist.com.
- Covered by `e2e/tests/analytics.spec.ts` (order sign-in, consent, onboarding; declined sends nothing; accepted sends `first_open` once; English text; older version asked again; invite link through consent), `e2e/tests/onboarding.spec.ts`. Run via `scripts/verify.sh --only e2e -- tests/analytics.spec.ts`.

## Gotchas

- The question appears only in builds with an analytics key. Local fg/Linux builds and builds without a key never ask and have no „Nutzungsdaten“ section in More.
- Asked once per install: an existing user on a new install is asked once, then goes to the list (spec "a member with a household is asked once on a new install"). Whether a second user on an already answered install is asked: unverified.
- A browser tab authorizing an AI assistant (MCP consent) is not interrupted by the question; the app asks the next time it opens.
- A yes under an older consent text version is treated as no decision (nothing is sent until the new yes). The current version is 2026-11-01.
- Legal text: quoted from the German and English ARB strings; do not edit or paraphrase.
- Analytics never carry list text, names or emails; the household's ID is sent after a yes.
