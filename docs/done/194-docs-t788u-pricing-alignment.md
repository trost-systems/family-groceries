# Job 194: pricing and tiers alignment in the planning docs (2026-11-12)

Documentation only. No app feature, no live store or RevenueCat price, no submission, no published
term.

- [`docs/PRODUCT_FEATURE_MAP.md`](../PRODUCT_FEATURE_MAP.md): yearly €24.99 / Lifetime €149.99
  (approved, not shipped), Free price entry and unlimited barcode scanning, CS1 tiers, a new section
  "Pricing and tiers, 11 Nov 2026 evening", the `grocery-log` considering row (8 considering), new
  open decisions (paid-launch Premium slice, Lifetime allowances, `shared-views`, last-price memory
  tier, grocery-log history boundary). Superseded wording kept and marked.
- [`docs/PAYWALL_RELEASE.md`](../PAYWALL_RELEASE.md): "Product prerequisites" and step 2.3.
- [`docs/PURCHASES.md`](../PURCHASES.md): the expected-prices table is labelled as today's store
  amounts, with the approved ones not shipped.
- [`docs/DECISIONS.md`](../DECISIONS.md): "Job 194".

## Where

- PR: https://github.com/trost-systems/family-groceries/pull/377

## Verification

- `scripts/verify.sh --only gitleaks,lint` passed. A script checked that every table row in the map has its table's column count.
- An Opus review against the brief found two must-fix items. Photos and last-price hints were wrongly marked as superseded shared views. Two rows still described Premium prices and Premium scans. Both are fixed, along with five of its six should-fix items.
- Screenshots: none, because nothing visible changed.

## Not done, by design

- No live store, RevenueCat or `expectedPrices` change. No submission. No published terms. No app feature.
- Job 182 and PR #363 are untouched.
- Open, as the brief asks: which Premium slice is required for the paid launch, the Lifetime allowance numbers, and `shared-views`. Also open: the last-price memory tier, which no decision re-tiered, and the grocery-log history boundary.
- The t788u and t789u research notes are not on hz. The brief was the source.

## Review 0 fixes (follow-up PR)

- **Sources.** "Sources and method" no longer claims the living Page was checked. The map was written from the lead's brief only, and a cross-check against the Page is still to do.
- **`validation-plan` row.** It now says F5 measures nothing today. `mcp_tool_call` capture is off under N-147 (#383), and `api_key_used` cannot fire while `public_api` is off. Both are server events in `_shared/telemetry.ts`, not app events in `events.dart`.
- **Also.**
  - The code-check sha is now `764265b0`.
  - The Free tiers are marked as the tier each feature gets when built.
  - Open decisions 7 and 10 are reframed to the 1 Dec paid launch.
  - The root `DONE_SUMMARY.md` entry now matches its neighbours' style.
