# Tools for the design prototypes

Run `npm ci` here first (Playwright 1.64.1 uses the Chromium already installed on the runner).

| Command | What it does |
| --- | --- |
| `node check.mjs ../option-N-x [--shots]` | Every check from the brief for one option, in Chromium behind the site CSP; `--shots` writes `../screenshots/`. Options whose tokens declare `size.target` (the Hummel Hex variants) also must pass the interaction gates: every control ≥ the target size, a visible focus ring on every tab stop that no mask, clip or overflow cuts, `.hex` faces sinking by their edge on press, nothing animating under reduced motion |
| `node contrast-review.mjs ../option-*` | axe contrast without background images, plus pixel measurement of what axe cannot decide (`CR_DEBUG=<dir>` saves crops of failures); served over http, since CSS masks don't load from file:// |
| `node build-hex-variants.mjs` | Job 41: `option-3-hummel/tokens.json` + the shared `../_tokens/hummel-hex.tokens.json` (common + `variant.sharp`/`variant.soft`) to `option-3a-hex-sharp/` and `option-3b-hex-soft/` tokens.json and tokens.css |
| `node build-hex-assets.mjs` | Job 41: the hexagon mask SVGs from each variant's `shape.hex.*`, plus both variants' pages from the single source in `hex-src/` |
| `node build-dart-widgets.mjs <out.dart> ../option-3a-hex-sharp ../option-3b-hex-soft` | Job 41: widgets-only Dart tokens (no material) for `flutter-hex-poc/` |
| `node hex-closeups.mjs ../option-3a-hex-sharp ../option-3b-hex-soft` | Job 41: rest, hover, pressed and focus close-ups of a button and a chip into `../screenshots/41/` |
| `node build-css.mjs ../option-N-x` | `tokens.json` to `tokens.css` (Style Dictionary) |
| `node build-dart.mjs ../option-N-x out.dart` | `tokens.json` to a Flutter ThemeExtension, ColorScheme and constants |
| `node build-email.mjs ../option-N-x out.html` | Invite email with inlined light-mode values |
| `node normalize-colors.mjs ../option-N-x` | Hex strings in `tokens.json` to DTCG colour objects |
| `node m3-scheme.mjs [#seed]` | The Material 3 tonal-spot roles Flutter's `ColorScheme.fromSeed` builds |
| `node summarize.mjs ../option-N-x` | Markdown token tables for `design-prototypes.md` |
| `node thumbs.mjs` | Gallery thumbnails |
| `node publish.mjs <worktree>` | Copies gallery and options to `site/public/design-prototypes/` with absolute links (Vercel cleanUrls) |
| `node preview-check.mjs <worktree>` | Serves `site/dist` like Vercel and crawls `/design-prototypes`, with axe in light and dark at 390 and 1440 on every page |

`design-prototypes.template.md` plus `summarize.mjs` output make `../../design-prototypes.md`. `BRIEF.md` is what the option builders worked from; `generators/` keeps their page generators (paths inside point at their original /tmp work dirs).
