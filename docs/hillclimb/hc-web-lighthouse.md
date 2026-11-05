# hc-web-lighthouse

Start: 2026-11-05 19:45:00 CET
Start epoch: 1793904300

Job 129. Goal: a faster Flutter web app (the `flutter build web --release --no-web-resources-cdn
--wasm` build, not `site/`) under Lighthouse, without changing what users see.

## Measurement

`tool/hillclimb/hc-web-lighthouse/measure.sh [runs=3]` prints one JSON line.

- **Build.** The production web build (`--release --no-web-resources-cdn --wasm --base-href /`,
  `config/auth.json` defines) into `app/build/web-hc`, with `SUPABASE_URL=http://127.0.0.1:62981`
  and a dummy publishable key. Under `flock /tmp/flutter-build-web.lock` (one web build per host).
- **Server.** `lighthouse.mjs` serves the build on 127.0.0.1:62980 the way Vercel does:
  vercel.json's SPA rewrite, Cache-Control and Content-Type headers, the CSP (with the fake
  Supabase origin in `connect-src`), brotli (quality 5) for text and wasm.
- **Backend.** `fake_supabase.py` on 127.0.0.1:62981: a fixed household of 24 items in 6
  categories (job 100's fixture) with CORS, `/auth/v1/user`, realtime 404 (the list runs
  offline-marked). No Docker stack.
- **Signed in.** Before each Lighthouse run the page opens `/manifest.json` on the origin and
  writes a gotrue session (far-future expiry, so no refresh call) to `sb-127-auth-token`.
  Lighthouse runs with `disableStorageReset` so the session stays; each run is a fresh Chromium
  profile (Playwright's chromium-1248, headless, `--no-sandbox`), so the HTTP cache is cold.
- **Page set.**
  1. `list`: `/`, the signed-in list. Checked: the DOM (semantics) contains "Bananen".
  2. `add`: `/add`, the app link that opens the add sheet on a cold start. Checked: the sheet's
     hint (ARB `typeToSuggest`, English or German) is in the semantics DOM and the list's rows
     ("Bananen") are not, since the sheet's barrier hides them. (Until review 0 the check was
     "an input is in the DOM", which the list's own add bar also passes; see "Harness changes".)
  A run where a page misses its state, or Lighthouse reports a runtime error, fails the measure.
  The final screenshots land in `/tmp/hc129-last/` for a look by eye.
- **Profile.** Lighthouse 13.6.0 (pinned in `package.json`), the **desktop** preset
  (`desktop-config.js`: 1350x940, simulated throttling with 40 ms RTT, 10 Mbps, CPU slowdown 1),
  performance category only. Never mixed with the mobile profile.
- **Score.** Each run: the mean of the two pages' Performance (0-100). Score: the median of the
  3 runs. Parts: per page, the median over the runs of performance, LCP, TBT, TTI, SI, FCP, CLS
  and total byte weight (informational; job 133 owns size). No randomness (`seed` 0); the
  noise is host CPU time feeding Lantern's simulation, which `/tmp/fg-hc-measure.lock` keeps
  other hill-climb jobs out of (but not the other lanes' builds and tests).

## Baseline (884b3c8d, 2026-11-05 19:49-19:51 CET)

| measure | runs (mean of pages) | score | list perf | add perf | list TBT | add TBT | list LCP | add LCP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 77, 76, 78.5 | 77 | 82 | 74 | 356 | 492 | 343 | 334 |
| 2 | 74, 74.5, 75 | 74.5 | 78 | 71 | 380 | 487 | 1455 | 1452 |
| 3 | 68, 68.5, 78 | 68.5 | 78 | 67 | 432 | 801 | 346 | 374 |

Baseline median **74.5**. Noise band: max - min = **8.5** (2 % of the median would be 1.5).
A kept step needs a score above 74.5 + 8.5 = 83 (3 measures, median, when near that line).

What the baseline shows (diagnostic copy `diag.mjs`, which also writes the full LHR):

- LCP is `div#splash` (the CSS background SVG). It is bimodal, 250-350 ms or about 1450 ms,
  depending on whether the simulated network fetches `splash/mark-light.svg` before or after the
  4.5 MB of engine and app code.
- TBT is all `main.dart.mjs` long tasks: one of 150-200 ms at about 0.5 s (engine and Dart
  start), a run of 50-60 ms tasks to 1.3 s, and a cluster of 60-240 ms tasks at 2.7-3.5 s (the
  first frames once the list data is in).
- SI 1.8 s (list) and 2.3 s (add): the splash stays until Flutter's first frame.
- Lighthouse 13 scores desktop as FCP 10 %, SI 10 %, LCP 25 %, TBT 30 %, CLS 25 %.

## Attempts

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 20:05 | Splash marks inline in splash.css (data: URIs from design/app-icon/build.mjs), so LCP (#splash) waits on no fetch | 77 (76.5, 77, 77) | reverted | +2.5 < band 8.5; LCP outliers gone (0/18 page runs at 1450 ms vs 6/18), TBT unchanged; near-miss to combine |
| 2 | 20:20 | Macrotask yields (`Future.delayed(Duration.zero)`) between start-up steps in `_main` (after semantics, Supabase.initialize, analytics, before runApp) | 73 (74, 73, 69); load 4-7 | reverted | Splits engine start from the first build, but the long task is the first real frame (layout ~120 ms + skwasm raster ~300 ms in one rAF task); TBT 445/535 unchanged |
| 3 | 20:30-20:49 | `<link rel=preload as=image>` for the splash marks in index.html (light/dark by media), so the LCP image starts with the page | 77.5, 76.5 (quiet host, load 5-6; 3rd stopped, median cannot pass 83); 66.5, 66.5, 74 at load 11-20 (discarded) | reverted | LCP outlier still appears (1470 ms, 1 of 12 page runs); TBT unchanged (359-371 / 480-489) |
| - | 20:50-21:00 | Diagnostic, not a step (reverted, not measured with measure.sh): `ShoppingListView` rebuilds only when what it draws changes (loaded, server rows, pending ops, catalog, prefs, fresh ids), not on usuals or connection emits | - | - | Readable-names profile build: the post-load list rebuild drops from 78 ms to 28 ms of Dart work, the periodic offline re-emit from 38 ms to 8 ms. The file belongs to #257 (job 117) until it merges |
| 4 | 21:00-21:10 | Web: lay out one line per bundled face (Inter 400-700, Bricolage 700/800), one face per task, after `runApp`, so face setup leaves the first text frame | 73 (66, 73, 78.5; load 5->12), 71 (load 5->7), 76.5 (load 4.6->5.8): median 73 | reverted | No TBT change visible through the noise (352-660 / 436-541) |
| - | 21:16 | Main moved (#257, #248, #254 merged); branch rebased onto 694046e0. #257 had owned `shopping_list_view.dart`, so attempt 5 waited for it | control on the new main: 72.5 (75.5, 72.5, 71; load 6.9->13.2), 73 (76, 73, 69.5; load 8.2->15.5) | - | The host ran 14 lanes; no window under load 6 for 30 min, so `quiet.sh` ran with `HC129_MAX_LOAD=9` for control and candidate alike |
| 5 | 21:50-22:18 | The list page rebuilds only on what it draws: a `DrawnList` value (loaded, server rows, pending ops, catalog, prefs, fresh ids) selected by `ShoppingListView`, the header, the add bar and the closed add sheet instead of watching the whole cubit; usuals, seen marks and repeated connection states no longer rebuild and relayout every row. Plus a widget test (`attempts/05-drawn-list.patch`) | 71 (68.5, 71, 78; load 8.3->11.2), 75 (75, 75, 75.5; load 7.2->6.3), A/B against the control above | reverted | Analyze clean, 1852 tests green (the new test fails on main, passes with the change). The rebuild still costs a frame: `BlocProvider`'s scope marks itself dirty on every emit, and each frame pays ~35 ms of raster readback on the web, so only ~50-80 ms of Dart work goes; candidate - control is +0 +- noise, the median cannot reach 83 |

Gating: the baseline and attempts 1-2 ran ungated (`measure.sh` directly). Attempt 3's counted
runs and attempts 4-5 ran through `quiet.sh`. So attempt 1's +2.5 compares like with like, while
attempt 3's +3 compares a gated candidate with an ungated baseline, which favours the candidate.
Attempt 5 has its own same-condition control.

## Harness changes after the baseline

- 2026-11-05 23:10 CET (review 0, must fix 1): the `add` page's ready check in `lighthouse.mjs`
  and `diag.mjs` now requires the sheet's hint and no list rows. Checked on the baseline build
  with the same stored session: on `/` list=true, add=false; on `/add` list=false, add=true. A
  confirming `measure.sh 1` (load 11.7) passed with score 75 (list 76, add 74). The score is
  computed the same way and every reported run showed the sheet open in its final screenshot,
  so no re-baseline.

## Result

**No kept step.** Baseline 74.5 (band 8.5), final 74.5: the branch changes no app code.

| part | baseline median (3 measures) |
| --- | --- |
| score | 74.5 (77, 74.5, 68.5) |
| list performance | 78-82 |
| add performance | 67-74 |
| LCP list / add | 343-1455 / 334-1452 ms (bimodal) |
| TBT list / add | 356-432 / 487-801 ms |
| TTI list / add | 3280-3294 / 3378-4300 ms |
| SI list / add | 1787-1804 / 2327-2649 ms |
| FCP | 201-202 ms |
| CLS | 0.00002 |
| total byte weight | 4,519,413 bytes (informational, job 133) |

**Stop: rule 2, 5 consecutive iterations without a kept improvement** (22:18 CET, 2 h 33 min after
the start; weekly usage 62 %).

## What limits the score (measured with `profile.mjs` and `frametrace.mjs`)

- **TBT is frames, and a frame on this host is mostly raster.** Headless Chromium has no GPU, so
  skwasm's WebGL runs in SwiftShader on the main thread (single-threaded skwasm: the page is not
  cross-origin isolated). `OffscreenCanvas.transferToImageBitmap` alone is ~35 ms per frame at
  1350x940, 600-900 ms over a load of ~15 frames; first-use shader compiles (~100 ms) and
  paragraph layout (~100 ms) come on top. Any frame with more than ~15 ms of Dart work is a long
  task.
- **The load's frames.** First frame (blank, spinner), shell with spinner (Dart 184 ms: 58 ms
  build, the rest the first text layout and font setup), list (112 ms Dart: 1,407 widgets),
  rebuilds of the whole list on the seen mark, the usuals and the connection state (78 ms, then
  38 ms every reconnect: the fake has no realtime, so the list runs offline-marked), the emoji
  font arriving (53 ms relayout of all text).
- **LCP is the splash `div`'s background SVG.** It is bimodal (~350 or ~1450 ms simulated)
  depending on whether Lantern queues `splash/mark-light.svg` behind the 2.8 MB of wasm. Inlining
  the SVG (attempt 1) removed the outliers; a preload (attempt 3) did not.
- **TTI ~3.3 s is mostly bytes:** 2.8 MB of brotli wasm (main.dart.wasm, skwasm.wasm) and 0.9 MB of
  fonts at Lantern's 10 Mbit/s (job 133's goal).
- **Noise.** Other lanes (Playwright stress runs, builds, `flutter test`) move TBT by 2x; a
  measure at load 11-20 scored 66.5 where the same build scored 77 at load 5. The band (8.5) is
  larger than any single app-level change found here.

## Next steps (for the lead; none is in this PR)

1. **Cross-origin isolation** (`Cross-Origin-Opener-Policy: same-origin` plus
   `Cross-Origin-Embedder-Policy: require-corp` or `credentialless` in vercel.json) lets skwasm
   raster on a worker. Side run, 2 Lighthouse runs per page at load 7.8, not a step: list TBT
   210-505 ms, add TBT 232-262 ms, list performance up to 91. It is a deploy-header change (out
   of scope here) and COOP `same-origin` breaks popup-based sign-in (Google, Apple) unless those
   flows are checked first.
2. **`ListCubit._onChannelStatus` emits even when the status is unchanged** (offline -> offline on
   every failed resubscribe), which rebuilds the list page and costs a frame. A
   `if (state.connection != status)` guard fixes it at the source; `list_cubit.dart` belonged to
   #253 (job 114) during this job.
3. `attempts/05-drawn-list.patch` (a proposal, applied nowhere; the list page selects only what it draws) is correct, tested
   and removes 50-80 ms of Dart work per needless rebuild, but no frame; worth landing together
   with 2.
4. The splash marks inline in `splash.css` (attempt 1, via `design/app-icon/build.mjs`, owned by
   #237 during this job) make LCP stable at ~350 ms (+2.5 here, inside the band).
