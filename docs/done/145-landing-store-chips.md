# Job 145: interactive store chips on the landing page

PR #290. The „Läden / stores“ card on hummlist.com `/de` and `/en` now reacts: tapping a store
re-orders the categories below it. The Lead merges after review.

## What changed

- **Stores:** Drogerie, Getränkemarkt, Supermarkt (EN: Drugstore, Drinks store, Supermarket).
  Getränkemarkt replaces Bäckerei. Baumarkt was ruled out because the app has no hardware
  categories (DECISIONS, Job 145).
- **Routes**, each a store's first five stops, from the app's seeded categories and emoji:
  - Supermarkt: Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Vorrat & Konserven.
  - Getränkemarkt: Getränke, Süßes & Snacks, Kühlregal, Tiefkühl, Haushalt.
  - Drogerie: Drogerie, Vorrat & Konserven, Süßes & Snacks, Haushalt, Getränke (the dm layout the app shipped).
- `site/landing.mjs` renders the card as HTML. The buttons are `aria-pressed` toggle buttons, and
  the Supermarkt route renders server-side, so it shows without JavaScript.
- `site/public/stores.js` (a module) switches the route. Rows that stay slide to their new place
  (FLIP, 360 ms) and new rows fade in. With reduced motion the route changes with no animation.
- `site/public/landing.css`: the site's tactile hex buttons (white, lemon when pressed), step
  numbers drawn by a CSS counter, a light border on the dark card, and a Highlight face in forced colours.
- Copy: `feature.stores.pick` („Tippe auf einen Laden:“ / "Tap a store:") is the hint above the
  buttons. There are store and category names in DE and EN, and the category names are tested
  against the app's ARB strings. `feature.stores.image` (the still's alt text) is gone, and
  COPY_NEEDED.md is regenerated.
- Removed: the stores still (8 WebPs) and its scene `site/scenes/stores.html`.

## How to verify

```bash
cd site && npm ci && npm test && npm run build
cd checks && npm ci && flock /tmp/fg-e2e.lock node stores.mjs ../dist --shots /tmp/stores
```

## Results

- `npm test` (site): 169 of 169 pass. That includes the new tests for the server-rendered card
  and for the category names matching the app's ARB strings. The new tests fail when the default
  store or a category name is changed (checked by hand).
- `site/checks`, one hold of the e2e lock (`docs/screenshots/145/browser-checks.log`):
  - `stores.mjs`: 122 of 122 checks pass (250 of 250 after review 0, below). Covered: no JavaScript; click per store at 390 and
    1440 px, light and dark; keyboard Enter and Space; forced colours; reduced motion (no row
    animates); motion (5 rows animate and settle).
  - `crawl.mjs`: all pages pass. Checks: axe, 48 px targets, focus indicators, press depth, motion.
  - `contrast.mjs`: all text and non-text contrast passes.
- The first browser run found four problems, all fixed:
  - the focus ring and the button contour had no contrast on the dark card;
  - the pressed button didn't sink on press;
  - forced colours hid the pressed button's text;
  - the reduced-motion step counted CSS transitions.
- Lighthouse (first run, before the CSS-only fixes): accessibility 100 everywhere. Performance
  93 to 94 on mobile and 100 on desktop; TBT 0 ms, CLS 0.
- An independent review agent read the diff. Its findings (forced colours, the supermarket
  route that skipped Fleisch/Wurst/Fisch, a fade that snapped when interrupted) are fixed.

## Evidence

`docs/screenshots/145/`: the GIFs `stores-wide-de.gif` and `stores-compact-en.gif`, each store
light and dark, no JavaScript, forced colours, and the still it replaces.

## Missing or blocked

- The Vercel preview (https://hummlist-site-git-job-145-landing-store-chips-peter-trost.vercel.app)
  needs a Vercel login, so it was not driven from here. The same build was driven locally.
- The browser checks in `site/checks` run by hand, as before; CI runs the site tests and build.

## Review 0 (FIX), addressed

- **Must fix: row labels clipped at 320, 1024 and 1100 px.** Fixed in `site/public/landing.css`.
  The card now lays out by its own width:
  - The frame is a size container. The buttons sit beside the route only from a 36rem card;
    narrower cards stack them above it.
  - Each row steps `clamp(0px, (100cqi - 17rem) / 4, 18px)` of the list's width, so the staircase
    flattens before a row can leave the card.
  - On cards of 22rem or less (phones of 320 to 360 px) the rows are 40 px tall at 15 px.
  - The frame's 16:9 / 4:5 shape is now a minimum height. A clipping frame cannot grow by its
    aspect ratio, so at 1024 px the stacked buttons and route were also cut off at the top and
    bottom.
- **New check:** `site/checks/stores.mjs` now covers 16 widths from 320 to 1440 px, both
  languages and every store. Each visible row and button must stay inside the card's content box
  sideways and inside its height, and the page must not scroll sideways. It now runs 250 of 250
  checks, up from 122.
  - Its first runs failed, which the fix needed: „Fleisch/Wurst/Fisch“ is 265 px, wider than my
    estimate, and the 1024 px screenshot showed the vertical cut.
- **Found by the same sweep, on main too:** the waitlist form's two phone tiles scrolled the page
  7 px sideways at 320 px. They now stack when two do not fit (`site/public/waitlist.css`), and
  `waitlist.mjs` passes 108 of 108 checks.
- **Nice to have, done:**
  - The hint „Tippe auf einen Laden:“ shows only once `stores.js` runs; without JavaScript the
    buttons do nothing.
  - DECISIONS says the Getränkemarkt route is an example a user arranges, while Drogerie is the
    shipped preset.
- **Nice to have, left:**
  - The buttons still take three lines at 320 px.
  - The PR body's images still point at the branch, because push-pr writes the body into the
    commit and a later edit would desync it. GitHub keeps the PR's commits.
- **Results:** `crawl.mjs` and `contrast.mjs` pass on every page; site tests pass 169 of 169.
  New evidence: `de-320-light-supermarkt.png`, `de-1024-light-supermarkt.png`,
  `en-1024-light-drinks-store.png`, the GIFs and `browser-checks.log`.

