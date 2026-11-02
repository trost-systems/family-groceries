# Job 66: deep links (iOS universal links, Android App Links)

Decisions: [DECISIONS.md](../DECISIONS.md) "Job 66". Route table: [DEEP_LINKS.md](../DEEP_LINKS.md).
Screenshots: [`docs/screenshots/66/`](../screenshots/66/). Manual step: [NEEDS_PETER.md](../NEEDS_PETER.md) "Job 66". PR: #188.

## What was built

- **Route table.** `app/lib/app/deep_links.dart` (`appLinks`) claims `/list`, `/add`, `/stores/<id>`,
  `/more`, `/more/...` and `/join/<code>` on app.hummlist.com. Anything else opens the list. `/`,
  sign-in, onboarding, the analytics question, the MCP consent page and the old `/settings` are not
  claimed, so browser sign-in flows stay in the browser.
- **iOS and Android.** The AASA (`app/web/.well-known/apple-app-site-association`) lists the same
  paths. The Android `autoVerify` filter has one `<data>` per path. `Runner.entitlements` already had
  `applinks:app.hummlist.com` and is unchanged. So are `assetlinks.json` (the Play signing key and the
  upload key from RELEASE.md, already verified by Google for the domain) and `vercel.json` (AASA as
  `application/json`, no redirect, `.well-known/` outside the SPA rewrite).
- **Router.** `next` now carries an app link's location as well as the MCP consent URL. It is vetted,
  so it cannot become an open redirect. Signed out, a link goes to `/login?next=...`, then on to the
  link after sign-in (after the analytics question on a new install). Without a household, the link
  is carried through onboarding. A sign-out never carries the current page. `RedirectMemory` keeps a
  link in memory across the mobile sign-in return (`com.hummlist.app://login-callback`). A web sign-in
  for a link returns to `/?next=...`.
- **List links.** `/add` and `/stores/<id>` redirect to `/` and pass a `ListLink` (`app/lib/list/list_link.dart`).
  The list then opens the add sheet with the field focused, or unfolds the store and scrolls its divider
  to the top. This works in the 1-, 2- and 3-column layouts and on a cold start.
- **Checks.** `deep_links_config_test.dart` is table-driven: the AASA, the manifest and Vercel's rewrite
  must match `appLinks`. I saw it fail when one manifest path was dropped. `web-prod.sh` parses both
  built files as JSON. `e2e/web-smoke.mjs` checks the new paths and the AASA's `/more/*` on a deployed URL.
- **Docs and maps.** `docs/DEEP_LINKS.md`, DECISIONS, NEEDS_PETER, the verify-hummlist feature `app-links.md`,
  a "Links into the app" section in FEATURES-FOR-WRITERS.md, and `household.md` in verify-family-groceries.

## How to verify

- `cd app && flutter analyze && flutter test`
- `scripts/verify.sh --only e2e -- tests/deep-links.spec.ts`
- After the next dispatched release: `node e2e/web-smoke.mjs https://app.hummlist.com`, then the
  device checklist in NEEDS_PETER "Job 66".

## Results (hz, 2026-11-02)

- `flutter analyze`: no issues. `flutter test`: 1463 passed, 80 skipped; after rebasing onto job 63, 1485 passed, 80 skipped.
- `e2e/tests/deep-links.spec.ts`: 4 of 4 passed (signed-out `/more/invites` through sign-in and
  the analytics question, a link through onboarding, `/add` + `/list` + an unknown path, `/stores/<id>`
  scrolled and unfolded, a foreign store id).
- Regression specs `auth`, `onboarding`, `shell-more`, `mcp`, `analytics`: 41 passed. 2 failed:
  onboarding AC6 with the fake Google/Apple provider. Those stop at GoTrue's `/auth/v1/callback`
  because hz containers cannot reach host ports (a known hz limit). CI runs them.
- After the rebase onto job 63: `deep-links`, `add-sheet` and `autofocus` specs, 13 of 13 passed.
- `scripts/verify.sh --only lint,web-prod,gitleaks`: passed.

## Missing or blocked

- No device check: no simulator or emulator on hz. The new paths open the iPhone app only once
  app.hummlist.com serves the new AASA, which goes live with the next dispatched Release run. Android
  needs only the new build. NEEDS_PETER "Job 66" has the checklist.
- Job 63 (widgets) landed during this job. This branch is rebased onto it, and its widget links
  (`hummlist-widget://`) are untouched. Mapping the widget's Add onto `/add` is a follow-up
  (DECISIONS 66.8).
- The brief asked for an `added` changelog item. The changelog gate only knows `new`, `improved`
  and `fixed`, so the item is `new`.
- The brief's port block 661xx is invalid (66121 > 65535), so the local stack ran on 566xx.
