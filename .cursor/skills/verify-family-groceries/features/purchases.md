# Hummlist Lifetime (in-app purchase)

Mehr → Hummlist Lifetime sells a one-time unlock for the whole household on iOS and Android, at the price the store reports, with "Käufe wiederherstellen". The server verifies every store transaction before the household is unlocked; both members then see "Freigeschaltet" (on the page and in the More row) without buying twice. Pending approvals, cancels, store errors, a store without the product (agreement not active) and offline each show their own state with a retry. The web never sells: it says the purchase is in the iOS and Android app and shows the unlock. Nothing in the app is gated by the unlock yet.

## Sub-features

- `iap-offer` shows the store's price on the buy button ("Für 9,99 € kaufen") and "Käufe wiederherstellen" (`lifetime-buy`, `lifetime-price`, `lifetime-restore`).
- `iap-buy` buys, shows "Kauf wird geprüft …" (`lifetime-verifying`), then "Freigeschaltet" (`lifetime-unlocked`); one row in `purchases`, one in `entitlements`.
- `iap-partner` shows the unlock on the other member's client live, and the More row's detail "Freigeschaltet" (`more-lifetime`).
- `iap-restore` restores on a fresh install: unlocked again, no second purchase row.
- `iap-pending` shows "Wartet auf Bestätigung" (`lifetime-pending`) for Ask to Buy or a Play pending payment, then unlocks when the store delivers the approved purchase.
- `iap-states` covers canceled (`lifetime-canceled`), store error (`lifetime-error`), not available yet (`lifetime-unavailable`), store offline (`lifetime-offline`), each with `lifetime-retry` where it applies.
- `iap-killed` covers an app killed between purchase and verification: the next start verifies and unlocks.
- `iap-refund` locks the household again after a refund notification.
- `iap-elsewhere` refuses a purchase already unlocking another household (`lifetime-used-elsewhere`).
- `iap-web` shows `lifetime-web` and no buy or restore button on the web build.

## How to get to it (user POV)

- Mehr → Hummlist Lifetime (`more-lifetime`, under Haushalt) → `/more/lifetime`. Only signed in and in a household (`authRedirect`).
- On a phone the store sheet (App Store, Google Play) does the buying. Locally there is no store: the fg builds carry the app's fake store (`FAKE_STORE`), whose purchases are signed by the local stack's `/purchases/test/sign` (scripts/iap-test-ca.sh), so the real `/purchases/verify` runs.

## Driving it with fg

Preconditions:

- Baseline from `features/README.md`; peter and lea signed in. `supabase_up` (fg's stack start) runs `scripts/iap-test-ca.sh`; a stack started before job 25 needs `fg up --fresh`.
- The fake store's scenario comes from `FG_FAKE_STORE` at build time: `ok` (default), `pending` (approved after about 8 s), `cancel`, `error`, `unavailable`, `offline`. Changing it rebuilds: `FG_FAKE_STORE=pending fg up --clients peter,lea`.
- The fake store keeps its sold and unfinished purchases in `fake_store.json` in the app support directory of each client.

- **Offer.** On peter: `fg tap --key tab-more`, `fg marionette -- scroll-to --key more-lifetime`, `fg tap --key more-lifetime`, `fg wait --key lifetime-screen`. `fg find --key lifetime-price` reads "Für 9,99 € kaufen"; `lifetime-restore` is there. `fg screenshot --name iap-offer`.
- **Buy.** `fg tap --key lifetime-buy`, then `fg wait --key lifetime-unlocked`. `fg db query --as peter "select household_id, store, product_id from entitlements"` shows one row; `fg db query "select environment, revoked_at from purchases order by verified_at desc limit 1"` shows `Sandbox` and null.
- **Partner.** On lea: open More; `fg wait --as lea --contains "Freigeschaltet"` on the More row within 5 s without a tap; open the page: `lifetime-unlocked`, no `lifetime-buy`.
- **Restore.** Forget the server side as a new install would see it: `fg db query --write "delete from purchases"` (the unlock goes with it), `fg restart --client peter`, open the page (Buy is back), `fg tap --key lifetime-restore`, `fg wait --key lifetime-unlocked`. The fake store still owns the purchase.
- **Pending.** Built with `FG_FAKE_STORE=pending`: buy, `fg wait --key lifetime-pending`, then `fg wait --key lifetime-unlocked` (about 8 s).
- **States.** Built with `cancel`, `error`, `unavailable` or `offline`: buy (or just open the page for the last two) and wait for `lifetime-canceled`, `lifetime-error`, `lifetime-unavailable` or `lifetime-offline`; `lifetime-retry` reloads.
- **Killed.** Built with `ok`: `fg tap --key lifetime-buy`, then at once `fg restart --client peter` (the fake store has recorded the purchase as unfinished). After the restart, without another tap, the page shows `lifetime-unlocked`; `fg db query "select count(*) from purchases"` is 1.
- **Refund.** Read the transaction: `fg db query "select transaction_id from purchases order by verified_at desc limit 1"`. Sign Apple's refund for it and send it: `curl -s -X POST "$(fg env | jq -r .apiUrl)/functions/v1/purchases/test/sign" -d '{"transactionId":"<id>","notificationType":"REFUND"}'` gives `signedPayload`; `curl -s -X POST "$(fg env | jq -r .apiUrl)/functions/v1/purchases/apple/notifications" -d '{"signedPayload":"<…>"}'` answers `{"status":"revoked"}`. Both clients lose `lifetime-unlocked` live.
- **Elsewhere.** The fake store is per client, so this runs at the API level: sign one transaction with `/purchases/test/sign`, verify it as peter (`fg login peter --api` prints an access token; `POST /functions/v1/purchases/verify` with `{"store":"apple","source":"purchase","jws":…}`), then as a user of a seeded other household: `{"status":"used_elsewhere"}`. `e2e/tests/purchases.spec.ts` does the same in CI.
- **Web.** `fg sync` clients are web: the page shows `Hummlist Lifetime gibt es in der iOS- und Android-App.` and no buttons. `e2e/tests/purchases.spec.ts` drives the web side end to end in CI.
- **Proof.** `fg screenshot --name iap-<sub-feature>` per state, the `fg db query` rows, and `fg record start/stop` across buy and partner.

## Gotchas

- A Linux desktop build needs clang, CMake and the GTK headers; on a host without them (the Hetzner runner in job 25) the page's native states were rendered by `app/test/purchases/screenshots_test.dart` instead, and the web side by the e2e spec.
- The local function trusts the test CA only inside a local stack; a hosted project answers 404 on `/purchases/test/sign` and refuses the fake store's purchases (no real store transaction).
- Real store purchases (App Store sandbox, Play license testers) need Peter's agreements and the Lead's store setup (NEEDS_PETER / NEEDS_LEAD "Job 25"); report them as not drivable here.
- `PURCHASES_ENVIRONMENTS` is `Sandbox` on the local stack; a fake-store purchase is environment Sandbox and counts as internal in analytics.
