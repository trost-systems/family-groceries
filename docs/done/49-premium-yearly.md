# Job 49: Hummlist Premium, yearly and Lifetime under one entitlement

Peter's Spec #4 decision (2026-10-31): Hummlist Premium is sold as a yearly subscription
(`com.hummlist.app.yearly`, 9.99 €/year) and as Lifetime (`com.hummlist.app.lifetime`, 29.99 €),
both granting one RevenueCat entitlement, `premium`, for the whole household. This job built the
server lifecycle, the one premium check for the integrations, the Premium page with the store's
own prices, Legal Review K.13's must-fixes, analytics and the price drift check. Nothing is sold
or gated: `REVENUECAT_PURCHASES` stays off, the new server switch `premium_offer` is seeded off.

Decisions: docs/DECISIONS.md "Job 49". Behavior: docs/PURCHASES.md. Open steps for the Lead,
Ops and Legal Review: docs/NEEDS_LEAD.md "Job 49".

## What was built

- **Migration `20261031214500_premium_yearly.sql`.** Kind `lifetime` → `premium` (rows migrated,
  checks extensible); `purchases.plan`, the yearly state (`expires_at`, `auto_renew`,
  `billing_issue`, `state_at`); member-readable `entitlements.premium_source`, `expires_at`,
  `auto_renew` (H-55 column grants, Realtime updates); `household_premium()` and
  `household_has_premium()` (server-only, active at read time: Lifetime/tester beat yearly, an
  ended yearly plan is no premium without any cron); `purchase_lifecycle` with newest-event-wins
  ordering; a refunded yearly plan's later renewal counts again; second yearly plans kept apart;
  tester grants for yearly households; archive and join previews use "has premium now";
  `my_yearly_plan()` for the subscriber's own facts; `app_switches.premium_offer` (off) and
  `premium_offer()`; the export lists plan, end and renewal.
- **Webhook** (`supabase/functions/purchases/`): every RevenueCat event type mapped (record,
  lifecycle, revoke, reinstate, ignore); cancel reasons per Legal Review K.13 (only a refund
  revokes: CUSTOMER_SUPPORT or a negative price; UNSUBSCRIBE, BILLING_ERROR, DEVELOPER_INITIATED,
  PRICE_INCREASE, UNKNOWN turn auto-renew off); BILLING_ISSUE with and without grace; Play's
  `id:basePlan`; `entitlement_ids` not read (old and new entitlement both work); no reason stored
  or logged (H-87); `premium_source` on purchase events; `test/event` plays every type.
- **App** (`app/lib/purchases/`): `Entitlement.premium` (legacy wire `lifetime` parses to it), the
  rows' effective premium (`HouseholdUnlocks.premiumAt`), `canOffer(Entitlement.premium, plan)`;
  the Premium page (yearly first, the store's prices with "inkl. MwSt." only in euros, the
  subscription disclosures, EULA and privacy links, status lines, manage row, subscriber-only
  billing notice, two-plans note, the Lifetime-while-yearly warning before the store sheet and
  the note after it); store prices through a native channel (StoreKit 2, Play Billing 9.1.0;
  not `in_app_purchase`, which adds a StoreKit observer at launch); the billing-continues warning
  before account deletion, leaving, deleting, archiving and re-enabling; lint rules confining the
  channel; the RevenueCat SDK still starts only on Buy or Restore.
- **Products and prices** (`scripts/iap/`): both products, Apple IDs, group, base plan and
  expected country prices in `product.ts`; `Hummlist.storekit` with the subscription group;
  `price_drift.ts` (+ daily workflow) fails on drift or Lifetime in BR/MX/IN, skips clearly
  without its secrets.
- **Analytics** (`analytics/`): both paying queries count either product; the WAH share counts a
  yearly purchase for 365 + 14 days (documented approximation); fixtures for every case.
- **Docs**: DECISIONS "Job 49" (28 entries), PURCHASES.md (lifecycle and cancel_reason tables,
  cases incl. one subscription per Apple ID), PRIVACY_DATA_MAP.md, ANALYTICS.md, NEEDS_LEAD
  "Job 49", the verify skill's `features/purchases.md`, `releases/flags.json` (`premium-launch`
  matches "premium" too).

## How it was verified

- Deno: `revenuecat_test.ts` (13, every event type and cancel reason), `handler_test.ts` (39),
  the whole functions suite (393 passed), `store_integration_test.ts` against the local database
  (the full yearly lifecycle: subscribe, claim, UNSUBSCRIBE keeps premium, UNCANCELLATION, an
  older EXPIRATION after a newer RENEWAL is stale, BILLING_ISSUE with and without grace, a late
  RENEWAL, TRANSFER and a restore elsewhere move nothing, EXPIRATION deletes nothing, Lifetime
  wins, unknown transaction writes nothing, tombstoned yearly refused, two yearly rows).
- pgTAP: `premium_yearly.test.sql` (57) and the existing files, 22 files / 1297 tests pass.
- Flutter: `flutter analyze` clean; `flutter test` all pass (1137+), including entitlements
  rules, cubit (yearly and Lifetime), RevenueCat repository (yearly by id, Play id, yearly-only
  storefront, receipt in use), H-67 channel-level test (zero SDK calls, one price read per page
  opening), the Premium page (prices DE/EN, USD/GBP/CHF without VAT, yearly-only storefront,
  unreadable or empty prices, switch off, warning before the sheet, subscriber variant, status
  lines, billing issue only for the subscriber, two plans, lapse, tester, EULA on iOS), the store
  price channel (15), account deletion and join flows (subscriber, other member, no plan,
  offline).
- e2e (local stack, `scripts/verify.sh --only e2e`): `premium-yearly.spec.ts` 5/5 (live yearly for
  both partners, cancelled, expired with list and token intact, renewed; Lifetime while yearly
  with both warning variants; TRANSFER into another household gives nothing; account deletion
  warnings for subscriber and partner; leaving warns then joins; English), plus
  `purchases.spec.ts`, `household-bound.spec.ts`, `account.spec.ts` green.
- Local gates: gitleaks, lint, functions, flutter, fg-cli, db, site, changelog pass.
- CI on 9f3cecc (PR #160): ci-ok green, every gate including android and ios, which compile the
  native price channel: https://github.com/trost-systems/family-groceries/actions/runs/41258222015
- Screenshots: `docs/screenshots/49-premium-yearly/` (native page states DE+EN from
  `screenshots_test.dart`, web states from the e2e spec).

## Not done here, and why

- Dashboard, store and secret work (NEEDS_LEAD "Job 49"): the drift check's four repository
  secrets, its first real run (BR/MX/IN amounts), opening the StoreKit file in Xcode, PostHog
  insights, deleting the old `lifetime` entitlement later, turning `premium_offer` and
  `REVENUECAT_PURCHASES` on (Peter).
- Legal texts: none edited (S-1..S-11, terms, FAQ entry, konto-loeschen.html, the 26 "Hummlist
  Lifetime" values); every placeholder is listed for Legal Review.
- The native price channel is compiled by CI's android and ios gates; it runs on a device only
  once purchases are on.
