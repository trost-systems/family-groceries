# Job 50: integration lock (Siri, Alexa and MCP are Hummlist Premium)

Spec #4 (Peter, 2026-10-31): Siri, Alexa and AI-assistant access (MCP) are part of Hummlist
Premium; the list, sync, categories, the app and the web app stay free. This job built the lock
on the server and in the app, behind two switches that stay off until Peter says go: the server
switch `app_switches.integration_lock` (seeded off) and the app define `INTEGRATION_LOCK` (off).
With both off every integration works exactly as before for every household.

Decisions: docs/DECISIONS.md "Job 50". Behavior and go-live order: docs/PURCHASES.md
"Integration lock". Steps for the Lead, Legal Review and Hummlist Launch: docs/NEEDS_LEAD.md
"Job 50".

## What was built

- **Migration `20261101081327_integration_lock.sql`.** The switch `integration_lock` (off);
  `integration_gate(household, integration)`, the one check (service only): open while the switch
  is off, else job 49's `household_has_premium` (yearly not ended, Lifetime, tester grant, at read
  time); `integration_blocks` notes the first refusal per household and integration in an hour;
  `integration_lock()` lets the app read the switch.
- **`supabase/functions/_shared/premium.ts`** (`requirePremium`): calls the gate after
  `authenticate`, sends `integration_blocked` (`integration` only, under the caller's analytics
  yes) at most once an hour, and throws when the check fails so the endpoint gives its normal
  transient error.
- **Siri (`voice`).** Every caller but the app's own session (Shortcut PAT, native Siri
  credential, OAuth): locked → HTTP 200, `premium_required`, "Sprachbefehle sind Teil von
  Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt." (English
  for `lang: en`); nothing is added or read. In-app dictation stays free.
- **Alexa.** Add, read and launch are gated after verification and linking: the premium sentence
  with a card, session ended, rate limit untouched. Help, stop, fallback, linking and skill events
  stay free.
- **MCP.** Discovery, OAuth, `initialize` and `tools/list` stay open; every `tools/call` answers
  HTTP 200 with `isError: true` and a German or English sentence. Never 401/403, so tokens stay
  valid and nothing needs relinking.
- **App.** `app/lib/settings/integration_lock.dart`: `IntegrationLockCubit` (reads the two server
  switches only with the define on) and `integrationAccess`, the one decision (server enforces and
  `canOffer(Entitlement.premium, yearly)`). Zugänge shows the card "Teil von Hummlist Premium"
  with what is included and Buy (to the Premium page, `?from=integrations`) where the build sells,
  "Bald verfügbar." where it does not, the "buy it in the app" note on the web; every token and
  app is listed as "Pausiert: braucht Hummlist Premium", nothing removed. A purchase by any member
  hides it within one Realtime sync. No RevenueCat call. `paywall_viewed` (`entry_point`) is new
  on the Premium page.
- **Analytics.** `integration_blocked` in the server catalog, `paywall_viewed` in the app's, both
  documented in docs/ANALYTICS.md; `analytics/queries/integration_blocked_weekly.sql` with its
  reference in `metrics.ts` and fixture tests.
- **Ops.** `scripts/iap/integration-cutover.sql`: read-only count of households the switch would
  lock and which integrations they use. `releases/flags.json` hold `integration-lock`.
- **Tests.** pgTAP `integration_lock.test.sql` (switch off/on, report once an hour, lapse deletes
  nothing, renewal opens with the same rows, Lifetime, tester grant, RLS); Deno
  `voice/handler_lock_test.ts`, Alexa lock cases in `alexa/handler_test.ts`,
  `mcp/tools_test.ts` (through the SDK's HTTP handler), `_shared/premium_test.ts`,
  `_shared/premium_integration_test.ts` (all three endpoints against the database, in the db
  gate), telemetry catalog cases; Flutter `test/settings/integration_lock_test.dart` (AC3, AC4,
  AC5, both define combinations, no SDK call, `paywall_viewed`) and the screenshot test; e2e
  `e2e/tests/integration-lock.spec.ts`, which `scripts/gates/e2e.sh` runs alone after the suite
  because it flips the global switch.
- **fg.** `FG_INTEGRATION_LOCK=1 fg up` builds the app with the define; recipes in
  `features/{voice,alexa,mcp-access,purchases}.md`.
- Fixed on the way: the More test harness's fake Supabase answered without the request, so every
  harness test's token list failed to load (postgrest reads the method back); now it loads.

## How it was verified

On the Hetzner runner, local stack (ports 573xx), 2026-11-01:

- `scripts/verify.sh --only gitleaks,lint,functions,fg-cli,flutter,db,changelog`: all pass. Deno
  functions 490 passed; analytics 15; Flutter 1282 + 244; pgTAP 25 files, 1412 tests (with
  `integration_lock.test.sql`, 35); the db gate's integration tests incl.
  `_shared/premium_integration_test.ts` (switch off adds as before, switch on refuses all three
  and adds nothing, `integration_blocked` once per integration without content, a yearly plan
  opens and its lapse locks with the same token); backup drill 36 tables.
- e2e `integration-lock.spec.ts` through `scripts/gates/e2e.sh tests/integration-lock.spec.ts` (web
  release build): 3 passed. A locked couple: Shortcut, Alexa (linked through the real consent
  page) and MCP refused with nothing added; Zugänge shows the card for both and both
  connections paused; INITIAL_PURCHASE through the webhook removes Lea's card live and all three
  work with the same token, link and MCP session; EXPIRATION locks again live, nothing revoked;
  RENEWAL opens again. A tester's household works; a beta household is locked until the Lead adds
  its member as a tester, then the same token works. English settings.
- fg on the Linux app (`FG_INTEGRATION_LOCK=1`, switch and `premium_offer` on): Peter's Zugänge
  shows the card with Buy; Buy opens the Premium page; a fake-store yearly purchase removes the
  card on Lea's client without leaving the page. `fg fn call voice --as peter` (the app's own
  session) adds while locked, as designed.
- CI: see the PR's ci-ok run.

## Screenshots

`docs/screenshots/50-integration-lock/`: the app (fg on Linux and the screenshot test) locked
with Buy, "Bald verfügbar", unlocked, the Premium page opened from the card, Lea's settings after
Peter's purchase; the web (e2e) locked DE and EN, paused after the plan expired, unlocked.

## Not done here (by design or blocked)

- Turning anything on: Peter's go, in the order of docs/PURCHASES.md.
- Legal Review: privacy section 9 (`integration_blocked`, `paywall_viewed`) and every text that
  presents the integrations as free; no legal text was edited.
- Hummlist Launch: the final copy for every placeholder (NEEDS_LEAD lists them), the Alexa skill
  description and the site guides.
- An OAuth token sent straight to PostgREST is not gated (DECISIONS 50.3).
