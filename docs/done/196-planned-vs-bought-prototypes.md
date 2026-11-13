# Job 196: planned vs bought, five prototypes (2026-11-12)

Throwaway prototypes, no production UI. Times Europe/Berlin.

## What was built

- Sandbox: [`docs/design/planned-vs-bought/`](../design/planned-vs-bought/) (`index.html`, one
  switcher over all five approaches, four scenarios, a prices toggle). How to run it:
  [`README.md`](../design/planned-vs-bought/README.md).
- Slugs: `snapshot-vs-ticked-list`, `trip-review-unplanned`, `weekly-plan-kept`,
  `aisle-plan-badge`, `two-column-receipt-optional`.
- Recommendation: [`RECOMMENDATION.md`](../design/planned-vs-bought/RECOMMENDATION.md). Pick
  `trip-review-unplanned`; the biggest open question is how a trip starts.
- Screenshots: [`docs/screenshots/196/`](../screenshots/196/) (32: every approach in every
  scenario, plus driven interactions).

## How to verify

Serve the repository root (`python3 -m http.server 8796 --bind 127.0.0.1`), open
`/docs/design/planned-vs-bought/index.html`, and run `shoot.mjs` against it (README). It exits
non-zero if a count or empty state is wrong.

## Not done, by design

- No app, database or function change; no receipt scanning, no spend charts, no grocery log.
- No shareable preview URL: no Vercel project or setting was created or changed.

## Fix round 1 (review.0, 2026-11-13)

Follow-up PR on main. A logged item now ticks a matching open list item. The first tick starts
the trip, so it no longer turns a planned item into an extra. The review's "Fertig" leaves the
next list. Plus smaller fixes (see DECISIONS). `shoot.mjs` checks the reviewer's repros; it
fails on the merged first version and passes now. Screenshots refreshed in
`docs/screenshots/196/` (36).
