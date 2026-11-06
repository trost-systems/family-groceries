# Job 146: the hummlist.com demo videos re-filmed after the UI changes

The three silent loops on `/de` and `/en` (`add-tick`, `household-sync`, `mcp-chat`, each DE and
EN, wide and compact) show today's app: the floating add field over the list, the floating tab
pill, the yellow "new" highlight, the add sheet's own "Hinzugefügt" line and no snackbars. Same
pipeline, rules and file names as job 54 (`marketing/videos/README.md`); 24 web files, 12
posters, 6 WebVTT tracks replaced in `site/public/media/`.

## What changed

- `marketing/videos/capture/driver.ts`: closes the List tab's tips after sign-in (off camera);
  `scrollUntil` backs up a wheel notch when its target leaves view.
- `marketing/videos/capture/shots.ts`: household-sync satellites scroll until the pantry row is at
  y ≤ 112.
- `marketing/videos/*/scene.mjs`: crops end under the tab pill where the frame has room
  (DECISIONS "Job 146" 2).
- `test/fixtures/scenarios/demo-familie.yaml`, `demo-family-en.yaml`: two tail rows for scroll room.
- `site/content/landing/copy.yml`, `site/COPY_NEEDED.md`: `demo.household-sync` says "less than a
  second" (measured 0.58 to 0.80 s).
- `marketing/videos/*/REVIEW.md`: re-take notes, new ffprobe, seam and latency tables.
- Before and after posters: `docs/screenshots/146/`.

## How to verify

```bash
cd site && npm ci && npm run build && npm test
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt -show_entries format=duration,size site/public/media/add-tick-de-wide.mp4
```

Re-making the videos: `marketing/videos/README.md` (stack, Linux profile build, takes, `node build.mjs`).

## Results

- `scripts/verify.sh --only gitleaks,lint,site,fg-cli` passed (site: 167 tests, 30 pages).
- `hyperframes check`: 0 errors on all 12 projects. Seams SSIM 0.9968 to 0.9981. Web files 279 to
  510 KiB each, 8.9 MiB together. No audio track in any file.
- Measured: sync add 0.58 to 0.80 s, tick 1.48 to 1.64 s; MCP add answer 764 ms (DE), rows in the
  app 1.6 s after the call.

## Licences

Unchanged from job 54 (`docs/done/54-demo-videos.md` table): HyperFrames 0.8.225 (Apache-2.0),
GSAP 3.13.0 (Standard "no charge"), Chrome Headless Shell (BSD-3), FFmpeg/xdotool/Xvfb (tools),
Bricolage Grotesque and Inter (OFL 1.1), Material Icons (CC BY 4.0, `MaterialIcons_LICENSE.txt` in the
Flutter SDK; site credit pending as before), Noto Color Emoji (OFL 1.1 / Apache-2.0), app icon and footage (own). No new
asset was added.

## Missing

- Peter's phone check of each loop (NEEDS_LEAD "Job 54" still applies).
- The English MCP cut still shows Sam's German list (job 54's open question).
