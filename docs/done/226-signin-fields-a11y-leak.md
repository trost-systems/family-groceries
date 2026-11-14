# Job 226: sign-in fields lingering in the web build's accessibility tree

## What was wrong

Job 223's baseline drive was right, and it happened every time. After a sign-in by email and password, the web app kept two hidden `<form>`s on every later screen until a reload:

- One held an input with the email. Chrome's accessibility tree named it, so screen readers found it.
- The other held an input with the password, in plain text in the DOM. Chrome masked it in the accessibility tree; Playwright's ARIA snapshot printed it.

Reproduced in 5 of 5 drives on main 7bfae2ed (verify-snacklist web build, local stack, seeded test account). The iOS and Android apps keep no such copy in a page, and their login route was already gone.

## Root cause

Flutter 3.50's web engine keeps each autofill field the user has left as a synthetic input in a dormant form, so the browser can save the login (flutter/flutter#180652). It removes those forms only on `TextInput.finishAutofillContext`, and nothing in the app sent it. It was not a route kept in the Navigator stack, and not the text controllers: the login route and its controllers were disposed; only the engine's forms stayed. Job 201 had noted the copies in `sign-in.md` as harmless.

## Fix

PR #427, on main as 88e28fd0 (`app/lib/session/login_screen.dart`). `SignInPanel` ends the autofill context itself:

- **At the sign-in.** It ends as soon as the session turns signed in, while a login field still owns the text input. It saves only after an email and password attempt that went out and did not fail. A Google or Apple sign-in, or a magic link, ends it without saving.
- **Leaving signed out.** It ends from `dispose`, without saving.

Why not `AutofillGroup`: its dispose runs after the next screen's push animation. By then the list's add field owns the text connection, and ending the context closed it. The add field lost focus after every sign-in (3 of 3 drives). Opus review 0 caught it. The panel now reads its auth client from `SocialSignIn` (the same `client.auth`), so widget tests can drive the password path. Details are in `docs/DECISIONS.md`, job 226.

## Verification

Web build (verify-snacklist), fresh browser per drive:

| | main 7bfae2ed | fix |
| --- | --- | --- |
| drives with the leak | 5 of 5 | 0 of 5 |
| `<form>`s / inputs holding email or password | 2 / 2 | 0 / 0 |
| Chrome AX nodes naming the email | 3 | 0 |
| add field focused after sign-in, typed key lands | 3 of 3 | 3 of 3 |
| failed sign-in, then „Neu bei Snacklist? Los geht's“ | | clean |

Evidence (credentials replaced): `docs/screenshots/226/` (before and after ARIA, per-drive JSON).

Tests:

- **Widget** (`app/test/session/login_screen_test.dart`, group "job 226"). A password sign-in ends the context at once, once, saving. A Google sign-in after a failed password ends it without saving. Leaving signed out ends it without saving. All fail on main; the first also fails on the `AutofillGroup` version.
- **e2e** (`e2e/tests/auth.spec.ts`). No input holds the email or password and the ARIA snapshot has no email after a sign-up and a sign-in. The add field keeps focus. A failed sign-in followed by the start screen leaves nothing.

The rule `text-field-autofill-explicit` and its AGENTS.md row now say a field with hints must end its context.

## Not verified

Whether Chrome or iOS now offer to save the password after a sign-in. Headless Chromium shows no prompt, and there is no iPhone here. `FEATURES-FOR-WRITERS.md` says not to claim it.

## Release

No flag: the fix ships to everyone. The next green main build after 88e28fd0 carries it to TestFlight and Play internal (release.yml), and the web app with the next `release` push. Changelog item: fixed, screen readers no longer find the email after a sign-in.

## Reviews

Opus review 0 FIX: the `AutofillGroup` version lost the add field's focus, and the PR needed a changelog item. Both fixed. Review 1 PASS, review 2 PASS. Their nice-to-haves are done except a new lint; DECISIONS gives the reason.
