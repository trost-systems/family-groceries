# Job 79: More menu research and five prototypes

Not for merge. The PR exists so Vercel builds a preview of the review page.

## What was built

- **Research:** `docs/design/menu-research.md`. iOS Settings, Things, Todoist, Bring!, AnyList,
  Revolut, Spotify, Duolingo, Material 3 and Apple HIG, with sources and 12 takeaways. Claims
  without an opened source are marked unverified.
- **Five prototypes in the Flutter app:** `app/lib/more/menu_prototypes.dart` (a part of
  `more_screen.dart`). In a debug build, the lab icon in the More app bar switches between
  today's menu, M-P1 to M-P5 and the update card. Release builds don't show it.
  - M-P1 Klar gegliedert: today's look, five clear groups.
  - M-P2 Gruppen: inset groups without headers, hex icons, account first, sign out apart.
  - M-P3 Luftig: 48 px between sections (today 20), title headers, 64 px rows.
  - M-P4 Kompakt: text only, 48 px rows, values at the row end, fits one screen.
  - M-P5 Nach Aufgaben: task headers, hex icons, legal links as a quiet footer.
  Every prototype has menu rows only plus the version at the bottom. The usage-data switch is on
  a Privacy page. Stores and Categories are left out (job 78). The update card is the only card,
  shown in one state of each prototype (P1, P3, P5: patch; P2, P4: store version).
- **Review page:** `site/public/internal/menu-prototypes.html` (noindex, preview only), built by
  `node design/menu-prototypes/build.mjs <shots>` from the widget-test screenshots.

## How to verify

```sh
cd app
flutter test test/more/menu_prototypes_test.dart   # constraints of every prototype
SCREENSHOT_DIR=/tmp/menu79 flutter test --update-goldens \
  test/more/menu_prototypes_screenshots_test.dart     # 37 shots
cd .. && node design/menu-prototypes/build.mjs /tmp/menu79
```

`menu_prototypes_test.dart` checks for each prototype: no switch on the menu, no stores or
categories, every row above the version, the update card above every row and dismissible, the
usage-data switch on the Privacy page. It also checks that the debug switcher swaps the menu.

## Not done, on purpose

- The feature map (`features/`) is unchanged: users see nothing new.
- No Shorebird or store version check. The card is a mock until a direction is picked.

## Review 0 fixes

- `docs/design/menu-research.md` had a first-pass and a second-pass section for Bring!,
  AnyList, Revolut, Spotify and Duolingo, which contradicted each other (Spotify's settings
  entry, "opened" versus "snippet"). The stale first-pass block is gone: one section per app,
  based on the opened sources. The patterns table marks the Revolut and Spotify icon claims as
  unverified.
- The review page cited commit cfaf0f5, which the squash removed. It now gives the date and
  "Code in PR #206" instead of a hash.
- Also from the nice-to-haves: the first section below the update card keeps at least 20 px
  (M-P4 had 12). The page says the update card is a mock (its buttons only close it, "1.4.0" is
  a sample) and notes that M-P3 keeps "Abmelden" in normal ink inside Konto, while M-P2 and M-P4
  set it apart in the error colour.
