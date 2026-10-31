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
- **Checks:**
  - `check.mjs` gains interaction gates: 48 px targets, an unclipped visible focus ring on every tab stop, press depth equal to the edge, and no animation under reduced motion.
  - `contrast-review.mjs` now serves over http, because masks don't load from file://.
  - `preview-check.mjs` runs axe on every published page.
- **Write-up:** the "Hummel Hex" section in `/workspace/hummlist/research/design-prototypes.md` has the screenshots, the token diff, the Flutter findings and the recommendation (Soft).

## How to verify

- Preview (Vercel login): https://hummlist-site-git-design-41-hummel-hex-peter-trost.vercel.app/design-prototypes, plus `/option-3a-hex-sharp`, `/option-3b-hex-soft` and each one's `/tokens-sheet`.
- Run `cd design-prototypes/_tools && npm ci`. Then run `node check.mjs ../option-3a-hex-sharp` and the same for 3b, and `node contrast-review.mjs ../option-3a-hex-sharp ../option-3b-hex-soft`.
- Run `node publish.mjs <worktree>`, then `cd site && npm run build`, then `node preview-check.mjs <worktree>`.
- Run `cd design-prototypes/flutter-hex-poc && flutter analyze && flutter test`.

## Results

| Check | Result |
| --- | --- |
| `check.mjs`, both variants, 390 and 1440, light and dark | Pass. axe has 0 violations. The new interaction gates pass, and each gate was shown to fail on a real defect. |
| `contrast-review.mjs` | 0 failures in 16 runs. The lowest median is 5.42:1. |
| Site build and `preview-check.mjs` with axe | 15 of 15 pages are clean. |
| Flutter | `flutter analyze` is clean (flutter_agent_lints experimental). `flutter test` passes 97 of 97. |
| gitleaks | No leaks. |
| Vercel `hummlist-site` on `32ecb63` | "Deployment has completed". The alias redirects (302) to the login. |

Screenshots are in `design-prototypes/screenshots/41/`: 16 full pages, 32 state close-ups, the gallery, and the Flutter goldens in `flutter/`.

## Review 0 fixes

- Everything is committed and pushed. The source tree is under `design-prototypes/` and the published copy is under `site/public/design-prototypes/`.
- The shared token file is in the repo, and the PoC's `tokens.g.dart` regenerates from it. The PoC had stale 4 px depth values, which were regenerated and the goldens updated.
- The gallery is updated.
- The PoC README is written, with the Flutter findings.
- The screenshots are committed.
- The research section and this summary are written.
- The gates ran on the published tree, and the "needs review" contrast nodes are resolved by the pixel pass.
- The state close-up script now waits for the pressed frame. Before, the pressed shots matched the rest shots.

## Known gaps

- Nobody has seen the preview behind Vercel Authentication from this box, because there is no Vercel token here. The local crawl stands in for it, as in job 36.
- `site/test/consistency.test.mjs` still fails on the prototype footers (`#` links). This is inherited from job 36. CI doesn't run on design branches.
- The goldens were generated on Linux.
