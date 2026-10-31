# Design prototypes (source)

The source tree behind `site/public/design-prototypes/`, on the design branches only. It is not for main. Job 36 built options 1 to 5 in `/workspace/hummlist/research/design-prototypes/`. Job 41 committed that tree here so the token pipeline reruns from the branch:

- `_tokens/hummel-hex.tokens.json` is the shared DTCG file for the Hummel Hex variants. It holds the common hex, depth and motion tokens, and `variant.sharp` / `variant.soft`.
- `_tools/` has the Style Dictionary builds, the generators and the checks (`_tools/README.md`).
- `option-*/` are the pages with relative links. `node _tools/publish.mjs <worktree>` copies them to `site/public/design-prototypes/` with the absolute links Vercel needs.
- `flutter-hex-poc/` is the Flutter proof of concept on `widgets.dart` only (its README).
- `screenshots/41/` holds job 41's screenshots: full pages, state close-ups, the gallery, and `flutter/` goldens.
