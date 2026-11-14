# Job 215: store screenshots and demo videos, redone for Snacklist

Redo of job 65's closed PR #190, in the frame Peter picked in job 214: FR2 Großschrift with
FR1's Wabenband in cobalt. Nothing was uploaded to any store and nothing was merged.

## What was built

- **One command:** `scripts/store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all] [--assistants neutral|named|named_api] [--videos] [--keep]`.
  It films the real Snacklist release web build against a local stack with „Unser Haushalt“
  (Anna, Jonas, Wochenmarkt, Bäckerei, Supermarkt, Drogerie) and writes 62 files for both
  locales into `marketing/store-screenshots/out/`:
  - Play phone 1080 × 1920, 7 shots.
  - Play 7-inch tablet 1440 × 2560 and 10-inch tablet 1800 × 3200, 4 shots each, no text.
  - App Store 6.9-inch iPhone 1320 × 2868 and 13-inch iPad 2064 × 2752, 7 shots each.
  - Play feature graphic 1024 × 500 (no name or logo) and icon 512 × 512.
  - All 24-bit RGB without alpha.
- **Shots:** list, sync, add, order, voice, assist, invite. Voice and assist items arrive through
  the local `voice` and `mcp` functions with Jonas's token.
- **Words:** all in `captions.yaml`, de-DE and en-US, every caption `draft`. Voice and assist
  have a `neutral` variant (the default) and `named`; assist also has `named_api`.
- **Checks that fail a run:** size and store rule, alpha, 8 MB, text share over 20 % (Play),
  forbidden words (Premium, price, kostenlos, rankings, retailer chains, AI brands, Hummlist, a
  split "Snacklist", assistant names outside named variants), honey rows not matching the
  sticker, the feature graphic's centre zone. `compare.mjs` compares two runs.
- **Workflow:** `.github/workflows/store-screenshots.yml`, workflow_dispatch only. It uploads the
  set as an artifact.
- **Videos:** `add-tick` and `household-sync` (DE and EN, wide and compact) re-filmed with
  „Unser Haushalt“ / "Our Home". `marketing/videos/remake.sh` makes them again. The captions,
  VTT files, alt texts, `site/COPY_NEEDED.md` and FEATURES-FOR-WRITERS are updated.
- **Research:** `docs/store/store-captions-assistants.md` covers whether captions may name Siri,
  Alexa and MCP, with sources and real listings. Also copied to
  `/workspace/hummlist/research/`.

## How to verify

```bash
scripts/store-screenshots.sh                       # about 12 min, plus waiting for /tmp/fg-e2e.lock
cp marketing/store-screenshots/out/manifest.json /tmp/a.json
scripts/store-screenshots.sh && node marketing/store-screenshots/compare.mjs /tmp/a.json
scripts/store-screenshots.sh --assistants named
FG_PORT_PREFIX=<block> marketing/videos/remake.sh  # Linux host with Docker and Xvfb, about 19 min
```

## Results

- **Full run:** 716 to 757 s on the Hetzner runner. 62 files, all checks pass.
- **Determinism:** two neutral runs matched in 62 of 62 files. The named run differs in exactly the
  12 voice and assist frames that carry text.
- **Videos:** 16 files and 4 VTT files. 11.2 to 12.5 s, seam SSIM 0.996 to 0.997, posters
  27 to 48 KB, H.264 and VP9, no audio.
- **Gates:** `scripts/verify.sh --only gitleaks,lint,site,fg-cli` passed. actionlint passes on the
  workflow.

## Screenshots

`docs/screenshots/215/`:

- both contact sheets;
- the de-DE Play phone strip;
- the feature graphic;
- the named voice and assist frames;
- the video posters.

## Open

- Legal and Peter, before any upload: `docs/NEEDS_LEAD.md` "Job 215". The points are the named
  captions, MCP once it is paid (Apple 2.3.2), the API flag, the 50-list limit and an English
  read.
- The workflow can be started only once it is on main.
- The household-sync compact cut layers Jonas's phone over the bottom of Anna's (DECISIONS job
  215, item 9).
