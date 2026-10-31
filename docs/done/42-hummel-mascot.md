# Job 42: Hummel mascot directions and design language (done 2026-10-31)

Peter asked for bee variations and, ideally, a design language for the mascot, like Duolingo's Duo. With it, the bee can appear in the app, in AI-generated ads and later in animation, and stay the same character.

## What was built

- **Six directions**, each a hand-authored SVG character on token colours only:
  - **Wabe:** a hexagon cell
  - **Pummel:** a round ball
  - **Strich:** one ink line
  - **Sticker:** today's bee stood up
  - **Kulleraugen:** big expressive eyes
  - **Tropfen:** a honey drop
- **Per direction, 14 SVGs** (all ≤ 8 KB, run through svgo):
  - four expressions: neutral, "Freut sich", "Hört zu" (the voice and Alexa moment), "Winkt"
  - a four-view turnaround
  - the app icon
  - mono ink and knockout for the figure and the icon
  - a construction guide
- **Per direction, further files:**
  - `sheet.png`: a 1600 × 1000 reference sheet (turnaround, expressions, colours, icon, mono, fixed features)
  - the icon as PNG at 16, 32, 48 and 180 px
  - `LANGUAGE.md`, the design language. Its sections are construction, proportions, fixed features, colour tokens, expressions, pose rules, do and don't, and reference sheet and prompt, with an English image-generation prompt block.
- **Pages:**
  - a gallery at `/design-prototypes/mascot`, linked from the design-prototypes gallery
  - one page per direction, with `LANGUAGE.md` rendered in
- **Source:** `/workspace/hummlist/research/design-prototypes/mascot/`. `_build/` holds the generator, checker, comparison, publish step and one module per direction. Published copy: `site/public/design-prototypes/mascot/` on branch `design/42-hummel-mascot`.
- **Research and recommendation:** the "Mascot" section of `/workspace/hummlist/research/design-prototypes.md`. Screenshots are in `/workspace/hummlist/research/design-prototypes/screenshots/42/`.

## Recommendation

**Kulleraugen**, with Tropfen second.
- **Acting:** Kulleraugen acts like Duo, through lids, pupils and brows held in one table, so it is ready to rig.
- **Consistency:** a frontal round head with few fixed features keeps it the same bee in generated images.
- **Icon and dark mode:** its icon reads at 16 px, and its white edge carries it on dark.
- **Tropfen** has the most ownable silhouette and the best small icon, but less acting range.

## Preview

- https://hummlist-site-git-design-42-hummel-mascot-peter-trost.vercel.app/design-prototypes/mascot, behind Vercel Authentication.
- Vercel status for `hummlist-site` on the commit: "Deployment has completed". The alias answers with a 302 to the Vercel login, and a made-up alias returns 404.
- No PR and no merge. Main is untouched.

## How to verify

```sh
cd /workspace/hummlist/research/design-prototypes/mascot/_build
npm ci   # first time
node build.mjs                      # all SVGs, PNGs, pages
node check.mjs [--shots]            # SVG lint, files, LANGUAGE.md, axe/CSP/overflow on 7 pages x 4
node compare.mjs                    # lineup and icon comparison PNGs
node publish.mjs ~/fg-wt/42-hummel-mascot
cd ~/fg-wt/42-hummel-mascot/site && npm run build
node /workspace/hummlist/research/design-prototypes/_tools/preview-check.mjs ~/fg-wt/42-hummel-mascot
```

## Results

- **`check.mjs`:**
  - 84 SVGs pass. Every colour is a Hummel token, the largest file is 6.0 KB, and none has raster content, styles or scripts.
  - 6 of 6 LANGUAGE.md files pass.
  - 28 page renderings pass (390 and 1440 px, light and dark), with 0 axe WCAG 2.1 AA violations, no CSP or request errors, no broken images and no horizontal scroll.
- **Site build and preview crawl:** the build passes, and the preview-check crawl loads 19 of 19 pages cleanly.
- **gitleaks:** no leaks on the published folder or the commit.
- **Legibility:** checked by eye on the comparison PNGs.
  - On dark, every figure reads after the white-edge round.
  - At 16 px, Tropfen, Kulleraugen and Pummel still read as bees, and Wabe and Sticker as faces.
  - Strich reads only from 32 px.

## Missing or blocked

- **Footer site test:** `site/test/consistency.test.mjs` fails one test because the prototype pages have no legal footer. This is job 36's known gap, and CI doesn't run on design branches.
- **Preview content:** I couldn't view it behind Vercel Authentication, because there is no Vercel token here. The local crawl emulates Vercel's routing and CSP.
- **Peter decides:** the direction (or a mix), and whether the app icon changes.
