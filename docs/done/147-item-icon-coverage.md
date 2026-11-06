# Job 147: item icon coverage and a fallback icon

## What was built
- **1,439 items in data, not code.** `tool/item_icons/{fresh,pantry,drugstore,home}.tsv`
  (3,040 German and English spellings, 299 distinct emoji, 119 stops), emoji limited to Unicode 14.0
  (`tool/item_icons/emoji.tsv`). `node tool/item_icons/build.mjs` validates them and writes
  `app/lib/list/list_view/item_icons.g.dart` and `site/public/data/item-icons.v1.json`; `--check`
  runs in the lint gate with `build.test.mjs`.
- **Matching** (`ItemIcons` in `app/lib/list/list_view/item_icon.dart`): phrases, then whole words,
  then the longest compound head (head of 3+ letters after 3+), `=` whole-word-only forms, `-`
  stops, first word left to right. O(letters) per name with maps built once.
- **Fallback**: `ItemIconFallback`, a pale hex cell with a thin navy contour, in rows and the add
  sheet; the category emoji only on dividers. Three options compared in
  `docs/screenshots/147/fallback-options-*.png`.
- **Remote table**: `app/lib/list/item_icons_remote.dart`, at most one GET a day to
  `https://hummlist.com/data/item-icons.v1.json`, cached in `DeviceCache`, applied over the bundled
  table only for schema 1 with a higher revision. CSP `connect-src` and site `/data/` headers.
- **Web emoji fonts**: `warmItemIconFonts` lays every table emoji out at start, so the web engine
  never draws one in the monochrome Noto Sans Symbols 2 (found while verifying, DECISIONS Job 147.6).

## How to verify
- `node tool/item_icons/build.mjs --check` (prints the coverage line, 418/418 samples, and checks the classifier sweep).
- `cd app && flutter test test/list/item_icon_test.dart test/list/item_icon_samples_test.dart
  test/list/item_icons_remote_test.dart test/design/item_icon_fallback_golden_test.dart`.
- `.cursor/skills/verify-hummlist/helpers/launch.sh`, then
  `node .cursor/skills/verify-hummlist/journeys/item-icons.mjs <dir>`.

## Results
- `scripts/verify.sh --only lint,site,flutter,web-prod`: passed (flutter 1,963 tests).
- Journey `item-icons`: PASS on the web build (mixed list light and dark, one plain GET for the
  remote table with no item names, the remote ⚪ shown, no Symbols 2 font fetched).
- Screenshots: `docs/screenshots/147/` (before/after light and dark, add sheet, remote table,
  the monochrome emoji before the warm-up, fallback options).

## Open
- `hummlist.com/data/item-icons.v1.json` exists once the site deploys from main; until then the
  check gets a 404, which counts as that day's check (one request a day), and the bundled table
  stays.
- The classifier files „WC-Ente“ under Fleisch/Wurst/Fisch (its icon is right now, 🚽); a classifier
  fix is out of this job's scope.
- `foldName` drops accented letters („Rosé“ folds to „ros“), on the server too; left as is so the
  app and `public.normalize_item_name` keep folding alike.
- The web warm-up's extra ~640 KB of emoji fonts on a first visit has no Lighthouse A/B yet.
- Phones: iOS and Android not driven (no simulators here); the matcher and loader are the same
  Dart code as on the web, covered by tests.

## Review 0 fixes
- **Wrong icons from our own classifier names** (Lorbeer 🍺, Axe 🪓, Flensburger 🍔, WC-Ente 🍗):
  fixed rows (Lorbeer 🌿, Axe 🧴, Flensburger 🍺, „wc ente“ 🚽, Russisch Brot 🍪), `beer` is
  whole-word only (Himbeer, Erdbeer), stops for Insekt, Frottee, Hornmehl and Rosenwasser, all in
  the samples. The lever: `build.mjs` writes `tool/item_icons/classifier-sweep.tsv`, the icon of
  each of the 2,391 names in `supabase/classifier/*.tsv`, and `--check` fails when it is stale, so
  every table change shows its effect on real names in the diff. I read all 1,218 hits by eye.
- **REVISION guard on CI**: the lint gate fetches `origin/main` into the depth-1 checkout, and
  `--check` fails (instead of skipping) when it cannot read it (`ITEM_ICONS_NO_MAIN=1` opts out).
  Proven in a `--depth 1` clone: no main fails; a Vernel change at REVISION 1 fails; REVISION 2
  passes; plus a `build.test.mjs` case.
- **A 404 or 5xx counts as the day's check**: only transport errors and timeouts retry at the
  next start. Remote tests for 404 and 503 (no request within 23 h, one after 25 h) and a 404
  before any table; on the web build a routed 404 was fetched once, and not again after a reload.
- Also: emoji values with spaces or invisible format characters (bidi overrides) are rejected;
  `site/README.md` says REVISION is raised by hand and how to remove an icon remotely (a stop);
  the docs say "plain hexagon"; the `item-icons` journey now asserts the remote ⚪ by comparing
  the icon cell's pixels (PASS with revision 999, FAIL with `--remote-revision 1`).
