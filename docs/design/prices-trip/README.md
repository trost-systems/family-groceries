# Prices and trip total: five prototypes (job 189)

Throwaway prototypes for choosing how price entry and the trip total should work. Synthetic data, no backend, no app code. Price entry is Free for everyone, so none of them shows a paywall. Peter makes the choice in job 190. This is not approval to implement.

| # | Slug | Idea |
| --- | --- | --- |
| 1 | `inline-row-price` | Tap "+ Preis" on the row, type, Enter. The total is pinned under the list. |
| 2 | `item-sheet-price` | A sheet asks for unit, quantity and price. The total changes on "Übernehmen". |
| 3 | `trip-review-list` | After shopping, go through the items one by one, then see a summary with the total. |
| 4 | `focused-price-keypad` | A large keypad opens under the list. Item, quantity and total stay in view. |
| 5 | `last-price-confirm` | Rows are prefilled with last time's price (synthetic). Accept or edit each one. |

The recommendation and open questions are in [`RECOMMENDATION.md`](RECOMMENDATION.md). The screenshots are in [`../../screenshots/189/`](../../screenshots/189/), starting with `comparison.png`.

## Look at it

Serve the built preview without installing anything:

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory docs/design/prices-trip/dist
# http://127.0.0.1:8790/#/                 all five side by side
# http://127.0.0.1:8790/#/inline-row-price one approach with notes
# http://127.0.0.1:8790/#/empfehlung       the recommendation
```

Or run the sandbox. The dev server has the Agentation toolbar for leaving notes on elements.

```sh
cd docs/design/prices-trip/sandbox
npm ci
npm run dev       # copies tokens, fonts and hex masks from site/public, serves on 127.0.0.1:4190
npm test          # vitest: price parsing, line and unit prices, trip total
npm run build     # writes ../dist
flock /tmp/fg-e2e.lock npx playwright test   # the shared scenario in all five, writes the screenshots
```

Each phone has "Zurücksetzen" to restart the scenario. The scenario steps are shown above the phones.
