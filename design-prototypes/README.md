# Design prototypes (source)

The source tree behind `site/public/design-prototypes/`, on the design branches only. It is not for main. Job 36 built options 1 to 5 in `/workspace/hummlist/research/design-prototypes/`. Job 41 committed that tree here so the token pipeline reruns from the branch:

- `_tokens/hummel-hex.tokens.json` is the shared DTCG file for the Hummel Hex variants. It holds the common hex, depth and motion tokens, and `variant.sharp` / `variant.soft`.
- `_tools/` has the Style Dictionary builds, the generators and the checks (`_tools/README.md`).
- `option-*/` are the pages with relative links. `node _tools/publish.mjs <worktree>` copies them to `site/public/design-prototypes/` with the absolute links Vercel needs.
- `flutter-hex-poc/` is the Flutter proof of concept on `widgets.dart` only (its README). Its `widgetbook/` package is a Widgetbook catalog of it; `widgetbook/` here is that catalog's web build (`_tools/build-widgetbook.sh`), published at `/design-prototypes/widgetbook`.
- `screenshots/41/` holds job 41's screenshots: full pages, state close-ups, the gallery, `flutter/` goldens and `widgetbook/` catalog shots.
- Job 46 added Hex Weich (3b) in five art styles and a merge with Frische (5): `option-3c-raster`, `option-3d-riso`, `option-3e-papierschnitt`, `option-3f-glas`, `option-3g-marker`, `option-6-hex-frische`. Their sources are `_tools/art-styles/<folder>/`; `node _tools/build-art-styles.mjs` regenerates the pages. `screenshots/46/` holds every page (homepage and token sheet, 390 and 1440, light and dark) and `contact-sheet.png`.
