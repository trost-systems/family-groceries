# Planned vs bought: five throwaway prototypes (job 196)

Interactive HTML sketches for the `planned-vs-bought` idea in
[`docs/PRODUCT_FEATURE_MAP.md`](../../PRODUCT_FEATURE_MAP.md). They are not app code, not an
approved build and not a receipt scanner. All data is made up (the Brandt family: Anna shops,
Ben writes from home).

The recommendation and the open questions are in [`RECOMMENDATION.md`](RECOMMENDATION.md).

## Run it

From the repository root (the page loads the site's tokens and fonts by relative path):

```sh
python3 -m http.server 8796 --bind 127.0.0.1
# open http://127.0.0.1:8796/docs/design/planned-vs-bought/index.html
```

The left panel switches approach, scenario and prices. "Von vorn" goes back to before the
shop; "Nächster Schritt" replays the scenario one event at a time; "Ben schreibt etwas dazu"
adds an item from another phone mid-trip. In the phone you tick rows, start and end the trip,
write an item onto the list ("Dazuschreiben") or log one that is already in the basket
("Schon gekauft"). The first tick or logged item starts the trip if you did not press
"Einkauf starten". "Schon gekauft" with the name of an open list item (case and spaces
ignored) ticks that item instead of adding an extra one. "Fertig" after the review leaves the
next list: what was not bought, minus what you removed.

Deep links: `#a=<slug>&s=<scenario>&prices=1`, plus `played=0` (start before the shop) and
`done=1&review=1` (trip ended, review open).

| Slug | What it shows |
| --- | --- |
| `snapshot-vs-ticked-list` | The list during the shop, split into "Beim Start auf der Liste" and "Seit dem Start dazugekommen". |
| `trip-review-unplanned` | The list stays as it is today; "Einkauf beenden" opens a review: items not on the start list first, with "War geplant" to correct one, then "Wie geplant" and "Nicht gekauft". |
| `weekly-plan-kept` | Counts for the week (planned and bought, extra, not bought) and one row per trip. No charts. |
| `aisle-plan-badge` | The list as today, with a "neu" badge on rows added after the start. |
| `two-column-receipt-optional` | A planned column next to a bought column; a "Bon-Spalte" toggle shows an empty third column where a receipt match could go later. |

Scenarios: `basic` (Milch and Brot planned, Chips logged), `empty` (empty list at the start,
two items logged), `during` (Ben adds Eier and Butter after the start, Brot stays), `nothing`
(empty list, nothing bought). Prices appear only when "Bestätigte Preise zeigen" is on, only
as a figure already on the item, and a total only when every row in it has one.

## Prove it

`shoot.mjs` drives every approach through every scenario, checks the counts and empty states
in the page text, and writes the screenshots in [`docs/screenshots/196/`](../../screenshots/196/):

```sh
node docs/design/planned-vs-bought/shoot.mjs \
  http://127.0.0.1:8796/docs/design/planned-vs-bought/index.html /tmp/196-shots
```

It loads Playwright from `~/family-groceries/e2e/node_modules/` unless you pass another
`node_modules` directory as the third argument.
