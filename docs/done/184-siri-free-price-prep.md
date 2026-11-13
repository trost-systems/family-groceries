# Job 184: Siri free, and the approved prices as a drift-check transition

PR: https://github.com/trost-systems/snacklist/pull/388. It merged at 06:4x CET on 13 Nov 2026 as **13d2391e** on main (864f3ab4 was the pushed head, `ci-ok` green). `supabase-deploy` run 43374606532 succeeded, covering the migration, the voice function and the smoke test. Times are Europe/Berlin.

## What was built

**Live once merged and deployed, but invisible today.** The `integration_lock` switch is off and was not touched.
- Migration `20261113034530_siri_free.sql`: `public.integration_gate`, in job 185's per-user form `(household, integration, user)`, answers open for `siri`. The two-argument form delegates to it, as it does for `alexa`. It still accepts `siri`, so a voice function deployed before the migration keeps working during the rollout or a rollback. MCP and the API stay Premium.
- Voice function: it no longer asks the Premium gate. `premium_required` is gone from its answers and its event catalog, and `integration_blocked` allows `mcp` and `api` only. The native iOS client keeps its `premium_required` branch, and old builds stay compatible.
- App copy (no flag, because no tester can reach it):
  - The Zugänge Premium card shows only while the lock is on. It no longer lists Siri, and Siri tiles are never shown paused.
  - The Premium page's Siri benefit is removed. It showed only with `NATIVE_SIRI_LIVE`, an unreleased hold.
  - The Lifetime line no longer claims a ratio. It now reads "Einmal zahlen, für immer." / "Pay once, for good."

**Prep only: in the repo, not in any store.**
- `scripts/iap/product.ts`: euro storefronts expect €24.99 / €149.99 and carry the superseded €9.99 / €29.99.
- `price_drift.ts`: a store at the superseded price is a note, the approved price is clean, and any third price fails. The daily drift check stays green until Ops moves the stores, and a PR then deletes the superseded amounts.
- `basePrice`, `app/ios/Snacklist.storekit` (local StoreKit test config), the fg fake store and the paywall review driver now use 24.99 / 149.99.
- Docs: `PURCHASES.md`, `PAYWALL_RELEASE.md` 2.3, `PRODUCT_FEATURE_MAP.md` and `DECISIONS.md` ("Job 184"), reconciled with job 194's #377 and #389. €9.99, €29.99 and €39.99 appear only as superseded or historical.

## Confirmations

- No App Store Connect, Play Console or RevenueCat change. No script that talks to them was run, and nothing was spent, uploaded or submitted.
- User-facing paywall copy reads every amount from StoreKit / Play Billing (`store_prices.dart`). No old or new amount is hardcoded in `app/lib` or the ARB values. `fakeStorePrices` applies only to non-release builds with `FAKE_STORE` set.

## Verification

- Local:
  - `scripts/verify.sh --only lint,functions,flutter,db` passed. This covers pgTAP on the 634 port block and `flutter test`.
  - `deno test` in `scripts/iap` passed 29 tests.
- After rebasing onto #387 (job 185, per-user Premium):
  - The migration was renamed so it sorts after `per_user_premium`, and it now redefines the three-argument gate. Its body is #387's with one line changed.
  - #387's pgTAP case and integration test expected Siri to lock on a lapse. They now prove the same thing with MCP and assert that Siri stays free.
  - Re-verified with Flutter 3.50: `verify.sh --only lint,functions,flutter,db` passed.
- CI: `ci-ok` was green on 403356e0, 3091af55, 307fd9e7 and 864f3ab4, including e2e (`integration-lock.spec.ts`: Siri adds with the lock on, before and after a plan lapses, while MCP refuses) and the iOS StoreKit test (149.99). 
- A read-only Opus review found no correctness bugs. Its stale-doc findings were fixed in the rebase onto #377 and #389.
- Screenshots: `docs/screenshots/184/` (Premium page goldens).

## For Ops (not done here)

- Set yearly €24.99 and Lifetime €149.99 in App Store Connect and Play, and set the other currencies. Then open a PR that:
  - deletes `superseded` from the euro storefronts in `scripts/iap/product.ts`;
  - records the USD, GBP and CHF amounts (and BR, MX, IN yearly) the stores report.
- `scripts/iap/google_product.ts --apply` now overwrites the live Play Lifetime price with €149.99 (`docs/PURCHASES.md`, "Store setup"). Only Ops should run it.

## Open or not in scope

- The paused tile for a "Kurzbefehl" token stays while the lock is on, because the same token also signs in to MCP, which stays locked.
- Not done here, as the brief required: per-user Premium and prices or trip total (jobs 185 and 186), household-cap changes, shared views, and legal texts.
