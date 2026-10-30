# Job 25: Hummlist Lifetime in-app purchase (sandbox)

PR: https://github.com/trost-systems/family-groceries/pull/129

Hummlist can now sell **Hummlist Lifetime**, one non-consumable purchase (EUR 9.99 in Germany)
that unlocks the buyer's whole household, from the iPhone and Android app. The server verifies
every store transaction before anything unlocks, both partners see "Freigeschaltet" live, and
refunds take it away again. Nothing in the app is gated by it yet (NEEDS_PETER "Job 25", item
4). It is inert until Peter's agreements and the Lead's store setup are done: the app says "not
available yet", the server answers 503. Overview: [PURCHASES.md](../PURCHASES.md); calls made:
DECISIONS "Job 25" (30 items).

## What changed for users

- **More → Hummlist Lifetime** (iOS, Android): the store's price on "Für 9,99 € kaufen",
  "Käufe wiederherstellen", then "Freigeschaltet" for the whole household. States: waiting for
  approval (Ask to Buy, Play pending), verifying, canceled, store error, not available yet
  (products not loadable), store offline, verification offline (kept and retried), already used
  in another household, refunded, nothing to restore. The More row says "Freigeschaltet" once the
  household has it.
- **Web:** no buy or restore button; "Hummlist Lifetime gibt es in der iOS- und Android-App." and
  the unlock.
- A purchase interrupted by a killed app is verified at the next start (the store transaction is
  finished only after the server's final word).

## Where

- Server: migration `supabase/migrations/20261030190000_purchases.sql` (`purchases`,
  `entitlements` with member RLS and Realtime, `purchase_rate`, `purchase_grant`/`_revoke`/
  `_reinstate`/`_take_call`, export section `purchases`); pgTAP `supabase/tests/purchases.test.sql`
  (50) and `account_deletion.test.sql`; fixtures `scripts/backup/fixtures.sql`.
- Function `supabase/functions/purchases/`: `apple.ts` (JWS chain to the pinned Apple Root CA -
  G3, OIDs, ES256, App Store Server API), `google.ts` (Play Developer API, Orders API,
  acknowledge, voided purchases), `handler.ts` (`/verify`, `/apple/notifications`,
  `/google/voided`, `GET`, local-only `/test/sign`), `store.ts`, `deps.ts`, `config.ts`,
  `test_signer.ts`, `types.ts`; tests with an own Apple-like test CA and Google fixtures built from
  the documented shapes; `store_integration_test.ts` in the db gate. `_shared/purchases.ts` gained
  `sendPurchaseEvent`.
- App `app/lib/purchases/`: `PurchaseRepository` (plugin `in_app_purchase` 3.3.1, StoreKit 2;
  unsupported; fake store), `PurchaseApi`, `Entitlements` (`isUnlocked`), `PurchaseCubit`,
  `LifetimeScreen`; route `/more/lifetime`, More row `more-lifetime`, ARB DE+EN `lifetime…`;
  tests `app/test/purchases/` (91 plus 28 screenshot captures).
- Store as code: `scripts/iap/` (`product.ts`, `apple_product.ts` ASC API, `google_product.ts`
  Play API, dry run by default, never submits), `app/ios/Hummlist.storekit`, StoreKitTest XCTests
  in `app/ios/RunnerTests/RunnerTests.swift` run by `scripts/ios-storekit-test.sh` on a Mac (not
  in CI: the test host did not launch on GitHub's runner twice, issue #130).
- Local testing: `scripts/iap-test-ca.sh` (run by `supabase_up`), fg builds pass `FAKE_STORE`.
- Ops: `.github/workflows/purchases-voided.yml` (daily Play refunds), `scripts/smoke-remote.sh`
  (status, signer 404 on hosted, verify refused).
- e2e: `e2e/tests/purchases.spec.ts` (web state, live unlock for both partners, retry, partner
  restore, replay from another household, forged JWS, refund notification, English).
- Docs: `docs/PURCHASES.md`, DECISIONS "Job 25", NEEDS_PETER/NEEDS_LEAD "Job 25",
  `docs/ANALYTICS.md` (Purchases), `docs/PRIVACY_DATA_MAP.md`, `docs/ACCOUNT_DELETION.md`, privacy
  draft section 5a (`site/content/legal/datenschutz-kaeufe.md`, `privacy-purchases.md`, preview
  only), verify recipe `.cursor/skills/verify-family-groceries/features/purchases.md`; analytics
  fixture H8 (sandbox purchase is internal).

## Edge cases

| Case | Proof |
| --- | --- |
| Double tap, retry, app killed mid-purchase | `purchase_cubit_test.dart` (no second buy while buying/verifying; finish only after a final answer; redelivery at start), pgTAP `restored` on repeat, e2e retry answers `restored` |
| Restore on another phone / partner | e2e (Lea restores, both pages unlocked live), pgTAP |
| Forged JWS, wrong bundle, wrong product, Sandbox on Production config, replay from another household | `apple_test.ts`, `handler_test.ts`, e2e (forged signature 422, Max `used_elsewhere`) |
| Refund / revoke (Apple notification, Google voided) | `handler_test.ts`, `store_integration_test.ts`, e2e (live lock, repeated notification `unchanged`), pgTAP (once) |
| Ask to Buy / Play pending | cubit and screen tests (StoreKitTest `testAskToBuyIsPendingUntilApproved` written, not run: issue #130) |
| Products not loadable, offline, store down | screen tests and screenshots, handler 502/503 |
| Buyer leaves / deletes the account | pgTAP (unlock stays; restore elsewhere only after the household is gone; buyer link nulled), DECISIONS 25.9 (no tax records needed) |
| Web | e2e (no buttons, unlocked state) |
| Not signed in / no household | router (`/more` paths need a household), handler 401/403 |

## How to verify

```bash
(cd supabase/functions && deno test --allow-env --allow-net purchases/ _shared/purchases_test.ts)
scripts/gates/db.sh                       # pgTAP, integration, db lint, backup drill
(cd app && flutter test test/purchases)
scripts/gates/e2e.sh tests/purchases.spec.ts --workers=1
SCREENSHOT_DIR=/tmp/shots flutter test --update-goldens test/purchases/screenshots_test.dart  # in app/
```

## Results

- Local on the Hetzner runner (local stack 548xx): db gate PASS (pgTAP incl. 49 purchase tests,
  `supabase db lint`, backup drill), functions gate 403 + 12 + 13 + 9 + 4 tests, lint and site
  gates, flutter 1005 passed (28 screenshot captures skipped), e2e `purchases.spec.ts` 3/3.
- A manual smoke against the served local function: grant, retry restores, RLS read, refund
  notification revokes once, 401 without a session.
- CI: [run 41118314642](https://github.com/trost-systems/family-groceries/actions/runs/41118314642) green on 6fc6c37 (ci-ok, both e2e shards, db, functions, flutter, ios). No
  flaky reruns: the one red run (41116236878, live-sync) was caused by this job's second Realtime
  channel and fixed in the spec (DECISIONS 25.30). An ios infra hang (Flutter setup) was rerun once
  on an earlier head, then the StoreKit tests left the gate (issue #130).

## Screenshots

`docs/screenshots/job-25/`: `job25-app-<state>-<de|en>-<390|1366>.png` (offer, pending, unlocked,
unavailable, offline, error, More) from the real page with the fake store in a widget render
(this runner cannot build the Linux desktop app: no clang, CMake or GTK headers, no sudo);
`job25-web-*`, `job25-unlocked-web-*`, `job25-more-*` from the e2e spec on the real web build.

## Not done, needs others

- **NEEDS_PETER Job 25:** Paid Applications agreement, banking and tax forms; Play payments
  profile; Small Business Program; confirm product decisions 25.1 to 25.5 and say which features
  need the unlock; approve privacy section 5a; the store copy.
- **NEEDS_LEAD Job 25:** P1 the App Store Connect product (`apple_product.ts` on the box, where
  the ASC key is; manual steps if the API refuses), P2 In-App Purchase key and the function
  secrets, P3 App Store Server Notifications V2 URLs, P4 sandbox tester (Peter's address), P5 Play
  service account key, product and license testers, P6 the device checklist on a TestFlight
  build.
- Not tested against the live stores: Apple's real certificate chain on a real sandbox
  transaction, the Google API responses (fixtures follow the documented shapes), the AT and CH
  prices. Each is a NEEDS_LEAD step's first run.
- The fg recipe could not run here (no Linux desktop toolchain); the web e2e and the widget
  renders cover the page instead.
