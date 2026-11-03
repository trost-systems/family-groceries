# Store screenshots

The Play Store and App Store screenshots, the Play feature graphic and the Play icon come from one
command. It films the real Hummlist web build against a local Supabase stack with the demo
household „Unser Haushalt“ (Anna and Jonas) and composes the store files from a checked-in caption
file, in the store frame P2 „Großschrift“ that Peter picked on 2026-11-02 (job 77's proposals,
job 84 made it the pipeline's frame). With `--videos` it also re-films the hummlist.com demo loops `add-tick` and `household-sync`
with the same household. Nothing is uploaded anywhere.

## Run it

```bash
scripts/store-screenshots.sh                         # de-DE, Play and App Store
scripts/store-screenshots.sh --locale all            # also the draft en-US set
scripts/store-screenshots.sh --store play            # only Play
scripts/store-screenshots.sh --videos                # also add-tick and household-sync for site/public/media
scripts/store-screenshots.sh --keep                  # leave stack and web server up afterwards
scripts/store-screenshots.sh --locale all --publish  # the checked-in set: store/screenshots/
node marketing/store-screenshots/review.mjs          # its review page, /internal/store-frames-final
```

The script needs what the verify-hummlist skill needs: Docker, the Supabase CLI, Flutter, Node and
ffmpeg. It uses this checkout's port block in `supabase/config.toml` (CI uses the canonical 543xx).
With the web build in place, a run of both locales took 3 min 22 s on the Hetzner runner: the
capture about 1.5 min per locale, the composition about 15 s. A fresh web build adds about 80 s.

The steps:

1. `.claude/skills/verify-hummlist/helpers/launch.sh` starts the stack, builds the release web
   app (wasm, production defines) when `app/` changed, and serves it.
2. `marketing/store-screenshots/capture.spec.mjs` runs under `/tmp/fg-e2e.lock` with one worker
   and films every scene once per capture size (`CAPTURES` in `sets.mjs`) into `out/raw/`, with a
   JSON file per scene: the rows its caption points at, in capture pixels.
3. `marketing/store-screenshots/compose.mjs` frames every capture for each device that shows it
   (`frame.mjs`), checks size, pixel format, text share and caption fit, and writes the contact
   sheet, `manifest.json` and `summary.md`.
4. With `--publish`, the store files, `manifest.json` and `summary.md` are copied to
   `store/screenshots/`, the checked-in set.
5. Every seeded run is torn down (`teardown.mjs`), then `helpers/cleanup.sh` stops what the
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
| `<locale>/appstore-iphone69/<n>-<scene>.png` | 1320 × 2868 | App Store 6.9-inch iPhone, portrait (the slot also takes 6.7-inch files) |
| `<locale>/appstore-iphone65/<n>-<scene>.png` | 1284 × 2778 | App Store 6.5-inch iPhone, portrait |
| `<locale>/appstore-ipad13/<n>-<scene>.png` | 2064 × 2752 | App Store 13-inch iPad, portrait |
| `<locale>/play/feature-graphic.png` | 1024 × 500 | Play feature graphic |
| `<locale>/play/icon-512.png` | 512 × 512 | Play hi-res icon, from `AppIcon-1024.png`, which `design/app-icon` generates |
| `<locale>/contact-sheet.png` | | every file of the locale on one sheet |
| `manifest.json`, `summary.md` | | size, pixel format, bytes, sha256 and caption status per file |

Every file is a PNG with 24-bit RGB and no alpha channel; `compose.mjs` fails on a file that
breaks its size, its pixel format or Play's 8 MB limit. `<n>` is the position in the store
listing.

## The frame

P2 „Großschrift“ (`marketing/store-screenshots/frame.mjs`), job 77's proposal as it was picked:

- Honey background (#ffe24a). On top, the caption: two lines in Bricolage Grotesque 800 at 132 px
  (on the 1080 px Play shot; every size scales with the frame's width), a subline in Inter 600.
  A line that would wrap gets smaller type instead; the manifest records the size (`captionPx`).
- Below, the real app as a card 86 % of the frame wide, ink edge, rounded top, hard ink shadow,
  standing on the foot of the frame. The card shows the part of the capture the caption points
  at: the tallest window that fits, cut only through gaps between rows (at least 8 CSS pixels of
  one background colour across the full width, found from the pixels, never inside the tab bar).
- The sync shot lifts Jonas's confirmation („Hinzugefügt: Eier → Supermarkt“) out of his phone
  as a tilted sticker on the card's top edge.
- The feature graphic: the tagline on honey with its last words (`accent`) in cobalt, the top of the list as
  a card in the bottom-right corner.

`compose.mjs` fails when a shot's or the feature graphic's own text (captions, not the app) covers more than 20 % of it
(Play's guidance; the shots measure 4 to 17 %), when the caption runs into the card, or when a
caption names a retailer, shortens "Hummlist" or mentions Premium or a price.

All phone sizes frame one phone capture (360 × 800 CSS pixels at 3×, an Android-sized screen), so
Play and the App Store show the same app at the same type size. Tablets have their own capture
(800 × 1280 at 2×).

## Scenes

| Scene | Devices | What it shows |
| --- | --- | --- |
| `list` | all | Jonas's list 1.55 s after Anna added Radieschen and Ziegenkäse (English: Goat cheese and Strawberries, which the classifier files under produce): „2 neu von Anna“, the rows tinted honey |
| `sync` | all | Anna's list with Jonas's Eier tinted honey („1 neu von Jonas“); Jonas's „Hinzugefügt: Eier → Supermarkt“ as the sticker |
| `add` | all | „2 Hafer“ typed into the add sheet: the typed row, then suggestions with the quantity from the household's shops and the catalogue |
| `order` | all | More → Läden → Supermarkt: „Supermarkt: Reihenfolge“ with the numbered categories |
| `tick` | phones | Vollmilch 180 ms after the tap: struck through, the row tinted mint |
| `invite` | phones | More → Partner einladen → Neue Einladung: code, link https://app.hummlist.com/join/…, valid 7 days |

The order is P2's: the shared list first, then the live sync, the quick add, the store's walking
order, ticking off and the invite. The voice shot comes later (Q35 N1). The web build shows its own
origin in invite links, while the phones share https://app.hummlist.com: the invite scene's page
runs at that origin, every request to it answered by the local web build (`app.mjs`).

## The demo household

`test/fixtures/scenarios/demo-haushalt.yaml` (German) and `demo-household-en.yaml` (English) have:

- Two members, Anna and Jonas.
- Four generic stores, the only ones in the household: Wochenmarkt, Bäckerei, Supermarkt and
  Drogerie (legal N-23). On main, `create_household` still adds dm, Lidl and Edeka;
  `marketing/store-screenshots/seed.mjs` deletes every store the scenario does not name.
- Thirteen open items.
- Eight weeks of weekly shops, so the add sheet suggests what the household buys („Schon mal gekauft“).
- One old purchase of Honig, Marmelade and Eier, so the demo videos' adds land at the Supermarkt.

Scenes that change data (`list`, `sync`) seed a run of their own. The others share one run per locale.

## Captions

`marketing/store-screenshots/captions.yaml` holds every word the store files show besides the app's
own: per locale, a two-line title and a subline for each scene, and for the feature graphic a
title with its cobalt `accent`, each with a `status`. The German scene captions are P2's as Peter
saw them; only the de-DE tagline (FG1, „Eine Einkaufsliste, die der ganze Haushalt mitsummt.“) is
`approved` today. The English texts are drafts. The run renders drafts too and lists them in
`manifest.json` and at the end of its output. A caption that shortens "Hummlist", names a
retailer or mentions Premium or a price fails the composition.

## Deterministic output

A rerun on the same commit writes byte-identical files, except the invite shots: every run
creates a new invite, so its code and expiry date differ (`compare.mjs` lists them as expected).
Compare two runs with:

```bash
cp marketing/store-screenshots/out/manifest.json /tmp/before.json
scripts/store-screenshots.sh
node marketing/store-screenshots/compare.mjs /tmp/before.json     # "N of M identical", the invite shots as expected, exit 0
```

What makes it so:

- **Fixed data.** Each run seeds the scenario afresh: one run per locale for the scenes that
  change nothing, and one per capture for `sync`. Times in the scenario are relative to the
  seeding, and the suggestions and the order come from the server, so the same list comes back
  every time.
- **Fixed clock.** Each page runs on Playwright's fake clock from its first script. The clock
  starts at the moment its run was seeded, so the app sees the same ages every run. This matters
  because the add sheet's 30-day recent rows are computed on the device. Only the invite shows a
  date (its expiry, seven days after the seeding).
  Timers and animation frames run on the same clock.
- **Frozen frames.** Before its frame, a scene pauses the clock on the 16 ms frame grid and then
  steps it by a named amount: the tick 180 ms after the tap, the sync 1.55 s after the rows
  arrive, the caret 300 ms after a key (visible in the add sheet) or 750 ms (off in list frames).
  Frames come only from these steps, so the host's speed does not show.
- **Loaded fonts.** The capture waits for the app's fonts, and the composition waits for its fonts
  and images to decode. The composition uses the site's self-hosted Bricolage Grotesque and
  Inter.

A different Chromium or font build can still change a few anti-aliased pixels. If a comparison
across machines differs, compare two runs on one machine first.

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
4. Run `scripts/store-screenshots.sh --keep`, then
   `cp marketing/store-screenshots/out/manifest.json /tmp/before.json`, run it again, and check
   that `node marketing/store-screenshots/compare.mjs /tmp/before.json` reports no change.
5. Read the contact sheet before you hand the set over.
