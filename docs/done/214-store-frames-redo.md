# Job 214: store frame proposals FR1 to FR5, redone for Snacklist

PR: https://github.com/trost-systems/snacklist/pull/425 (draft, **not for merge**). Changelog
`none`. Nothing was uploaded to Play Console or App Store Connect. There was no Release dispatch
and no merge.

## Preview for Peter

- `https://family-groceries-design-nltnskaru-peter-trost.vercel.app/internal/store-frames`
  (the root `/` shows the same page). Project `family-groceries-design`,
  `dpl_39yvAgtcXG2T5Dk9861sYZuQGurj`, READY, target preview, deployed 2026-11-13 at 22:06 CET.
- **The share link is still open.** SSO blocks the bare URL (302 to Vercel sign-in), and this
  runner has no Vercel connector. The lead mints the 23-hour link with
  `get_access_to_vercel_url` and sends it to Peter. The preview is not ready for Peter until
  then.
- All 42 deployed files have the same SHA-1 as the build in `/tmp/dist214` (hz only). No
  project, domain, protection or bypass setting changed.
- Why not the site's own PR preview: since #404, `site/scripts/supabase-gate.mjs` skips every
  branch but `main`. This PR's `hummlist-site` check ends "Canceled by Ignored Build Step"
  (DECISIONS job 214, item 9).

## Options

| Label | Name | Direction |
| --- | --- | --- |
| FR1 | Wabenband | A panorama band through all six shots |
| FR2 | Großschrift | Oversized captions on honey. Peter's earlier pick (job 84's P2), marked „frühere Wahl“ on the page |
| FR3 | Schwebend | A tilted device, with the key row lifted out |
| FR4 | Lupe | Frameless, with sticker callouts |
| FR5 | Ein Einkauf | A six-step story with weekdays and speech bubbles |

Peter answers with one label. Job 215 builds the final set from it.

## What was built

- `design/store-frames/capture.mjs` (new). It takes six screens of today's Snacklist release web
  build (list, sync with the sender's sheet, add, order, tick, invite) at 1080 × 2400. It uses
  job 65's paused-clock method. It also writes the rows each caption points at, the floating
  bars' top and the sender band to `raw/de-DE/meta.json`.
- `test/fixtures/scenarios/store-frames.yaml` (new). „Unser Haushalt“ with Anna and Jonas, the
  generic stores Wochenmarkt, Bäckerei, Supermarkt and Drogerie, and past trips for the
  suggestion and the remembered store.
- `design/store-frames/` ported from job 77's closed branch. The proposals are relabelled
  FR1 to FR5 with Snacklist naming and the FG2 tagline „Gemeinsam einkaufen, ohne Werbung.“
  (in place of „mitsummt“). Crops now stop above the floating add bar and tab bar. The
  feature-graphic crop ends at the first clean line below Anna's new rows.
- `docs/store/frame-research.md`, the research with sources, renamed for Snacklist.
- The review page `site/public/internal/store-frames.html` is noindex. `site/build.mjs` drops
  `internal/` from production builds. `site/agent.mjs` treats `internal/` pages as no content
  pages, and `site/test/internal.test.mjs` covers both.
- Screenshots are in `docs/screenshots/214/`.

## How to verify

```sh
.claude/skills/verify-snacklist/helpers/launch.sh --scenario store-frames --fresh
node design/store-frames/capture.mjs
node design/store-frames/build.mjs --site
(cd site && npm test && npm run build && npm run preview)    # /internal/store-frames
```

## Results

- `scripts/verify.sh --only gitleaks,lint,site,changelog,fg-cli` passes, including no-hummlist
  and the scenario validation.
- The frame text share per shot is 4.6 % to 12.7 %. Play's guidance is at most 20 %.
- On the locally built site, the page answers 200 with `noindex, nofollow`. All 50 images load,
  and the console shows no errors at 390 px and 1440 px.
- In the captures, Legal N-23 holds: only generic store names, no Premium and no price. The
  invite link reads `app.snacklist.app`.

## Left as is

- Real app UI in the captures: the sender's „Hinzugefügt: Kaffee → Supermarkt“ wraps onto two
  lines at 432 px, Radieschen has the generic hexagon icon, and the invite shows a dated expiry.
- The set is German only, for Play phone. The final set (DE and EN, App Store sizes) is job
  215's work, from the chosen frame.
