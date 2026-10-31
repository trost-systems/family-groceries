# Hummel Hex: Flutter raw-widgets proof of concept

A design-system sketch for Hummlist on `package:flutter/widgets.dart` only. It has hexagonal buttons that sit on a visible edge and sink into it when pressed, in a Sharp and a Soft variant. Design job 41, on the `design/41-hummel-hex` branch. **It is not wired into `app/`** and nothing in the shipping app imports it.

## Flutter version and the Material/Cupertino split

Checked on 2026-10-31. The local SDK is Flutter **3.47.8** (stable, framework 737ba8f885, 2026-10-22, Dart 3.13.7), the version CI uses. The latest stable hotfix is 3.47.9 ([release tag](https://github.com/flutter/flutter/releases/tag/3.47.9)).

**Verdict: the split has shipped as an opt-in.** It is not a forced move yet.

- Material and Cupertino are published as separate packages by the verified publisher flutter.dev: [`material_ui`](https://pub.dev/packages/material_ui) 1.9.0 and [`cupertino_ui`](https://pub.dev/packages/cupertino_ui) 1.1.5. I confirmed both versions through the pub.dev API.
- The migration guide is [docs.flutter.dev/release/breaking-changes/material-ui-and-cupertino-ui](https://docs.flutter.dev/release/breaking-changes/material-ui-and-cupertino-ui). The migration command is `dart fix --apply --code=migrate_design_widgets`.
- `package:flutter/material.dart` and `cupertino.dart` **still ship inside the SDK and are not deprecated in 3.47.8.** I confirmed this locally: `packages/flutter/lib/material.dart` is a full library with no `@Deprecated`. The `src/widgets/` layer names material or cupertino only in `/// @docImport` doc comments, never in real imports.
- These points come from the research pass (sources fetched, not re-checked by me):
  - Material and Cupertino froze in flutter/flutter on 2026-04-07, and new work moved to flutter/packages ([blog](https://flutter.dev/blog/flutters-material-and-cupertino-code-freeze)).
  - [What's new in Flutter 3.47](https://flutter.dev/blog/whats-new-in-flutter-3-47) (2026-08-12) pairs 3.47 with the packages. It plans the formal deprecation for the November stable.
  - The `@Deprecated` library annotations are on master only ([PR #192957](https://github.com/flutter/flutter/pull/192957)).
  - Deleting the in-SDK code has no target version ([#172942](https://github.com/flutter/flutter/issues/172942), umbrella [#101479](https://github.com/flutter/flutter/issues/101479)).
- What exists for custom design systems: the style-neutral widgets layer grew in steps. ToggleableStateMixin and ToggleablePainter came in 3.24. RawMenuAnchor and Expansible came in 3.32, RawRadio and RadioGroup in 3.35, RawTooltip in 3.41 and showRawDialog in 3.44. widgets.dart has **no RawButton, RawCheckbox, RawSwitch or generic TabBar**, and there is no base theme for WidgetsApp. A button wrapper is "under consideration" ([#97496](https://github.com/flutter/flutter/issues/97496)).

What this means here: a hex design system on `widgets.dart` alone works on today's stable. Buttons, chips and check rows need their own interaction wrapper (this PoC's `Pressable`) and their own theme (`HexTheme`, an InheritedWidget). Code that imports neither material nor cupertino will not see the coming deprecation warnings. `test/no_material_test.dart` keeps it that way.

## Catalogue

| Widget | What it is |
| --- | --- |
| `HexTheme` / `HexThemeData` | InheritedWidget with one colour set (light or dark) and one hex variant (sharp or soft). It has no ThemeExtension and no Material `Theme`. |
| `HexBorder` | An `OutlinedBorder`. It draws a horizontal hexagon (pointed left and right ends) or a pointy-top one, with optional filleted corners. |
| `HexButton` | Primary (honey), secondary and quiet kinds, in regular and small sizes, with an optional leading `icon` in the label colour. It is tactile: it lifts on hover, sinks into its edge on press, and has a hex focus ring. |
| `HexChip` | A selectable store filter. A selected chip stays sunk and turns honey, so selection does not rely on colour alone. |
| `ListRow` | A list item: hex check box, title, optional subtitle, and a store badge or quantity. The whole row is one target. |
| `HexAvatar`, `HexBadge` | A pointy-top initials avatar, and a small outlined store or count badge. |
| `Pressable` | The shared interaction. It combines FocusableActionDetector (Enter and Space through ActivateIntent), MouseRegion, a pointer press and one Semantics node. It animates with the motion tokens, or changes instantly when `MediaQuery.disableAnimations` is set. |

`lib/main.dart` runs a `WidgetsApp` gallery with every widget in both variants, light and dark. The folder has no platform runners. Add them with `flutter create --platforms=web,linux .` to run it.

## Design notes

- **Hex geometry.** Each pointed end is `shape.hex.tip × height` wide. The token is 0.2887, which is 1/(2·tan 60°), so all six corners are 120°, the honeycomb angle. The Soft variant fillets each corner with a circular arc tangent to both edges. The tangent distance is `r / tan(60°)`, with `r = cornerRadius × height / referenceHeight` (8 px at 48 px). Small chips are therefore as round, relative to their size, as large buttons. The web variants' mask SVGs come from the same formula (`_tools/build-hex-assets.mjs`).
- **Depth.** The face rests on a solid edge `depth.edge` tall (6 px; `edge-l` is 8 px). Hover lifts the face by `depth.lift` (2 px). Press moves it down by `depth.press` (= edge) until it sits flush with the edge. The press takes `motion.duration.press` (70 ms) and the release takes `motion.duration.release` (160 ms). The layout box never changes, so neighbours don't move.
- **Focus.** A ring parallel to the hex outline is painted outside the face. It leaves a surface-coloured gap and is never clipped, because the control reserves the room for it.
- **Accessibility.** Every control has a target of at least 48 × 48 dp, even for short labels like "OK". Horizontal padding is at least the tip width, so text stays between the tips. Disabled controls keep AA text contrast and announce `enabled: false`. Tests run `androidTapTargetGuideline`, `labeledTapTargetGuideline` and `textContrastGuideline` for each variant and brightness.

## Tokens

`lib/src/tokens.g.dart` is generated. Do not edit it. The source is the shared DTCG file `design-prototypes/_tokens/hummel-hex.tokens.json`, merged with option 3's tokens:

```sh
cd design-prototypes/_tools && npm ci
node build-hex-variants.mjs          # option-3a-hex-sharp/ + option-3b-hex-soft/ tokens.json and tokens.css
node build-dart-widgets.mjs ../flutter-hex-poc/lib/src/tokens.g.dart ../option-3a-hex-sharp ../option-3b-hex-soft
```

`design-prototypes/_tools/check-token-drift.sh` proves that this file, and the web variants' token files and shapes, match the shared token file. The generator rejects variants that differ anywhere except `shape.hex`.

## Run

```sh
cd design-prototypes/flutter-hex-poc
flutter pub get
flutter analyze        # flutter_agent_lints experimental, the app's rule set
flutter test           # widgets, semantics, guidelines, goldens, the no-material guard
flutter test --update-goldens   # after a token or visual change
```

Goldens render with the real fonts. Baloo 2 and Nunito are variable TTFs from [google/fonts](https://github.com/google/fonts) under the OFL (see `fonts/OFL-*.txt`), and the tests load them with `FontLoader`. The goldens were generated on Linux with Flutter 3.47.8. They are not stable across platforms: on macOS or Windows, text rendering differs by a few pixels and the golden tests fail. Regenerate them with `--update-goldens` on the platform you compare on, or run them on Linux (the CI runner's OS). Copies of the gallery and states-grid goldens are in `design-prototypes/screenshots/41/flutter/`.

## Widgetbook catalog

`widgetbook/` is a second package, `hummel_hex_widgetbook`, that depends on this one by path. This package does not depend on it, and its `lib/` stays free of material. The catalog itself uses Widgetbook's Material UI.

Preview: https://hummlist-site-git-design-41-hummel-hex-peter-trost.vercel.app/design-prototypes/widgetbook (behind the same Vercel login as the rest of the preview).

### Versions

Checked on pub.dev on 2026-10-31 and pinned exactly:

| Package | Version | Why |
| --- | --- | --- |
| `widgetbook` | 4.0.0-beta.14 | The newest release. Stories, args, scenarios and `testWidgetbook` exist only in v4; the stable 3.25.0 has `@UseCase` and knobs. Since 4.0.0-alpha.5 the generator and the test helpers are part of this package. |
| `build_runner` | 2.16.2 | The newest that resolves: build_runner 2.17.x needs `build` 5, Widgetbook 4 needs `build` 4. |

`widgetbook_generator` (4.0.0-alpha.4) and `widgetbook_annotation` (3.11.0) are the old line and are not used. `build.yaml` turns off Widgetbook's telemetry builder. That builder would otherwise post a hash of the git user's email and the remote's owner URL to Mixpanel on every build.

### What is in it

- Stories mirror `lib/src/`: `hex_button.stories.dart` (Primary, Secondary, Quiet), `hex_chip.stories.dart` (Unselected, Selected), `list_row.stories.dart` (Unchecked, Checked) and `gallery.stories.dart` (all variants).
- Args: label or title, `shape` (sharp or soft; off follows the theme), kind, size, enabled, `withIcon`, selected or checked, subtitle, store or quantity, and `interaction` (rest, hover, focus, pressed).
- Scenarios with fixed args for each state: Default, Hover, Focus, Pressed, Disabled, With icon, Small, plus the list row's subtitle, quantity and plain rows.
- Hover, focus and press come from `InteractionDriver` (`lib/src/interaction.dart`). It sends the widget real input: a synthetic mouse rests on it, a synthetic finger holds it down, or keyboard focus lands on it. So the catalog and the snapshots show the widget's own state rendering, and the PoC needs no "forced state" parameter. The scenarios' `run` waits for that input to land.
- Addons: Theme (Sharp or Soft, light or dark, over `HexThemeData`), Text Scale, and Viewport (none, iPhone 13, Samsung Galaxy S20). Widgetbook 4 draws a viewport as an outlined frame with the device name, not as a device bezel.
- Scenario matrix in `testWidgetbook`: every scenario in all four themes, plus one Text x2 and one iPhone 13 scenario per story. Each scenario also has to meet the tap-target, labelled-tap-target and text-contrast guidelines.

The generated `*.g.dart` files are committed, so the folder builds and analyzes without running the generator. Rerun the generator after you change a stories file.

### Run

```sh
cd design-prototypes/flutter-hex-poc/widgetbook
flutter pub get
dart run build_runner build   # regenerates *.stories.g.dart and lib/components.g.dart
flutter analyze
flutter test                  # testWidgetbook: one snapshot per scenario in build/.widgetbook/
flutter run -d chrome
```

`design-prototypes/_tools/build-widgetbook.sh` runs all of that for both packages. It then builds the web app with `--base-href /design-prototypes/widgetbook/ --no-web-resources-cdn` and writes it to `design-prototypes/widgetbook/`, which `_tools/publish.mjs` publishes. `web/flutter_bootstrap.js` points CanvasKit and the fallback fonts at the app's own folder, so the page makes no request to gstatic.com. The catalog has no emoji and no glyph outside its bundled fonts, so it needs no fallback font.
