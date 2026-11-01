# Job 52: the design system (6b Hex Frische, option 6's yellow) in the app, app icon #5

The app now looks like 6b Hex Frische with option 6's brighter dark-mode yellow, as Peter locked
it on 2026-10-31. Screens keep their widgets, keys, strings and flows. The public changelog note
waits behind the hold `new-design` until Peter has looked at the build in TestFlight.
References: [DESIGN.md](../DESIGN.md) (tokens, contrast, components, Widgetbook, icon pipeline),
[DECISIONS.md](../DECISIONS.md) "Job 52", [NEEDS_PETER.md](../NEEDS_PETER.md) "Job 52". PR #156.

## What was built

- **One token source** `design/tokens/hummlist.tokens.json`: 6b's tokens, with dark `honey`
  `#ffe24a` and dark `honey-edge` `#b39b1a` from option 6. In light mode 6 and 6b already used
  the same lemon, so the change is dark mode only. `node design/tokens/build.mjs` writes
  `app/lib/design/tokens.g.dart` and `site/public/tokens.css` (6b's `--hl-*` names, for job 53).
  `--check` runs in the lint gate.
- **Theme** `appTheme` (`app/lib/app/theme.dart`): a Material 3 colour scheme for light and dark
  from the tokens, Bricolage Grotesque over Inter (bundled static TTFs with their OFL texts, on
  the licence page), and component themes. Every `FilledButton` is a lemon hex with the navy
  contour, sitting on a hard edge. It sinks in 70 ms when pressed and springs back with a
  bounce; with reduced motion it jumps. `OutlinedButton` is the raised variant. Chips,
  checkboxes and the navigation indicator are hexes; dialogs and sheets have rounded corners.
  `app/lib/design/` holds `HexBorder`, the tactile face, `hlMotion` and the font licences.
- **Screens** changed only in typography and shape references: seven button text styles name
  Inter, store names and counts use Bricolage, the fold-out chip label is 14 px, two sheet buttons
  dropped a stadium shape, and the delete confirmation takes `HexBorder`.
- **A main bug fixed on the way.** On the web, a click on the add field after closing the sheet
  could arrive as a semantics tap or focus, which never calls `TextField.onTap`. The click showed a
  cursor and no sheet. That is the cause of main's flaky multi-add e2e specs (list, classifier,
  feedback). The field's next focus after the user closes the sheet now opens it.
- **Widgetbook** `app/widgetbook/`: 27 components, 119 stories in light and dark, text size, reduced
  motion, slow motion and device frames. It covers every control in every state, playgrounds where
  a press really sinks and bounces, the app's own store badges, explainer, fold-out chips and list
  rows, and token pages. The `flutter` gate runs its analyze, format and 244 tests;
  `.github/workflows/widgetbook.yml` builds it and uploads the artifact `widgetbook` on `main`.
- **App icon #5 Wabenstapel** from `design/app-icon/build.mjs` (plain Node, deterministic,
  `--check` in the lint gate; replaces `scripts/icons.py`):
  - iOS: the Icon Composer bundle `AppIcon.icon` (the layered Liquid Glass icon), compiled by
    actool on CI's Xcode 26, next to the single-size asset catalog (light, dark, tinted).
  - Android: adaptive `ic_launcher` and `ic_launcher_round` with a monochrome layer, plus the
    legacy PNGs.
  - Web: favicon (PNG and SVG), PWA and maskable icons, the apple-touch icon, manifest colours.
- **Splash screens** with the 6b mark on `#f7f7f2` or `#0b1024`: iOS launch storyboard, Android
  launch background, the API 31 splash and night variants, and a web splash that leaves on
  Flutter's first frame.
- **Changelog hold** `new-design` in `releases/flags.json`.

## How it was verified

- `flutter analyze --fatal-infos` and `flutter test` in `app/`: 1152 tests pass, among them:
  - goldens of every button kind in every state, light and dark
  - goldens of the list, add sheet, More and settings, light and dark, with the real fonts
  - a contrast test over every token pair; it failed on a planted change
  - the semantics tap and focus on the field (failed before the fix)
  - the chips on one line (fails at 15 px)
  - the tab switch after a close
- `scripts/gates/flutter.sh` green, Widgetbook included (244 tests).
- `node design/tokens/build.mjs --check` and `node design/app-icon/build.mjs --check` pass. Each
  fails on a planted change. Two icon builds give the same bytes.
- e2e on this runner (local stack, ports 575xx), all green:
  - list, add-sheet, classifier, list-header, feedback and household-bound: 26 of 27, then
    household-bound 5 of 5 once job 47's migration was applied to the local database
  - `list.spec.ts` "adds are grouped" failed 3 of 3 with `origin/main`'s own build before the fix
  - after narrowing the fix (CI's sync smoke found the sheet opening after sign-in): list,
    add-sheet, classifier, feedback and list-header 24 of 24, and the fg sync smoke test PASS
- CI on the PR: the `ios` job (macos-26) compiled `AppIcon.icon` into icon stacks for light, dark
  and tintable; `scripts/gates/ios.sh` now requires them. The `android` job built the debug APK
  with the new resources.
- Screenshots: `docs/screenshots/52/before-after/` (list, add sheet, settings, Lifetime page,
  light and dark, main against this branch), `docs/screenshots/52/icon/` (every appearance, small
  sizes, splash), `docs/screenshots/52/widgetbook/` (states, tokens, a press clip).

## Open

- Peter's look check in TestFlight, then releasing the hold (NEEDS_PETER "Job 52").
- The Widgetbook workflow first runs after the merge (a dispatch needs the workflow on `main`).
- Store screenshots and listings are out of scope (later, through Peter).
