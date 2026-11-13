# Job 189: five price-entry and trip-total prototypes (2026-11-12, Europe/Berlin)

These are sandbox prototypes only, for Peter's choice in job 190. **No production UI shipped, and nothing under `app/`, `supabase/` or `alexa/` changed.** This is not approval to implement. Price entry and the trip total are Free (t788u). No approach has a paywall, an entitlement check or a Premium step.

## Where

- Sandbox source: `docs/design/prices-trip/sandbox/` (Vite + React, Agentation in dev). There is one folder per approach under `src/prototypes/`.
- Comparison: the built preview in `docs/design/prices-trip/dist/`. `#/` shows all five side by side, `#/<slug>` shows one approach with notes and the scenario steps, and `#/empfehlung` shows the recommendation.
- Recommendation: `docs/design/prices-trip/RECOMMENDATION.md`.
- Screenshots: `docs/screenshots/189/`. Start with `comparison.png` and `comparison-dark.png`.
- Decision record: `docs/DECISIONS.md`, "Job 189".

## The five slugs

1. `inline-row-price`: the price on the list row, with the total pinned underneath.
2. `item-sheet-price`: a sheet for unit, quantity and price. The total changes on confirm.
3. `trip-review-list`: a pass at the till, one item at a time, then a summary.
4. `focused-price-keypad`: a large keypad. The item, quantity and total stay in view.
5. `last-price-confirm`: a synthetic last price is prefilled. Accept or edit it, or accept all.

## Recommendation

Use `inline-row-price` as the base. It takes the fewest steps, the total is always visible, and it uses the system keyboard. Add last-price prefill on its chip later. The open questions for Peter are in RECOMMENDATION.md:

- Does a price tick the item?
- What is a trip?
- Does a line total stay when the quantity changes?
- Should the list keep a planned weight?
- Are 0 € and deposits allowed?
- Does the household see prices live?
- Is it euros only?

## How to verify

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory docs/design/prices-trip/dist   # open http://127.0.0.1:8790/#/
cd docs/design/prices-trip/sandbox && npm ci && npm test && flock /tmp/fg-e2e.lock npx playwright test
```

## Results

- vitest: 30 of 30 pass.
- Playwright: 6 of 6 pass. The same scenario runs in all five and each ends on 13,62 € with 4 priced and 3 open. It also checks the comparison and recommendation pages.
- The static `dist/` serves with 0 failed requests.
- `scripts/verify.sh --only gitleaks,lint,changelog` passes.

## Review

A fresh-eye review read the screenshots and the recommendation and found eight problems. These are fixed:

- **Approach 5's confirm mark.** It reused the mint "bought" check. It now uses a cobalt € hex and the row stays white.
- **Weight and multipack in 5.** Approach 5 now runs both through its editor in the spec, and the editor shows the change from last time ("0,30 € teurer als zuletzt").
- **The total claim.** The recommendation said 1's total moves live. It moves on save, as in 2 and 4, so the text now says the difference is only where the total sits.
- **Honest limits.** The recommendation now says the phone keyboard isn't shown and that 5 is "1 with suggestions".
- **Missing start shots.** Approaches 2, 3 and 4 now have `0-start` screenshots.
- **The "+ Preis" chip.** It now has the navy contour.
- **The disabled stepper.** Its contrast is raised.

The approach 4 sheet cutting a list row in half and the floating "Fertig" on approach 3's summary were left as they are, because they don't affect the comparison.

## Preview URL

None. The Vercel connector is not available on the Hetzner runner, and the brief forbids changing Vercel projects or settings. Peter can serve `dist/` locally with the command above. That is the only manual step, so nothing goes in NEEDS_PETER.

Changelog: `none`.
