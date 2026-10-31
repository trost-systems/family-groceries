# Tools for the design prototypes

Run `npm ci` here first (Playwright 1.64.1 uses the Chromium already installed on the runner).

| Command | What it does |
| --- | --- |
| `node check.mjs ../option-N-x [--shots [--out <dir>]]` | Every check from the brief for one option, in Chromium behind the site CSP; `--shots` writes `../screenshots/` (or `<dir>`). Options whose tokens declare `size.target` (the Hummel Hex variants) also must pass the interaction gates: every control ≥ the target size, a visible focus ring on every tab stop that no mask, clip or overflow cuts, `.hex` faces sinking by their edge on press, nothing animating under reduced motion |
| `node contrast-review.mjs ../option-*` | axe contrast without background images, plus pixel measurement of what axe cannot decide (`CR_DEBUG=<dir>` saves crops of failures); served over http, since CSS masks don't load from file:// |
| `node build-hex-variants.mjs` | Job 41: `option-3-hummel/tokens.json` + the shared `../_tokens/hummel-hex.tokens.json` (common + `variant.sharp`/`variant.soft`) to `option-3a-hex-sharp/` and `option-3b-hex-soft/` tokens.json and tokens.css |
| `node build-hex-assets.mjs` | Job 41: the hexagon mask SVGs from each variant's `shape.hex.*`, plus both variants' pages from the single source in `hex-src/` |
| `node build-dart-widgets.mjs <out.dart> ../option-3a-hex-sharp ../option-3b-hex-soft` | Job 41: widgets-only Dart tokens (no material) for `flutter-hex-poc/` |
| `./check-token-drift.sh` | Job 41: regenerates every Hummel Hex token output in a temp copy and fails if a committed file differs (variant tokens.json/css, mask SVGs, pages, the PoC's `tokens.g.dart`) |
| `node hex-closeups.mjs ../option-3a-hex-sharp ../option-3b-hex-soft` | Job 41: rest, hover, pressed and focus close-ups of a button and a chip into `../screenshots/41/` |
| `node build-art-styles.mjs [option-…]` | Job 46: each folder in `art-styles/` (style.json, partial tokens.json, style.css, assets/, fonts/) becomes a page at `../<folder>`: 3b's markup and stylesheet plus the style's CSS, 3b's tokens merged with the style's, a token sheet whose swatches, contrast pairs, fonts, type ramp and radii come from the merged tokens. The bee is replaced by the style's `motif.svg` and `mark.svg`. Each style's `make-assets.mjs` regenerates its SVGs; `art-styles/BRIEF.md` is the brief the style builders worked from |
| `node contact-sheet.mjs [--title <text>] [--job <n>] <out.png> <option-…>` | Job 46: one labelled PNG, the top of each homepage on a phone (light, dark) and on desktop, one column per option; `--title` and `--job` set the heading and the job number (default job 46's) |
| `node build-css.mjs ../option-N-x` | `tokens.json` to `tokens.css` (Style Dictionary) |
| `node build-dart.mjs ../option-N-x out.dart` | `tokens.json` to a Flutter ThemeExtension, ColorScheme and constants |
| `node build-email.mjs ../option-N-x out.html` | Invite email with inlined light-mode values |
| `node normalize-colors.mjs ../option-N-x` | Hex strings in `tokens.json` to DTCG colour objects |
| `node m3-scheme.mjs [#seed]` | The Material 3 tonal-spot roles Flutter's `ColorScheme.fromSeed` builds |
| `node summarize.mjs ../option-N-x` | Markdown token tables for `design-prototypes.md` |
| `node thumbs.mjs [option-…]` | Gallery thumbnails (all options, or the ones named) |
| `bash build-widgetbook.sh` | Job 41: regenerates the Widgetbook stories, runs analyze and tests in `flutter-hex-poc/` and its `widgetbook/`, and writes the web build (base href `/design-prototypes/widgetbook/`, engine and fonts local) to `../widgetbook/` |
| `node app-icon/build.mjs` | Job 45: `app-icon/variations.mjs` (every icon as layers of filled paths with colour roles and a monochrome rule) to `../app-icon/`: the sprite sheet (SVG + PNG), the top picks' Icon Composer groups, visionOS layers, Android adaptive icon (vector drawables, PNGs, legacy mipmaps, Play 512), previews and the page. Job 48: `ORIGINAL5` in `variations.mjs` adds the three favourites in option 5's original colours (5o, 13o, 14o), sharing the originals' layers by reference; `allowLidlLike` lifts the not-Lidl colour guard for those records only. Every favourite gets six Apple previews (light, dark, clear and tinted, each light and dark) and real-pixel renders at 29 pt, 48 dp and 16 px |
| `node app-icon/check.mjs` | Job 45: checks the built files: sizes, opaque visionOS back, foreground inside Android's 66 dp circle (on the PNG), each vector drawable rendered back and compared with its PNG, one-colour monochrome, at most 4 Icon Composer groups, no "Humm" alone |
| `node app-icon/shots.mjs <worktree> [45\|48]` | Job 45: screenshots of the published app icon page into `../screenshots/45/`; with `48`, the section "Peter's favorites in original 5 colors" and its rows into `../screenshots/48/` |
| `node publish.mjs <worktree>` | Copies gallery, options, `app-icon/` and `widgetbook/` to `site/public/design-prototypes/` with absolute links (Vercel cleanUrls); the Flutter build is copied as built |
| `node preview-check.mjs <worktree>` | Serves `site/dist` like Vercel, each path with its own CSP (`serve-dist.mjs`), and crawls `/design-prototypes`, with axe in light and dark at 390 and 1440 on every page, and every linked file must answer 200; the Widgetbook must also load CanvasKit from its own folder |
| `node widgetbook-shots.mjs <worktree>` | Job 41: Widgetbook screenshots (stories, scenarios, themes, device frames) from `site/dist` into `../screenshots/41/widgetbook/`; fails on any failed, off-origin or CSP-blocked load |

`design-prototypes.template.md` plus `summarize.mjs` output make `../../design-prototypes.md`. `BRIEF.md` is what the option builders worked from; `generators/` keeps their page generators (paths inside point at their original /tmp work dirs).
