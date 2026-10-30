# Job 31: Alexa skill "Hummlist", add items by voice, de-DE (Spec #7)

PR: https://github.com/trost-systems/family-groceries/pull/116

"Alexa, sag Hummlist, füg Milch und Eier hinzu" adds Milch and Eier to the linked user's current
household, categorized like typed items, live on every member's phone; Alexa says "Milch und Eier
sind auf der Hummlist." "Alexa, frag Hummlist, was auf der Liste steht" reads the open items
(Peter's decision 3: it fit, so it is in this job). Overview: [ALEXA.md](../ALEXA.md); calls made:
DECISIONS "Job 31". Nothing was done at Amazon: the skill goes live through the steps in
NEEDS_PETER "Job 31".

## Where

- `supabase/functions/alexa/`: `verify.ts` (signature, chain to pinned Amazon roots in
  `anchors.ts`, SAN, timestamp, skill id), `handler.ts` (intents, re-prompt, link card, rate
  limit, events), `speech.ts` (German replies), `store.ts`, `deps.ts`, `config.ts` (test CA only
  in a local stack), `analytics.ts`, tests (`verify_test`, `handler_test`, `skill_package_test`,
  `config_test`, `store_integration_test` for the db gate), `test_ca.ts`.
- Reused, not copied: `voice/parse.ts` and `voice/items.ts` (Siri's splitter and add path),
  `mcp/list.ts` (aisle order), `_shared/auth.ts` (OAuth tokens; the OAuth variant gained
  `sessionId`), `_shared/telemetry.ts` (`withTelemetry`; server event `item_added`
  `{source: alexa}`).
- Migration `20261030140000_alexa.sql`: `analytics_consents` + `record_analytics_consent`,
  `alexa_links` + `alexa_remember`/`alexa_revoke`, `alexa_rate` + `alexa_take_adds` (all service
  only), `export_my_data` gains `analytics_decisions` and `alexa_links`. pgTAP:
  `supabase/tests/alexa.test.sql`.
- App: `Analytics.recordConsent`, set by `SessionCubit`, records each install's answer on the
  server (answer, switch, internal mark, sign-in; a no under the id it had, or none after job
  33b deleted it); tests in `app/test/analytics/analytics_test.dart` and
  `session_events_test.dart`.
- Skill package: `alexa/skill-package/` (`skill.json`, `interactionModels/custom/de-DE.json`,
  icons), `alexa/ask-resources.json`, `alexa/account-linking.json` (no secret).
- Scripts: `scripts/alexa-oauth-client.sh` (registers the confidential OAuth client for
  production, Ops), `scripts/alexa-test-ca.sh` (test CA for the local stack, run by
  `supabase_up`), `scripts/alexa-say.sh` (signed requests against a local stack),
  `scripts/smoke-remote.sh` (unsigned → 400 after each deploy), backup fixtures.
- e2e: `e2e/tests/alexa.spec.ts`, `alexa-helpers.ts`; `mcp-helpers.ts` takes a callback URL.
- Docs: `docs/ALEXA.md`, DECISIONS, NEEDS_PETER, ANALYTICS ("Alexa"), the verify skill's
  `features/alexa.md`, AGENTS.md layout.

## Account linking

Supabase Auth's OAuth 2.1 server takes Alexa directly: a confidential client
(`client_secret_basic`), PKCE S256 (Supabase requires PKCE; Alexa sends it once the skill turns it
on), the three Alexa redirect URLs, refresh tokens. No shim. Proven end to end on the CI stack
(transcript in the PR).

## How to verify

- `cd supabase/functions && deno test --allow-env --allow-net` (functions gate).
- CI: db gate (pgTAP `alexa.test.sql`, `alexa/store_integration_test.ts`), e2e
  `alexa.spec.ts` (linking, AC1-AC8 on the stack, analytics answers recorded).
- `flutter test test/analytics`.
- Locally with a stack: `scripts/alexa-say.sh --launch`, `--token <t> "milch und eier"`.

## Open, outside this box

NEEDS_PETER "Job 31": the Amazon Developer account (Peter), skill creation and
`ALEXA_SKILL_ID` (Ops, lead), beta invites and the device checklist (AC1/AC3 on a real Echo,
AC12; Peter's yes), certification (Peter's yes, privacy policy naming the skill), approval of the
name "Hummlist".
