# Job 70: sign-in without autofocus, Google and Apple first (2026-11-02)

From Peter's device test: the email field took focus on open, and the keyboard stayed open over
Google's sign-in.

## What changed

- `app/lib/session/login_screen.dart`: the email field no longer autofocuses. Where the build
  offers Google or Apple, the email form sits behind „Weiter mit E-Mail“ / "Continue with email"
  (key `sign-in-email`, `EmailSignInButton` in `provider_buttons.dart`), under the provider
  buttons at their 48 px. Opening the form focuses no field. A Google or Apple tap unfocuses
  first, so the keyboard closes and does not come back after a cancel. Builds without providers
  (Linux desktop, `fg`) show the form at once, as before. The MCP consent page embeds the same
  panel.
- Strings: `continueWithEmail` in `app_de.arb` and `app_en.arb`.
- Tests: `app/test/session/login_screen_test.dart` (no focus and no keyboard on open, with and
  without providers; the form opens unfocused; a tap focuses; Google and Apple close the keyboard
  and a cancel plus a full app pause/resume does not reopen it). They fail on the old code (5
  tests, checked by putting `autofocus` and the missing unfocus back). Goldens `login-light`/`-dark`.
- e2e: `openEmailSignIn(page)` in `e2e/tests/helpers.ts`, used by every spec that types into the
  form (DE and EN); `social-sign-in.spec.ts` checks the new layout and that no DOM input is
  focused on open and after „Weiter mit E-Mail“. `e2e/sync/engine.mjs`, `host-census.mjs`,
  `analytics-proof.mjs` and verify-hummlist's `signIn` click the button when it shows.
- Feature map: verify-hummlist `sign-in.md` (+ `ai-assistants.md`, `privacy-consent.md`),
  `FEATURES-FOR-WRITERS.md` (last verified), verify-family-groceries `auth.md`.
- Decisions: `docs/DECISIONS.md`, Job 70.

## Verification

- `scripts/verify.sh --only lint,flutter,changelog,gitleaks`: passed (1536 Flutter tests).
- e2e on hz (ports 570xx): full run 168 passed; the failures were specs this job had not yet
  migrated (fixed, then 40/40 passed on rerun) and the fake-OIDC specs (`id-token.spec.ts`,
  onboarding AC6, social-sign-in provider round trips), which always time out on hz because its
  containers can't reach host ports. CI covers them.
- `e2e/sync-smoke.sh` against the e2e build: PASS (signs in through „Weiter mit E-Mail“).
- verify-hummlist `launch.sh` signed the seeded member in through the new screen (READY), then a
  Playwright run took the screenshots in `docs/screenshots/70/` and asserted that no input was
  focused on open and after „Weiter mit E-Mail“, and that a tap on the field focuses it.

## Screenshots

`docs/screenshots/70/login-{de,en}-light-{1-open,2-email}.png`, `login-de-dark-*.png`.

## Open

Nothing blocked. Native keyboard behavior on a phone (iOS/Android) is covered by widget tests
only: there are no simulators on the build boxes.
