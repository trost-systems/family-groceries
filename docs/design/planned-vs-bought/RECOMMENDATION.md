# Planned vs bought: recommendation (job 196, 12 Nov 2026)

Peter picks. This page recommends one of the five prototypes in [`README.md`](README.md); nothing
here is built in the app, and job 197 waits for Peter's choice.

## Recommendation: `trip-review-unplanned`

Build the end-of-trip review. The list stays exactly as it is while you shop; when the trip ends,
one screen shows what was bought that was not on the list at the start, then what went as
planned, then what stayed on the list.

- **It keeps the shopping loop untouched.** The list in the app is sorted by the store's walking
  order. `snapshot-vs-ticked-list` and `two-column-receipt-optional` re-sort it into planned and
  extra while you are in the aisle, which costs every shopper on every trip, including those
  who never asked for the comparison.
- **It has one moment, and the moment fits.** The comparison matters after the shop, not
  between the shelves. The app already notices a trip's end (`TripCompleted` when your tick
  empties the list), so the review has a natural place to appear.
- **It can be corrected.** "War geplant" lets the shopper fix the common false positive: an item
  agreed by phone, or written onto the list by someone else after the start. The other four
  approaches show a classification the user cannot fix.
- **It works without prices and without a receipt.** Counts and names carry the screen; a
  confirmed price adds one "Zusammen" line, and a missing price says "Preis fehlt bei 1 von 2"
  instead of a wrong total. A receipt match could later fill the "Nicht auf der Liste" card
  without changing its shape.
- **It handles the edge cases plainly.** Empty list at the start: "Ohne Liste gekauft". Nothing
  bought: "Nichts gekauft. Die Liste bleibt, wie sie ist." Items not bought stay on the list,
  with "Entfernen" for the ones that are no longer needed.

A second Claude reviewer, working from the screenshots and the code without this page, ranked
the five the same way at the top (review first, badge second). It suggested adding the badge
during the shop. This page does not: the review already names what was extra, and a badge on
every trip puts the comparison in the aisle for everyone. If Peter wants an in-shop hint, the
badge is the one to add.

## The other four

| Slug | Verdict | Why |
| --- | --- | --- |
| `weekly-plan-kept` | Later, as a second view on the same data | Needs weeks of trips before it says anything (the same slow payoff as `spend-history`). Three totals side by side read as a score, which is close to the moral framing the brief rules out, even in neutral colours. |
| `aisle-plan-badge` | Fallback if a review screen is too much | Cheapest to build and keeps walking order, but a "neu" badge mid-shop is noise for most trips and gives no summary at the end. |
| `snapshot-vs-ticked-list` | No | Splits the list by plan instead of by aisle while you shop. |
| `two-column-receipt-optional` | No | Three columns do not fit the 358 px compact design; the planned column repeats every bought name; the receipt column is empty until receipt scanning exists. |

## Still a question

1. **What counts as bought?** The feature map row defines it as confirmed receipt purchases. The
   brief for these prototypes, and this recommendation, use ticked or logged items instead, with a
   receipt as an optional later input. The row now notes this; Peter's pick settles it.
2. **How does a trip start?** Every approach needs the snapshot taken at the start. The
   prototypes have an explicit "Einkauf starten" button, and the first tick or logged item also
   starts the trip; the app has no trip start today. An implicit start (the first tick after the
   list was last emptied, or after a few hours without ticks) adds no step, but may snapshot the
   wrong moment. Its typical false positive: if the snapshot is taken after the first tick and
   leaves ticked items out, the item that started the trip shows up as extra. The snapshot
   must hold every item open just before the starting tick. This is the biggest design question
   and decides most of job 197's build.
3. **Is an item someone else adds during the shop planned?** The prototypes count it as extra,
   name who added it ("von Ben") and let the shopper mark it "War geplant". The other choice is
   to count everything written onto the list as planned and only items logged in the store as
   extra.
4. **Where does "Schon gekauft" live?** Logging an item that is already in the basket is new
   (today an item is always written first, then ticked). It overlaps with the post-shop entry in
   job 198's grocery log; one entry point should serve both. A logged item must match an open
   list item when it is the same thing, or every log counts as extra. The prototype matches
   by name (case and spaces ignored) and ticks the list item. The app would match on
   `items.canonical_key` (spelling variants and synonyms). Still open: what a near match
   (Vollmilch for Milch) does, and whether the shopper confirms it.
5. **Free or Premium?** P3a puts planned vs bought in the later Premium pitch. The counts need no
   prices; the "Zusammen" line needs `prices-and-trip-total` (Premium). One option: the review
   on Free, the price line with Premium.
6. **Two shoppers, two stores, one list.** One trip per shopper, or one per household? The
   prototype has one shopper.
7. **Does the review stay?** Once closed, is the trip kept (and so a grocery-log entry, job 198),
   or gone?

No receipt scanning was built; the receipt column in `two-column-receipt-optional` is an empty
placeholder, and receipt matching still waits for Legal's N-127 conditions.
