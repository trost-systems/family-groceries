# Job 174: the code rename Hummlist → Snacklist (S1)

Peter approved the clean-slate rename (name Snacklist, bundle ID and Android package
`com.snacklist.app`, decision B2). The store records exist since S0. This job renamed the repo in
three stacked PRs. The live Hummlist app keeps working: every backend list holds Hummlist's value
and Snacklist's. Branch `hummlist-maint` (8db0195f, main before the rename) keeps a Hummlist
hotfix build possible. Reasons: DECISIONS "Job 174".

## What landed

- **(a) Identifiers, #345.** Bundle `com.snacklist.app` and its widget, App Group, keychain, URL
  schemes, Android package and Kotlin classes, the new Google iOS client, `Snacklist.storekit`
  and product IDs `com.snacklist.app.lifetime|yearly`, ASC app 6832756448, Play app
  4975647801932295032, fastlane.
  - Additive: both apps in AASA and assetlinks; both hosts in associated domains and App Links;
    both product-ID sets in the purchases function and analytics; `com.snacklist.app` added to
    the Apple bundle IDs.
- **(b) Copy, #346.** `APP_URL` `https://app.snacklist.app`; the guides, legal, help and icons
  base and the site's `siteUrl` `https://snacklist.app` (both live since 00:35). App strings, Siri names and phrases, widget, web manifest and title, design
  tokens (`snacklist.tokens.json`, `SnacklistColors`), site copy, guides and legal pages (name
  and domain), the MCP page, voice and MCP server copy (server name `snacklist`). The voice parser also
  strips Snacklist's spoken names. Consent text version 2026-11-10; the server still counts
  Hummlist's 2026-11-01 yes. Additive: `auth_urls.ts` allows the Snacklist callback and host,
  `config.toml` the callback, and the waitlist function accepts `https://snacklist.app` as origin.
- **(c) Docs and skills.** Live docs fact-checked: the Snacklist records next to Hummlist's, the
  Siri names, the consent version, the hosts, the Snacklist Alexa skill id. Skills renamed (`verify-snacklist`, `snacklist-ui-craft`,
  `snacklist-howto-clips`). The release build notes say Snacklist. A DECISIONS entry.

## Kept on purpose

- `https://mcp.hummlist.com` (no mcp.snacklist.app), the @hummlist.com addresses and the hosted
  Site URL `https://app.hummlist.com`. hummlist.com and app.hummlist.com keep serving the site and
  the web app; associated domains, App Links, AASA and assetlinks keep both hosts.
- The Alexa skill: its name, invocation, speech and guides (S4).
- The waitlist consent texts and mails (S3).
- Wire names that the server or stored state rely on.
- The Dart package, applied migrations, history docs.

## How to verify

- `scripts/verify.sh` gates per PR: lint, functions, site, fg-cli, changelog, flutter and
  web-prod passed locally. ci-ok was green on each PR, including ios, android and e2e.
- The function integration tests against a local stack (the db gate's list): 103 passed.
- The live drive on the release web build: `docs/screenshots/174/b-journey.log` and the
  `b-*.png` screenshots.

## Cut-over and follow-up (lead)

- At the first Snacklist release:
  - Set `REVENUECAT_APPLE_API_KEY` and `REVENUECAT_GOOGLE_API_KEY` to the Snacklist RevenueCat
    apps' SDK keys.
  - Run the `certificates` workflow with lane `renew_profile` for the Snacklist profiles.
  - Upload the first AAB by hand.
  - Re-check the app-signing SHA-256 in assetlinks.
- Done by the lead on 2026-11-10: the hosted redirect allow list has
  `com.snacklist.app://login-callback` and `https://app.snacklist.app/**`, the Google provider has
  Snacklist's iOS client, and `ALEXA_SKILL_ID` lists the new Snacklist skill
  (`docs/ALEXA.md`, Deploy). The local `config.toml` has the callback since (b).
- S2: `com.snacklist.app` in the hosted Apple client ID list (`configure-social-auth.mjs` takes
  comma lists; pass both apps' values).
- S3: an MCP host on snacklist.app if wanted. Mail addresses, waitlist consent and mails move
  with the S3 mail switch. The waitlist Play testing URL moves too.
- Next release upload: the `release` branch then serves Snacklist's AASA and assetlinks entries
  on both hosts (on 2026-11-10 they list only Hummlist).
- S4: Alexa speech, guides, support FAQ answer, `copy_needed.json` `alexa.*`.
- S5: re-film the site media and marketing scenes. Remove the Hummlist values from the backend
  lists.
- The daily price-drift check fails on Play until the Snacklist Play products exist.
- NEEDS_PETER "Job 174": the mail addresses, a Siri name test on device, the mixed waitlist
  pages, Apple's sign-in list name.
