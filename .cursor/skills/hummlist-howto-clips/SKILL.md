---
name: hummlist-howto-clips
description: "Record short how-to clips of the real Hummlist web app (Playwright on the release web build with the fictional Brandt family, German and English) and export an email GIF, MP4 and WebM for the site, and a PNG fallback, per feature id of the verify-hummlist feature map. Use when an email, newsletter, guide or site page needs a GIF or video of how a Hummlist feature works."
---

# Hummlist how-to clips

A clip is a few seconds of the real app doing one thing, filmed from the web build that verify-hummlist launches against a local stack. It is never a mockup and never the hosted project. Each language seeds its own demo household for the take (the Brandt family, `test/fixtures/scenarios/demo-familie.yaml` and `demo-family-en.yaml`) and tears it down afterwards. No real user data appears.

## Make a clip

```bash
.cursor/skills/verify-hummlist/helpers/launch.sh            # once: stack, web build, server (READY ...)
node .cursor/skills/hummlist-howto-clips/clip.mjs quick-add                 # DE + EN into the default out dir
node .cursor/skills/hummlist-howto-clips/clip.mjs quick-add --lang en --out /tmp/clips --keep-frames
node .cursor/skills/hummlist-howto-clips/clip.mjs quick-add --dark          # dark theme (light is the default)
```

Output: `<out>/<feature-id>/<lang>.gif`, `.mp4`, `.webm` and `.png`, plus `<out>/<feature-id>/meta.json`. `meta.json` records the commit, the recording time, the scenario, and per file its bytes, width, height, duration and fps, plus the alt text. The default `<out>` is `/workspace/hummlist/research/60-feature-map/clips`, which the Hetzner runner mirrors to the box, where the lead copies it to `/workspace/hummlist/clips/`. The script prints one line per language with every size and exits 1 when a GIF misses its budget. Don't commit generated media, except a proof under `docs/screenshots/<job>/`.

| Export | Spec |
| --- | --- |
| GIF (email) | 480 px wide, 12 fps (then 10), 128 colours (then 96, 64, 48) until it is at most 1.5 MB, palette from ffmpeg `palettegen` (diff stats) and `paletteuse` (bayer). Frame 1 is the finished result, held 0.9 s, then the journey plays and ends on the same frame, looping forever. `gifsicle -O3` runs when it is installed |
| MP4 (site) | H.264, yuv420p, `+faststart`, CRF 22, 30 fps, 390×844 (the screencast delivers CSS pixels even at DPR 2), silent |
| WebM (site) | VP9, CRF 36, 30 fps, same size, silent |
| PNG (fallback) | The finished result at 600 px wide, the same frame as GIF frame 1 |

How it films:

- Viewport 390×844 at DPR 2, light theme, locale `de-DE` or `en-US`. The app follows the browser language.
- Chromium's screencast captures every painted frame with its timestamp at 390×844 CSS pixels, and ffmpeg turns the frames into a 30 fps master at their real timing, so pauses are real pauses. The GIF scales that master to 480 px, so its moving frames are slightly soft. Frame 1 and the PNG come from a DPR 2 screenshot and are sharp. A DPR 2 capture loop (`Page.captureScreenshot` with `clip.scale: 2`) manages only about 13 fps here, too slow for smooth video.
- A tap shows a soft dot where the finger lands (hummlist-ui-craft `references/motion.md`). There is no cursor.

## Write a clip for another feature

Add `scripts/<feature-id>.mjs`, named after a feature id from `.cursor/skills/verify-hummlist/features/`, exporting:

| Export | Meaning |
| --- | --- |
| `scenario` | `{ de: 'demo-familie', en: 'demo-family-en' }` or other scenarios with the state the journey needs |
| `play({ page, L, lang, tap, pause })` | The journey, from the signed-in list to the finished result. `tap(locator)` taps with the dot, `pause(ms)` waits, `L(key)` gives the UI text in the clip's language |
| `prepare({ page, L, lang })` | Optional: steps before filming starts (open a tab, scroll) |
| `hold`, `posterHold` | How long the end state holds at the loop's end, and as GIF frame 1 (ms) |
| `alt` | `{ de, en }` alt text: what happens, with the labels as on screen |

`scripts/quick-add.mjs` is the example. Find widgets as verify-hummlist does: by role and accessible name, through the helpers in `.cursor/skills/verify-hummlist/helpers/lib.mjs`. Follow hummlist-ui-craft's `references/motion.md`:

- Three to five beats with deliberate pauses: about 0.9 s on the opening screen, 1 to 1.2 s for the result of each step, and 1.5 s or more on the payoff.
- Open on a calm, finished screen.
- Keep a loop at 4 to 8 s.
- Never film a navigation backwards.

Keep data fictional, with items that make sense in both languages. The catalogue suggestions are German words even in English, so the English quick-add types "Ched" for „Cheddar“. Check every take on a contact sheet before you hand it over:

```bash
ffmpeg -i <out>/quick-add/de.gif -vf "select='not(mod(n\,15))',scale=240:-1,tile=8x1" -frames:v 1 /tmp/sheet.png
```

## Email caveats

- Outlook for Windows shows only the first frame of a GIF. That is why frame 1 is the finished result and stands on its own.
- Gmail, Apple Mail, Outlook on the web and on Mac, and most phone apps play GIFs. Some corporate clients block images until the reader allows them.
- Always set `alt` (from `meta.json`), `width="300"` or so in the HTML (the GIF is 480 px for sharpness on retina screens), and link the PNG or the feature's page as the fallback.
- Keep one GIF per email if you can. Each is up to 1.5 MB, and big emails get clipped (Gmail clips HTML over about 100 KB, not images) or load slowly on mobile data.
- For the site, use the MP4 with the WebM as `<source>` elements, `muted playsinline loop`, and the PNG as poster. Under `prefers-reduced-motion`, show the poster only (hummlist-ui-craft).

## Gotchas

- `clip.mjs` needs `launch.sh`'s instance (`doctor.sh` healthy) and `ffmpeg`. It seeds and tears down its own runs, so it doesn't touch the baseline run.
- Store sections show the store's name in a neutral hex pill (no retailer colours or logos since job 57). The demo households have no store tags, so their items sit under „Ohne Laden“; seed store tags in the script's scenario if a clip needs a store.
- A failed take leaves `<out>/<feature-id>/.work-<lang>/` only with `--keep-frames`. A failure still tears the seeded run down.
