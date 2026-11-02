# Store screenshots

The Play Store and App Store screenshots, the Play feature graphic and the Play icon come from one
command. It films the real Hummlist web build against a local Supabase stack with the demo
household „Unser Haushalt“ (Anna and Jonas) and composes the store files from a checked-in caption
file. With `--videos` it also re-films the hummlist.com demo loops `add-tick` and `household-sync`
with the same household. Nothing is uploaded anywhere.

## Run it

```bash
scripts/store-screenshots.sh                         # de-DE, Play and App Store
scripts/store-screenshots.sh --locale all            # also the draft en-US set
scripts/store-screenshots.sh --store play            # only Play
scripts/store-screenshots.sh --videos                # also add-tick and household-sync for site/public/media
scripts/store-screenshots.sh --keep                  # leave stack and web server up afterwards
```

The script needs what the verify-hummlist skill needs: Docker, the Supabase CLI, Flutter, Node and
ffmpeg. It uses this checkout's port block in `supabase/config.toml` (CI uses the canonical 543xx).
A de-DE run takes about 2 minutes once the web build exists: the build about 80 s, the capture
about 1.5 min, the composition about 15 s.

The steps:

1. `.claude/skills/verify-hummlist/helpers/launch.sh` starts the stack, builds the release web
   app (wasm, production defines) when `app/` changed, and serves it.
2. `marketing/store-screenshots/capture.spec.mjs` runs under `/tmp/fg-e2e.lock` with one worker
   and films every scene into `out/raw/`.
3. `marketing/store-screenshots/compose.mjs` writes the store files, checks their size and pixel
   format, and writes the contact sheet, `manifest.json` and `summary.md`.
4. Every seeded run is torn down (`teardown.mjs`), then `helpers/cleanup.sh` stops what the
   launch started, unless you passed `--keep`.

On GitHub: Actions, workflow "Store screenshots" (`.github/workflows/store-screenshots.yml`),
"Run workflow" with a locale and a store. The set is the run's artifact
`store-screenshots-<sha>`. The workflow runs only when someone starts it.

## Output

`marketing/store-screenshots/out/` (git-ignored):

| File | Size (px) | Store rule |
| --- | --- | --- |
| `<locale>/play-phone/<n>-<scene>.png` | 1080 × 1920 | Play phone: 9:16, each side 320 to 3840 |
| `<locale>/play-tablet7/<n>-<scene>.png` | 1440 × 2560 | Play 7-inch tablet: 9:16, each side 320 to 3840 |
| `<locale>/play-tablet10/<n>-<scene>.png` | 1800 × 3200 | Play 10-inch tablet: 9:16, each side 1080 to 7680 |
| `<locale>/appstore-iphone69/<n>-<scene>.png` | 1320 × 2868 | App Store 6.9-inch iPhone, portrait |
| `<locale>/appstore-ipad13/<n>-<scene>.png` | 2064 × 2752 | App Store 13-inch iPad, portrait |
| `<locale>/play/feature-graphic.png` | 1024 × 500 | Play feature graphic |
| `<locale>/play/icon-512.png` | 512 × 512 | Play hi-res icon, from `design/app-icon`'s 1024 px asset |
| `<locale>/contact-sheet.png` | | every file of the locale on one sheet |
| `manifest.json`, `summary.md` | | size, pixel format, bytes, sha256 and caption status per file |

Every file is a PNG with 24-bit RGB and no alpha channel; `compose.mjs` fails on a file that
breaks its size, its pixel format or Play's 8 MB limit. `<n>` is the position in the store
listing.

## Scenes

| Scene | Devices | What it shows |
| --- | --- | --- |
| `list` | all | Anna's list in store sections (Wochenmarkt, Bäckerei, Supermarkt, Drogerie) |
| `add` | all | „Hafer“ typed into the add sheet, with suggestions from history and the catalogue |
| `tick` | phones, Play tablets | Brötchen 180 ms after the tap: struck through, the row tinted mint |
| `sync` | all | Jonas's list 1.55 s after Anna added two items at the market: „2 neu von Anna“ |
| `due` | iPhone, iPad | the empty add sheet with „Wieder fällig“ rows |
| `edit` | phones | the edit sheet of Äpfel (variety Elstar) |
| `dark` | phones | the list in the dark theme |

The empty add sheet opens at half the screen height, so the 780 px Play phone has room for only one
„Wieder fällig“ row. That phone shows `edit` instead. The device registry, with sizes, viewports
and scene lists, is `marketing/store-screenshots/sets.mjs`. The scenes are
`marketing/store-screenshots/scenes.mjs`.

No frame shows Premium, a price, a retailer name or logo, or a real person.

## The demo household

`test/fixtures/scenarios/demo-haushalt.yaml` (German) and `demo-household-en.yaml` (English) have:

- Two members, Anna and Jonas.
- Four generic stores, the only ones in the household: Wochenmarkt, Bäckerei, Supermarkt and
  Drogerie (legal N-23). On main, `create_household` still adds dm, Lidl and Edeka;
  `marketing/store-screenshots/seed.mjs` deletes every store the scenario does not name.
- Thirteen open items.
- Eight weeks of weekly shops, so „Wieder fällig“ has rows.
- One old purchase of Honig, Marmelade and Eier, so the demo videos' adds land at the Supermarkt.

Scenes that change data (`sync`) seed a run of their own. The others share one run per locale.

## Captions

`marketing/store-screenshots/captions.yaml` holds every word the store files show besides the app's
own: per locale, a title and a subtitle for each scene and for the feature graphic, each with a
`status`. Only the de-DE feature graphic („Gemeinsam einkaufen, ohne Werbung“ / „Eine Liste für
Partner, Familie und WG“) is `approved` today. The run renders drafts too and lists them in
`manifest.json` and at the end of its output. A caption that shortens "Hummlist" or mentions
Premium or a price fails the composition.

## Deterministic output

A rerun on the same commit and host writes byte-identical files; three consecutive runs on the
Hetzner runner matched in every file. Compare two runs with:

```bash
cp marketing/store-screenshots/out/manifest.json /tmp/before.json
scripts/store-screenshots.sh
node marketing/store-screenshots/compare.mjs /tmp/before.json     # "27 of 27 identical", exit 0
```

What makes it so:

- **Fixed data.** Every scene starts from a freshly seeded scenario. Times in the scenario are
  relative to the seeding, and due items and order are computed by the server, so the same list
  comes back every time.
- **Fixed clock.** Each page runs on Playwright's fake clock from the first script, with its wall
  time on Saturday 31 October 2026, 10:00 Berlin. Timers and animation frames run on the same
  clock.
- **Frozen frames.** Before its frame, a scene pauses the clock on the 16 ms frame grid and then
  steps it by a named amount: the tick 180 ms after the tap, the sync 1.55 s after the rows
  arrive, the caret 300 ms after a key (visible in the add sheet) or 750 ms (off in list frames).
  Frames come only from these steps, so the host's speed does not show.
- **Loaded fonts.** The capture waits for the app's fonts, and the composition waits for its fonts
  and images to decode. The composition uses the site's self-hosted Bricolage Grotesque and
  Inter.

A different host or a different Chromium build can still change a few anti-aliased pixels.
Compare runs from the same machine.

## Demo videos (`--videos`)

`marketing/videos/remake.sh` films `add-tick` (Anna) and `household-sync` (Anna and Jonas) in German
and English with the same scenarios, then builds the site files with `marketing/videos/build.mjs`.
The names, sizes and formats are those in `site/public/media/README.md`. The takes film the
Linux profile build under Xvfb with real X input (xdotool), as job 54 set up
(`marketing/videos/README.md`). The script builds that bundle in the linux-build container where
CMake is missing. The CI workflow does not film the videos, because its runner lacks the X tools
and the GTK build. Run `--videos` on the Hetzner runner or the box.

## Add or change a scene

1. Add the scene to `SCENES` in `scenes.mjs`: whose phone it is, `ownRun: true` if it changes
   data, and a `frame()` that ends with `pause()` and named `step()`s.
2. Add a title and subtitle for every locale in `captions.yaml`, with `status: draft`.
3. Add the scene to the devices' `scenes` in `sets.mjs`.
4. Run `scripts/store-screenshots.sh --keep` twice and check that `compare.mjs` reports no change.
5. Read the contact sheet before you hand the set over.
