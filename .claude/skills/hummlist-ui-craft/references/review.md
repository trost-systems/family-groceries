# Rehearse, review, hand over

Run the whole thing at real speed and look at it the way the audience will, before anyone
does. Every answer below comes from a frame you looked at, never from the code.

## Film

`film.mjs` uses the repo's Playwright (run `npm ci` in `e2e/` once) and Chromium. Scenes are
standalone HTML pages at design size; `--select` narrows to one element.

```sh
F=.claude/skills/hummlist-ui-craft/film.mjs
node $F site/scenes/hero.html --out shots/hero --still --at 6200       # poster PNG (+ WebP with ffmpeg)
node $F site/scenes/hero.html --out shots/hero --every 500 --count 28  # contact sheet, seeked frames
node $F site/scenes/hero.html --out shots/hero-358 --width 358 --height 320 --every 500 --count 28
node $F site/scenes/hero.html --out shots/hero-dark --dark --still --at 6200
node $F site/scenes/hero.html --out shots/hero-rm --reduced --still     # reduced-motion state
node $F site/scenes/hero.html --out shots/hero --seam 12000             # first vs last frame diff
node $F site/scenes/hero.html --out site/public/media/hero --video 12   # WebM (VP9) + MP4 (H.264)
node $F sheet app/test/design/goldens/*-light.png --out shots/goldens   # sheet of existing PNGs
```

Frames are seeked, not sampled from wall-clock time: the helper pauses every CSS and Web
Animation (or calls `window.scene.seek(ms)`) and sets the time, so a sheet is exact and
repeatable. `--video` records in real time; check it once at speed as well.

For Flutter, the frames come from goldens (`flutter test --update-goldens`) or the Linux build
under `xvfb-run` recorded with `ffmpeg -f x11grab`; extract stills with
`ffmpeg -ss <t> -i in.mp4 -frames:v 1 out.png` and put them on one sheet with `film.mjs sheet`.

## What to watch

- **Framing first.** Clear every framing fault on the still before any motion work; after
  moving anything, re-film the whole loop.
- **Every frame at the real width**, wide and 358, light and dark, filmed separately.
- **Measure, don't eyeball:** one shadow, one radius set, one gutter across the page; compare
  computed styles, not impressions.
- **The loop end to end** plus the start of the next; `--seam` near 0 %.
- **Each beat close up:** film presses, sheet openings, ticks and handoffs at 40 to 80 ms
  steps (`--from <ms> --every 50 --count 20`). A sheet at 500 ms misses a one-frame pop.
- **Text and glyphs:** nothing spills its box, nothing shimmers after a move.
- **Reduced motion:** the poster is complete and still.
- **The host:** the shipped poster and loop in the real page at 390 and 1440, no layout shift.
- **What tools cannot sign off:** a sheet misses flashes; a seam diff does not judge a story.
  Watch it at speed, slowed, and once more after the final edit. Say what you did not watch.

Fix the largest visible fault first, in this order: framing, hierarchy and density, motion,
polish. Re-film, return to the top. Ten films with an unchanged frame means stop and get a
fresh eye.

## Fresh-eye review

Give a reviewer (another agent, not the builder) only: the frames, the scene's URL or file, a
one-line brief, the closest existing Hummlist shot, and this file. Not the plan, not the
reasons.

The reviewer's brief: you are judging a picture someone else built. Look at it as the most
exacting product designer you know would, the one who screenshots the single wrong thing and
asks "what is this?". First question: could this be any grocery app, or is it Hummlist on
this page? Then answer every checklist item below from a frame; if a frame you need does not
exist, film it yourself. Return a ranked list (framing, hierarchy, motion, polish), each item:
what you would screenshot, which frame file shows it, the fix in one line. Rank by how much of
the picture it spoils, not by how easy it is. Do not fix, do not soften. If nothing, say
"nothing" and list the frames you looked at. Platform conventions (a real iOS status bar, the
real keyboard) are not faults; invented chrome is.

## Checklist

Framing
- One gutter; the hero bleeds off at least one edge or sits whole because the brief says so?
- Nothing with words, or that the eye needs whole, cut by the crop?
- Ground is the page: no plate behind the phone on a white or navy page?
- No empty corner, no void under a list, rows at their own pitch?
- Phone: nothing under the island, sheets below the status bar?

Hierarchy and density
- Beside the closest Hummlist shot, the one difference named? Is yours emptier, flatter, smaller?
- Real words on the subject, bars only beside it and where the crop cuts?
- Heaviest marks (yellow, sticker shadow, display type) on what the story is about?
- Member avatars in their own colours; gray discs only for filler?

Motion
- Each beat stepped and looked at: presses, ticks, sheets, handoffs, exits, the seam?
- Nothing appears without an entrance or leaves without an exit?
- Neighbours move with an insertion or removal?
- Loop ends where it began, or resets with a visible cause?

Polish and brand
- Words 12 px from edges, title/subtitle 4 to 6 px of ink apart, dots 6 px clear?
- Nothing under 10 px on the phone; nothing wrapping that should not?
- One icon style and size; no emoji icons; no hand-drawn marks?
- Tokens only: no off-palette colour, no white text on yellow, no tomato text, navy contour
  where the contrast rules require it?
- "Hummlist" spelled in full; no bee, no other brands' logos, no sparkles or purple, no
  vendor chat look-alike?

## You see, you do

| You see | You do |
| --- | --- |
| A void under a list or pane | More rows until it runs off the crop, or crop the pane; never spread rows |
| A one-line row much taller than its words | Padding 12 px (8 dense) and more rows |
| Rows spaced wider than they are tall | Tighten to the row padding; add rows |
| A phone floating whole with even margins | Bleed it off two edges with one gutter, or fill the stage |
| A tinted plate behind the device | Remove it; the page is the ground |
| Gray bars where the eye lands | Real words there; bars beside it |
| A label as words beside a value as a bar | Both words, or drop the row |
| A stat's unit on its own line | Keep number and unit together (`white-space: nowrap`), resize |
| A desktop scene shrunk into the phone column | A 358 px compact design |
| A popover or sheet that shifts while open | Pin it by the edge it opened from; reserve its height |
| An emoji where an icon belongs | The app's Material glyph; emoji stay in messages |
| An icon clipped by its box | Fit it to its viewBox or use the real glyph |
| Yellow control without contour on a light surface | Add the 2 px navy contour |
| A sparkle, wand or purple on the AI chat | Remove it; show what the AI did (the rows) |
| A row that pops in or out | Entrance and exit, the list height animating with it |
| A check you think is intentional | Look at the frame again; if it stands, say why in the notes |

## Hand-over notes

Put these in the PR body or DONE_SUMMARY, one block per scene or video:

```md
### <scene or video>
Plan: focal object, action, payoff, what was left out
Layout: <framing layout>, gutter <px>, compact 358: <how it recomposes>
Beats: 1 … 2 … 3 … payoff, loop <n> s, poster at <ms>
Captured: widths, light/dark, reduced motion, seam diff <%>, sheets <paths>
Review: <reviewer's ranked list> → <fix or why it stands>
Not checked: <what nobody watched>
```
