# hc-web-bundle

Start: 2026-11-05 21:41:26 CET
Start epoch: 1793911286

Job 133. Goal: fewer bytes for a first-time browser of the Flutter web app (the production
`flutter build web --release --no-web-resources-cdn --wasm` build, not `site/`), without
removing features or changing what users see. Lower is better.

## Measurement

`tool/hillclimb/hc-web-bundle/measure.sh` prints one JSON line.

- **Build.** As Vercel builds it (`scripts/vercel.sh`): `--release --no-web-resources-cdn --wasm
  --base-href /` with `config/auth.json`, into `app/build/web-hc133`, under
  `/tmp/flutter-build-web.lock` (one web build per host, shared with job 129).
  `SUPABASE_URL=http://127.0.0.1:63381`, a dummy publishable key.
- **Boot.** `capture.mjs` serves the build on 127.0.0.1:63380 with vercel.json's SPA rewrite,
  writes a gotrue session to localStorage (far-future expiry, job 129's trick) and opens `/` in
  a fresh Chromium (Playwright 1.64.1, chromium-1248, 1350x940, `de-DE`, empty HTTP cache).
  `fake_supabase.py` (copied from job 129) answers the Supabase calls with a fixed household of
  24 items in 6 categories, no Docker stack. The page must show the list ("Bananen" in the
  semantics DOM), else the measure fails. Recording stops after 3 s without a new request.
- **Which files count.** Exactly the files the page fetched from the web origin during that
  boot (the capture's list; Supabase calls are not files of the bundle). Chromium supports
  WasmGC, so this is the dart2wasm + skwasm path, the one current Chrome, Edge and Firefox take.
  The dart2js fallback (`main.dart.js`, for Safari < 18.2 and others) is not fetched there;
  its raw and gzip size are listed as parts for context, not scored. No file is excluded by
  hand: a deferred chunk counts only if the boot fetched it.
- **Score.** The sum over those files of the brotli size (Node 24 zlib, quality 11, window 22),
  the same for every file, so brotli is fixed (Vercel serves brotli to browsers that accept it).
  gzip -9 totals and raw sizes are parts. Compression of fixed bytes is deterministic; the only
  variation is in the build output itself.
- **Parts.** Per file raw, gzip and brotli bytes; totals; the file count; dart2js main size;
  build wall time (informational, includes Flutter's incremental cache, so the first build of a
  tree is slower).
- **Seed.** No randomness (`seed` 0).
- **How to run it.** Bare: `tool/hillclimb/hc-web-bundle/measure.sh`. It takes
  `/tmp/fg-hc-measure.lock` itself, around the capture, and `/tmp/flutter-build-web.lock` around
  the build. **Do not wrap it in `flock /tmp/fg-hc-measure.lock`** as the brief's generic baseline
  command says: the inner `flock` on the same file then waits for the outer one forever (review 0
  checked: `flock L flock -w 2 L true` exits 1). Every number here comes from bare runs.
- **`build_seconds`** is timed under the build lock, not the measure lock, so other jobs' load
  can move it. It is informational only; the score has no timing in it.

## Baseline (694046e0, 2026-11-05 21:45-21:51 CET)

| run | score (br bytes) | gzip | files | build s |
| --- | --- | --- | --- | --- |
| 1 | 3,936,066 | 4,935,115 | 23 | 109.5 |
| 2 | 3,936,104 | 4,935,153 | 23 | 9.8 |
| 3 | 3,936,104 | 4,935,153 | 23 | 8.9 |

Baseline median **3,936,104** bytes brotli. Max - min = 38 bytes (`flutter_bootstrap.js`
differs between the first, cold build and the incremental ones). Noise band = 2 % of the
median = **78,722** bytes. A kept step must bring the score below **3,857,382**, then below
the new best minus 2 % of it.

Where the 3.94 MB go (brotli bytes, run 2):

| file | br |
| --- | --- |
| canvaskit/skwasm.wasm (engine) | 1,209,789 |
| main.dart.wasm (app) | 1,184,614 |
| Inter 400/500/600/700 .ttf | 640,485 |
| fonts/notocoloremoji chunks 3, 6, 7 (engine fallback for the item emoji) | 482,759 |
| purchases_flutter web SDK (`purchases_js_hybrid_mappings.js`, loaded at plugin registration) | 203,083 |
| Bricolage Grotesque 700/800 .ttf | 101,246 |
| Roboto (engine default font) | 74,845 |
| the rest (skwasm.js, main.dart.mjs, bootstrap, MaterialIcons, manifests, splash) | 39,283 |

## Guardrail baseline

`flutter analyze`: No issues found. `flutter test`: 1852 passed, 90 skipped, 114.7 s.

## Attempts

| # | time | change | score | kept | why |
| --- | --- | --- | --- | --- | --- |
| 1a | 21:55 | Web-only emoji font for the item icons: HarfBuzz (harfbuzzjs) subsets of the v32 chunks, merged with fontTools | 3,505,478 | reverted | The icons rendered blank (2,901 px differ): harfbuzzjs's wasm drops COLR and fontTools' merger drops it too. Score alone would have "won". |
| 1 | 22:05 | Web-only `NotoColorEmoji-icons.ttf`: the 60 icon emoji of `item_icon.dart` cut with fontTools from Noto Color Emoji 2.047 (the release the engine's v32 chunks name), asset `platforms: [web]`, registered as "Noto Color Emoji" before `runApp` (`loadWebEmojiFont`), `scripts/web-emoji-font.sh` (later folded into `scripts/app-fonts.sh`) regenerates it, `web_emoji_font_test.dart` guards drift | 3,514,502 | kept | The boot fetches no emoji chunk (482,759 br) and one 61 KB font instead; list pixels identical (0 of 1,174,500 differ above the field); Android bundle has no new asset. |
| 2 | 22:14 | Inter and Bricolage Grotesque (all platforms) lose their private-use glyphs (U+E000-F8FF, about 740 in Inter) and every OpenType feature the app never turns on (kept: calt ccmp locl kern mark mkmk frac numr dnom tnum; dropped: aalt case cv01-14 ss01-08 dlig salt zero ordn sinf subs sups pnum lnum onum cpsp). Every other character, hinting and names stay. `scripts/web-emoji-font.sh` becomes `scripts/app-fonts.sh` + `app-fonts.py` (idempotent, in place) | 3,416,812 | kept | -97,690 (band 70,290). List pixels identical; all 150 golden checks in test/design pass with Flutter's exact comparator; Android and iOS draw the same glyphs and get the smaller files too. |
| 3 | 22:21 | The bundled fonts also lose their TrueType hinting (glyf instructions, fpgm, prep, cvt) | 3,279,301 | kept | -137,511 (band 68,336). Flutter never runs these programs: Impeller and skwasm draw with `SkFontHinting::kSlight`, which Skia's FreeType backend maps to `FT_LOAD_TARGET_LIGHT` (the auto-hinter), and CoreText on iOS ignores TrueType hints. Evidence: list pixels identical on web, all goldens pass, and the same goldens fail (40+) when Inter Regular is swapped for Bold, so they do see font bytes. |
| 4 | 22:29 | dart2wasm `-O4` instead of Flutter's release default `-O2` (measured by hand, main.dart.wasm only) | (wasm 1,184,614 -> 1,164,883 br) | reverted | -19,731 is under the band (65,586), and -O3/-O4 drop implicit type checks, so a bug that throws today could corrupt state instead. Not worth it. No code changed. |
| 5 | 22:45 | App-owned Material, Cupertino and Widgets localization delegates for de and en only (`app/lib/app/framework_localizations.dart`), building `MaterialLocalizationDe/En` etc. directly with the SDK delegates' format arguments; intl date data for de and en only, generated from the SDK by `scripts/framework-l10n.py` (the flutter gate checks it is current). The global delegates keep about 80 locales because they choose at runtime | 3,190,577 | kept | -88,724 (band 65,586); main.dart.wasm 1,184,614 -> 1,096,389 br. A behaviour test compares every string getter and format of the new delegates with the global ones for de and en (8 deliberate breaks each failed it); list pixels identical; flutter gate 1855 + widgetbook 336 pass. |
| 6 | 22:50 | The bundled fonts also lose their glyph names (`post` format 3) | 3,157,232 | reverted | -33,345 is under the band (63,812). Pixels identical; a free win, but the protocol keeps only steps past the band. |
| 7 | 22:52 | Near-misses combined: glyph names (as 6) plus dropping the unused direct dependency `cupertino_icons` (its tree-shaken font and manifest entry) | 3,156,241 | reverted | -34,336 is still under the band (63,812). Pixels identical. |
| 8 | 23:38 | Review 0 resumes the loop (the first stop at 22:56 broke protocol rule 4). Every remaining no-risk trim stacked: glyph names, `cupertino_icons`, and the web-only emoji font as WOFF2 without vhea/vmtx, its empty GSUB and glyph names | 3,144,978 | reverted | -45,602 is under the band (63,812). Pixels identical, so skwasm takes WOFF2 through `FontLoader`. Before it: no web-only switch for Roboto exists (skwasm adds it unless the pubspec-generated manifest names a `Roboto` family), and WOFF2 for Inter/Bricolage (-59,932 offline) is web-only: Android's libflutter.so has WOFF1 (`sfwoff.c`) but no brotli, and pubspec `fonts:` cannot be scoped per platform, so it would need FontLoader on every platform (a native cold-start cost). intl's `numberFormatSymbols` (all locales) is a mutable map `NumberFormat` reads, so it stays. |
| 9 | 23:53 | Inter and Bricolage as WOFF2 on the web, TrueType on devices: pubspec `fonts:` cannot differ per platform and Android's engine reads no WOFF2, so the fonts become assets (`.ttf` with `platforms: [android, ios, linux, macos, windows]`, `assets/fonts/web/` with `platforms: [web]`) registered by `loadAppFonts` (FontLoader, every platform, before `runApp`, 5 s cap, failures only log; it also replaces `loadWebEmojiFont`). Glyph names go too. `scripts/app-fonts.sh` writes the WOFF2 files (wawoff2 2.0.1); `web_woff2_fonts_test.dart` checks they hold the same tables as the TTFs. Widgetbook uses the same loader | 3,095,512 | kept | -95,068 (band 63,812). List pixels identical; goldens unchanged (they already loaded these files with FontLoader); flutter gate 1856 + Widgetbook 336, lint, web-prod pass; the Android asset bundle has the six TTFs and no WOFF2. Devices now register the fonts with FontLoader in `main` instead of the engine's manifest, in parallel with the other awaited start-up work: same files, same glyphs, but not run on a device here (hz has none). |
| 10 | 23:58 | The leftover small trims: the emoji font as WOFF2 without vhea/vmtx, its empty GSUB and glyph names, and the unused `cupertino_icons` | 3,083,257 | reverted | -12,255, under the band (61,910). Pixels identical. |
| 11 | 00:01 | Web-only Inter and Bricolage without Greek and Cyrillic (the WOFF2 files only; devices keep every letter) | 3,020,987 | reverted | -74,525 clears the band and the list is pixel-identical (it has no Greek or Cyrillic), but on the web those letters would then draw in the engine's Noto Sans fallback instead of Inter: a visible change for users who type them, which guardrail 3 forbids. A number for the lead, not a step. |
| 12 | 00:02 | GPOS compaction (`fontTools.otlLib.optimize.compact`, levels 1, 5, 9) before WOFF2 | (offline) | reverted | Inter's WOFF2 grows (85,344 -> 86,824 at level 9, 85,292 at level 1), Bricolage saves 424 B. The score is the sum of the files' brotli sizes and WOFF2 does not shrink further under brotli, so no build was needed to see it misses. |
| 13 | 00:03 | WOFF2 with the hmtx transform too (fontTools' encoder with the Brotli wheel; Google's encoder does not transform hmtx) | (offline) | reverted | -6,288 over the six files, under the band. |
| 14 | 00:05 | Every near-miss stacked: 10 plus 13 | 3,076,971 | reverted | -18,541, under the band. Pixels identical. Fifth attempt in a row without a keep: stop rule 2. |
| fix | 01:45 | Review 1: `loadAppFonts` no longer leaks font errors. `FontLoader.load` awaits its reads one by one and stops at the first failure, so the other reads' errors reached `main`'s zone handler and error tracking (up to four PostHog exceptions per blocked font fetch, review 1 saw them). Each read now handles its own failure from the start and logs it; every face that loads still registers, in order, with the bytes viewed as FontLoader does (a first try that awaited all reads with `Future.wait` before registering left Inter unregistered in the Widgetbook tests: every weight measured the test font's 266.0 px instead of 143.96-149.06). `load_app_fonts_test.dart`: all six reads failing, and two of Inter's four, reach no zone handler; both fail on the old loader | 3,096,882 | kept (fix) | Not a ratchet step: a correctness fix. One measure: +1,374 B, all in main.dart.wasm (the loader's code), far inside the band; list pixels identical. flutter gate 1858 + Widgetbook 336, lint, web-prod pass. |

## Result (2026-11-06 00:06-00:09 CET, after review 0)

Final runs: 3,095,512 (d5b572b7), 3,095,508, 3,095,508 (the same build plus test and generator
edits). Median **3,095,508** bytes brotli, from **3,936,104**: **-840,596 (-21.4 %)**. gzip -9
total 4,935,153 -> 3,865,270 (-21.7 %). The boot fetches 21 files instead of 23.

| file (brotli bytes) | baseline | final |
| --- | --- | --- |
| canvaskit/skwasm.wasm | 1,209,789 | 1,209,789 |
| main.dart.wasm | 1,184,614 | 1,096,389 |
| Inter 400/500/600/700 (.ttf, now .woff2 on the web) | 640,485 | 349,520 |
| Noto Color Emoji fallback chunks 3, 6, 7 | 482,759 | 0 |
| NotoColorEmoji-icons.ttf (new, web only) | 0 | 60,655 |
| purchases_js_hybrid_mappings.js | 203,083 | 203,083 |
| Bricolage Grotesque 700/800 (.ttf, now .woff2 on the web) | 101,246 | 62,874 |
| Roboto (engine default) | 74,845 | 74,845 |
| the rest | 39,283 | 38,353 |

Kept: 1 (web emoji font), 2 (private-use glyphs and unused features), 3 (TrueType hinting),
5 (de/en framework localizations), 9 (WOFF2 on the web, glyph names out, fonts loaded by
`loadAppFonts`). Reverted: 1a, 4, 6, 7, 8, 10, 11, 12, 13, 14.

## Stop reason

**Stop rule 2: five attempts in a row without a kept improvement (10 to 14).** The first stop at
22:56 (after attempt 7) broke protocol rule 4: it named no rule. Review 0 sent the job back and
the loop resumed at 23:30; attempt 9 was then kept. Elapsed at the stop: about 2 h 25 of 6 h.

Weekly usage (`usage-gate`): 21:41 0.61 (before the baseline), 22:14 0.62, 22:56 0.63, 23:30
0.64, 23:53 0.65, 00:09 0.00 (the week reset at 00:00). Neither hour mark (22:41, 23:41) was
checked on the hour; the readings either side of each bracket it (0.62-0.63, 0.64-0.65). Never
near 0.95.

## Review 1 evidence (reviewer's runs, 2026-11-06 00:45-01:30 CET)

- Score reproduced bare on 68ab76e4: 3,095,468 (40 B from the median, in main.dart.wasm and
  flutter_bootstrap.js).
- Web, base 4a103f67 against head: the signed-in list in de-DE and en-US differs only in the
  blinking caret; typed `Ελληνικά Кириллица Tiếng Việt ąęł ß € № ½ 🦄🫖` is 0 px different.
- The dart2js + CanvasKit fallback (Safari < 18.2) draws the WOFF2 fonts: 0 px in Chromium
  (`canvaskit/chromium/`), caret only in Playwright WebKit (`canvaskit/canvaskit.wasm`).
- Native path: `flutter build linux --release`, base against head under Xvfb, the login screen
  is 0 px different; head's bundle has the six TTFs and no `web/`. That is the path Android and
  iOS take now; a phone is still untested.
- The 5 s cap: with `Inter-Regular.woff2` held 9 s the list shows at 5.8 s in fallback text and
  re-renders identically to a normal boot when the font arrives.
- Start-up on localhost (no latency), A/B under the measure lock: base 887/998/964/970 ms to the
  list, head 1028/1018/1013/1083 ms, about 50 ms later. The fonts now start when `main` runs
  (about 440 ms) instead of during engine init (about 350 ms). On a real link the 840 KB less
  outweighs it; `<link rel=preload as=font crossorigin>` for the Inter WOFF2 files in
  `web/index.html` would likely win the 50 ms back. That is job 129's area (LCP/TBT), so it is
  a suggestion, not a change here.

What is left, measured or estimated:

- Under the band: glyph names were folded into 9; the emoji font as WOFF2 (-11 KB),
  `cupertino_icons` (-1 KB), hmtx transform (-6 KB), dart2wasm `-O4` (-20 KB, unsound).
- **For the lead: RevenueCat's web SDK, -203,083 (-6.6 % of the final score).** The web app never
  sells (`app/lib/purchases/setup.dart`), but `purchases_flutter`'s web plugin injects
  `purchases_js_hybrid_mappings.js` in `registerWith`, so every web boot downloads 1 MB of
  JavaScript. Removing it means a fork or `dependency_overrides` of `purchases_flutter` without
  the web platform (or asking upstream for lazy loading). The brief rules out touching
  IAP/RevenueCat. Deleting the file after the build would make the script tag fail, which
  `flutter_bootstrap.js` treats as a failed boot and reloads.
- **For the lead: Greek and Cyrillic out of the web fonts, -74,525** (attempt 11). Visible for
  users who type those letters on the web (Noto Sans instead of Inter), so not kept.
- **Roboto, -74,845.** skwasm adds Roboto as its required default family (it lays out text with
  unregistered fonts in it) unless the font manifest names a `Roboto` family, and the manifest
  comes from pubspec `fonts:`, which every platform reads. No web-only switch exists.
- skwasm.wasm and skwasm.js are the engine (renderer unchanged). main.dart.wasm's remaining
  bulk is framework, Supabase, the engine's font fallback tables, and code under Siri and
  purchases (off limits). intl's all-locale `numberFormatSymbols` is a mutable map
  `NumberFormat` reads, so it stays. `flutter build web --wasm` does not pass dart2wasm's
  `--enable-deferred-loading`.
