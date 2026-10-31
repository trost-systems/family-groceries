# Job 46: Hex Weich (3b) in art styles, plus a merge with Frische (5) (2026-10-31)

This is a design job. The branch `design/46-hex-art-styles` is built on `design/41-hummel-hex` (`83ae14d`). It is a preview only. There is no PR, nothing was merged, main is untouched, and the app code is unchanged.

## Pages

The preview sits behind Vercel Authentication. Sign in with the Vercel account first. A 302 to the login is expected.

| Page | Style | Homepage | Token sheet |
| --- | --- | --- | --- |
| Gallery | All options with thumbnails, new section "Hex Weich in anderen Kunststilen" | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes | |
| 3c Raster | Flat editorial / Swiss | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3c-raster | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3c-raster/tokens-sheet) |
| 3d Riso | Risograph, two inks overprinted | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3d-riso | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3d-riso/tokens-sheet) |
| 3e Papierschnitt | Layered paper-cut | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3e-papierschnitt | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3e-papierschnitt/tokens-sheet) |
| 3f Glas | Translucent glass hex layers | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3f-glas | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3f-glas/tokens-sheet) |
| 3g Marker | Hand-drawn ink outline, marker fills | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3g-marker | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-3g-marker/tokens-sheet) |
| 6 Hex Frische | 3b × 5 merge | https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-6-hex-frische | [tokens-sheet](https://hummlist-site-git-design-46-hex-art-styles-peter-trost.vercel.app/design-prototypes/option-6-hex-frische/tokens-sheet) |

**Contact sheet:** `design-prototypes/screenshots/46/contact-sheet.png`, with a copy in `/workspace/hummlist/research/design-prototypes/screenshots/46/`. It shows the same screen for 3b, 5 and the six new pages: the top of the homepage on a phone in light and dark, and on desktop.

## The styles

Every page keeps 3b's structure, sections and app mock, and its soft-cornered hexagon on every control (buttons, chips, check boxes, avatars, badges). The tactile press, the 48 px targets and the focus rings stay too. There is no bee: each page has its own hex mark and hex motif.

- **3c Raster.** Paper, ink and honey as the only signal colour. A six-column hairline grid shows behind the page. Sections are numbered large (01 to 04). The type is Inter Tight 800 up to 7.5rem with tight tracking, over Inter. The buttons are flat hex slabs with a 4 px ink edge, and the phone stands on one big honey field.
- **3d Riso.** Blue ink carries the text, outlines and edges, and yellow ink is printed 3 to 10 px off register. Where the two overlap they print green, which is the "done" colour. It has paper and ink grain, halftone fields, Space Grotesk over IBM Plex Sans, and navy stock in dark mode.
- **3e Papierschnitt.** Everything is cut from card and stacked, with soft shadows lit from the top left. The hero is a paper landscape of hexagons. Buttons are two sheets of paper. Headlines are Fraunces with its SOFT and WONK axes, over Figtree. Dark mode is dusk card stock with a honey hexagon moon.
- **3f Glas.** Frosted hex panes over calm honey, violet and mint glows. The phone is a glass slab and the header a glass capsule. Type is Outfit over Figtree. Dark mode is the showcase. Under `prefers-reduced-transparency` everything turns solid.
- **3g Marker.** Fineliner outlines that wobble and double, over marker fills in honey, mint and lavender that sit a little off the line. The paper is a sketchbook dot grid, and the flight lines are pen arrows. Headlines are in Caveat, text stays in Nunito. Dark mode is graphite paper with white ink.
- **6 Hex Frische (merge).** 3b's hex controls with a navy contour and edge, on option 5's big rounded colour blocks. Mint is the main block colour, lemon is for buttons and one block, cobalt is for text and one block. Lemon and cobalt never meet as big fields, and tomato red is not used, so there is no discount-supermarket look. Type is Bricolage Grotesque 800 over Inter.

I used the five suggested styles and swapped none. Each came out distinct, and together they run from flat to dimensional and from precise to handmade.

## My ranking, as a brand for Hummlist

1. **6 Hex Frische.** The most market-ready. It keeps 3b's clear hex controls and adds 5's confidence, and it reads fresh rather than loud. Weak spots: the dark-mode feature blocks are calmer, navy cards with coloured rims, and the white privacy section looks a little empty next to the colour blocks.
2. **3c Raster.** The most grown-up. The honey hexagon carries the brand on its own, and the system would carry over to the app almost one to one. It is cooler and less playful than 3b, and on desktop the hero leaves a deliberate empty corner.
3. **3d Riso.** The most ownable and characterful. The off-register hexagon is memorable. It leans "indie zine" more than "everyday family tool".
4. **3e Papierschnitt.** Warm and crafted, and strong for marketing and illustration. In small UI, shadows instead of outlines carry the edges, which is harder to bring into the app, and the light paper texture is a little busy.
5. **3g Marker.** Charming and distinctive in light mode. Dark mode is muddier, and hand-drawn controls are the hardest to turn into an app.
6. **3f Glas.** Premium in dark mode. In light mode it is elegant but quiet and the least ownable. The blur costs rendering time on mid-range phones.

## How it is built

- `design-prototypes/_tools/build-art-styles.mjs` generates each page from `_tools/art-styles/<folder>/`. That folder holds `style.json` (label and token-sheet prose), a partial `tokens.json` merged over 3b's, a `style.css` appended to 3b's stylesheet, `assets/` and `fonts/`. The token sheet's swatches, contrast pairs, fonts, type ramp, radii and border note are generated from the merged tokens.
- Each style's `make-assets.mjs` regenerates its SVGs. Rerunning each one reproduced the committed files byte for byte.
- 3b's shared helpers moved into `_tools/hex-render.mjs`. Rebuilding 3a and 3b afterwards left their files byte-identical, and `check-token-drift.sh` passes.
- `_tools/contact-sheet.mjs` builds the contact sheet. `check.mjs --out <dir>` writes screenshots to a folder of your choice, and `thumbs.mjs [option…]` builds only the named thumbnails.
- Six subagents built the six styles in parallel, each from `_tools/art-styles/BRIEF.md`. I reviewed each one, rebuilt all of them from source, and reran every check myself.

## Verification (on the final tree)

| Check | Result |
| --- | --- |
| `check.mjs` on the six new pages and 3b, both pages, 390 and 1440, light and dark: token contrast pairs, static rules, CSP, fonts, overflow, axe, 48 px targets, focus rings, press depth, reduced motion | All 7 pass, run in parallel |
| `contrast-review.mjs` on the six new pages and 3b | 0 failures in 56 runs. The lowest median is 4.96:1, on Marker's lavender chip in dark mode. |
| `publish.mjs`, then `site npm run build`, then `preview-check.mjs` | Build OK. 28 of 28 pages under `/design-prototypes` load cleanly behind the CSP, axe-clean in light and dark at 390 and 1440. |
| `site npm test` | 52 of 52 pass |
| `check-token-drift.sh` (3a and 3b) | Outputs match |
| gitleaks (pre-commit and `gitleaks detect`) | No leaks |
| Folder size | 280 to 436 KB per page, under the 1.5 MB limit |

Screenshots are in `design-prototypes/screenshots/46/`: 48 full pages (homepage and token sheet × 390 and 1440 × light and dark for each of the six pages) and `contact-sheet.png`. They are 256-colour PNGs, because the grain textures made them up to 10 MB each.

## Fixes to shared tools

- **`contrast-review.mjs` turns transitions off.** Measuring a parent element set its colour to transparent, and a colour transition then gave the child the half-faded value. That produced false 1.00:1 failures on `.store-count > b`. I reproduced it with 8 failures before the fix and 0 after.
- **`check.mjs` polls the press depth for up to 1 s.** It used to read it once after 150 ms, and the blur-heavy Glas page sometimes needed more frames. A face that never sinks still fails.

## Known gaps

- I have not seen the preview behind Vercel Authentication from this box, because there is no Vercel token here. As in jobs 36 and 41, the local crawl (same routing and CSP) stands in for it.
- The email and store-image mock-ups on the token sheets can only suggest effects such as glass blur and paper shadows, which mail clients and static store images don't render.
