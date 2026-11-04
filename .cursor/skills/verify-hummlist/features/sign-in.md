# Sign-up and sign-in

A signed-out user sees one login screen. It has no title bar and opens on the Hummlist icon over the wordmark „Hummlist“. Production builds open on „Mit Google anmelden“ / "Sign in with Google", „Mit Apple anmelden“ / "Sign in with Apple" and „Weiter mit E-Mail“ / "Continue with email" (job 70); tapping the last one opens the email form under the divider „oder mit E-Mail“ / "or with email". The email form offers email plus password („Anmelden“ / "Sign in"), „Registrieren“ / "Sign up" for a new account, and „Anmeldelink per E-Mail senden“ / "Email me a sign-in link" (a magic link by email, no code to type). Builds without Google and Apple show the email form at once. No field is focused when the screen opens or when the email form opens, so the keyboard stays closed until the user taps a field; tapping Google or Apple closes an open keyboard, and it stays closed after a canceled provider sign-in. Signing out is in the More tab. A signed-out user who opens an AI assistant's access page signs in on this login screen and then returns to that page. Right after an account deletion the login screen confirms it with a card. There is no screen in the app where a user types a code from an email.

## Sub-features

- `password-sign-in` email + password; lands on the list, or on onboarding for an account without a household. On builds with an analytics key, a device's first sign-in shows the analytics question first (privacy-consent).
- `sign-up` „Registrieren“ with the same two fields; on the hosted project the user must first confirm by the emailed link.
- `magic-link` „Anmeldelink per E-Mail senden“ sends a link; opening it on the device signs in. Only the email field is needed.
- `continue-with-email` „Weiter mit E-Mail“ / "Continue with email" under the provider buttons opens the email form (builds with a provider only).
- `no-autofocus` the login screen and the email form open with no field focused; Google or Apple closes the keyboard first.
- `google` / `apple` provider buttons (production builds only). Same email as an existing account links to that account and its household.
- `form-checks` „Bitte eine gültige E-Mail-Adresse eingeben“ / "Please enter a valid email address" (email without "@"); „Mindestens 6 Zeichen“ / "At least 6 characters" (password under 6, for sign-in and sign-up, not for the magic link).
- `legal-footer` Impressum and Datenschutz links under the form (see Gotchas).
- `errors` failed sign-in snackbar „Anmeldung fehlgeschlagen: {message}“ / "Sign-in failed: {message}"; canceled provider sign-in „Anmeldung abgebrochen“ / "Sign-in canceled".
- `deleted-notice` right after an account deletion, a card above the sign-in methods: „Dein Konto wurde gelöscht.“ / "Your account was deleted."; when an Apple grant could not be revoked, also „Falls du dich mit Apple angemeldet hattest: Entferne „Hummlist“ auf deinem iPhone unter Einstellungen › [dein Name] › Anmelden & Sicherheit › Mit Apple anmelden.“ / "If you signed in with Apple, remove “Hummlist” on your iPhone under Settings › [your name] › Sign-In & Security › Sign in with Apple." (`e2e/tests/account.spec.ts`).
- `sign-out` More tab, „Abmelden“ / "Sign out"; also the logout icon (tooltip „Abmelden“) in the app bar of the first-run screens (analytics question, „Willkommen bei Hummlist“).

## How to get to it (user POV)

- Open Hummlist signed out: the login screen shows at once (any other path redirects to it).
- Signed in: tab „Mehr“ / "More", then „Abmelden“ / "Sign out".
- Email: tap „Weiter mit E-Mail“ / "Continue with email" (builds with Google or Apple), then tap the email field.
- Sign-up: type email and password, tap „Registrieren“ / "Sign up".
- Magic link: type email, tap „Anmeldelink per E-Mail senden“; snackbar „Wir haben dir einen Anmeldelink geschickt. Öffne ihn auf diesem Gerät.“ / "We sent you a sign-in link. Open it on this device."; open the emailed link in the same browser or phone.
- Sign-up on the hosted project (email confirmation on): snackbar „Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.“ / "Please confirm your email address with the link we sent you."
- Platforms: web uses the OAuth redirect for Google and Apple and returns to the same page (an invite link survives it); iOS uses the native Google and Apple dialogs; Android uses native Google and an Apple redirect in the browser. Magic links on the phones open the app through the link `com.hummlist.app://login-callback`.

## Driving it with Playwright

Preconditions:

- Local stack up, the web build served; browser locale de-DE. Mailpit receives the local mails (`latestLinkFor` in `e2e/tests/helpers.ts`).
- Sign-in recipes start signed out (new browser context). Use a fresh address per run (`newEmail(...)` in the specs) for sign-up; the seeded users (password known to the harness) for sign-in.
- Locally email confirmation is off, so sign-up signs in at once.

- **Open the email form.** `openEmailSignIn(page)` (`e2e/tests/helpers.ts`) clicks `page.getByRole('button', { name: 'Weiter mit E-Mail' })` when the build shows it. Observable result: textbox „E-Mail“ visible, and `document.activeElement` is no `INPUT` (Flutter web adds its input only for a focused field). Every recipe below that types into the form starts with it.
- **Sign up.** Type the credentials and tap Registrieren. `typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email)`, `typeInto(page.getByRole('textbox', { name: 'Passwort' }), password)`, `page.getByRole('button', { name: 'Registrieren' }).click()` (the helper `signUp(page, email)` does this and then `answerConsent`). Observable result: URL `/analytics-consent` (the e2e and verify-hummlist builds both carry a stand-in analytics key), then `/welcome` after the answer (driven 2026-11-04).
- **Password sign-in.** Same two fields, then `page.getByRole('button', { name: 'Anmelden', exact: true }).click()` (`exact`, because a plain name match is a case-insensitive substring and also hits „Mit Google anmelden“ and „Mit Apple anmelden“) or Enter in the password field. Observable result: `addField(page)` visible and focused for a user with a household. In a new browser context the analytics question comes first (`answerConsent`, or `signIn` in `helpers/lib.mjs`); a signed-out deep link such as `/more/invites` goes to `/login?next=/more/invites`, then the question, then the linked page (driven 2026-11-04).
- **Sign out.** `openMore(page, 'Abmelden')`. Observable result: the login screen, button „Weiter mit E-Mail“ visible.
- **Magic link send.** Signed out: `typeInto(... 'E-Mail' ...)`, `page.getByRole('button', { name: 'Anmeldelink per E-Mail senden' }).click()`. Observable result: `page.getByText(/Anmeldelink geschickt/).first()` visible.
- **Magic link open.** In the same context that already answered the analytics question: `await page.goto(await latestLinkFor(email))`. Observable result: URL `/` and `addField(page)` focused (the link is the `/auth/v1/verify...` URL from Mailpit).
- **Form checks.** Type `foo` as email, `123` as password, tap Anmelden. Observable result: the two messages under the fields (Flutter shows them as text under the inputs; a screenshot is the safe proof).
- **Wrong password.** Observable result: snackbar starting „Anmeldung fehlgeschlagen“, still on the login screen.
- **Provider buttons.** The e2e build shows them, above „Weiter mit E-Mail“: `page.getByRole('button', { name: 'Mit Google anmelden' })` and `'Mit Apple anmelden'`. A click starts a redirect to `/auth/v1/authorize?provider=google|apple`; real provider round trips cannot run locally (the specs swap the provider for a fake OpenID issuer).
- Covered by `e2e/tests/auth.spec.ts`, `e2e/tests/social-sign-in.spec.ts`, `e2e/tests/id-token.spec.ts` (token grant against the local stack), `e2e/tests/no-google.spec.ts` (no request to Google leaves the app). Run via `scripts/verify.sh --only e2e -- tests/<file>`.

## Gotchas

- There is no password reset in the app („Passwort vergessen“ does not exist); a user who forgot the password uses „Anmeldelink per E-Mail senden“.
- Code or no code: the app never asks for an emailed code. The only code entry in the app is the household invite code (8 characters from A-Z and 2-9, without I, O, 0, 1). The hosted project's auth settings (read through the Management API on 2026-11-01) have an email one-time-code length of 8, but the sign-in link and confirmation emails carry only a link, no code; only the reauthentication email (which the app never triggers) contains a code. Locally `otp_length = 6`, also unused.
- Email subjects on the hosted project (2026-11-01, Supabase's English defaults, sent through a custom SMTP sender): sign-in link „Your sign-in link“, sign-up confirmation „Confirm your email address“, password reset „Reset your password“. The bodies are short link emails; their exact wording is not in the repo. The local stack sends the sign-in link with the same subject „Your sign-in link“ (Mailpit, 2026-11-04).
- Legal footer: the login screen ends with links „Impressum“ / "Imprint" and „Datenschutz“ / "Privacy", on screen without scrolling; they open hummlist.com in a new tab (de: `/impressum`, `/datenschutz`; en: `/en/imprint`, `/en/privacy`). Locator: `page.getByRole('link', { name: 'Impressum', exact: true })`; covered by `e2e/tests/legal.spec.ts`.
- Google and Apple buttons appear only when the build has the provider configured; production (`app/config/auth.json`) has Google web and iOS client IDs and Apple on, and the hosted project has both providers enabled (Management API, 2026-11-01). Hosted sign-up needs the emailed confirmation (autoconfirm off); the minimum password length is 6. The e2e and verify-hummlist builds have Apple on and a fake Google id, so both buttons show but neither completes locally.
- Apple "Hide My Email" creates a separate account (private relay address does not match). Provider sign-ins with the same verified email as an existing account join that account and its household.
- A signed-in user whose build has a PostHog key is asked the analytics question before anything else (see the privacy-consent feature); the e2e build has one, so `answerConsent` follows sign-up in the helpers.
- Playwright: `typeInto` for typing. The login screen has no heading (its ARIA shows a group with the text „Hummlist“); match the sign-in button with `exact: true`, since „Mit Google anmelden“ and „Mit Apple anmelden“ also contain "anmelden".
