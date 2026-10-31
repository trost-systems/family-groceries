# Job 45: app icon research, sprite sheet and layered top 3 (2026-10-31)

Design job, preview only. The branch is `design/45-app-icon`, built on `design/41-hummel-hex`
(job 46 was not done when this job started). There is no PR, nothing was merged, main is
untouched, and nothing went to a store.

## Preview

- Page (Vercel login): https://hummlist-site-git-design-45-app-icon-peter-trost.vercel.app/design-prototypes/app-icon
- Linked from the gallery: https://hummlist-site-git-design-45-app-icon-peter-trost.vercel.app/design-prototypes
- Vercel `hummlist-site` on `781fdaa`: "Deployment has completed". The alias answers 302 to
  the login, as expected. Nobody has looked behind the login from the runner (no Vercel token);
  the local Vercel-routing crawl stands in for it.

## What was built

- **Research:** `research/app-icon.md` (also `/workspace/hummlist/research/app-icon.md`). It
  has a spec table per platform, and every claim links an official page. All 26 links answered
  200 on 2026-10-31. Key points:
  - **Icon Composer** makes one `.icon` file for iOS, iPadOS, macOS and watchOS. It has a
    background fill plus layers in at most 4 groups, from a 1024 px source (1088 px for watchOS,
    round). You design three appearances (Default, Dark, Mono), and the system derives six from
    them: default, dark, clear light and dark, tinted light and dark. Layers should be flat SVG.
    The system adds the glass, highlights and shadows.
    Sources: [HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons),
    [Icon Composer doc](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer),
    [WWDC25 361](https://developer.apple.com/videos/play/wwdc2025/361/).
  - **visionOS** takes a background and one or two layers on top, 1024 px each, masked to a
    circle, with the content centred.
    Sources: [Configuring your app icon](https://developer.apple.com/documentation/xcode/configuring-your-app-icon),
    [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10076/).
  - **Android adaptive icons** have foreground, background and an optional monochrome layer.
    Each layer is 108 dp, 72 dp of it shows, and the 66 dp safe circle is never clipped. Themed
    icons came with Android 13.
    Sources: [Adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive),
    [AdaptiveIconDrawable](https://developer.android.com/reference/android/graphics/drawable/AdaptiveIconDrawable).
  - **Android 16 QPR2** themes icons without a monochrome layer automatically, and users pick
    the icon shape. Source: [release notes](https://developer.android.com/about/versions/16/qpr2/release-notes).
  - **Google Play** takes a 512 px PNG as a full square and applies its own 30 % rounding and
    shadow. Source: [Play icon spec](https://developer.android.com/distribute/google-play/resources/icon-design-specifications).
  - **Not confirmed from an official source** (listed in the research doc):
    - that visionOS layers must be PNG and the back layer opaque (we deliver it opaque anyway)
    - the `.solidimagestack` format
    - the word "parallax" for visionOS (Apple says the icon expands and gains depth)
    - which shapes Android 16 users can pick, and whether they are Material 3 Expressive shapes
    - any Android 17 icon change
    - 29 pt and 16 px as current Apple sizes (we kept them as the legibility test)
- **Sprite sheet:** `design-prototypes/app-icon/sprite-sheet.png` (1420 × 1350) and `.svg`.
  It has 16 variations: 8 from 3b Hex Soft (1 to 8), 6 from 5 Frische (9 to 13, 15) and 2 that
  merge 3b and 5 (14, 16). Each cell shows the icon at 180 px in light and 72 px in dark, plus
  the real 29 px and 16 px renders. None has a bee figure. The motifs are hexagon, letter H,
  check, list, speech bubble, bee stripes, the dotted flight path and colour blocks.
- **Top 3**, each in `design-prototypes/app-icon/top/<n>-<name>/`:
  - **5 Wabenstapel.** The only one whose layers are the idea itself: a honey hex ring, then a
    cream hex with the check, so glass and visionOS give each its own depth. The 3b violet keeps
    it apart on any home screen, and at 16 px it still reads as a ring with a dot.
  - **14 Frische Wabe.** The 3b × 5 merge at its clearest: the hexagon as the brand mark and the
    Frische colours as the mood. Cobalt on mint is far from discounter blue/yellow/red, and the
    cut-out check holds at 16 px.
  - **13 Kachelstapel.** The strongest pure Frische idea. Two tilted tiles say "you share one
    list" with no word or figure. The front tile floats over the back one, which suits glass
    and visionOS. Navy keeps the mint and white calm.
  - Each one has:
    - `icon-composer/`: one folder per group, one SVG per layer, `background.svg`, and a README
      with steps and the Default, Dark and Mono fill for every layer.
    - `visionos/`: `back.png` (opaque), `middle.png` and `front.png` (transparent), all
      1024 px, plus SVGs.
    - `android/res/drawable/ic_launcher_{foreground,background,monochrome}.xml` (108 dp vector
      drawables) and `mipmap-anydpi-v26/ic_launcher.xml`.
    - Android PNGs at 432 px, legacy `mipmap-*/ic_launcher.png` from 48 to 192 px, and
      `play-store-512.png`.
    - `previews/`: Apple light, dark, clear and tinted (SVG and PNG), Android circle, squircle,
      rounded square and cookie, and Material You themed light and dark.
- **Page** `design-prototypes/app-icon/index.html`, German, du-form. It embeds the sprite sheet
  and shows each pick:
  - Apple light, dark, clear and tinted on wallpapers
  - a visionOS stack of three layers with a CSS 3D tilt (still under reduced motion) and the
    layers laid out side by side
  - four Android masks
  - Material You themed icons
  - the download links and the spec table
  The page has no scripts. The site CSP stays unchanged.
- **Tools** `design-prototypes/_tools/app-icon/`:
  - `variations.mjs` holds the data, and `geom.mjs` the shapes, as path data plus flattened
    outlines.
  - `render.mjs` turns them into SVG, vector drawables, monochrome and previews.
  - `build.mjs` and `page.mjs` write the outputs. `check.mjs` checks them, and `shots.mjs`
    takes the screenshots.
  - Decisions 1 to 10 for job 45 are in `docs/DECISIONS.md`.

## How to verify

    cd design-prototypes/_tools && npm ci
    node app-icon/build.mjs && node app-icon/check.mjs
    node publish.mjs <worktree> && (cd ../../site && npm run build && npm test)
    node preview-check.mjs <worktree>
    node app-icon/shots.mjs <worktree>

## Results

| Check | Result |
| --- | --- |
| Data guards in `build.mjs` (66 dp safe circle, not-Lidl colours, "Humm" alone) | Pass for all 16. The colour rule caught violet as "blue" at first; the blue band was narrowed to 200–245°. |
| `app-icon/check.mjs` | Pass. It checks PNG sizes, the opaque visionOS back, the foreground pixels inside 66 dp, each vector drawable rendered back against its PNG (under 0.2 % of pixels off), a one-colour monochrome layer and at most 4 groups. Each gate was shown to fail on a planted defect: a recoloured XML path, one pixel outside the circle, a translucent back pixel, a second colour in mono and "Humm" in a README. |
| `site npm run build` | Pass |
| `site npm test` | 52 of 52 |
| `preview-check.mjs` | 18 pages and 38 linked files are clean behind the CSP. axe found no violations in light and dark at 390 and 1440. |
| gitleaks | No leaks (full tree and the commit) |

Screenshots are in `design-prototypes/screenshots/45/`:
- the full page, mobile and desktop, light and dark
- each pick's section in the same four views
- the gallery with the new link

## Missing or blocked

- **No `.icon` file.** Apple does not document the format, and Icon Composer needs a Mac. The
  SVG groups and the README make assembly a 10-minute job (NEEDS_PETER).
- **Clear, tinted and themed views are approximations** built from our monochrome shape, and
  the page says so. The Mono fills for marks (black at 60 %) are a starting point to tune in
  Icon Composer.
- **The vector drawables were not compiled by aapt2** (no Android SDK on the runner). They use
  only `<vector>`, `<group translate>` and `<path fillColor/fillType/pathData>` with M, L, A
  and Z commands, and they render the same as their PNGs.
- **No job 46 art styles,** because job 46 had not finished. If Peter likes one, its icon
  variants can be added in `variations.mjs` and rebuilt.
