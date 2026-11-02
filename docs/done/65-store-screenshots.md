# Job 65: automated store screenshots (Play and App Store)

One command films the real Hummlist web build against a local stack with the demo household
„Unser Haushalt“ (Anna and Jonas, four generic stores) and writes every store file:

- Play: phone, 7-inch tablet and 10-inch tablet screenshots, the feature graphic and the icon.
- App Store: 6.9-inch iPhone and 13-inch iPad screenshots.

Each file has a caption band drawn from one checked-in caption file. Reruns are byte-identical.
With `--videos` the same command re-films the hummlist.com demo loops `add-tick` and
`household-sync` with the same household, replacing the Brandt family. A by-hand workflow
produces the set on GitHub as an artifact. Nothing is uploaded to any store. The guide is
[docs/STORE_SCREENSHOTS.md](../STORE_SCREENSHOTS.md).

## What was built

- `scripts/store-screenshots.sh [--locale de-DE|en-US|all] [--store play|appstore|all] [--videos] [--keep]`:
  - starts the stack, the release web build and its server (the verify-hummlist launcher);
  - films every scene with Playwright under `/tmp/fg-e2e.lock` with one worker;
  - composes, checks and writes `marketing/store-screenshots/out/` (git-ignored) with a contact
    sheet per locale, `manifest.json` (size, pixel format, sha256, caption status) and
    `summary.md`;
  - tears down its seeded runs and stops what it started.
- `marketing/store-screenshots/`:
  - `sets.mjs`: the device registry (size, viewport, scenes) and the one layout both sides use.
  - `scenes.mjs`: list, add, tick, sync, due, edit, dark, each ending on a paused clock at a named
    moment.
  - `captions.yaml`: de-DE and en-US titles and subtitles with a status. Only the de-DE feature
    graphic is approved.
  - `capture.spec.mjs`, `app.mjs`: the capture side.
  - `seed.mjs`: the scenario minus every store it doesn't name. It tears its own run down if
    pruning fails.
  - `compose.mjs`: HTML frames rendered by Chromium, flattened to RGB24 by ffmpeg. It fails on a
    wrong size, an alpha channel, more than 8 MB, a shortened "Hummlist", or Premium or a price
    in a caption.
  - `compare.mjs`: two manifests compared; exit 1 on any difference.
- Sizes:
  - Play phone 1080 × 1920, 7-inch tablet 1440 × 2560, 10-inch tablet 1800 × 3200 (all 9:16).
  - Feature graphic 1024 × 500, icon 512 × 512.
  - App Store 6.9-inch iPhone 1320 × 2868, 13-inch iPad 2064 × 2752.
  - All 24-bit RGB without alpha.
- `test/fixtures/scenarios/demo-haushalt.yaml`, `demo-household-en.yaml`: Anna and Jonas,
  Wochenmarkt, Bäckerei, Supermarkt, Drogerie, 13 items, eight weeks of shops.
- `.github/workflows/store-screenshots.yml`: workflow_dispatch only (locale, store), artifact
  `store-screenshots-<sha>`, the table as job summary.
- Videos:
  - `marketing/videos/remake.sh` builds the Linux bundle when needed, takes add-tick and
    household-sync in DE and EN, and builds the site files.
  - `household-sync` now has two phones (Anna leads, Jonas the satellite).
  - `copy.json`, the VTT captions, `demo.*` alt texts in `site/content/landing/copy.yml` and
    `site/COPY_NEEDED.md` are updated, plus a job 65 section in each `REVIEW.md`.
  - The 24 files in `site/public/media/` keep their names, sizes and formats.
- Fixes found on the way:
  - `scripts/gates/e2e.sh` no longer deadlocks under `flock /tmp/fg-e2e.lock` (an orphaned waiter
    held every e2e run on hz for an hour). The fix has a test in `scripts/e2e-gate-test.sh` that
    fails on the old gate.
  - fg accepts port blocks up to 654.
  - verify-hummlist's `lib.mjs` loads Playwright lazily, so a Playwright test runner can import it.

## How to verify

```bash
scripts/store-screenshots.sh --locale all --keep          # 3 min 22 s with the web build in place
open marketing/store-screenshots/out/de-DE/contact-sheet.png
cp marketing/store-screenshots/out/manifest.json /tmp/before.json
scripts/store-screenshots.sh --keep && node marketing/store-screenshots/compare.mjs /tmp/before.json
scripts/store-screenshots.sh --videos                     # Hetzner runner or box: Xvfb, xdotool
scripts/verify.sh --only gitleaks,lint,site,fg-cli
```

## Results

- Capture: 25 scenes per locale pass in about 1.5 min. de-DE and en-US each produce 27 files.
- Determinism: six de-DE runs on the Hetzner runner matched in 27 of 27 files (`compare.mjs`),
  before and after the review moved the clock's start.
  So did the GitHub Actions run of the same commit
  (https://github.com/trost-systems/family-groceries/actions/runs/41372840599, started by a
  temporary push trigger that was removed before the PR). Before the frame-grid alignment, the
  caret's blink phase and a 1 px end of the strike-through differed between runs.
- Videos: 8 cuts. Seam SSIM 0.9965 to 0.9977, 10.6 to 11.2 s, MP4 0.33 to 0.74 MB, WebM 0.36 to
  0.54 MB, posters 25 to 38 KB. Measured sync in the takes: DE 946 ms, EN 498 ms.
- Review: an independent pass found nine issues, all fixed.
  - The clock was pinned to a calendar date while the add sheet's 30-day recent rows are computed
    on the device. The set would have changed within a week. The clock now starts at the run's
    seeding moment.
  - A run a killed capture left behind could leak, because `out/` was wiped before its teardown.
    Teardown now runs first and tries every run.
  - A failed store prune leaked its run. `seed.mjs` now tears it down.
  - The gate had no test that an unrelated lock holder still blocks it. Added.
  - A failed workflow run uploaded no traces. Added.
  - Two dispatches with different inputs cancelled each other. The concurrency group now includes
    the inputs.
  - Three doc mismatches, fixed.
  - The store-size rules were not checked against the registry. `deviceProblems` now checks them.
- Gates: gitleaks, lint (including `e2e-gate-test.sh`), site (97 tests, build) and fg-cli pass
  locally.

## Screenshots

`docs/screenshots/65/`:

- The de-DE and en-US contact sheets.
- Four de-DE frames and the feature graphic.
- The new video posters.

## Missing or blocked

- The approved v2 set, its capture scripts and the ASO spec are not on the Hetzner runner. The
  set was rebuilt from the brief, and its scene captions are drafts until the lead compares them
  (NEEDS_LEAD "Job 65").
- The workflow can be dispatched only after it is on main.
- English items show category icons (job 54's finding), so en-US stays a draft.
- The root `DONE_SUMMARY.md` and `FEATURES-FOR-WRITERS.md` are changed by jobs 61 to 64, so this
  job leaves them alone. The lead adds the one-line link at landing.
