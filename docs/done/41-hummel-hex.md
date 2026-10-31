# Job 41: Hummel Hex variants and the Flutter widgets-only PoC (2026-10-31)

Design job. The branch is `design/41-hummel-hex`, built on job 36's `design/36-prototypes`. It is preview only. There is no PR, nothing was merged, and main is untouched. The mascot is unchanged, because job 42 owns it.

## What was built

- **Two web variants of option 3 (Hummel):**
  - `option-3a-hex-sharp` has pointed hex corners. `option-3b-hex-soft` rounds them with an 8 px radius at 48 px height.
  - Each has a homepage and a token sheet (app list mock, invite email, Alexa card).
  - Hexagons replace every pill: buttons, store badges, chips, tabs, counters, avatars and check boxes.
  - Buttons are tactile, PostHog style: a 6 px edge, a 2 px lift on hover, and on press the face sinks fully into the edge. Under reduced motion the states switch instantly.
  - The pages have more dotted bee-flight lines.
  - Every target is at least 48 px.
  - The focus ring is drawn on the unmasked control, so it is never clipped.
- **Gallery:** a "Hummel Hex" section shows option 3, 3a and 3b side by side.
- **Tokens:**
  - The shared DTCG file is `design-prototypes/_tokens/hummel-hex.tokens.json`. It holds the common tokens plus `variant.sharp` and `variant.soft`, and only `shape.hex.corner-radius` differs between them.
  - `build-hex-variants.mjs` writes each variant's tokens.json, and Style Dictionary builds the tokens.css.
  - `build-hex-assets.mjs` builds the mask SVGs and both pages from one source.
  - `build-dart-widgets.mjs` builds the Flutter tokens.
- **Flutter PoC:** `design-prototypes/flutter-hex-poc/` is a design system on `package:flutter/widgets.dart` only, and it is not wired into `app/`.
  - Components: HexTheme (InheritedWidget), HexBorder, HexButton (sharp and soft, tactile), HexChip, ListRow, HexAvatar and HexBadge.
  - It has 97 widget and golden tests. Its README states what Flutter 3.47.8 offers about the Material/Cupertino split, with sources: `material_ui` and `cupertino_ui` are published as opt-in packages, the SDK libraries are not deprecated yet, and there is no RawButton.
- **Widgetbook catalog** (the addendum of 2026-10-31 13:43): `design-prototypes/flutter-hex-poc/widgetbook/` is a sibling package on Widgetbook 4.0.0-beta.14, pinned exactly. It depends on the PoC by path, and the PoC never depends on it.
  - Generated v4 stories for HexButton (Primary, Secondary, Quiet), HexChip, ListRow and a Gallery.
  - Args for label, shape (sharp or soft), kind, size, enabled, icon and interaction. Fixed-arg scenarios for default, hover, focus, pressed, disabled and with icon.
  - Addons for theme (Sharp/Soft × Light/Dark), text scale and viewport (iPhone 13, Galaxy S20).
  - The `testWidgetbook` suite runs 176 scenarios. Each one also passes Flutter's tap-target and contrast guidelines.
  - HexButton gained an optional `icon`. A teardown crash in `Pressable` turned up and is fixed (PoC tests 99/99).
  - The static web build is `design-prototypes/widgetbook/`, published at `/design-prototypes/widgetbook` and linked from the gallery. `_tools/build-widgetbook.sh` rebuilds it, and `_tools/widgetbook-shots.mjs` takes the screenshots. CanvasKit and the fonts are served from the same origin, and Widgetbook's telemetry is off.
- **Checks:**
  - `check.mjs` gains interaction gates: 48 px targets, an unclipped visible focus ring on every tab stop, press depth equal to the edge, and no animation under reduced motion.
  - `contrast-review.mjs` now serves over http, because masks don't load from file://.
  - `preview-check.mjs` runs axe on every published page.
- **Write-up:** the "Hummel Hex" section in `/workspace/hummlist/research/design-prototypes.md` has the screenshots, the token diff, the Flutter findings and the recommendation (Soft).

## How to verify

- Preview (Vercel login): https://hummlist-site-git-design-41-hummel-hex-peter-trost.vercel.app/design-prototypes, plus `/option-3a-hex-sharp`, `/option-3b-hex-soft`, each one's `/tokens-sheet`, and the catalog at `/widgetbook`.
- Run `cd design-prototypes/flutter-hex-poc/widgetbook && flutter test`, or `design-prototypes/_tools/build-widgetbook.sh` to rebuild and republish the catalog.
- Run `cd design-prototypes/_tools && npm ci`. Then run `node check.mjs ../option-3a-hex-sharp` and the same for 3b, and `node contrast-review.mjs ../option-3a-hex-sharp ../option-3b-hex-soft`.
- Run `node publish.mjs <worktree>`, then `cd site && npm run build`, then `node preview-check.mjs <worktree>`.
- Run `cd design-prototypes/flutter-hex-poc && flutter analyze && flutter test`.

## Results

| Check | Result |
| --- | --- |
| `check.mjs`, both variants, 390 and 1440, light and dark | Pass. axe has 0 violations. The new interaction gates pass, and each gate was shown to fail on a real defect. |
| `contrast-review.mjs` | 0 failures in 16 runs. The lowest median is 5.42:1. |
| Site build and `preview-check.mjs` with axe | 16 of 16 pages are clean, the Widgetbook catalog included. Each page is served with the CSP its `site/vercel.json` rule sets; the catalog must load CanvasKit from its own folder, with no off-origin request. |
| Flutter PoC | `flutter analyze` is clean (flutter_agent_lints experimental). `flutter test` passes 99 of 99. |
| Widgetbook catalog | `flutter analyze` is clean. `flutter test` passes 177 of 177 (176 `testWidgetbook` scenarios). |
| Site tests (`npm test`) | 52 of 52 pass. The footer test now skips the prototype mock-ups. |
| Token drift (`_tools/check-token-drift.sh`) | Outputs match the shared token file. A test edit to `depth.edge-l` made it fail. |
| gitleaks | No leaks. |
| Vercel `hummlist-site` on `32ecb63` | "Deployment has completed". The alias redirects (302) to the login. |

Screenshots are in `design-prototypes/screenshots/41/`: 16 full pages, 32 state close-ups, the gallery, the Flutter goldens in `flutter/`, and 13 catalog shots in `widgetbook/` (button in Sharp and Soft, light and dark, pressed, focus, iPhone and Galaxy frames, text ×2, chip, list row, gallery).

## Review 0 fixes

- Everything is committed and pushed. The source tree is under `design-prototypes/` and the published copy is under `site/public/design-prototypes/`.
- The shared token file is in the repo, and the PoC's `tokens.g.dart` regenerates from it. The PoC had stale 4 px depth values, which were regenerated and the goldens updated.
- The gallery is updated.
- The PoC README is written, with the Flutter findings.
- The screenshots are committed.
- The research section and this summary are written.
- The gates ran on the published tree, and the "needs review" contrast nodes are resolved by the pixel pass.
- The state close-up script now waits for the pressed frame. Before, the pressed shots matched the rest shots.

## Review 1 fixes

- The Widgetbook addendum was missing from the build prompt. It is now done (above), with decisions 9 and 10 in `docs/DECISIONS.md` (the v4 prerelease pins and the hosting changes).
- Nice-to-haves done: the inherited footer test failure is scoped away, the README states that the goldens are Linux-only, and the token drift check exists.

## Hosting changes (design branch only)

- `site/vercel.json` gives `/design-prototypes/widgetbook` its own CSP (WebAssembly and inline styles allowed, `connect-src 'self'`). The site-wide strict CSP excludes that path. No Vercel project setting changed.
- `site/build.mjs` allows same-folder `<script src>` in that folder only.

## Known gaps

- Nobody has seen the preview behind Vercel Authentication from this box, because there is no Vercel token here. The local crawl stands in for it, as in job 36.
- The goldens were generated on Linux.
