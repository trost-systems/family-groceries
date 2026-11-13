# Job 190: prices on the list row, list total and per-store subtotals (2026-11-13)

Production build of Peter's pick `inline-row-price` (t832u, 13 Nov 2026 08:13 Europe/Berlin), with
LQ2/PW1 as Peter locked them (t833u, 08:21) and his TestFlight review path (t834u). Merged as
`a1f53b75` (PR [#393](https://github.com/trost-systems/snacklist/pull/393)) on 13 Nov 2026 at
11:56 Europe/Berlin. It reaches TestFlight and Play internal as build **1271** (version
0.1.0, release run [#261](https://github.com/trost-systems/snacklist/actions/runs/43417917064),
"Uploaded a1f53b7" green). `supabase-deploy` applied the migration to production (green).

## What a household member gets (flag on)

- A chip at the end of every row: "+ Preis", or the line total once a price is saved today.
  Tapping it opens a compact editor under the row: price on the system decimal keyboard (signed,
  letters blocked as you type), "Gesamt" or "pro Stück / kg / l" with the other value derived,
  the scale weight or volume for kg/l items, a quantity stepper for pieces, "Summe danach" and
  "0,30 € teurer als zuletzt" once an earlier price exists. Errors only for empty and too large
  (and a missing, zero or too large weight).
- Saving never ticks the item; ticking never needs a price.
- The total bar under the list: "Einkaufssumme", the amount, "N mit Preis · M offen", across all
  stores of the shown list. A "Summe <Laden>" line ends each store section.
- The household currency on the household page ("Währung"), default EUR, any member, live.
  Amounts follow the ISO code; nothing hardcodes €.
- Every member sees prices, subtotals and the total live.
- Free: no entitlement, paywall or Premium check anywhere on the path.

## Where

- Inline row chip: `app/lib/list/list_view/price_views.dart:30` (`PriceChip`), placed per row at
  `app/lib/list/list_view/shopping_list_view.dart:684`; the editor `price_views.dart:108`
  (`PricePanel`).
- Pinned list total: `price_views.dart:705` (`TotalBar`), pinned above the add bar at
  `app/lib/list/list_screen.dart:609`.
- Per-store subtotal: `price_views.dart:790` (`StoreSubtotal`), added at the end of each store
  section at `shopping_list_view.dart:717`.
- Rules (limits, units, LQ2 arithmetic, totals, current-day rule, money formatting):
  `app/lib/list/pricing.dart`. The write: `SetPrice` in `app/lib/list/model.dart`.
- Server: `supabase/migrations/20261113094500_prices_and_currency.sql` (five nullable item
  columns, all or none; `households.currency`; `export_my_data`).
- Flag: PostHog `prices-and-trip-total`, `releases/flags.json` rollout `off`.

## LQ and PW as shipped (locked by Peter, t833u; no longer provisional)

- **LQ2.** The unit price is stored (`items.price_unit_micros`). A typed total is divided by the
  quantity at save; a later quantity change keeps the unit price and scales the line (2 packs at
  1,38 €, then 3: 2,07 €).
- **PW1.** The planned weight is the quantity ("846 g Bananen"). The editor prefills it; the
  shopper types the per-kg price or the label price with the scale weight; saving writes the
  weighed amount back to the quantity ("1,02 kg"). Volumes the same in litres.
- The unit follows the item: g/kg quantities per kg, ml/l per litre, anything else per Stück.

## Lead calls (docs/DECISIONS.md, "Job 190")

- A price counts for the running total on the device's local day it was saved; older prices are
  "last time's price" for the comparison. Nothing is deleted.
- The total sums open and ticked items of the shown list with today's price in the household
  currency; a price in an earlier currency is shown with its code and not summed.
- Analytics: `price_entered {confirmed: false}` per saved price, `trip_total_viewed {final:
  false}` once per list and session (both allow-listed since job 195). `shop_started` unsent.
- Accepted limits: a subtotal goes with its section (all ticked or folded) while the total keeps
  counting; merges keep the kept item's price; the total sees the 50 newest ticked rows.

## Job 199's trips

199 (#394) landed first. This migration sorts after `20261113070349_grocery_log.sql`, and its
`export_my_data` is 199's body (with `trips_logged`) plus the price and currency fields.
`public.trips` and `save_trip` are untouched: a logged trip still carries name, quantity and
canonical key only. The per-store-per-day grain matches the current-day rule, so a later change
can add an optional price and currency to the snapshot and sum a day's store trips into the list
total.

## Peter's review (t834u): TestFlight, flag on for his install only

No Vercel preview (Peter skipped it in t834u). The TestFlight build is named above. The flag is
off for everyone; NEEDS_PETER "Job 190" has the steps: analytics yes, long press the version
under More, "Installations-ID kopieren", and the lead adds a PostHog release condition
`distinct_id` equals that id. The id is the install's (no `identify`, no person profiles), so a
reinstall needs a new id. The condition is documented by PostHog but has not been tried on this
project; NEEDS_PETER names the override fallback.

## Not built

The approach-3 end-of-trip summary ("Summe …, N Artikel ohne Preis, Nachtragen", a later screen
for receipt-at-home entry), receipt scanning, spend-history graphs, planned-vs-bought,
shelf-label scanning, user photos, prices on the API or MCP, multi-household shared views, a
region-based currency default. No store, console, flag rollout or sales change.

## Verification

- Flutter (3.50.0): full suite 2761 passed, 0 failed. New `pricing_test.dart`,
  `prices_cubit_test.dart`, `prices_screen_test.dart` (flag off; price does not tick; tick needs
  no price; totals across stores and per store; limits −9999/0/9999 and beyond, 50 kg/50 l;
  deposit and zero; letters blocked; currency default, change and formatting; LQ2; PW1; the
  358×740 editor with a 300 px keyboard keeps the total bar visible and tappable; the total bar
  clears the tab band; an orphaned editor closes; undo restores a price), goldens
  `prices_golden_test.dart`, and `more_toggle_test.dart` for the install id.
- pgTAP: `prices.test.sql`, `rls.test.sql` (cross-household currency and price), the export in
  `account_deletion.test.sql`; the db gate passed.
- e2e `prices.spec.ts`: flag off; two members (prices in two stores, nothing ticked, the partner
  sees prices, both subtotals and the total live, a −0,25 € deposit); currency change live; letters
  dropped; scale weight and LQ2. With list and live-sync specs: 17/17 locally after the rebase on
  199; CI `ci-ok` green on the merged head, e2e included.
- Independent Opus review: round 0 FAIL (an orphaned editor kept the add bar hidden; a weighed
  item priced per piece lost its quantity), both fixed with tests that fail without the fix;
  round 1 PASS; its should-fix (an undone delete's price must not land on a partner's twin)
  fixed. Reviews in the job directory (`review.0.md`, `review.1.md`).
- Screenshots: `docs/screenshots/190/` (list with chips and subtotals, editor, partner's live
  view, CHF).

## Open

- Peter: the PostHog condition for his install (NEEDS_PETER "Job 190"); LQ2/PW1 are locked.
- Before the flag goes on for everyone: the privacy policy's section 5 should name prices and
  the household currency (PRIVACY_DATA_MAP, differences to the policy), and
  FEATURES-FOR-WRITERS' "never claim price tracking" line changes.
