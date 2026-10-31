# Purchases: Hummlist Lifetime

Hummlist sells one thing: **Hummlist Lifetime**, a non-consumable in-app purchase (EUR 9.99 in
Germany) that unlocks the buyer's whole household. Nothing in the app is gated by it yet (product
decision 4, NEEDS_PETER Job 25), and nothing is sold: the purchase screen is behind the build
define `REVENUECAT_PURCHASES`, off by default, until Peter approves the new legal texts. Built in
job 25 (sandbox, our own store verification) and rebuilt in job 43 on RevenueCat. Decisions:
DECISIONS.md "Job 25", "Job 25b" and "Job 43".

**Model A (Peter, 2026-10-31).** One member pays once; the whole household has it. A purchase
belongs to the household it was bought in, for good: it stays there when the buyer leaves, hands
the household over or deletes the account, and it never unlocks another household, also not after
its own is deleted. Nothing moves with the user. The app offers Buy only to a household it knows
has no Lifetime, so no member pays twice. Someone who paid and then joins an unlocked household is
pointed to the refund help (Apple and Google decide; we refund nothing ourselves). Testers get it
free. A later subscription for running-cost features (model D) would be a second entitlement kind
next to Lifetime ("A second entitlement" below).

**RevenueCat (Peter, 2026-10-31 14:03; Legal Review's conditions, ADDENDUM 5).** RevenueCat
verifies purchases with Apple and Google; our server no longer talks to either store. The
RevenueCat customer is the **household**: the App User ID is the household's UUID, never a user
id, never anonymous.

## How it works

1. A member opens Mehr → Hummlist Lifetime. Only once the household's rows are read from
   Supabase and hold no Lifetime (`Entitlements.canOffer(Entitlement.lifetime)`) does the app
   start the RevenueCat SDK (`purchases_flutter`), configured with the household id as App User
   ID (`logIn(householdId)` when it was configured for another household). Members who never open
   the page to buy never talk to RevenueCat. While the rows load or the phone is offline the page
   says "Wir prüfen, ob dein Haushalt Hummlist Lifetime schon hat …" and has no Buy; More's row
   shows no "Hummlist unterstützen" then either. Buy and Restore are enabled only when the SDK's
   App User ID is the household shown.
2. Buy runs the store's sheet through RevenueCat, which verifies the purchase with the store,
   acknowledges Play purchases and finishes the transaction. The app then **claims** it:
   `POST /functions/v1/purchases/claim` with its own session and `{store, transactionId}` (the
   StoreKit transaction id; on Android the Play order id `GPA.…`, which is what RevenueCat's
   `transactionIdentifier` holds there), pinned to `eu-central-1`. The claim records the buyer
   (H-55); it never unlocks anything. Until Supabase shows the unlock, the page says "Wird
   freigeschaltet …".
3. RevenueCat calls our webhook (`POST /functions/v1/purchases/revenuecat/webhook`, the `purchases` function) with
   `NON_RENEWING_PURCHASE`. The function checks the `Authorization` header (constant time) and,
   when configured, RevenueCat's HMAC signature, ignores event ids it already processed, and
   records the transaction for the household `app_user_id` names (`purchase_record`): a row in
   `purchases` bound to that household and a row in `entitlements`.
4. Every member's app reads the household's `entitlements` rows (RLS: members only; the columns
   that say who paid or granted it are not readable, H-55) and hears new ones over Realtime: the
   partner's phone shows "Freigeschaltet" without buying. The app asks for a kind
   (`has(Entitlement.lifetime)`), never for "any row". The unlock the app shows comes only from
   Supabase, never from RevenueCat's `CustomerInfo`.
5. Refunds: RevenueCat's `CANCELLATION` takes that purchase's unlock away (`purchase_revoke`) and
   sends `purchase_refunded` once; `REFUND_REVERSED` reinstates it in its own household. A
   `TRANSFER` never moves anything.
6. Restore (Käufe wiederherstellen) calls `restorePurchases()` under the household's App User ID.
   With the project's restore behavior **Keep with original App User ID** (an Ops setting),
   RevenueCat refuses a purchase that belongs to another household; the app says "Dieser Kauf
   gehört zu einem anderen, früheren Haushalt und bleibt dort." with the refund help. The server
   refuses it too, whatever RevenueCat does (`purchase_record`: bound household, tombstones).

| Case | What happens |
| --- | --- |
| Double tap on Buy, app killed mid-purchase | RevenueCat owns the transaction and finishes it; its webhook records it. A claim lost with a killed app leaves the buyer unknown: the unlock stands, `purchase_completed` is not sent (analytics undercount) |
| Restore on a new phone or the partner's phone | Household already unlocked: shown at once, no Buy, no Restore (nothing to restore) |
| The same purchase in another household (restore, re-buy, a RevenueCat `TRANSFER`) | Refused by RevenueCat (Keep with original App User ID) and by `purchase_record` (`used_elsewhere`): one household per purchase, for good. "Dieser Kauf gehört zu einem anderen, früheren Haushalt und bleibt dort." and the refund help link |
| Restore after its household was deleted | Refused (`used_elsewhere` with `household_gone`; after the 30-day purge `tombstoned`). Nothing unlocks anywhere else (H-56) |
| A second purchase in an unlocked household (two phones, Ask to Buy, a race) | Its own row; refunding one keeps the other's unlock. Every member's page then shows "Euer Haushalt hat Hummlist Lifetime mehr als einmal gekauft. Einen der Käufe können Apple oder Google erstatten." with the refund help |
| Buyer switches households between buying and claiming | The claim names the household the buyer is in when it arrives; for a purchase bound to the other household `purchase_claim` answers `elsewhere`. The unlock stands where it was bought, the buyer stays unknown (no `purchase_completed`) |
| Ask to Buy, Play pending payment | "Wartet auf Bestätigung"; RevenueCat's webhook records it when the store completes it |
| Products not loadable, offline, store down | A "not available yet" or offline state with retry; no crash |
| Payer leaves the household, hands it over or deletes the account | The unlock stays with the household. Account deletion removes the buyer link; the purchase keeps its household (`bound_household`) |
| Last member leaves an unlocked household (joins another) | Joining asks first. With `HOUSEHOLD_ARCHIVE` on: "Archivieren und beitreten" keeps the household archived (list and unlock kept, re-enabled under Mehr → Archivierte Haushalte); "Löschen und beitreten" asks once more ("… wird nicht erstattet", refund help). With it off (releases, until the legal texts say so): that warning and "Trotzdem beitreten". Never blocked |
| Joiner into an unlocked household | The join screen says "Dieser Haushalt hat Hummlist Lifetime. Du musst nichts kaufen." With their own purchase from the last 30 days that stands: a link to the refund help |
| Tester | Their grant (1 by default, `scripts/iap/testers.ts`) unlocks a household they are in that has none; it stays with that household like a purchase. No RevenueCat involved. Internal for analytics |
| Archived household | No members, not readable by anyone, its invites lead nowhere; the archiving user alone sees and re-enables it (`archived_households`, `unarchive_household`). Deleted with that user's account. Its purchases restore nowhere else, and in it again after re-enabling |
| Family Sharing | Off at Apple; a webhook event with `is_family_share` is ignored |
| An App User ID that is no household (anonymous, unknown) | Ignored: nothing recorded, nothing unlocked |
| Web | No buy button and no external purchase link; "Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet." and the unlocked state |
| `REVENUECAT_PURCHASES` off (every build until Peter's OK) or no SDK key | "Hummlist Lifetime ist bald verfügbar.", no Buy, no Restore; unlocks (testers) still show |
| Signed out, no household | The page is under More, which `authRedirect` only lets households reach; the claim route answers 401/403 |

## The webhook

`supabase/functions/purchases/handler.ts`. Routes:

| Route | Caller | What it does |
| --- | --- | --- |
| `GET /purchases` | smoke checks | `{configured}` |
| `POST /purchases/revenuecat/webhook` | RevenueCat | The webhook (above). `Authorization` must equal `REVENUECAT_WEBHOOK_AUTH` whole (it includes `Bearer `). 401 without the right `Authorization` (or, with `REVENUECAT_WEBHOOK_HMAC_SECRET`, a bad or stale `X-RevenueCat-Webhook-Signature`: `t=…,v1=…`, HMAC-SHA256 over `"<t>.<raw body>"`, 5 minutes). 200 for everything it processed or ignores, 500 when the database fails so RevenueCat retries (5 times over about 80 minutes). The event id is stored in the same transaction as the writes |
| `POST /purchases/revenuecat/deletions` | the daily workflow | Deletes due RevenueCat customers ("Retention"); takes no input, so a call only runs the scheduled work early; at most 25 per run, each customer at most once an hour |
| `POST /purchases/claim` | the app, signed in | Records the buyer of a transaction in the caller's household (first member wins); 20 a minute per user |
| `POST /purchases/test/event` | local stack only (404 elsewhere) | Builds a RevenueCat event and processes it like the webhook, without the secret: the debug fake store, fg and e2e use it |

Events: `NON_RENEWING_PURCHASE` (and `INITIAL_PURCHASE`) for a product in `productKinds` record
and unlock; `CANCELLATION` revokes; `REFUND_REVERSED` reinstates; `TRANSFER`, `TEST`,
`TEMPORARY_ENTITLEMENT_GRANT`, `EXPIRATION` and anything else are acknowledged and change nothing.
Stores: `APP_STORE` is `apple`, `PLAY_STORE` `google`; others are ignored. The purchase's key is
`original_transaction_id` (`transaction_id` when absent); the claim may name either.

**Analytics.** `purchase_completed` goes out once, when both the webhook's record and the buyer's
claim are in (whichever comes second), under the buyer's consent; `purchase_refunded` on a refund
of a purchase with a known buyer. Without a claim, or without consent, nothing is sent (the paying
share is a lower bound, docs/ANALYTICS.md). Sandbox purchases, testers' purchases and purchases
in households a tester unlocked are `is_internal`. `purchase_restored` is no longer sent: a
RevenueCat restore produces no event for us.

### Who receives what (Legal Review H-53)

Our server calls neither Apple nor Google. The recipient is **RevenueCat, Inc.** (processor under
its DPA, part of RevenueCat's terms, https://www.revenuecat.com/dpa/; SCCs module 2 for EEA
transfers). The app's `purchases_flutter` SDK talks to RevenueCat (`api.revenuecat.com`), and
RevenueCat talks to Apple (App Store Server API with the In-App Purchase key) and Google (Play
Developer API through a service account; real-time developer notifications).

Data RevenueCat receives: the household UUID as App User ID (also sent to Apple as
`appAccountToken`, because it is a UUID), store transaction ids and the Play purchase token,
product id, price, currency, storefront or country code, purchase and refund dates, sandbox or
production, platform, app and SDK version, the device locale, and the requesting IP address
(network level). No e-mail, no name, no Supabase user id, no list or household content; the app
sets no customer attributes and collects no advertising or device identifiers (enforced by the
lint rules `purchases-flutter-only-in-revenuecat-repository` and `no-revenuecat-customer-data`). RevenueCat states customer
data "is sent to AWS data centers located in the United States" (https://www.revenuecat.com/privacy/);
the DPA's subprocessors are all in the USA (AWS, Google, Snowflake, ScyllaDB, ClickHouse, Elastic,
Sentry, Honeycomb, Cloudflare, Fastly, Hex, OpenAI, Anthropic); the docs name no EU hosting
option. RevenueCat AI features stay off (an Ops setting, C4). These are facts with sources; the
legal assessment is Legal Review's.

The one call we make to RevenueCat: `DELETE https://api.revenuecat.com/v2/projects/{project_id}/customers/{household_id}`
and the `GET` that confirms it (404), for deleted households ("Retention"; API v2,
https://www.revenuecat.com/docs/api-v2/customer, read 2026-10-31).

### Where it runs (Legal Review H-54)

Edge Functions run in the region nearest the caller unless pinned (Supabase "Regional
Invocations", https://supabase.com/docs/guides/functions/regional-invocation, read 2026-10-31).
RevenueCat calls from the US and can't set the `x-region` header, so the webhook URL Ops
registers carries the query parameter:
`https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/revenuecat/webhook?forceFunctionRegion=eu-central-1`
(`eu-central-1` is Frankfurt, the project's region). The app's claim call passes
`region: 'eu-central-1'` (`x-region` header and the same parameter). The function logs `SB_REGION`
once per request, nothing else from it. A pinned call is not rerouted during a regional outage;
RevenueCat retries, the app retries the claim.

## Data

| Table | Who reads | Who writes | Rows |
| --- | --- | --- | --- |
| `purchases` | service connection | `purchase_record`, `purchase_claim`, `purchase_revoke`, `purchase_reinstate` | store, transaction id (the original), latest transaction id, its HMAC, product, kind, environment, buyer (from the claim; null after their deletion), bound household (set at the first record, never changed), purchased/verified/revoked at, price, currency, country, when `purchase_completed` went out, when the household was deleted |
| `entitlements` | household members (RLS, column grants: `id, purchase_id, household_id, kind, source, product_id, store, environment, granted_at`), Realtime | `purchase_record`, `purchase_reinstate`, `tester_grant_apply` (insert), `purchase_revoke` (delete) | one row per unlock: a purchase's (`source` purchase) or a tester's grant (`source` tester, `tester` the granting user, null after their deletion); kind; granted by (not member-readable) |
| `purchase_claims` | service connection | `purchase_claim`, `purchase_record` | a claim waiting for its webhook: store, transaction id, claimant, their household, when (30 days at most) |
| `revenuecat_events` | service connection | the webhook | processed event ids and types, 90 days |
| `purchase_tombstones` | service connection | `purge_purchases` | HMAC-SHA256 of purged store transaction ids under `REVENUECAT_TOMBSTONE_HMAC_KEY`, nothing else |
| `revenuecat_deletions` | service connection | trigger on household deletion (every one: opening the purchase page creates the customer), `revenuecat_deletions_take`/`_done` (the deletion route) | deleted households' ids (RevenueCat App User IDs), due 30 days later |
| `lifetime_testers` | service connection | `scripts/iap/testers.ts`, `tester_grant_apply` | user id, grants (free unlocks, default 1), used, note, added at |
| `households.archived_at`, `archived_by` | nobody but `archived_households()` for the archiving user | `leave_current_household(true)`, `accept_invite(code, true)`, `unarchive_household` | when and by whom the last member archived it |
| `purchase_rate` | service connection | `purchase_take_call` | per-user window for claims |

Migrations `20261030190000_purchases.sql` and `20261031123504_household_bound_lifetime.sql`;
pgTAP `supabase/tests/purchases.test.sql` and `household_bound.test.sql`; the data map
`docs/PRIVACY_DATA_MAP.md`. `export_my_data` has `purchases` (with `belongs_to_household`),
`lifetime_tester` and `archived_households` sections.

### Retention

- **Household deleted** (its last member left without archiving, or deleted their account): its
  unlock rows go at once (cascade). Its purchase rows are kept 30 days (support and refund window),
  then `purge_purchases` (pg_cron, daily 03:41) deletes them and keeps only each transaction's
  HMAC in `purchase_tombstones`, so the purchase never binds to a household again. The household's
  RevenueCat customer is queued in `revenuecat_deletions` and deleted by the function
  (`purchases/deletions.ts`, started daily by `.github/workflows/revenuecat-delete.yml`): API v2
  `DELETE` then a `GET` that must answer 404, retried at most hourly until it does; logs counts
  only; does nothing while `REVENUECAT_SECRET_KEY` or `REVENUECAT_PROJECT_ID` is unset. A failure opens the issue "RevenueCat customer deletion
  failed"; rerun the workflow once RevenueCat answers.
- **Tombstones** are kept while Hummlist Lifetime is sold or its unlocks are honoured, reviewed
  yearly (NEEDS_LEAD Job 43). One HMAC key for all of them (`REVENUECAT_TOMBSTONE_HMAC_KEY`):
  changing it would make the old tombstones useless.
- **Buyer deletes their account:** the buyer link is nulled (`purchases.user_id`,
  `entitlements.granted_by`); the household keeps its unlock. Nothing is deleted at RevenueCat:
  it never had a user id.
- **Webhook event ids:** 90 days. **Claims** that never met their webhook: 30 days.
- **Archived households** keep everything until re-enabled or their archiver's account is deleted
  (`delete_account`); one whose archiver vanished another way is deleted by the daily purge.
- RevenueCat's own retention after deletion follows its DPA ("subject to standard data backup and
  archival practices").
- Purchases from before job 43 that unlocked nothing are bound to the nil UUID (never bind again);
  they have no HMAC and are not purged (sandbox only, no buyer data beyond job 25's).

### Testers

`lifetime_testers` lists users who get Lifetime free, with a number of grants (1 by default). A
grant unlocks a household the tester is in that has no Lifetime: at once when the Lead adds them or
raises the count, otherwise when they next create or join such a household. The unlock is an
`entitlements` row with `source` tester and then behaves like a purchase: it stays when the tester
leaves, survives an archive, never moves; lowering the count or removing the tester keeps it, and
a deleted household doesn't give its grant back (`used` is counted). Testers don't use RevenueCat
promotional entitlements: those would send tester and household data to RevenueCat. Sandbox
purchases (TestFlight, App Review, Play license testers) stay as they are (Peter, 2026-10-31).
Both are internal for analytics: the function marks a tester's purchase and any purchase in a
household a tester unlocked `is_internal`, and the app marks every event from a household whose
rows include a tester grant (`isInternal`'s `testerHousehold`).

```
deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts list
deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts add --email a@b.de [--grants 2] [--note "TestFlight"] [--apply]
deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts set-grants --email a@b.de --grants 3 [--apply]
deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts remove --email a@b.de [--apply]
```

Dry run unless `--apply`. Hosted: `SUPABASE_ACCESS_TOKEN` (Management API, on the box); local:
`SUPABASE_DB_URL`. The e-mail is resolved to the user id at run time, never stored or printed
back.

### A second entitlement (model D, not built)

What a later subscription (AI meal plans, price feeds) adds, without touching Lifetime:

1. A product id in `scripts/iap/product.ts` and a kind in `productKinds`
   (`supabase/functions/purchases/types.ts`), e.g. `'com.hummlist.app.plus': 'plus'`. Every product
   check (`kindOf`) then accepts it.
2. The kind in the `purchases_kind` and `entitlements_kind` checks (a migration) and in
   `Entitlement` (`app/lib/purchases/entitlements.dart`). An unknown kind unlocks nothing in an
   older app (`Entitlement.parse` drops it), so a `plus` row never unlocks Lifetime features.
3. Subscription events: `INITIAL_PURCHASE`, `RENEWAL` and `EXPIRATION` with an end date on the
   entitlement; `purchase_record` keys everything by purchase and kind already.
4. Paywalls ask `canOffer(Entitlement.plus)`. Apps from before job 43 (TestFlight) read any row as
   unlocked; they gate nothing, but no store build from before job 43 should be live when a
   second kind ships.
5. **RevenueCat's restore behavior is project-wide.** "Keep with original App User ID" would pin a
   subscription bought with the same Apple ID to the first household as well. Revisit when D is
   built (e.g. a separate RevenueCat project or entitlement).

## Configuration

RevenueCat (set up by the Lead, ADDENDUM 6): entitlement `lifetime`, offering `default`, package
`$rc_lifetime`, product `com.hummlist.app.lifetime` (non-consumable). The app loads the product by
its id. Function secrets (set by the Lead on the hosted project; NEEDS_LEAD "Job 43 – RevenueCat
setup"). Without
`REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_TOMBSTONE_HMAC_KEY` the webhook answers 503
`not_configured`; the claim route works regardless.

| Secret | Meaning |
| --- | --- |
| `REVENUECAT_WEBHOOK_AUTH` | The `Authorization` header value set in RevenueCat's webhook integration |
| `REVENUECAT_WEBHOOK_HMAC_SECRET` | Optional: RevenueCat's webhook signing secret; when set, the signature is required |
| `REVENUECAT_TOMBSTONE_HMAC_KEY` | The one key for the tombstone HMACs; never rotate it while tombstones count |
| `REVENUECAT_SECRET_KEY` | A v2 secret key (`customer_information:customers:read_write`) for deleting customers; never in the app |
| `REVENUECAT_PROJECT_ID` | The RevenueCat project (Hummlist) |

App build defines (public SDK keys, from the build environment, never committed):
`REVENUECAT_APPLE_API_KEY` (`appl_…`), `REVENUECAT_GOOGLE_API_KEY` (`goog_…`), and
`REVENUECAT_PURCHASES=true` to show the purchase screen (off by default; turn it on only for
Peter's own builds until he approves the legal texts, then for everyone).

Gone with job 43 (the Lead deletes them from the hosted secrets and the repository):
`PURCHASES_ENVIRONMENTS`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`,
`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PURCHASES_CRON_SECRET`.

## Testing locally

- `scripts/iap-local-env.sh` (run by `supabase_up`) writes local stand-ins for the function's
  secrets into the gitignored `supabase/functions/.env`. On the local stack the function also
  serves `POST /purchases/test/event`, which plays RevenueCat.
- The app's fake store: build with `--dart-define=FAKE_STORE=ok` (or `pending`, `cancel`,
  `error`, `unavailable`, `offline`) in a debug build on a desktop or phone; its purchases go
  through the local `test/event` route and the real claim route. Recipe:
  `.cursor/skills/verify-family-groceries/features/purchases.md`.
- `e2e/tests/purchases.spec.ts`: the web page, then a purchase reported through the real webhook
  (local secret) unlocks the household live for both members, and a refund locks it again.
- `e2e/tests/household-bound.spec.ts`: joining an unlocked household (nothing to buy, the refund
  help, the delete warning), restore after the household is gone, archive and bring back, a
  household bought twice, the web copy. The e2e build has `HOUSEHOLD_ARCHIVE` on
  (`app/config/e2e.json`).
- `app/ios/Hummlist.storekit`: the product for Xcode's StoreKit testing (RevenueCat supports
  StoreKit configuration files for local UI work on a Mac).
- Tests: `supabase/functions/purchases/*_test.ts`, `store_integration_test.ts` (db gate), pgTAP,
  `scripts/iap/*_test.ts`, `app/test/purchases/`.

## Store setup

Scripted where the APIs allow it, never submitted for review:

- `scripts/iap/apple_product.ts`: App Store Connect API, dry run by default, `--apply` to create
  the non-consumable, DE+EN localizations, the EUR 9.99 price in Germany (others equalized),
  availability in all territories; prints the equalized AT and CH prices. Needs the ASC API key,
  which is on the box only.
- `scripts/iap/google_product.ts`: Play Developer API `monetization.onetimeproducts`, dry run by
  default; prints Play's converted AT and CH prices. Needs the payments profile first.
- `scripts/iap/product.ts` holds id, names and price for both; `product_test.ts` pins the
  StoreKit file and the function's product id and kind to it.
- RevenueCat (account, apps, In-App Purchase key, Play service account, products with the Play
  product NON-CONSUMABLE, the `lifetime` entitlement, restore behavior, the webhook):
  NEEDS_LEAD "Job 43 – RevenueCat setup".

## Refunds when something is off

RevenueCat retries a failed webhook 5 times over about 80 minutes; after that, resend it from
RevenueCat's dashboard (Integrations → Webhooks → the event). A refund whose `CANCELLATION`
never arrived keeps the household unlocked until it is resent. The deletion workflow opens an
issue when it fails (see "Retention").
