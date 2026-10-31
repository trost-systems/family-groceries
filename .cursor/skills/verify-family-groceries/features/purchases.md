# Hummlist Lifetime (in-app purchase)

Mehr → Hummlist Lifetime sells a one-time unlock for the whole household on iOS and Android through RevenueCat, with "Weiter zum Kauf" and "Kauf wiederherstellen"; the store's sheet shows the price, the page shows none. RevenueCat's SDK starts only on a tap on one of the two (job 47, H-67): app start and opening, rebuilding, leaving or returning to the page make no SDK call. The household id is RevenueCat's App User ID; RevenueCat verifies with the store and calls the `purchases` function's webhook, which unlocks the household in Supabase. Both members then see "Freigeschaltet" (page and More row) live, without buying twice. Since job 43 (model A) a purchase belongs to its household for good: Buy shows only when the household is known to have no Lifetime (never while loading or offline), a restore elsewhere unlocks nothing, testers get free grants, and the join screen says what Lifetime means for the join. The purchase screen is behind the build define `REVENUECAT_PURCHASES` (off: "Hummlist Lifetime ist bald verfügbar."). The web never sells. Nothing in the app is gated by the unlock yet.

## Sub-features

- `iap-offer` shows "Weiter zum Kauf" and "Kauf wiederherstellen" (`lifetime-buy`, `lifetime-restore`) and the note "Den Preis zeigen dir der App Store oder Google Play, bevor du kaufst." (`lifetime-price-note`), no price, only for a household known to have no Lifetime. Showing it asks no store.
- `iap-no-sdk-before-tap` (H-67): no RevenueCat SDK call before a tap on Buy or Restore. Proven by `app/test/purchases/no_sdk_before_tap_test.dart` (the real repository over the SDK's mocked platform channel: app start, More, page open, rebuild, leave and return make no call; Buy makes `setupPurchases`, `getProductInfo`, `purchaseProduct`, Restore `setupPurchases`, `restorePurchases`). The fake store has no SDK, so fg cannot show this on a device; on the web, `e2e/tests/purchases.spec.ts` checks no request goes to a RevenueCat host.
- `iap-buy` buys, shows "Wird freigeschaltet …" (`lifetime-unlocking`), then "Freigeschaltet" (`lifetime-unlocked`); one row in `purchases` (buyer from the app's claim), one in `entitlements`. After a minute without the unlock: `lifetime-unlock-delayed`, Buy stays disabled.
- `iap-partner` shows the unlock on the other member's client live, without a Buy button, and the More row's detail "Freigeschaltet" (`more-lifetime`).
- `iap-checking` shows "Wir prüfen, ob dein Haushalt Hummlist Lifetime schon hat …" (`lifetime-checking`) and no `lifetime-buy` or `lifetime-restore` while the household's rows are unknown; More's row then has no "Hummlist unterstützen".
- `iap-pending` shows "Wartet auf Bestätigung" (`lifetime-pending`) for Ask to Buy or a Play pending payment.
- `iap-states` covers, after a tap on Buy: canceled (`lifetime-canceled`), store error (`lifetime-error`), not available (`lifetime-unavailable`), store offline (`lifetime-offline`). Buy stays and tries again; there is no separate retry button.
- `iap-elsewhere` a purchase that belongs to another household: `lifetime-used-elsewhere` ("Dieser Kauf gehört zu einem anderen, früheren Haushalt …"), from RevenueCat's refusal or the server's.
- `iap-twice` a household with more than one purchase shows `lifetime-bought-twice` to every member; `lifetime-refund-help` (always on the page) opens the refund help sheet (`refund-help`, links `refund-apple`, `refund-google`, `refund-faq` to hummlist.com/support; texts per H-76: Apple refunds App Store purchases, Google Play in 48 hours, then our support).
- `iap-refund` locks the household again after RevenueCat's `CANCELLATION`.
- `iap-join` on the join screen: `join-target-unlocked` ("Du musst nichts kaufen."), `join-refund-help` (own purchase in the last 30 days and the target unlocked), and for the last member of an unlocked household `join-lifetime-ends` + `join-lifetime-refund-help` + "Trotzdem beitreten" (archive flag off) or `join-archive-offer` with `join-archive` / `join-delete` → `join-delete-dialog`, `join-delete-confirm` (flag on).
- `iap-archive` (flag `HOUSEHOLD_ARCHIVE` on, and the server switch: `fg db query --write "update app_switches set enabled = true where key = 'household_archive'"`): Mehr → Archivierte Haushalte (`more-archived`) opens a sheet (`archived-households`, `archived-<id>`, `archived-deletes-<id>` with "Wird am <Datum> gelöscht", 24 months after archiving, `archived-restore`, `archived-restore-dialog`, `archived-restore-confirm`, `archived-empty`). With the server switch off, archiving shows "Archivieren ist gerade nicht möglich. Dein Haushalt bleibt, wie er ist."; re-enabling still works.
- `iap-tester` a tester's grant unlocks their household (`entitlements.source = 'tester'`); `scripts/iap/testers.ts` with `SUPABASE_DB_URL` of the local stack.
- `iap-web` shows `lifetime-web` ("Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. …") and no buy or restore button on the web build.
- `iap-off` with `REVENUECAT_PURCHASES` off (the default) on iOS/Android: `lifetime-unavailable` ("bald verfügbar"), no Buy, no Restore.

## How to get to it (user POV)

- Mehr → Hummlist Lifetime (`more-lifetime`, under Haushalt) → `/more/lifetime`. Only signed in and in a household (`authRedirect`).
- On a phone RevenueCat's SDK runs the store sheet. Locally there is no store and no RevenueCat: the fg builds carry the app's fake store (`FAKE_STORE`), which posts its purchases to the local stack's `POST /purchases/test/event` (RevenueCat's stand-in, local only) and then claims them like the real app.

## Driving it with fg

Preconditions:

- Run `scripts/iap-local-env.sh` before `fg up`: fg's stack start doesn't run it (only `scripts/lib.sh` `supabase_up` does), and without it the webhook and `test/event` answer 503 and a buy ends in `lifetime-error`. It writes the local stand-in secrets into `supabase/functions/.env`; a running stack loads them only after `fg down` and `fg up`.
- The fake store's scenario comes from `FG_FAKE_STORE` at build time: `ok` (default), `pending`, `cancel`, `error`, `unavailable`, `offline`. Changing it rebuilds: `FG_FAKE_STORE=pending fg up --clients peter,lea`. On the Hetzner runner use `FG_SURFACE=linux` (SKILL.md, "Hosts without the Linux toolchain").
- The fake store keeps its purchases and the household each was bought for in `fake_store.json` in the app support directory of each client.

- **Offer.** On peter: `fg tap --key tab-more`, `fg marionette -- scroll-to --key more-lifetime`, `fg tap --key more-lifetime`, `fg wait --key lifetime-screen`. `fg find --key lifetime-buy` and `fg find --key lifetime-restore` count 1 (`.count`); `lifetime-price-note` is shown, no price: `fg screenshot --name iap-offer`.
- **Buy.** `fg tap --key lifetime-buy`, then `fg wait --key lifetime-unlocked`. `fg db query --as peter "select household_id, kind, source, store from entitlements"` shows one row (members can't `select *`: `granted_by` and `tester` are service-only); `fg db query "select environment, revoked_at, user_id is not null as has_buyer from purchases order by verified_at desc limit 1"` shows `Sandbox`, null and true.
- **Partner never sees Buy.** On lea, open the page before and after peter's buy: before, `lifetime-buy` counts 1; after, live and without a tap, `lifetime-unlocked` shows and `fg find --client lea --key lifetime-buy` counts 0.
- **Restore.** Built with `ok`: on a client that bought, `fg db query --write "delete from purchases"` (the unlock goes with it), `fg restart`, open the page (Buy is back), `fg tap --key lifetime-restore`, `fg wait --key lifetime-unlocked`. The fake store re-sends its purchase for this household.
- **Pending, states.** Built with `pending`, `cancel`, `error`, `unavailable` or `offline`: tap `lifetime-buy` (also for the last two: opening the page asks no store) and wait for `lifetime-pending`, `lifetime-canceled`, `lifetime-error`, `lifetime-unavailable` or `lifetime-offline`.
- **Refund.** `curl -s -X POST "$(fg env | jq -r .apiUrl)/functions/v1/purchases/test/event" -H 'content-type: application/json' -d '{"type":"CANCELLATION","appUserId":"<household id>","transactionId":"<id>"}'` (ids from `fg db query "select bound_household, transaction_id from purchases"`) answers `{"status":"revoked"}`; both clients lose `lifetime-unlocked` live.
- **Elsewhere.** Post the same `transactionId` for another seeded household: `{"status":"used_elsewhere"}`. `e2e/tests/purchases.spec.ts` and `household-bound.spec.ts` drive the real webhook (local secret) in CI, the latter also after the household is deleted.
- **Twice.** After peter's buy, post a second transaction for the same household through `test/event`: every member's page shows `lifetime-bought-twice`.
- **Join.** `fg seed` two households, unlock one, open the other's member on `/join/<code>` of the unlocked one: `join-target-unlocked`. `e2e/tests/household-bound.spec.ts` drives every join case on the web.
- **Tester.** `SUPABASE_DB_URL=<the stack's db url> deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts add --email peter@fg.test --apply`: peter's household shows `lifetime-unlocked` live; the row is `source = 'tester'`.
- **Web.** `fg sync` clients are web: `lifetime-web`, no buy or restore button, the refund help link.
- **Proof.** `fg screenshot --name iap-<sub-feature>` per state, the `fg db query` rows, and `fg record start/stop` across buy and partner.

## Gotchas

- Members can't `select *` from `entitlements` (job 43, H-55): name the columns; `granted_by` and `tester` are service-only, so `fg db query --as` must leave them out.
- `test/event` exists only on the local stack; a hosted project answers 404 there (`scripts/smoke-remote.sh` checks). The real webhook needs RevenueCat's `Authorization` value (`REVENUECAT_WEBHOOK_AUTH`; locally `scripts/iap-local-env.sh` sets a stand-in).
- Real store purchases need RevenueCat and the stores set up (NEEDS_LEAD "Job 43 – RevenueCat setup") and a build with `REVENUECAT_PURCHASES=true` and the SDK keys; report them as not drivable here.
- A fake-store purchase is environment Sandbox and counts as internal in analytics.
