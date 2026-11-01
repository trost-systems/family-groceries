# Design system

The app and the site share one design: **6b Hex Frische** with option 6's
yellow (Peter, 2026-10-31). Cobalt, lemon, mint and tomato on warm white or
deep navy, hexagonal controls with a navy contour that sit on a hard edge and
sink when pressed, Bricolage Grotesque over Inter. This page lists the token
source, the contrast rules, the Flutter components, the catalogue and the app
icon. The reasons behind the choices are in [DECISIONS.md](DECISIONS.md),
section "Job 52".

## Tokens

One source: [`design/tokens/hummlist.tokens.json`](../design/tokens/hummlist.tokens.json),
in the W3C design-tokens format with light and dark colours
(`color.light.*`, `color.dark.*`), type, space, radius, border, shadow,
depth, motion, the hex shape, the focus ring and the target size.

```sh
node design/tokens/build.mjs           # writes both outputs
node design/tokens/build.mjs --check   # writes nothing, exits 1 when an output is stale
```

| Output | What it holds | Used by |
| --- | --- | --- |
| `app/lib/design/tokens.g.dart` | `HummlistColors` (a `ThemeExtension`, light and dark), `HlFont`, `HlType`, `HlSpace`, `HlRadius`, `HlBorder`, `HlDepth`, `HlFocus`, `HlSize`, `HlHex`, `HlDuration`, `HlEasing` | `app/lib/app/theme.dart`, `app/lib/design/` |
| `site/public/tokens.css` | The same as `--hl-*` custom properties; dark colours under `prefers-color-scheme: dark` | The homepage (job 53) |

The generator is plain Node with no packages. The `lint` gate runs the
`--check`, so a token edit without a rebuild fails CI. Never edit the outputs.

### The yellow

The token is called `honey`, the prose says lemon (Zitrone). In light mode
options 6 and 6b already used the same lemon `#ffe24a`. The brighter yellow
Peter preferred is 6's **dark-mode** yellow: 6 keeps `#ffe24a` at night, 6b
dimmed it to option 5's `#e8cb3c`. So the change from 6b is dark mode only:

| Token | 6b light | 6b dark | Final light | Final dark |
| --- | --- | --- | --- | --- |
| `honey` | `#ffe24a` | `#e8cb3c` | `#ffe24a` | `#ffe24a` |
| `on-honey` | `#0f1530` | `#0b1024` | `#0f1530` | `#0b1024` |
| `honey-soft` | `#fff2a8` | `#35310f` | `#fff2a8` | `#35310f` |
| `honey-edge` | `#d4b20f` | `#a8901c` | `#d4b20f` | `#b39b1a` (6's) |

Everything else is 6b unchanged: cobalt `#1b3fae` (dark field `#2448c0`,
dark brand `#9fb6ff`), mint, tomato, navy, surfaces, text, type, radii,
depth, motion and the hex shape.

## Contrast

WCAG 2 relative luminance. `app/test/design/contrast_test.dart` reads the
pairs from the token file (`$extensions.com.hummlist.contrastPairs` and
`contourRequired`) and fails when one drops under its minimum, or when a
"contour required" pair stops needing its contour (then the rule is stale).
The same test pins the lemon pairs below to two decimals.
`app/test/app/theme_test.dart` checks the Material roles the screens use.

<!-- Generated from the token file; rerun the snippet in DECISIONS "Job 52" after a palette change. -->
| Pair | Light | Dark | Min |
| --- | --- | --- | --- |
| `on-honey` on `honey` | 13.87 (`#0f1530` on `#ffe24a`) | 14.57 (`#0b1024` on `#ffe24a`) | 4.5 |
| `text` on `honey-soft` | 15.82 (`#0f1530` on `#fff2a8`) | 11.85 (`#eff3ff` on `#35310f`) | 4.5 |
| `text` on `accent-soft` | 14.69 (`#0f1530` on `#e1e8ff`) | 11.91 (`#eff3ff` on `#1d2b66`) | 4.5 |
| `text` on `success-soft` | 15.44 (`#0f1530` on `#d6f5e7`) | 11.30 (`#eff3ff` on `#123a31`) | 4.5 |
| `text` on `surface-sunken` | 15.59 (`#0f1530` on `#eceff6`) | 15.81 (`#eff3ff` on `#111735`) | 4.5 |
| `text-muted` on `surface-sunken` | 6.63 (`#4b536c` on `#eceff6`) | 9.00 (`#b0b9d8` on `#111735`) | 4.5 |
| `brand` on `surface-raised` | 8.87 (`#1b3fae` on `#ffffff`) | 8.43 (`#9fb6ff` on `#151c3a`) | 4.5 |
| `brand` on `honey-soft` | 7.82 (`#1b3fae` on `#fff2a8`) | 6.64 (`#9fb6ff` on `#35310f`) | 4.5 |
| `accent` on `surface` | 8.25 (`#1b3fae` on `#f7f7f2`) | 9.53 (`#9fb6ff` on `#0b1024`) | 4.5 |
| `accent` on `surface-raised` | 8.87 (`#1b3fae` on `#ffffff`) | 8.43 (`#9fb6ff` on `#151c3a`) | 4.5 |
| `success` on `surface-raised` | 5.37 (`#0d7a4e` on `#ffffff`) | 8.23 (`#62c99d` on `#151c3a`) | 3 |
| `border` on `surface` | 16.70 (`#0f1530` on `#f7f7f2`) | 5.79 (`#7f8cc4` on `#0b1024`) | 3 |
| `border` on `surface-raised` | 17.94 (`#0f1530` on `#ffffff`) | 5.12 (`#7f8cc4` on `#151c3a`) | 3 |
| `on-mint` on `mint` | 11.61 (`#0f1530` on `#7fe3b8`) | 9.30 (`#0b1024` on `#62c99d`) | 4.5 |
| `text` on `mint-soft` | 15.44 (`#0f1530` on `#d6f5e7`) | 11.30 (`#eff3ff` on `#123a31`) | 4.5 |
| `on-cobalt` on `cobalt` | 8.87 (`#ffffff` on `#1b3fae`) | 7.60 (`#ffffff` on `#2448c0`) | 4.5 |
| `on-tomato` on `tomato` | 5.82 (`#0f1530` on `#ff5b3a`) | 5.79 (`#0b1024` on `#f0603f`) | 4.5 |
| `on-accent-soft` on `accent-soft` | 9.66 (`#132f86` on `#e1e8ff`) | 10.81 (`#e1e8ff` on `#1d2b66`) | 4.5 |
| `on-inverse` on `inverse` | 16.61 (`#f3f6ff` on `#0f1530`) | 15.81 (`#eff3ff` on `#111735`) | 4.5 |
| `text-muted` on `accent-soft` | 6.24 (`#4b536c` on `#e1e8ff`) | 6.78 (`#b0b9d8` on `#1d2b66`) | 4.5 |
| `honey` on `cobalt` | 6.85 (`#ffe24a` on `#1b3fae`) | 5.87 (`#ffe24a` on `#2448c0`) | 3 |
| `ink` on `on-cobalt` | 17.94 (`#0f1530` on `#ffffff`) | 20.34 (`#03050f` on `#ffffff`) | 4.5 |
| `ink` on `honey` | 13.87 (`#0f1530` on `#ffe24a`) | 15.72 (`#03050f` on `#ffe24a`) | 3 |
| `ink` on `tomato` | 5.82 (`#0f1530` on `#ff5b3a`) | 6.25 (`#03050f` on `#f0603f`) | 3 |
| `ink` on `mint` | 11.61 (`#0f1530` on `#7fe3b8`) | 10.03 (`#03050f` on `#62c99d`) | 3 |
| `accent` on `accent-soft` | 7.26 (`#1b3fae` on `#e1e8ff`) | 6.67 (`#9fb6ff` on `#1d2b66`) | 3 |
| `honey` on `inverse` | 13.87 (`#ffe24a` on `#0f1530`) | 13.55 (`#ffe24a` on `#111735`) | 3 |
| `text-muted` on `honey` | 5.90 (`#4b536c` on `#ffe24a`) | not used | 4.5 |
| `brand` on `honey` | 6.85 (`#1b3fae` on `#ffe24a`) | not used | 4.5 |
| `honey` on `surface` | not used | 14.57 (`#ffe24a` on `#0b1024`) | 3 |
| `honey` on `surface-raised` | not used | 12.89 (`#ffe24a` on `#151c3a`) | 3 |
| `honey-edge` on `surface` | not used | 6.84 (`#b39b1a` on `#0b1024`) | 3 |
| `edge` on `honey` | 13.87 (`#0f1530` on `#ffe24a`) | 15.72 (`#03050f` on `#ffe24a`) | 3 |
| `on-honey` on `honey-soft` | 15.82 (`#0f1530` on `#fff2a8`) | not used | 4.5 |

Pairs that fail alone. They are allowed only with the navy contour between
them, or never:

| Pair | Light | Dark | Rule |
| --- | --- | --- | --- |
| `honey` next to `surface` | 1.20 (contour 13.87 / 16.70) | not used | Yellow controls on light surfaces keep the 2 px navy contour and edge |
| `tomato` next to `honey` | 2.38 (contour 5.82 / 13.87) | 2.52 (contour 6.25 / 15.72) | Tomato on a yellow block only with the navy contour; never tomato text |
| `honey` next to `brand` | not used | 1.53 (contour 15.72 / 10.28) | Yellow next to `#9fb6ff` never as touching fields without contour |
| `on-cobalt` next to `honey` | 1.29 | 1.29 | No white or brand-light text on yellow: on-yellow text is `on-honey` |

Every text on yellow uses `on-honey`. A spinner inside a yellow button takes
the label colour, not the theme's cobalt, which would be `#9fb6ff` on yellow
(1.53) in dark mode (`app/lib/design/tactile.dart`).

## Flutter

### Theme

`appTheme(Brightness)` in `app/lib/app/theme.dart` builds Material 3
`ThemeData` for light and dark from the tokens. Screens keep their widgets,
keys and strings; the theme gives them the 6b look.

| Material role | Token |
| --- | --- |
| `primary` / `onPrimary` | `brand` / `on-brand` (cobalt; `#9fb6ff` in dark) |
| `primaryContainer` / `onPrimaryContainer` | `accent-soft` / `on-accent-soft` |
| `secondary` / `onSecondary` | `honey` / `on-honey` |
| `secondaryContainer` / `onSecondaryContainer` | `honey-soft` / `text` |
| `tertiary` / `onTertiary` | `success` / `on-success` |
| `tertiaryContainer` / `onTertiaryContainer` | `mint-soft` / `text` |
| `surface`, `onSurface`, `onSurfaceVariant` | `surface`, `text`, `text-muted` |
| `surfaceContainerLowest` … `Highest` | `surface-raised`, `surface-sunken`, mixed toward `divider` for the top tiers |
| `outline` / `outlineVariant` | `border` (the navy contour) / `divider` |
| `inverseSurface`, `inversePrimary` | `inverse` (light) or `text` (dark); `honey` (light) or `cobalt` (dark) |
| `error` | `error` (container mixed from it) |

The theme also carries `HummlistColors` as a `ThemeExtension` for widgets
that need a token without a Material role
(`Theme.of(context).extension<HummlistColors>()`).

### Type

Bricolage Grotesque (700, 800) for display, headline and title, store names
and counts. Inter (400, 500, 600, 700) for everything else. Both are OFL,
bundled as static TTFs in `app/assets/fonts/` with their licences, and listed
on the licence page (`app/lib/design/fonts.dart`). Nothing downloads a font
at runtime. Sizes stay Material's type scale, so text scaling to 200 % works
as before. A button that sets its own `textStyle` names `HlFont.sans`,
because a button's text style replaces the theme's instead of merging.

### Components

| Widget | Look |
| --- | --- |
| `FilledButton`, `ElevatedButton`, `FilledButton.tonal` | Lemon hex face, 2 px navy contour, on a `honey-edge` edge 4 px deep |
| `OutlinedButton` | Raised surface face on a `surface-edge` edge |
| `TextButton` | Cobalt label, hex ink |
| `FloatingActionButton` | Lemon hex with the contour |
| `ChoiceChip`, `Checkbox` | Hex; selected is lemon with navy |
| `NavigationBar` | Lemon hex indicator with the contour |
| `Card`, dialogs, bottom sheets | Radius m (18), l (28); dialogs keep the 2 px contour |

`app/lib/design/`:

- `hex_border.dart`: `HexBorder`, the soft hexagon (tip 0.2887 of the
  height, corner radius 8 at 48 px, scaled with the height), horizontal or
  pointy-top, with a true parallel outset for strokes and focus rings.
- `tactile.dart`: `TactileFace` and `tactileButtonStyle`. The face rests on
  its edge, lifts 2 px on hover, sinks 4 px flush into the edge on press in
  70 ms, and springs back in 160 ms on the bounce curve. A disabled face sits
  flush. The 3 px focus ring sits 2 px outside the face. The button's
  Material shape is its box grown by the ring, so the ring and the lift are
  never clipped. A button that sets its own `backgroundColor` (the delete
  confirmation, the Google button, the fold-out chips) opts out and stays a
  plain Material button in its colours.
- `motion.dart`: `hlMotion(context, duration)` is zero when the platform asks
  for reduced motion (`MediaQuery.disableAnimations`); the tactile face then
  jumps.
- `tokens.g.dart`: generated, see above.

Targets stay 48 px (face plus edge).

### Goldens

`app/test/design/components_golden_test.dart` renders every button kind in
rest, hover, focus, pressed and disabled, plus loading, chips, checkboxes,
the navigation bar, store badges and a card, light and dark.
`app/test/design/screens_golden_test.dart` renders the list, the add sheet,
More and the settings at 390 × 844, light and dark. Both load the real fonts
(`app/test/design/fonts.dart`). After a deliberate change:

```sh
cd app && flutter test --update-goldens test/design/
```

## App icon and splash

Icon #5 **Wabenstapel**: a lemon hex ring, inside it a hex with a check.
`design/app-icon/build.mjs` draws it from the geometry of design job 45 and
the colours in the token file, and writes every platform's files. It is plain
Node with its own rasterizer and PNG encoder (`raster.mjs`), so the output is
the same bytes on every machine.

```sh
node design/app-icon/build.mjs             # writes the platform files
node design/app-icon/build.mjs --check     # exits 1 when one differs (lint gate)
node design/app-icon/build.mjs --previews   # docs/screenshots/52/icon/ plus the numbers below
```

| | Light | Dark |
| --- | --- | --- |
| Background | cobalt `#1b3fae` | deep `#0b1024` |
| Ring | lemon `#ffe24a` | lemon `#ffe24a` |
| Inner hex | white `#ffffff` | `#9fb6ff` |
| Check | cobalt `#1b3fae` | deep `#0b1024` |

Monochrome (Android themed icons, iOS tinted): the ring and the check, without
the inner hex.

| Pair | Light | Dark |
| --- | --- | --- |
| Background / ring | 6.85 | 14.57 |
| Background / inner hex | 8.87 | 9.53 |
| Inner hex / check | 8.87 | 9.53 |
| Ring / inner hex | 1.29 | 1.53 |

The ring and the inner hex never touch: 20 of 1024 units of background lie
between them. The foreground reaches 25.3 dp from the centre, inside
Android's 33 dp safe circle (the build fails if a shape leaves it). At 29 pt
(29 and 87 px) and 48 dp the check reads clearly. At 16 px a lemon ring with a
light core and a dot of check remains
(`docs/screenshots/52/icon/small-sheet.png`).

| Platform | Files |
| --- | --- |
| iOS | `Runner/AppIcon.icon` (Icon Composer bundle, the layered iOS 26 icon) and `Assets.xcassets/AppIcon.appiconset` (one 1024 icon, light, dark and tinted, for older iOS), both named `AppIcon` |
| Android | `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` (background, foreground and monochrome vector drawables), legacy `mipmap-*/ic_launcher.png` and `ic_launcher_round.png` |
| Web | `favicon.png`, `favicon.svg`, `icons/Icon-192.png`, `Icon-512.png`, the maskable pair, `icons/apple-touch-icon.png`; `manifest.json` colours |

`scripts/gates/ios.sh` (CI, macos-26) checks that the built app's
`Assets.car` holds the AppIcon in light, dark and tinted, the icon stacks
compiled from `AppIcon.icon`, and the launch screen's colour and mark.

The splash screens show the 6b mark (cobalt hex, white check, lemon cell)
centred on the surface colour, `#f7f7f2` or `#0b1024`: iOS
`LaunchScreen.storyboard` with the `LaunchBackground` colour and
`LaunchImage` set, Android `launch_background.xml` with night variants and
`windowSplashScreen*` from API 31, and the web's `#splash` in `index.html`
(`splash.css`), which `flutter_bootstrap.js` removes on Flutter's first frame.

## Widgetbook

`app/widgetbook/` is the living catalogue: its own Flutter package with a
path dependency on the app, showing the app's real widgets in `appTheme`.

- Addons: light and dark, text size 1×, 1.3× and 2×, reduced motion, slow
  motion (time dilation) and device frames (iPhone 13, iPhone SE, Galaxy S20).
- Every Material control the app uses, each with an "Alle Zustände" story and
  one story per state (rest, hover, focus, pressed, disabled, loading where a
  control can be busy). States come from real mouse, finger and keyboard
  input. The "Spielwiese" stories have knobs for label, enabled and loading,
  and a press really sinks and bounces.
- Surfaces: navigation bar, snackbar with undo, dialog, bottom sheet, card.
- App widgets: store badges, the explainer card, the fold-out chips, and a
  list excerpt built from the app's own dividers and item rows (a tap ticks,
  a tap on a store folds).
- Tokens: the palette in light and dark, the contrast pairs with their ratio,
  the type ramp, radii, the depth states drawn with the real `TactileFace`,
  and the easing curves.

The `flutter` gate runs its format, analyze and tests: every story renders in
light and dark, the colour pages match the token file, and a press sinks the
label 4 px, overshoots on release and settles (one frame with reduced
motion).

**Open it.** It is not on hummlist.com. GitHub Actions → "Widgetbook" (runs on
every push to `main` that touches `app/`, or "Run workflow" on any branch) →
the run's artifact `widgetbook`. Unzip it, run
`python3 -m http.server -d widgetbook 8080` and open http://127.0.0.1:8080.
Locally: `scripts/widgetbook.sh` builds it into `app/widgetbook/build/web`
(one web build at a time, under `/tmp/flutter-build-web.lock`).
`scripts/widgetbook-shots.mjs` retakes the screenshots in
`docs/screenshots/52/widgetbook/`.
