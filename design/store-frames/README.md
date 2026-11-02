# Store screenshot frames

Five frame proposals for the store screenshots (job 77), rendered from the real app captures by
code. Each proposal produces six phone shots for Google Play (1080 × 1920, 24-bit PNG without
alpha) and a feature graphic (1024 × 500).

```sh
(cd e2e && npm ci)                                   # once: Playwright's Chromium
node design/store-frames/build.mjs                   # all proposals to /tmp/store-frames/P1 … P5
node design/store-frames/build.mjs P2,P4 --out dir   # some proposals, elsewhere
node design/store-frames/build.mjs --site            # also the review page in site/public/internal/
```

Needs ffmpeg. The review page is `/internal/store-frames` on the site's preview deployments
(`site/`, noindex). `site/build.mjs` leaves `public/internal/` out of production builds.

## Files

- `raw/de-DE/`: the app captures, 1080 × 2400, from the Flutter web release build. They show the
  fictional household „Unser Haushalt“ with Anna and Jonas and the generic stores Wochenmarkt,
  Bäckerei, Supermarkt and Drogerie (no retailer names, Legal N-23). Job 65 captured them on
  2026-11-01 from main 0978864, with the local scenario `play-listing` (kept off main) and the
  shot list in its de-DE Play screenshot spec. `fg-crop.png` is the top of `p1.png` for the
  feature graphics.
- `shots.mjs`: what each capture shows. `lift` is the row a caption points at, in capture pixels.
  Frames that show part of a screen crop it at clean cuts around that row. `kit.mjs` finds the
  clean cuts from the pixels: full-width runs of one background colour, never inside a row or the
  tab bar.
- `kit.mjs`: the page shell (self-hosted fonts and `site/public/tokens.css`), crops of a capture,
  hexagons, avatars.
- `proposals/p1-…p5-….mjs`: one proposal each. Each one sets the shot order, the German captions,
  a one-line rationale, a `strip()` and a `feature()`. `strip()` draws one 6480 × 1920 page, and
  `build.mjs` cuts it into the six shots. So a panorama (P1) and single frames go through the
  same code.
- `review.mjs`: the review page and its stylesheet.

## Rules the captions keep

These come from job 65's Play spec. Always "Hummlist", never shortened. No retailer names,
logos or colours. No "beste", "Nr. 1", "Top", "Neu", prices, "kostenlos" or calls to action. No
claims about automatic sorting, AI, Siri, Alexa or Premium. `build.mjs` measures the frame's own
text on each shot (the line boxes of captions, labels and bubbles). It prints the share and fails
above 20 %, which is Play's guidance.
