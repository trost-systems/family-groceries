# Job 47: purchase legal fixes (Legal Review K.11) and job 43 review leftovers

Nothing here is live for users: the purchase screen (`REVENUECAT_PURCHASES`) and archiving
(`HOUSEHOLD_ARCHIVE`, and now the server switch `household_archive`) stay off. The new legal texts
came in #147 (merged by the Lead as 01ad47c after Peter's approval on 2026-10-31); this job did
not touch them: `site/content/legal/*` and
`app/web/konto-loeschen.html` have no diff. Decisions: [DECISIONS.md](../DECISIONS.md) "Job 47".
Behavior: [PURCHASES.md](../PURCHASES.md).

## What was built

- **H-67: RevenueCat starts only on a tap.** App start and opening, rebuilding, leaving or
  returning to Mehr → Hummlist Lifetime make no SDK call. "Weiter zum Kauf" configures the SDK
  with the household id, loads the product and opens the store's sheet, which shows the price.
  "Kauf wiederherstellen" configures, then restores. The page shows no price (option a), only
  "Den Preis zeigen dir der App Store oder Google Play, bevor du kaufst." `canOffer` still decides
  whether Buy and Restore show. `PurchaseRepository.loadProduct`, `pageOpened`/`pageClosed` and
  the retry button are gone.
- **H-50: archived households are deleted 24 months after archiving.** The daily
  `purge_purchases` deletes them like any household (purchases start their 30 days, then the
  tombstone; the RevenueCat customer is queued). `archived_households()` returns `deletes_at`;
  "Archivierte Haushalte" shows "Wird am 31. Oktober 2028 gelöscht" / "Will be deleted on October
  31, 2028". The join screen's archive offer names the 24 months. No reminder e-mail: there is no
  mail sender on main.
- **H-70: a server switch for archiving, seeded off.** `app_switches.household_archive` (service
  role only). While off, any call that would archive fails with `archive_disabled` and changes
  nothing; re-enabling an archived household still works. The app shows its own message for it.
- **H-69:** the migration deletes the nil-bound sandbox purchases from before job 43, and the
  purge deletes any later one after 30 days.
- **H-68/H-73:** what Apple and Google receive and what the SDK keeps on the device, read from
  purchases-ios 5.99.0 and purchases-android 11.0.0 (pinned by purchases_flutter 11.0.0), with
  links in PURCHASES.md and a new device row in the data map. It matches draft 5a. A test fails
  when the locked SDK version changes without the docs. Sign-out calls nothing at RevenueCat
  (decision 47.6).
- **H-72:** removing a tester clears their mark on the households they unlocked (a trigger).
- **H-76 refund strings (ADDENDUM 1 and 2):** `refundHelpBody`, `refundHelpGoogle`,
  `lifetimeBoughtTwice` and `joinLifetimeEnds` are Legal Review's R-8 texts word for word (DE/EN):
  Apple alone refunds App Store purchases; Google Play through Google in 48 hours, then our
  support case by case. The refund help links the FAQ (`hummlist.com/support`, `/en/support`).
- **Job 43 leftovers:** `POST /purchases/revenuecat/deletions` needs `x-deletions-secret` (503
  while unset, 401 without or wrong), and the workflow sends it. Routes match exactly. The claim
  names the purchase's household and counts for a member at the purchase time, also one who left
  within the hour (`household_departures`, kept one hour). The `config.toml` comment describes the
  two secrets.

Migration `20261031194500_purchase_legal_fixes.sql`.

## How to verify

- `scripts/verify.sh --only db,functions,flutter,lint` and
  `scripts/verify.sh --only e2e -- tests/household-bound.spec.ts tests/purchases.spec.ts`.
- New tests: `supabase/tests/purchase_legal_fixes.test.sql` (55 cases),
  `app/test/purchases/no_sdk_before_tap_test.dart`, `app/test/household/archive_server_test.dart`,
  `scripts/iap/sdk_version_test.ts`, and the deletion, route and claim cases in
  `supabase/functions/purchases/handler_test.ts`.
- Screenshots: `docs/screenshots/47-purchase-legal-fixes/`.

## Open

NEEDS_LEAD "Job 47":
- set `REVENUECAT_DELETIONS_SECRET` as a function secret and a repository secret (the deletion
  workflow fails until both are set);
- turn archiving on (the SQL one-liner, then the app define) after Legal Review;
- Legal Review items: the SDK's foreground refresh after a tap, the device storage after sign-out,
  `household_departures`, Android Auto Backup, and H-74 (not done).
