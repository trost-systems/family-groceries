# Purchases: Hummlist Lifetime

Hummlist sells one thing: **Hummlist Lifetime**, a non-consumable in-app purchase (EUR 9.99 in
Germany) that unlocks the buyer's whole household. Nothing in the app is gated by it yet (product
decision 4, NEEDS_PETER Job 25); the plumbing, the purchase screen and `Entitlements.isUnlocked`
are in place. Built in job 25, sandbox only. Decisions: DECISIONS.md "Job 25".

## How it works

1. The app (iOS or Android) shows the store's price and buys through the `in_app_purchase`
   plugin (StoreKit 2 on iOS, Play Billing on Android). Web never sells.
2. The store hands the app a proof: on iOS the transaction's JWS (`jwsRepresentation`), on
   Android the purchase token. The app sends it to the edge function `purchases`
   (`POST /functions/v1/purchases/verify`) with its own session.
3. The function verifies with the store before anything is unlocked (below), then records the
   transaction (`public.purchases`, unique per store transaction) and unlocks the caller's
   household (`public.entitlements`). It answers `granted`, `restored`, `used_elsewhere`,
   `revoked` or `refunded`; Google payments still in progress answer `pending` (202).
4. Only after such a definitive answer does the app finish the store transaction. A network
   error, the store or the function being down, or a 503 keeps it unfinished: the store hands it
   over again on the next start, so a purchase interrupted by a killed app is granted then. A
   refusal (400, 422) is definitive too: the app finishes the transaction, says the receipt was
   not accepted and sends it again only on a restore the user asks for (DECISIONS 25b.1).
5. Every member's app reads the household's `entitlements` rows (RLS: members only) and hears new
   ones over Realtime: the partner's phone shows "Freigeschaltet" without buying.
6. Refunds: Apple sends App Store Server Notifications V2 (`REFUND`, `REVOKE`) to
   `/purchases/apple/notifications`; Google's refunds come from the Voided Purchases API, polled
   daily by `.github/workflows/purchases-voided.yml` through `/purchases/google/voided`. The
   unlock goes and `purchase_refunded` is sent once. Apple's `REFUND_REVERSED` reinstates the
   purchase; a restore unlocks again.

| Case | What happens |
| --- | --- |
| Double tap on Buy, app killed mid-purchase | One store purchase; the transaction stays unfinished until the server answered, so the next start verifies it |
| Restore on a new phone or the partner's phone | Household already unlocked: shown at once. Restore re-verifies (`restored`, `purchase_restored`) |
| Forged or modified JWS, other app, other product, a JWS from an environment not configured | 422 `refused` with the reason, nothing stored, logged by reason only; the app finishes it and a restore sends it again |
| `PURCHASES_ENVIRONMENTS=Production` without Sandbox | Inert (503 `not_configured`): App Review's sandbox purchases stay queued in the app instead of being refused (DECISIONS 25b.2) |
| Apple notification whose transaction is from another environment than the notification | 400 `environment_mismatch`, nothing changed |
| The same transaction from another household | `used_elsewhere`: one household per purchase |
| Refund or revoke | Unlock removed, `purchase_refunded` once (the `revoked_at` transition). A refund of a transaction never verified is recorded as revoked, so its receipt never unlocks later |
| Ask to Buy, Play pending payment | "Wartet auf Bestätigung"; it completes when the store delivers the approved transaction |
| Products not loadable (agreement inactive), offline, store down | A "not available yet" or offline state with retry; no crash |
| Buyer leaves the household or deletes the account | The unlock stays with the household. The purchase loses its buyer link. It can unlock another household only once its household is gone |
| Web | No buy button; "Hummlist Lifetime gibt es in der iOS- und Android-App." and the unlocked state |
| Signed out, no household | The page is under More, which `authRedirect` only lets households reach; the function answers 401/403 |

## Verification on the server

**Apple** (`supabase/functions/purchases/apple.ts`), as Apple's App Store Server Library does it:
ES256 header with a three-certificate `x5c`; the root byte-equal to the pinned Apple Root CA - G3
(`apple_roots.ts`, SHA-256 `63:34:3A:…:91:79`); the intermediate a CA signed by it with the WWDR
OID `1.2.840.113635.100.6.2.1`; the leaf signed by the intermediate with the receipt-signing OID
`1.2.840.113635.100.6.11.1`; every certificate valid at the payload's `signedDate`; the signature;
`bundleId` `com.hummlist.app`, `productId`, `environment`, `revocationDate`. With an In-App
Purchase key, `GET /inApps/v1/transactions/{id}` on the environment's host (production or
sandbox) is asked as well, and Apple's current record wins (refunds the app cannot know). The
same chain check covers the notifications' `signedPayload` and the transaction inside it.

**Google** (`google.ts`): `purchases.products.get` with the service account (purchase state,
`purchaseType` 0 = license test = Sandbox, order id), the Orders API for price, tax and country
when it answers, `acknowledge` after the household is unlocked (Play refunds a purchase that is
not acknowledged within three days), and `voidedpurchases.list` for refunds.

**Abuse limits.** 20 verifications a minute per user (`purchase_rate`); bodies are size-checked;
only the app's own session may verify (PATs and OAuth apps get 403).

## Data

| Table | Who reads | Who writes | Rows |
| --- | --- | --- | --- |
| `purchases` | service connection | `purchase_grant`, `purchase_revoke`, `purchase_reinstate` | store, transaction id, product, environment, buyer (null after their deletion), purchased/verified/revoked at, price, currency, country |
| `entitlements` | household members (RLS), Realtime | `purchase_grant` (insert), `purchase_revoke` (delete) | purchase, household, product, store, environment (Sandbox unlocks are testers'), granted by, granted at |
| `purchase_rate` | service connection | `purchase_take_call` | per-user window |

Migration `20261030190000_purchases.sql`; pgTAP `supabase/tests/purchases.test.sql`; the data map
`docs/PRIVACY_DATA_MAP.md`. Account deletion keeps the purchase without the buyer (for refunds
and against replays) and the household's unlock; a deleted household takes its unlock with it.
`export_my_data` has a `purchases` section.

## Configuration

Function secrets (the Lead sets them; NEEDS_LEAD Job 25). Without `PURCHASES_ENVIRONMENTS` the
function is inert: everything but `GET /purchases` answers 503 `not_configured`.

| Secret | Meaning |
| --- | --- |
| `PURCHASES_ENVIRONMENTS` | `Sandbox` while only TestFlight and testers buy; `Production,Sandbox` from App Store review on (App Review buys in the sandbox). `Production` alone leaves the function inert |
| `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` | In-App Purchase key (Users and Access > Integrations > In-App Purchase), not the App Store Connect API key. Optional: without it Apple is verified from the signature alone |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The Play service account's JSON key. Without it Google answers 503 |
| `PURCHASES_CRON_SECRET` | Bearer token of the voided poll; the same value as the repository secret of that name |

App Store Server Notifications V2 URL, production and sandbox:
`https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/apple/notifications`.

## Testing locally

- `scripts/iap-test-ca.sh` (run by `supabase_up`) makes a throwaway Apple-like CA and puts it in
  the gitignored `supabase/functions/.env`. The function trusts it only when `SUPABASE_URL` is the
  local stack, and only then serves `POST /purchases/test/sign` (`{transactionId}` → `{jws}`,
  with `notificationType` → `{signedPayload}`). A hosted project answers 404 there
  (`scripts/smoke-remote.sh` checks).
- The app's fake store: build with `--dart-define=FAKE_STORE=ok` (or `pending`, `cancel`,
  `error`, `unavailable`, `offline`) in a debug build on a desktop or phone; its purchases are
  signed by the local route, so the real verify path runs. Recipe:
  `.cursor/skills/verify-family-groceries/features/purchases.md`.
- `e2e/tests/purchases.spec.ts`: the web page, then a purchase signed by the local route unlocks
  the household live for both members, and a refund notification locks it again.
- `app/ios/Hummlist.storekit`: the product for Xcode's StoreKit testing (Scheme > Run > Options >
  StoreKit Configuration). Xcode signs its transactions with a local certificate, so the server
  refuses them (as it must); that is for UI work on a Mac. `scripts/ios-storekit-test.sh` runs
  the StoreKitTest XCTests (`RunnerTests.swift`) there; not in CI yet (issue #130).
- Tests: `supabase/functions/purchases/*_test.ts` (own test CA, Google fixtures built from the
  documented shapes), `store_integration_test.ts` (db gate), pgTAP, `scripts/iap/product_test.ts`,
  `app/test/purchases/`.

## Store setup

Scripted where the APIs allow it, never submitted for review:

- `scripts/iap/apple_product.ts`: App Store Connect API, dry run by default, `--apply` to create
  the non-consumable, DE+EN localizations, the EUR 9.99 price in Germany (others equalized),
  availability in all territories; prints the equalized AT and CH prices. Needs the ASC API key,
  which is on the box only.
- `scripts/iap/google_product.ts`: Play Developer API `monetization.onetimeproducts`, dry run by
  default; prints Play's converted AT and CH prices. Needs the payments profile first.
- `scripts/iap/product.ts` holds id, names and price for both; `product_test.ts` pins the
  StoreKit file and the function's product id to it.

The steps only Peter or the Lead can take are in NEEDS_PETER.md and NEEDS_LEAD.md, "Job 25".

## Refunds when something is off

The voided poll opens an issue "Purchases voided poll failed" when it fails. Rerun it from the
Actions tab once the function or Google answers again; it looks 7 days back and changes nothing
twice. A missed Apple notification is caught by the next verification of that transaction (the
App Store Server API reports `revocationDate`, with the In-App Purchase key) or by App Store
Connect's notification history (resend from there).
