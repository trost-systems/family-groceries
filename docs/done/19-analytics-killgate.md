# Job 19: kill-gate and LTV analytics, error tracking (PostHog EU)

PR: https://github.com/trost-systems/family-groceries/pull/96

Spec #1 "Kill-gate and LTV analytics": make the DACH kill gates (day-35 unlock share, weekly
active households) and LTV (net unlock revenue, household retention, reorders) measurable in
PostHog EU, and see app and edge-function errors there. Everything is built and tested; it stays
**off** until Peter approves the consent wording and sets the keys (NEEDS_PETER, Job 19).
Overview: [docs/ANALYTICS.md](../ANALYTICS.md); decisions: DECISIONS.md "Job 19".

## What changed for users (once the keys are set)

- **One question after the first sign-in on a device**, before creating or joining a household
  and before the list: may Hummlist send anonymous usage data and error reports to PostHog (EU)?
  "Ablehnen" and "Einverstanden" are equally prominent; the text is marked "ENTWURF: Freigabe
  durch Peter". An invite link still ends on joining. An MCP authorization tab is not
  interrupted. The answer belongs to the device and is asked once.
- **Mehr → Nutzungsdaten** shows and changes the answer; off stops sending at once.
- A long press on the version line marks the device internal ("Interne Installation") and shows
  "Testfehler senden".
- Nothing changes in builds without a key (fg, CI, local debug): no question, nothing sent.

## Where

- App, `app/lib/analytics/`: `analytics.dart` (the `Analytics` cubit: consent, install id,
  queue, sending), `events.dart` (event catalog and allow-list), `internal.dart` (`isInternal`),
  `exceptions.dart` (`$exception_list`, scrubber), `sink.dart` (`PostHogSink`, EU host only),
  `setup.dart`, `consent_screen.dart`, `chunk_ids*.dart`. Defines in `app/lib/app/environment.dart`.
- Hooks: `ListCubit` (`addParsed` with `source`, `tick`, new `readd`, reorders after the server
  took them; `_actor()` adds role and size), `AddSheetCubit.take` (typed vs suggestion),
  `SessionCubit` (`household_created`, `invite_accepted` with `method`, user and household for
  analytics, sign-out flushes first), `JoinScreen`/`WelcomeScreen`/join dialog (method),
  `Member.role` from `household_members`. Router: `analyticsConsentPath`, `authRedirect(…,
  askConsent:)`. More: `_AnalyticsSwitch`, version long press. `main.dart`: error hooks.
  `DeviceCache` implements `AnalyticsStore`. The consent page is one `ListView`, so the list
  after it keeps the add field's focus on the web (DECISIONS 19.20).
- Edge functions: `supabase/functions/_shared/telemetry.ts` (`withTelemetry`, `Telemetry`,
  scrubber, server event allow-list); every function's `index.ts` wraps its handler; voice and
  account report the failures they answer with 500. `_shared/purchases.ts`: `PurchaseVerifier`,
  `FakePurchaseVerifier`, `fromApple`, `fromGoogle`, `netAmount`, `recordPurchase`.
- Insights: `analytics/queries/*.sql` (HogQL: WAH, day-35 unlock, weekly and monthly retention,
  net revenue, reorders, internal filter, privacy scan), `analytics/metrics.ts` (the same in
  TypeScript), `analytics/fixtures.ts`, `analytics/metrics_test.ts` (run by the functions gate).
- Builds: `app/config/e2e.json` (stand-in key, `https://posthog.invalid`), `scripts/vercel.sh`
  (POSTHOG_* pass-through; source maps with a personal key), `release.yml` + Fastfile
  (`analytics_defines`), `scripts/lib.sh` `no_posthog_in_ci` in the e2e, web-prod and flutter
  gates.
- e2e: `e2e/tests/analytics.spec.ts` (5 tests), `helpers.ts` (`signUp` answers the consent,
  `answerConsent`, `fakeCollector`), `social-sign-in.spec.ts`, `offline-start.spec.ts`,
  `shell-more.spec.ts` (English consent), `e2e/sync/engine.mjs` (sync smoke declines it).
- Proofs (manual, never CI): `e2e/analytics-proof.mjs` (AC11), `analytics/proofs/edge_exception.ts`
  (AC12). Recipe: `.cursor/skills/verify-family-groceries/features/analytics.md` (+ index,
  `shell-more.md`, `auth.md`).
- Docs: `docs/ANALYTICS.md`, DECISIONS "Job 19", NEEDS_PETER "Job 19", AGENTS.md (layout,
  convention).

## Acceptance criteria

| AC | Status | Proof |
| --- | --- | --- |
| 1 first_open once, install_id, no personal data | done | `analytics_test.dart` (once per install id, payload keys), e2e `accepting sends first_open once…` (also after a reload), AC11 proof (real PostHog) |
| 2 nothing before consent / after decline / after off | done | unit tests (consent group), e2e declined test (0 requests incl. login screen, 7 s past the flush), e2e switch-off, AC11 proof `before consent: 0` |
| 3 one item_ticked per tick, household_id, no name; no retry/echo/undo duplicates; undo+redo new | done | `list_events_test.dart` (echo, offline retry, undo, redo), e2e (3 ticks, one undone, list text absent) |
| 4 HogQL scan of the project | delivered, lead runs it | `analytics/queries/privacy_scan.sql`; the allow-list makes the content impossible (`events_test.dart`, `checkContext`) |
| 5 WAH | delivered, sample data | `wah.sql`, `metrics_test.ts` (Berlin week edges) |
| 6 day-35 unlock share | PARTIAL (no purchases yet) | `unlock_d35.sql`, `metrics_test.ts` (late and refunded buys) |
| 7 retention by week and month (to month 11) | delivered, sample data | `retention_weekly.sql`, `retention_monthly.sql`, `metrics_test.ts` |
| 8 purchase events after verification, refunds lower the month, restores zero | PARTIAL (fake verifier) | `purchases_test.ts`, `revenue_monthly.sql`, `metrics_test.ts` |
| 9 category_reordered on a store layout; per-household counts | done | `list_events_test.dart` (scope store/default, hide-only, unchanged, offline, refused), `reorders.sql` |
| 10 internal filtered out of every gate insight | done | `internal.sql` in every gate query (`metrics_test.ts` checks), `isInternal` tests, e2e `is_internal: true` for test accounts |
| 11 release-build exception, readable, no personal data | done (web JS build; manual) | issue `StateError` "Bad state: Hummlist test error (More, internal install)" in project 319492, frames with `chunk_id` and the uploaded symbol set; e2e test for the wasm build against the collector |
| 12 edge-function exception, function name, no body | done (manual, Deno instead of `functions serve`: no Docker on the Mac) | issues `TypeError` "Job 19 forced test exception (edge function voice)" and `Error` "23505", `function_name: voice`, no body, token or item text (`telemetry_test.ts` asserts the same) |

## How to verify

```bash
(cd app && flutter analyze && flutter test test/analytics test/app/router_test.dart)
(cd supabase/functions && deno test --allow-env --allow-net _shared/telemetry_test.ts _shared/purchases_test.ts voice/handler_test.ts)
(cd analytics && deno test --allow-read)
scripts/ci-e2e.sh --spec tests/analytics.spec.ts
```

Manual proofs against PostHog: `features/analytics.md`, `an-internal` and `an-errors`.

## Test results

- `scripts/gates/flutter.sh` locally: analyze clean, 514 tests passed (101 of them in
  `test/analytics`). Functions gate: 272 + 9 Deno tests passed.
- CI: see the PR body for the green `ci-ok` run on the merged head.
- A self-review (`/code-review`) found 10 candidates; 8 fixed (DECISIONS 19.21), 2 kept with
  reasons. The consent → list focus loss on the web (Chromium and the iPhone) was traced into the
  engine and avoided by the consent page's layout (DECISIONS 19.20).
- Proof runs on 2026-10-29: AC12 two batches answered 200, AC11 two batches answered 200 from a
  real Chromium on a local release web build; PostHog's error-tracking API lists the three issues.
  Evidence: `docs/screenshots/19/` (`ac11-*.png`, `ac11-release-web-sent.json`,
  `ac12-edge-sent.txt`, `ac11-ac12-posthog-issues.{png,json}`) and the e2e screenshots.

## Not done / blocked

- **Off until Peter acts** (NEEDS_PETER Job 19): approve the ENTWURF wording, privacy policy
  entry and DPA, then the Vercel, GitHub (release) and Supabase function settings.
- **AC6 and AC8 partial**: no in-app purchase exists; the IAP job plugs real verification into
  `PurchaseVerifier` (design in ANALYTICS.md "Purchases"; needs store credentials).
- **AC4-AC7, AC9, AC10 on real data**: the lead creates the insights from the HogQL via the
  connector and runs `privacy_scan.sql` after the first real events (within 2 weeks of merge).
- **No PostHog UI screenshot**: the job runner has no PostHog login; the issue list comes from the
  error-tracking API (rendered in `ac11-ac12-posthog-issues.png`).
- **Chromium (wasm) web traces** carry Dart function names but no lines (PostHog can't
  symbolicate wasm); the JS build (Safari) maps back through the uploaded source map.
- MCP and Siri adds and ticks are not counted (PM decision).
