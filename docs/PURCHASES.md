# Purchases: Hummlist Premium

Hummlist sells **Hummlist Premium** for the whole household, in two ways (Peter, Spec #4,
2026-10-31): **yearly**, an auto-renewing subscription `com.hummlist.app.yearly` (EUR 9.99 a
year in Germany), and **Lifetime**, a one-time purchase `com.hummlist.app.lifetime` (EUR 29.99).
Both grant one entitlement, `premium`, which will unlock the integrations (Siri, Alexa, MCP/AI
assistants; job 50 gates them). Nothing in the app is gated by it yet, and nothing is sold: the
purchase screen is behind the build define `REVENUECAT_PURCHASES` and the server switch
`premium_offer`, both off, until Peter turns them on. Built in job 25 (sandbox, our own store
verification), rebuilt in job 43 on RevenueCat, changed in job 47 for Legal Review K.11 (the SDK
starts only on a tap) and in job 49 for the yearly plan (Legal Review K.13). Decisions:
DECISIONS.md "Job 25", "Job 25b", "Job 43", "Job 47" and "Job 49".

**Model A (Peter, 2026-10-31; both products since job 49).** One member pays; the whole
household has it. A purchase
belongs to the household it was bought in, for good: it stays there when the buyer leaves, hands
the household over or deletes the account, and it never unlocks another household, also not after
its own is deleted. Nothing moves with the user. The app offers Buy only to a household it knows
has no Lifetime, so no member pays twice. Someone who paid and then joins an unlocked household is
pointed to the refund help (H-76, Peter 2026-10-31: Apple alone refunds App Store purchases;
for Google Play, Google in the first 48 hours, after that our support case by case in the Play
Console). Testers get it
free. A later subscription for running-cost features (model D) would be a second entitlement kind
next to premium ("A second entitlement" below). The yearly plan is household-bound the same way:
its renewals stay with the household it was bought for, and the same Apple ID cannot pay a second
plan of the group for another household ("Cases").

**RevenueCat (Peter, 2026-10-31 14:03; Legal Review's conditions, ADDENDUM 5).** RevenueCat
verifies purchases with Apple and Google; our server no longer talks to either store. The
RevenueCat customer is the **household**: the App User ID is the household's UUID, never a user
id, never anonymous.

## How it works

1. A member opens Mehr → Hummlist Premium (`/more/lifetime`). Opening, rebuilding, leaving and
   returning to the page make no RevenueCat call and no network contact to RevenueCat, and
   neither does app start (Legal Review H-67, § 25 Abs. 2 Nr. 2 TDDDG). Opening reads the server
   switch `premium_offer()` and, only when it is on and this build sells, the two prices **from
   the store itself**, once: StoreKit 2 on iOS, Play Billing on Android
   (`app/lib/purchases/store_prices.dart`, channel `familygroceries/store_prices`; A2-5). The page
   shows each price exactly as the store formats it for the store account's country, "inkl.
   MwSt." only in euros, never a repo amount and nothing derived from the device's locale.
2. **What is offered** (`Entitlements.canOffer(Entitlement.premium, plan)`, the one decision
   point): with no premium both cards, **yearly first**; with an active yearly plan only Lifetime
   (the upgrade; never a second yearly plan, H-84); with Lifetime or a tester grant nothing; while
   the rows load or the phone is offline nothing ("Wir prüfen, ob euer Haushalt Hummlist Premium
   schon hat …"). A plan the store doesn't return (Lifetime in BR, MX, IN) is not offered there,
   silently. No price read at all (offline, store unavailable, timeout): no Buy, "Hummlist Premium
   ist gerade nicht verfügbar." Switch off or `REVENUECAT_PURCHASES` off: "Hummlist Premium ist
   bald verfügbar.", no Buy, no Restore, no price query.
3. The yearly card shows the price per year and the disclosures (1 year, renews automatically
   unless cancelled at least 24 hours before the period ends, charged at confirmation and
   renewal, where to cancel); the cards are followed by Restore, the terms (Apple's standard EULA
   on iOS, a placeholder elsewhere) and the privacy policy. All copy is placeholder (K.13 /
   Hummlist Launch).
4. **The tap starts the SDK.** Buy configures `purchases_flutter` with the household id as App
   User ID (`logIn(householdId)` instead when this app run configured it for another household),
   loads that plan's product by id (`getProducts`, `ProductCategory.subscription` for yearly,
   `nonSubscription` for Lifetime; Play names the subscription `com.hummlist.app.yearly:yearly`)
   and opens the store's sheet. Restore configures (or logs in) the same way, then calls
   `restorePurchases()`. After a tap the SDK stays configured for the rest of that app run; the
   next app start configures nothing until the next tap. RevenueCat verifies the purchase with the
   store, acknowledges Play purchases and finishes the transaction. The app then **claims** it:
   `POST /functions/v1/purchases/claim` with its own session and `{householdId, store,
   transactionId}`, pinned to `eu-central-1`. The claim records the buyer (H-55) if they were a
   member of that household when buying (job 47); it never unlocks anything. Until Supabase shows
   the unlock (for Lifetime: the Lifetime row, also next to a running yearly plan), the page says
   "Wird freigeschaltet …".
5. **Lifetime while a yearly plan renews** (H-84): Buy Lifetime first shows Legal Review's
   warning, „Euer Haushalt hat schon ein Jahresabo. Es läuft nach dem Einmalkauf weiter und wird
   weiter abgerechnet, bis es gekündigt wird; …“ (the subscriber's variant: „Du kannst es unter
   [Abo verwalten] kündigen.“), with „Trotzdem kaufen“ · „Abbrechen“. The SDK starts only on
   „Trotzdem kaufen“. After the purchase the page keeps that text with the store link while the
   plan renews. Hummlist never cancels or refunds the plan.
6. RevenueCat calls our webhook (`POST /functions/v1/purchases/revenuecat/webhook`, the
   `purchases` function): INITIAL_PURCHASE / NON_RENEWING_PURCHASE record the purchase for the
   household `app_user_id` names (`purchase_record`), the yearly plan with its end; RENEWAL and
   the lifecycle events keep the plan's state ("Subscription lifecycle" below).
7. Every member's app reads the household's `entitlements` rows (RLS: members only; who paid or
   granted is not readable, H-55) and hears inserts, updates and deletes over Realtime. Premium is
   active **at read time**: a Lifetime or tester row (no end), else a yearly row whose end lies
   ahead. The page's status line: „Hummlist Premium aktiv (jährlich, verlängert sich am …)“, „…
   läuft am … aus“ (auto-renew off), „Hummlist Premium Lifetime“, „Hummlist Premium über
   Tester-Freischaltung“. The server's check for the integrations is `household_has_premium()`
   (same rule).
8. While the household has an active yearly plan the page shows „Abo verwalten oder kündigen“
   (StoreKit's manage sheet on iOS, Play's subscription page on Android, a line with both pages on
   the web). Only the subscriber sees a failed renewal: „Apple bzw. Google konnten dein Jahresabo
   nicht abbuchen. Premium läuft noch bis {date}. …“ (`my_yearly_plan()`, H-87).
9. Before deleting the account, joining another household (leave, delete or archive the current
   one) or re-enabling an archived one, the subscriber of a renewing plan reads „Dein Jahresabo
   für Hummlist Premium läuft weiter und wird über dein Apple- bzw. Google-Konto abgerechnet, bis
   du es kündigst. Löschen oder Verlassen kündigt es nicht.“ with „Abo verwalten“ · „Trotzdem
   fortfahren“ (account deletion also for a plan they pay for another household); other members
   of a billed household the placeholder line „Ein Jahresabo für diesen Haushalt läuft weiter,
   bis es gekündigt wird.“ (H-85).
10. Refunds revoke one purchase's unlock (`purchase_revoke`) and send `purchase_refunded` once;
    `REFUND_REVERSED` reinstates it in its own household. A `TRANSFER` never moves anything.
11. Restore (Kauf wiederherstellen) calls `restorePurchases()` under the household's App User ID.
    With the project's restore behavior **Keep with original App User ID** (an Ops setting),
    RevenueCat refuses a purchase that belongs to another household; the app says "Dieser Kauf
    gehört zu einem anderen, früheren Haushalt und bleibt dort." with the refund help. The server
    refuses it too (`purchase_record`: bound household, tombstones).

| Case | What happens |
| --- | --- |
| Double tap on Buy, app killed mid-purchase | RevenueCat owns the transaction and finishes it; its webhook records it. A claim lost with a killed app leaves the buyer unknown: the unlock stands, `purchase_completed` is not sent (analytics undercount) |
| Restore on a new phone or the partner's phone | Household already unlocked: shown at once, no Buy, no Restore (nothing to restore) |
| The same purchase in another household (restore, re-buy, a RevenueCat `TRANSFER`) | Refused by RevenueCat (Keep with original App User ID) and by `purchase_record` (`used_elsewhere`): one household per purchase, for good. "Dieser Kauf gehört zu einem anderen, früheren Haushalt und bleibt dort." and the refund help link |
| Restore after its household was deleted | Refused (`used_elsewhere` with `household_gone`; after the 30-day purge `tombstoned`). Nothing unlocks anywhere else (H-56) |
| A second purchase in an unlocked household (two phones, Ask to Buy, a race) | Its own row; refunding one keeps the other's unlock. Every member's page then shows "Euer Haushalt hat Hummlist Lifetime mehr als einmal gekauft. Einen der Käufe kannst du dir erstatten lassen." with the refund help |
| Buyer switches households between buying and claiming | The claim names the household the purchase was made for (job 47), not the one the buyer is in now. `purchase_claim` records the buyer if they were a member of it at the purchase time: a member now who joined before it, or one who left it in the last hour (`household_departures`, kept one hour) after joining before it. Otherwise (left more than an hour ago, joined after the purchase, never a member, or the household is gone) it answers 403 `no_household` and the buyer stays unknown (no `purchase_completed`); the unlock stands where it was bought |
| Ask to Buy, Play pending payment | "Wartet auf Bestätigung"; RevenueCat's webhook records it when the store completes it |
| Products not loadable, offline, store down | Before the tap (no price read): no Buy, "Hummlist Premium ist gerade nicht verfügbar.". After the tap: the same line or the offline note; Buy stays and tries again; no crash |
| Yearly-only storefront (BR, MX, IN) | The store returns no Lifetime: no Lifetime card and no Lifetime entry (warning, upgrade); the yearly card as usual. Lifetime holders and testers there keep Premium |
| The same Apple ID already pays the yearly plan for household A, and the person tries to buy or restore it in household B (iOS) | Apple allows one subscription per Apple ID per group, and RevenueCat (Keep with original App User ID) keeps the receipt with A: the store or RevenueCat refuses (`receiptAlreadyInUse`), the app says "Dieser Kauf gehört zu einem anderen, früheren Haushalt und bleibt dort." and "Dein Apple- bzw. Google-Konto zahlt schon ein Jahresabo für einen anderen Haushalt. Jemand anderes aus diesem Haushalt kann Hummlist Premium abschließen." The restore setting stays |
| Two yearly plans in one household (two members' store accounts, a race) | Both rows kept, never merged; premium runs to the later end; the page says so with the manage link; the function logs `second_yearly` |
| Yearly plan cancelled (auto-renew off) | Premium stays until the period's end, the status says "läuft am … aus"; EXPIRATION ends it |
| Yearly plan lapsed | Premium off at read time; the paywall offers both plans again. Nothing is deleted: household, list, Alexa links, tokens, MCP grants stay (integrations are paused by job 50's gate). The row stays with its past end |
| Billing problem | Premium until the grace period's end (RevenueCat's `grace_period_expiration_at_ms`), else the period's end; only the subscriber is told. Google's account hold: EXPIRATION, premium off until a RENEWAL |
| Lifetime bought while yearly renews | Both rows; Lifetime wins; the yearly plan keeps renewing until its subscriber cancels it; when it expires premium stays |
| Archived household with a yearly plan | Archiving works as for Lifetime; the plan is still billed; at its end premium stops, the archive stays |
| Payer leaves the household, hands it over or deletes the account | The unlock stays with the household. Account deletion removes the buyer link; the purchase keeps its household (`bound_household`) |
| Last member leaves an unlocked household (joins another) | Joining asks first. With `HOUSEHOLD_ARCHIVE` on: "Archivieren und beitreten" keeps the household archived (list and unlock kept, re-enabled under Mehr → Archivierte Haushalte, deleted 24 months after archiving otherwise); "Löschen und beitreten" asks once more ("… Hummlist Lifetime endet mit ihm, denn ein Kauf gehört zu seinem Haushalt …", refund help). With it off (releases, until the legal texts say so): that warning and "Trotzdem beitreten". Never blocked. The server archives only while its switch `household_archive` is on (job 47, H-70); off, an archiving call is refused with `archive_disabled` and changes nothing, and the app says "Archivieren ist gerade nicht möglich. Dein Haushalt bleibt, wie er ist." |
| Joiner into an unlocked household | The join screen says "Dieser Haushalt hat Hummlist Lifetime. Du musst nichts kaufen." With their own purchase from the last 30 days that stands: a link to the refund help |
| Tester | Their grant (1 by default, `scripts/iap/testers.ts`) unlocks a household they are in that has none; it stays with that household like a purchase. No RevenueCat involved. Internal for analytics |
| Archived household | No members, not readable by anyone, its invites lead nowhere; the archiving user alone sees and re-enables it (`archived_households`, `unarchive_household`), with "Wird am <Datum> gelöscht" per household. Deleted 24 months after archiving unless re-enabled (job 47, H-50), and at once with that user's account. Its purchases restore nowhere else, and in it again after re-enabling; re-enabling and archiving again start a new 24 months. Re-enabling works with the server switch off, unless it would archive the household the user leaves |
| Family Sharing | Off at Apple; a webhook event with `is_family_share` is ignored |
| An App User ID that is no household (anonymous, unknown) | Ignored: nothing recorded, nothing unlocked |
| Web | No buy button and no external purchase link; "Hummlist Premium kaufst du in der iPhone- oder Android-App. Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet." and the status; with a yearly plan a line with the App Store and Google Play subscription pages |
| `REVENUECAT_PURCHASES` off (every build until Peter's OK) or no SDK key, or `premium_offer` off | "Hummlist Premium ist bald verfügbar.", no Buy, no Restore, no store price query; unlocks (testers) still show |
| Signed out, no household | The page is under More, which `authRedirect` only lets households reach; the claim route answers 401/403 |

## The webhook

`supabase/functions/purchases/handler.ts`. Routes match exactly (after the gateway's
`/functions/v1`; a trailing slash is ignored): `/purchases/revenuecat/webhooks`,
`/x/purchases/revenuecat/webhook` and other near misses are 404 (`handler_test.ts`, `routes`).

| Route | Caller | What it does |
| --- | --- | --- |
| `GET /purchases` | smoke checks | `{configured}` |
| `POST /purchases/revenuecat/webhook` | RevenueCat | The webhook (above). `Authorization` must equal `REVENUECAT_WEBHOOK_AUTH` whole (it includes `Bearer `). 401 without the right `Authorization` (or, with `REVENUECAT_WEBHOOK_HMAC_SECRET`, a bad or stale `X-RevenueCat-Webhook-Signature`: `t=…,v1=…`, HMAC-SHA256 over `"<t>.<raw body>"`, 5 minutes). 200 for everything it processed or ignores, 500 when the database fails so RevenueCat retries (5 times over about 80 minutes). The event id is stored in the same transaction as the writes |
| `POST /purchases/revenuecat/deletions` | the daily workflow | Deletes due RevenueCat customers ("Retention"); at most 25 per run, each customer at most once an hour. Needs `x-deletions-secret` equal to `REVENUECAT_DELETIONS_SECRET` (constant-time compare): 401 without or with a wrong one, 503 `not_configured` while the secret is unset (fail closed; job 47) |
| `POST /purchases/claim` | the app, signed in | Records the buyer of a transaction in the household it names (`householdId`, the purchase's App User ID), for a member of it at the purchase time (first member wins); 20 a minute per user |
| `POST /purchases/test/event` | local stack only (404 elsewhere) | Builds a RevenueCat event and processes it like the webhook, without the secret: the debug fake store, fg and e2e use it |

Products (`productOf` in `supabase/functions/purchases/types.ts`, pinned to
`scripts/iap/product.ts`): `com.hummlist.app.yearly` and Play's `com.hummlist.app.yearly:yearly`
(stored as the bare id) are the yearly plan, `com.hummlist.app.lifetime` is Lifetime, all of kind
`premium`; any other product id (another base plan included) is acknowledged and ignored. The
event's `entitlement_ids` is not read: `premium` and the old `lifetime` both work. Stores:
`APP_STORE` is `apple`, `PLAY_STORE` `google`; others are ignored. The purchase's key is
`original_transaction_id` (`transaction_id` when absent); the claim may name either.

### Subscription lifecycle

RevenueCat's event types and fields:
https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields (read 2026-11-01).
Every event carries `event_timestamp_ms`; a yearly row keeps the newest one applied (`state_at`),
and an older event changes nothing (`stale`). Lifecycle events for a transaction never recorded
write nothing (`unknown`).

| Event | Yearly plan | Lifetime |
| --- | --- | --- |
| `INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE` | Record and bind (H-56); end = `expiration_at_ms`, renews | Record and bind |
| `RENEWAL` | Same transaction: new end, renews, billing problem cleared (also "a lapsed user resubscribed" on Apple). A new transaction (Google resubscribe: new purchase token) is a new row in the same household only. Never a second `purchase_completed` | (as a record) |
| `CANCELLATION`, refund (see below) | Revoke this row (other rows stay), `purchase_refunded` | Revoke, `purchase_refunded` |
| `CANCELLATION`, not a refund | Auto-renew off; premium stays until the end | (every cancellation is a refund) |
| `UNCANCELLATION` | Auto-renew on | nothing |
| `BILLING_ISSUE` | Billing problem open; end = `grace_period_expiration_at_ms`, else `expiration_at_ms` | nothing |
| `EXPIRATION` | End = the reported end, at the latest the event's time; auto-renew off; premium ends at read time; nothing deleted | nothing |
| `SUBSCRIPTION_EXTENDED` | New end | nothing |
| `SUBSCRIPTION_PAUSED` (Google) | Auto-renew off, premium to the end; `EXPIRATION` (reason SUBSCRIPTION_PAUSED) ends it; a resume is a `RENEWAL` | nothing |
| `REFUND_REVERSED` | Reinstate with the stored state | Reinstate |
| `PRODUCT_CHANGE` | Logged by type; the following `RENEWAL` carries the new product, which maps to premium | logged |
| `TRANSFER` | Logged by type, nothing moves (H-56) | same |
| `TEMPORARY_ENTITLEMENT_GRANT`, `TEST`, others | 200, no write | same |

A `RENEWAL` newer than a refund of the same yearly transaction, in its own household, lifts the
refund (RevenueCat: a subscription refund covers the latest period, and auto-renew may stay on).

### cancel_reason

Read in flight, never stored or logged (H-87). Legal Review K.13 (A2-1, H-81): a cancellation
never ends a paid period; only a refund revokes at once.

| `cancel_reason` | Yearly plan | Lifetime |
| --- | --- | --- |
| `UNSUBSCRIBE` | Auto-renew off; premium until `expires_at`, then `EXPIRATION` ends it | Revoke (refund) |
| `BILLING_ERROR` | Auto-renew off; premium until `expires_at` | Revoke |
| `DEVELOPER_INITIATED` | Auto-renew off; premium until `expires_at` | Revoke |
| `PRICE_INCREASE` | Auto-renew off; premium until `expires_at` | Revoke |
| `UNKNOWN` (App Store only: "Apple did not provide the reason") | Auto-renew off, unless the event carries a negative `price`, which RevenueCat uses for refunds: then revoke | Revoke |
| `CUSTOMER_SUPPORT` (a refund) | Revoke | Revoke |
| missing | Auto-renew off | Revoke |

**Analytics.** `purchase_completed` goes out once per purchase, when both the webhook's record
and the buyer's claim are in (whichever comes second), under the buyer's consent;
`purchase_refunded` on a refund of a purchase with a known buyer. Both carry `product_id` and
`premium_source` (`yearly` | `lifetime`). A renewal sends nothing. Without a claim, or without consent, nothing is sent (the paying
share is a lower bound, docs/ANALYTICS.md). Sandbox purchases, testers' purchases and purchases
in households a tester unlocked are `is_internal`. `purchase_restored` is not sent: a RevenueCat
restore produces no event for us, and no production code sends it (the job 25 helper
`recordPurchase` in `_shared/purchases.ts`, which could, has no caller but its test; checked in job
47).

### Who receives what (Legal Review H-53)

Our server calls neither Apple nor Google. The recipient is **RevenueCat, Inc.** (processor under
its DPA, part of RevenueCat's terms, https://www.revenuecat.com/dpa/; SCCs module 2 for EEA
transfers). The app's `purchases_flutter` SDK talks to RevenueCat (`api.revenuecat.com`), and
RevenueCat talks to Apple (App Store Server API with the In-App Purchase key) and Google (Play
Developer API through a service account; real-time developer notifications).

Data RevenueCat receives (only after a tap on Buy or Restore, job 47): the household UUID as App
User ID (what reaches Apple and Google: "What Apple and Google receive" below), store transaction ids and the Play purchase token,
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

### What Apple and Google receive (Legal Review H-68)

SDK facts checked for purchases_flutter 11.0.0 (the version `app/pubspec.lock` locks), on
2026-10-31, from the source at the exact tags; `scripts/iap/sdk_version_test.ts` fails when the
locked version changes until this section is checked again.

- **Versions.** purchases_flutter 11.0.0 pins purchases-hybrid-common **20.0.0**
  (`ios/purchases_flutter.podspec` and `Package.swift`: `exact: "20.0.0"`; `android/build.gradle`:
  `common_version = '20.0.0'`). That pins **purchases-ios 5.99.0**
  ([PurchasesHybridCommon.podspec](https://github.com/RevenueCat/purchases-hybrid-common/blob/20.0.0/PurchasesHybridCommon.podspec#L18),
  [Package.swift](https://github.com/RevenueCat/purchases-hybrid-common/blob/20.0.0/Package.swift#L25))
  and **purchases-android 11.0.0**
  ([libs.versions.toml](https://github.com/RevenueCat/purchases-hybrid-common/blob/20.0.0/android/gradle/libs.versions.toml#L11)).
- **Apple, StoreKit 2** (the SDK's default, `StoreKitVersion.default = .storeKit2`,
  [StoreKitVersion.swift#L36](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Misc/StoreKitVersion.swift#L36);
  used on iOS 16 and later,
  [#L55](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Misc/StoreKitVersion.swift#L55);
  the app sets no StoreKit version): when the App User ID parses as a UUID, every purchase gets
  `Product.PurchaseOption.appAccountToken(uuid)`
  ([PurchasesOrchestrator.swift#L846-L849](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Purchasing/Purchases/PurchasesOrchestrator.swift#L846-L849)).
  Our App User ID is the household UUID, so **Apple receives the household id as the
  transaction's `appAccountToken`**.
- **Apple, StoreKit 1** (iOS 15, which the app still supports, deployment target 15.0): the SDK
  sets `SKMutablePayment.applicationUsername = appUserID` for every purchase, UUID or not
  ([PurchasesOrchestrator.swift#L661](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Purchasing/Purchases/PurchasesOrchestrator.swift#L661)).
  Apple receives the household id there too. (Apple's documentation says a UUID
  `applicationUsername` also appears as the transaction's `appAccountToken`; that is Apple's
  statement, not read from source.)
- **Google**: a one-time product's `BillingFlowParams` always get
  `setObfuscatedAccountId(appUserID.sha256())`
  ([BillingWrapper.kt#L1031](https://github.com/RevenueCat/purchases-android/blob/11.0.0/purchases/src/main/kotlin/com/revenuecat/purchases/google/BillingWrapper.kt#L1031)),
  where `sha256()` is the Base64 of the unsalted SHA-256 of the id's bytes
  ([utils.kt#L33-L37](https://github.com/RevenueCat/purchases-android/blob/11.0.0/purchases/src/main/kotlin/com/revenuecat/purchases/common/utils.kt#L33-L37)).
  **Google receives a hash of the household id**, not the id. `setObfuscatedProfileId` is never
  called in purchases-android 11.0.0 (no occurrence in the source).
- So draft 5a's sentence ("gibt RevenueCat beim Kauf die Kennung deines Haushalts an Apple
  weiter bzw. einen daraus gebildeten Hashwert an Google") matches the source. Two details for
  Legal Review (NEEDS_LEAD "Job 47"): the hash is unsalted (anyone who knows the household id can
  compute it), and a restore sends neither (it reads existing transactions).

### What the SDK keeps on the device (Legal Review H-73)

Written only after a tap on Buy or Restore (job 47); before, the SDK is never configured. SDK facts
checked for purchases_flutter 11.0.0, as above.

- **iOS** (purchases-ios 5.99.0): the UserDefaults suite `com.revenuecat.user_defaults`
  ([UserDefaults+Extensions.swift#L30](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/FoundationExtensions/UserDefaults+Extensions.swift#L30))
  with the App User ID (`com.revenuecat.userdefaults.appUserID.new`), the household's
  CustomerInfo JSON (`…purchaserInfo.<household id>`: purchased product ids, transaction ids,
  purchase dates, first seen, entitlements) and its timestamp, the product-to-entitlement mapping,
  and, unused by us, subscriber attributes and attribution keys
  ([DeviceCache.swift#L622-L656](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Caching/DeviceCache.swift#L622-L656));
  the offerings response in files under the app's `RevenueCat/device-cache` directory
  ([DeviceCache.swift#L54](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Caching/DeviceCache.swift#L54)).
- **Android** (purchases-android 11.0.0): the SharedPreferences file
  `com_revenuecat_purchases_preferences`
  ([RevenueCatBackupAgent.kt#L33](https://github.com/RevenueCat/purchases-android/blob/11.0.0/purchases/src/main/kotlin/com/revenuecat/purchases/backup/RevenueCatBackupAgent.kt#L33))
  with keys `com.revenuecat.purchases.<api key>…`: the App User ID (`.new`), CustomerInfo per user
  and its timestamp, SHA-1 hashes of sent purchase tokens (`.tokensV2`), the storefront country,
  the product-to-entitlement mapping and the offerings response (a file)
  ([DeviceCache.kt#L75-L147](https://github.com/RevenueCat/purchases-android/blob/11.0.0/purchases/src/main/kotlin/com/revenuecat/purchases/common/caching/DeviceCache.kt#L75-L147)).
  The app declares no `android:allowBackup`, so Android's Auto Backup may copy this file (like
  the app's other SharedPreferences) to the user's Google backup (NEEDS_LEAD "Job 47").
- **How long.** CustomerInfo counts as fresh for 5 minutes in the foreground and 25 hours in the
  background, the entitlement mapping 25 hours
  ([iOS DeviceCache.swift#L976-L986](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Caching/DeviceCache.swift#L976-L986),
  [Android DateExtensions.kt#L15-L16](https://github.com/RevenueCat/purchases-android/blob/11.0.0/purchases/src/main/kotlin/com/revenuecat/purchases/common/caching/DateExtensions.kt#L15-L16)).
  Stale entries are refreshed, not deleted: everything stays until the SDK switches to another
  App User ID (a Buy or Restore for another household, which clears the old household's
  CustomerInfo and offerings,
  [DeviceCache.swift#L129-L149](https://github.com/RevenueCat/purchases-ios/blob/5.99.0/Sources/Caching/DeviceCache.swift#L129-L149)),
  `logOut`, or uninstalling the app.
- **Device identifiers.** The app configures with `automaticDeviceIdentifierCollectionEnabled =
  false` and diagnostics off (`revenuecat_repository_test.dart` checks both) and calls no
  `collectDeviceIdentifiers` or attribute setter (lint `no-revenuecat-customer-data`).
- **Sign-out and account deletion (DECISIONS 47.6).** The app calls nothing at RevenueCat:
  `logOut` would create an anonymous RevenueCat customer and contact RevenueCat (forbidden, C3),
  and the SDK has no other call that clears its storage. The household id and its CustomerInfo
  stay on that device until one of the events above. A deleted household's customer is deleted at
  RevenueCat 30 days later ("Retention"); the copy on the device is not.

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
| `purchases` | service connection | `purchase_record`, `purchase_lifecycle`, `purchase_claim`, `purchase_revoke`, `purchase_reinstate` | store, transaction id (the original), latest transaction id, its HMAC, product, kind (`premium`), plan (`yearly`/`lifetime`), environment, buyer (from the claim; null after their deletion), bound household (set at the first record, never changed), purchased/verified/revoked at, price, currency, country, when `purchase_completed` went out, when the household was deleted; yearly: end (`expires_at`), renews (`auto_renew`), billing problem open (`billing_issue`), newest event applied (`state_at`). No cancel or expiry reasons, no per-renewal rows (H-87) |
| `entitlements` | household members (RLS, column grants: `id, purchase_id, household_id, kind, source, product_id, store, environment, granted_at, premium_source, expires_at, auto_renew`), Realtime (insert, update, delete) | `purchase_entitlement_sync` (from `purchase_record`, `purchase_lifecycle`, `purchase_reinstate`), `tester_grant_apply` (insert), `purchase_revoke` (delete) | one row per unlock: a purchase's (`source` purchase) or a tester's grant (`source` tester, `tester` the granting user, null after their deletion); kind; `premium_source` (`yearly`, `lifetime`, `tester_grant`); yearly: its end and whether it renews; granted by (not member-readable) |
| `purchase_claims` | service connection | `purchase_claim`, `purchase_record` | a claim waiting for its webhook: store, transaction id, claimant, their household, when (30 days at most) |
| `revenuecat_events` | service connection | the webhook | processed event ids and types, 90 days |
| `purchase_tombstones` | service connection | `purge_purchases` | HMAC-SHA256 of purged store transaction ids under `REVENUECAT_TOMBSTONE_HMAC_KEY`, nothing else |
| `revenuecat_deletions` | service connection | trigger on household deletion (every one: a tap on Buy or Restore creates the customer, also without a purchase), `revenuecat_deletions_take`/`_done` (the deletion route) | deleted households' ids (RevenueCat App User IDs), due 30 days later |
| `lifetime_testers` | service connection | `scripts/iap/testers.ts`, `tester_grant_apply` | user id, grants (free unlocks, default 1), used, note, added at |
| `households.archived_at`, `archived_by` | nobody but `archived_households()` for the archiving user (with `deletes_at`, 24 months later) | `leave_current_household(true)`, `accept_invite(code, true)`, `unarchive_household` (archiving only while `household_archive` is on) | when and by whom the last member archived it |
| `app_switches` | service connection (`app_switch(key)` for the functions); members only through `premium_offer()` | the Lead, with the service role | server switches; `household_archive` (seeded off) allows archiving; `premium_offer` (seeded off, job 49) lets the app offer Hummlist Premium |
| `household_departures` | service connection (`was_member_at`) | trigger on leaving a household | household, user, joined and left at; one hour, for the buyer's claim |
| `purchase_rate` | service connection | `purchase_take_call` | per-user window for claims |

Functions for others to call: `household_premium(household)` (source and end) and
`household_has_premium(household)`, server-only, the check the integrations use (job 50);
`my_yearly_plan()` (members: the caller's own subscriber facts) and `premium_offer()` (members:
the switch).

Migrations `20261030190000_purchases.sql`, `20261031123504_household_bound_lifetime.sql`,
`20261031194500_purchase_legal_fixes.sql` and `20261031214500_premium_yearly.sql`; pgTAP
`supabase/tests/purchases.test.sql`, `household_bound.test.sql`, `purchase_legal_fixes.test.sql`
and `premium_yearly.test.sql`; the data map
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
- **Archived households** keep everything until re-enabled, their archiver's account is deleted
  (`delete_account`), or 24 months have passed since archiving (job 47, H-50): the daily
  `purge_purchases` deletes the household like any deletion, so its purchases start their 30 days
  and its RevenueCat customer is queued. `archived_households()` returns `deletes_at`; the app
  shows "Wird am <Datum> gelöscht". Re-enabling clears `archived_at`; archiving again starts a new
  24 months. There is no reminder e-mail: Hummlist sends no notification e-mails of its own
  (DECISIONS 47.3). One whose archiver vanished another way is deleted by the daily purge.
- RevenueCat's own retention after deletion follows its DPA ("subject to standard data backup and
  archival practices").
- Purchases from before job 43 that unlocked nothing were bound to the nil UUID. All were sandbox
  test data; job 47's migration deletes the nil-bound `Sandbox` rows, and the daily purge deletes
  any nil-bound sandbox row 30 days after it was verified (tombstoning it if it has an HMAC), so
  none can linger (H-69). A nil-bound `Production` row cannot exist (nothing was sold before job
  43); the purge leaves one alone, for a person to look at.
- **Ended memberships** (`household_departures`: household, user, joined, left) are kept one hour
  for the buyer's claim, then deleted (on the next departure and by the daily purge).

### Testers

`lifetime_testers` lists users who get Lifetime free, with a number of grants (1 by default). A
grant unlocks a household the tester is in that has no Lifetime: at once when the Lead adds them or
raises the count, otherwise when they next create or join such a household. The unlock is an
`entitlements` row with `source` tester and then behaves like a purchase: it stays when the tester
leaves, survives an archive, never moves; lowering the count or removing the tester keeps it, and
a deleted household doesn't give its grant back (`used` is counted). Removing a tester from the
list (or their account) clears their mark on the households they unlocked (`entitlements.tester`,
trigger `lifetime_testers_removed`, H-72); the unlocks stay. Testers don't use RevenueCat
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

What a later running-cost subscription (AI meal plans, price feeds) adds, without touching
premium:

1. A product id in `scripts/iap/product.ts` and an entry in `products`
   (`supabase/functions/purchases/types.ts`) with its own kind, e.g. `plus`. Every product check
   (`productOf`) then accepts it.
2. The kind in the `purchases_kind` and `entitlements_kind` checks (a migration) and in
   `Entitlement` (`app/lib/purchases/entitlements.dart`). An unknown kind unlocks nothing in an
   older app (`Entitlement.parse` drops it), so a `plus` row never unlocks Lifetime features.
3. Subscription events work already (the yearly plan's lifecycle, job 49); the effective rule
   (`household_premium`) is per kind and would get its sibling.
4. Paywalls ask `canOffer(Entitlement.plus, plan)`. Apps from before job 43 (TestFlight) read any row as
   unlocked; they gate nothing, but no store build from before job 43 should be live when a
   second kind ships.
5. **RevenueCat's restore behavior is project-wide.** "Keep with original App User ID" would pin a
   subscription bought with the same Apple ID to the first household as well. Revisit when D is
   built (e.g. a separate RevenueCat project or entitlement).

## Configuration

RevenueCat (set up by the Lead and Ops): entitlement `premium` (`entl654efcfce4`) with the four
products (App Store and Play, yearly and Lifetime; the old `lifetime` entitlement stays until every
app is a job 49 build), offering `default` with `$rc_annual` and `$rc_lifetime`. The app loads
products by id, not the offering (DECISIONS 49.27). Store facts (Ops, 2026-10-31): App Store
subscription group "Hummlist Premium" `22532621`, yearly Apple ID `6829293557`, Lifetime
`6829223747`; Play base plan `yearly`, grace period 14 days, account hold 46 days. Function secrets (set by the Lead on the hosted project; NEEDS_LEAD "Job 43 – RevenueCat
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
| `REVENUECAT_DELETIONS_SECRET` | What the daily deletion workflow sends as `x-deletions-secret`; also a repository secret of the same name (NEEDS_LEAD "Job 47"). Unset: the deletion route refuses every call |

Expected prices (the drift check's constants, `expectedPrices` in `scripts/iap/product.ts`; never
shown in the app, which shows only what the store returns):

| Storefront | Yearly | Lifetime |
| --- | --- | --- |
| Euro storefronts (EUR) | €9.99 | €29.99 |
| United States (USD) | $9.99 | $29.99 |
| United Kingdom (GBP) | £8.99 | £24.99 |
| Switzerland (CHF) | CHF 10 | CHF 30 |
| Brazil, Mexico, India | as the store sets it (recorded on the first run) | not sold |

App build defines (public SDK keys, from the build environment, never committed):
`REVENUECAT_APPLE_API_KEY` (`appl_…`), `REVENUECAT_GOOGLE_API_KEY` (`goog_…`), and
`REVENUECAT_PURCHASES=true` to show the purchase screen (off by default; turn it on only for
Peter's own builds until he approves the legal texts, then for everyone). `HOUSEHOLD_ARCHIVE=true`
offers archiving in the app; the server archives only while `app_switches.household_archive` is
on (seeded off; NEEDS_LEAD "Job 47" turns both on together).

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
- `e2e/tests/premium-yearly.spec.ts`: the yearly plan live for both partners, cancelled and
  expired (list and tokens stay), Lifetime while yearly renews, a TRANSFER, and the
  billing-continues warnings before account deletion and leaving.
- `POST /purchases/test/event` takes `productId` (`com.hummlist.app.yearly`), `type` (every
  lifecycle type), `expiresInDays`, `graceDays`, `cancelReason`, `eventAgoMs`, `transferTo`.
- `e2e/tests/household-bound.spec.ts`: joining an unlocked household (nothing to buy, the refund
  help, the delete warning), restore after the household is gone, archive and bring back (with
  the deletion date), a household bought twice, the web copy. The e2e build has
  `HOUSEHOLD_ARCHIVE` on (`app/config/e2e.json`) and the spec turns the server switch on.
- `app/test/purchases/no_sdk_before_tap_test.dart`: the real `RevenueCatRepository` over a mocked
  platform channel: app start, the More tab, opening, rebuilding, leaving and returning to the
  page make no SDK call and one store price read per opening; Buy (yearly or Lifetime) makes
  `setupPurchases`, `getProductInfo`, `purchaseProduct`, Restore `setupPurchases`,
  `restorePurchases`, in that order (H-67).
- `app/ios/Hummlist.storekit`: both products (the yearly plan in its subscription group) for
  Xcode's StoreKit testing (RevenueCat supports StoreKit configuration files for local UI work on
  a Mac).
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
- `scripts/iap/product.ts` holds both products (ids, Apple IDs, names, base prices, period,
  subscription group, Play base plan) and the expected prices; `product_test.ts` pins the
  StoreKit file and the function's product map to it. `apple_product.ts` and `google_product.ts`
  create Lifetime only; Ops creates the subscription.
- `scripts/iap/price_drift.ts` (daily `.github/workflows/price-drift.yml`): reads both stores'
  current prices and fails on drift from the expected prices, or Lifetime in BR/MX/IN; "SKIPPED:
  … missing" without its secrets (NEEDS_LEAD "Job 49").
- RevenueCat (account, apps, In-App Purchase key, Play service account, products with the Play
  product NON-CONSUMABLE, the `lifetime` entitlement, restore behavior, the webhook):
  NEEDS_LEAD "Job 43 – RevenueCat setup".

## The refund help

A sheet (`app/lib/purchases/refund_help.dart`) from the Premium page, the join screen and the
delete confirmation. Its texts are Legal Review's R-8 strings word for word (H-76, job 47
ADDENDUM 1 and 2): App Store purchases only Apple refunds; Google Play in the first 48 hours
through Google, after that by e-mail to support@hummlist.com with the order number (`GPA.…`) or
the Google account's e-mail address, looked at case by case; statutory rights unaffected. Links:
Apple's Report a Problem, Google Play's refund page, and the FAQ on hummlist.com (`/support`,
`/en/support`; its refund question has no anchor of its own, and the legal pages are not this
code's to change). Below them a placeholder note for the yearly plan: cancelling only stops the
renewal; the current year is not refunded automatically (NEEDS_LEAD "Job 49").

## Refunds when something is off

RevenueCat retries a failed webhook 5 times over about 80 minutes; after that, resend it from
RevenueCat's dashboard (Integrations → Webhooks → the event). A refund whose `CANCELLATION`
never arrived keeps the household unlocked until it is resent. The deletion workflow opens an
issue when it fails (see "Retention").
