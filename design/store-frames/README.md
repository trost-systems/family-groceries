# Store screenshot frames

Five frame proposals for the store screenshots, FR1 to FR5 (job 77, redone for Snacklist in job
214), rendered by code from real captures of the Snacklist web app. Each proposal produces six
phone shots for Google Play (1080 × 1920, 24-bit PNG without alpha) and a feature graphic
(1024 × 500). FR2 Großschrift is the frame Peter picked in the first round (job 84, then „P2“).

```sh
(cd e2e && npm ci)                                                        # once: Playwright's Chromium
.claude/skills/verify-snacklist/helpers/launch.sh --scenario store-frames --fresh
node design/store-frames/capture.mjs                  # the six captures into raw/de-DE/
node design/store-frames/build.mjs                    # all proposals to /tmp/store-frames/FR1 … FR5
node design/store-frames/build.mjs FR2,FR4 --out dir  # some proposals, elsewhere
node design/store-frames/build.mjs --site             # also the review page in site/public/internal/
.claude/skills/verify-snacklist/helpers/cleanup.sh
```

Needs ffmpeg. The review page is `/internal/store-frames` on the site's preview deployments
(`site/`, noindex). `site/build.mjs` leaves `public/internal/` out of production builds.

## Files

- `capture.mjs`: drives the release web build of the verify-snacklist instance with the scenario
  `store-frames` (`test/fixtures/scenarios/store-frames.yaml`: „Unser Haushalt“ with Anna and
  Jonas and the generic stores Wochenmarkt, Bäckerei, Supermarkt and Drogerie; no retailer names,
  Legal N-23). It takes six screens at 432 × 960 CSS pixels and DPR 2.5 (1080 × 2400) on a paused
  page clock, so the caret is off and highlights are caught at the same moment each run. The
  invite screen runs at `https://app.snacklist.app`, so its link reads as on the phones.
- `raw/de-DE/`: the captures and `meta.json`. Per screen, `meta.json` holds the rows a caption
  points at (`lift`), the top of the floating add bar and tab bar (`chrome`), and for the sync
  screen the band lifted out of Jonas's phone (`sender`), all in capture pixels.
- `shots.mjs`: what each capture shows, the alt texts, the feature-graphic crop and the tagline.
- `kit.mjs`: the page shell (self-hosted fonts and `site/public/tokens.css`), crops of a capture,
  hexagons, avatars. It finds clean cuts from the pixels: full-width runs of one background
  colour above `chrome`, never inside a row.
- `proposals/fr1-…fr5-….mjs`: one proposal each. Each one sets the shot order, the German
  captions, a one-line rationale, a `strip()` and a `feature()`. `strip()` draws one 6480 × 1920
  page, and `build.mjs` cuts it into the six shots. So a panorama (FR1) and single frames go
  through the same code.
- `review.mjs`: the review page and its stylesheet.

## Rules the captions keep

Always "Snacklist", never shortened. No retailer names, logos or colours (Legal N-23). No Premium,
prices, "beste", "Nr. 1", "Top", "Neu", "kostenlos" or calls to action. No claims about automatic
sorting, AI, Siri or Alexa. `build.mjs` measures the frame's own text on each shot (the line boxes
of captions, labels and bubbles). It prints the share and fails above 20 %, which is Play's
guidance.
