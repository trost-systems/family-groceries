# Job 43: Hummlist Lifetime as a household-bound lifetime unlock (model A), on RevenueCat

PR #142. Peter chose model A on 2026-10-31: one member pays once and the whole household has
Hummlist Lifetime. The purchase belongs to that household for good, and nothing moves with the
user. Five addenda the same afternoon added more:
1. Archiving on last leave.
2. Tester grants that stay with households.
3. Legal Review's findings H-49 to H-56.
4. RevenueCat instead of our own store verification (Peter: "Let's just use RevenueCat and let
   them handle it").
5. Legal Review's conditions for RevenueCat.

Nothing is sold or gated yet; the purchase screen is off in every build (`REVENUECAT_PURCHASES`).
Behavior: [docs/PURCHASES.md](../PURCHASES.md). Calls and reasons:
[docs/DECISIONS.md](../DECISIONS.md), "Job 43" (31 entries).

## What was built

- **RevenueCat.** The app buys through `purchases_flutter` with the household id as App User ID.
  The SDK is configured lazily, only on the purchase page of a household Supabase says is locked.
  Two lint rules forbid attributes, device ids, `logOut`, and importing the SDK outside one file.
  The `purchases` function is RevenueCat's webhook receiver:
  - auth is a constant-time `Authorization` check, plus the optional HMAC signature;
  - event ids are stored in the same transaction as the writes, so retries are idempotent;
  - the webhook URL is pinned to `eu-central-1`;
  - the app claims its purchase to record the buyer.
  Our own Apple/Google verification, its secrets and the voided poll are gone.
- **Household-bound.** `purchase_record` binds a transaction to its household once and refuses it
  everywhere else: after deletion, for ids that are no household, for tombstoned transactions, and
  on `TRANSFER`. A reversed refund unlocks the original household again.
- **Retention.** A deleted household's purchase rows go after 30 days, and only an HMAC tombstone
  stays. Its RevenueCat customer is then deleted by `revenuecat-delete.yml`, which verifies the
  deletion with a GET that answers 404.
- **Paywall in one place.** `Entitlements.canOffer(Entitlement.lifetime)`. While the household's
  state is unknown there is no Buy. After buying, the page shows "Wird freigeschaltet …", and Buy
  stays off if the unlock is late. A household with two purchases sees a note with the refund
  help.
- **Refund help** (DE/EN sheet). It says we can't refund, then gives Apple's Report a Problem and
  Google Play's order-history steps.
- **Join screen.**
  - (a) "Du musst nichts kaufen." when the target household is unlocked.
  - (c) The refund link after the user's own purchase in the last 30 days.
  - (b) For the last member of an unlocked household: "deleted, not refunded" and
    "Trotzdem beitreten". With `HOUSEHOLD_ARCHIVE` the user can archive or delete, and deleting
    asks once more. Mehr → Archivierte Haushalte brings an archived household back.
- **Testers.** A grant count per tester, counted when used. A grant unlocks a locked household the
  tester is in and stays there. The Lead uses `scripts/iap/testers.ts`. Tester and Sandbox unlocks
  are internal for analytics.
- **Kinds.** Purchases and entitlements carry `lifetime`, and `productKinds` is the one product
  map. The extension steps for a later subscription are in PURCHASES.md.
- **Members can't read who paid** (H-55, column grants), and Realtime still delivers the unlock.
- **Analytics.** `paying_households_d35.sql` and `paying_share_wah.sql` (the kill gate), with
  `metrics.ts` mirrors and fixtures. No PostHog groups, no new events.
- **Web copy.** "Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. Danach ist
  es auch hier für deinen ganzen Haushalt freigeschaltet."

## How to verify

- `scripts/verify.sh` (or `--only db,functions,flutter,lint`) and
  `scripts/verify.sh --only e2e -- tests/household-bound.spec.ts tests/purchases.spec.ts`.
- Native: `.cursor/skills/verify-family-groceries/features/purchases.md` (fake store → local
  RevenueCat stand-in → claim). Use `FG_SURFACE=linux` on the Hetzner runner.
- Screenshots: `docs/screenshots/43-iap-household-a/`.

## Test results

- pgTAP: every file passes. `household_bound.test.sql` has 91 cases and `purchases.test.sql` 40.
  The backup drill passes with the new tables.
- Deno: the functions gate passes (the purchases handler alone has 26 tests), plus the DB
  integration test, `scripts/iap` (14) and analytics (12).
- Flutter: 1044 tests pass, and analyze and lint are clean.
- e2e (local): 8 of 8 in the purchases specs. `onboarding.spec.ts`'s fake Google/Apple sign-ins
  can't run on the Hetzner runner (Docker can't reach the host's fake OIDC server), so CI runs
  them. AC10 failed once in five local runs.
- CI: see PR #142.

## Open

- NEEDS_PETER Job 43: answering Google refund requests after 48 hours, turning on archiving,
  Pub/Sub billing for Play's real-time notifications, approving the legal texts (then the purchase
  screen goes on).
- NEEDS_LEAD Job 43: the RevenueCat setup (account, apps, keys, products NON-CONSUMABLE, restore
  behavior "Keep with original App User ID", the webhook URL and secrets, `REVENUECAT_SECRET_KEY`),
  deleting the removed secrets, adding testers, the two PostHog insights, Legal Review of the 5a
  sentences and the H-49 to H-56 notes.
- Not verified here: a real RevenueCat purchase (needs the setup), and the Android/iOS builds with
  `purchases_flutter`, which CI's android and ios gates cover.
