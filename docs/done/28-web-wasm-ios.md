# Job 28: WebAssembly web build (+ iOS Safari tap focus)

Branch `job/28-web-wasm-ios`. Decisions: `docs/DECISIONS.md`, "Job 28".

## What was built

- **Wasm web build.** `scripts/vercel.sh`, `scripts/gates/web-prod.sh`,
  `scripts/gates/e2e.sh` and `fg sync` build with `flutter build web --wasm`.
  The output holds `main.dart.wasm` (dart2wasm + skwasm) and `main.dart.js`
  (dart2js + CanvasKit), and Flutter's loader picks one per browser. Every
  dependency compiles to wasm unchanged (the app already used `package:web`
  and `dart:js_interop`). The web-prod gate fails if either app is missing
  or a build script drops `--wasm`.
- **`vercel.json`** sets `application/wasm` for `.wasm` and `text/javascript`
  for `.mjs`. `e2e/web-smoke.mjs` checks both on a deployment and that
  Chromium loads `main.dart.wasm`. Checked locally against the Vercel-style
  build (CDN engine files, auth config): Chromium loads the wasm app, and
  Google and Apple sign-in still reach their pages.
- **Browsers that run wasm:** Chromium (Chrome, Edge, Android). Safari, every
  iOS browser and Firefox stay on the JS app, by Flutter's default
  `wasmAllowList`. Opting WebKit in is not safe on Flutter 3.47 (DECISIONS
  28.2), so **Peter's iPhone still runs the JS build**. Follow-up: add the
  opt-in after the Flutter 3.50 upgrade.
- **No COOP/COEP headers** (DECISIONS 28.3): measured no gain in Chromium,
  and they change how the browser treats every cross-origin request.
- **iOS Safari double tap:** no app code changed. Our first tap focuses the
  input inside the tap, and nothing blurs it or moves the focus later. After
  a tapped suggestion, one tap brings the keyboard back (DECISIONS 28.5 and
  28.6). The two-tap open Peter saw is Flutter's or Safari's.
- **Tests:**
  - `e2e/tests/wasm-boot.spec.ts`: Chromium on wasm, and the JS fallback
    without WasmGC, each signing up, adding an item and reloading.
  - `boot.spec.ts`: the boot retry for the wasm files as well.
  - `e2e/tests/iphone.spec.ts`: WebKit as an iPhone, a focus log around
    each tap.
  - `e2e/tests/perf.spec.ts`: boot and scroll timings per build, opt-in.
  - CI installs WebKit; Playwright projects `chromium`, `iphone`, `webkit`.
  - `scripts/e2e-summary.sh` adds a timings table to the job summary.

## Measurements (CI, ubuntu runner, no GPU, run 40941887799)

List drawn = navigation to the frame showing "200 Artikel" (signed-in reload,
median of three). Scroll = `requestAnimationFrame` intervals while the wheel
scrolls 200 items down and up (first pass / second pass). The before state
(dart2js) is the JS row, from the same build in the same run.

| Browser | Build | List drawn | Scroll mean (1st / 2nd) | p95 (1st / 2nd) | Frames > 25 ms (1st) |
| --- | --- | ---: | --- | --- | --- |
| Chromium | JS (before) | 1524 ms | 23.5 / 22.2 ms | 50 / 33.4 ms | 269 of 812 |
| Chromium | wasm (after) | 806 ms | 17.8 / 18.4 ms | 33.3 / 33.3 ms | 48 of 769 |
| Chromium | wasm, cross-origin isolated | 793 ms | 17.7 / 18.9 ms | 33.3 / 33.3 ms | 33 of 581 |
| WebKit | JS (before and after: the default) | 1698 ms | 450 / 300 ms | 553 / 403 ms | all |
| WebKit | wasm (opt-in, not shipped) | 1091 ms | 115 / 111 ms | 132 / 122 ms | all |

Sizes (gzip): Chromium downloads 2.87 MB on wasm (`main.dart.wasm` 1.32 MB +
`skwasm.wasm` 1.54 MB) against 3.18 MB on JS (`main.dart.js` 1.12 MB +
Chromium's `canvaskit.wasm` 2.06 MB). Safari: `main.dart.js` + `canvaskit.wasm`
2.91 MB, unchanged.

## How to verify

- `scripts/verify.sh --only web-prod` builds with `--wasm` and checks the
  output.
- `scripts/ci-e2e.sh --no-db --spec "tests/wasm-boot.spec.ts tests/boot.spec.ts tests/iphone.spec.ts"`.
- `scripts/ci-e2e.sh --no-db --spec tests/perf.spec.ts` for the timings (in
  the job summary and as `PERF` lines).
- After deploy: `node e2e/web-smoke.mjs <preview URL with share link>`; the
  Network tab shows `main.dart.wasm` in Chrome.

## Test results

- `flutter analyze`: no issues. `flutter test`: 374 passed. Web-prod gate:
  passed, and fails when `--wasm` is removed from `vercel.sh` (checked).
- CI e2e of the new specs: run 40941887799, 14 passed (wasm, JS fallback,
  boot retries, iPhone tap, timings in Chromium and WebKit).
- Lint gate pieces run locally (actionlint, tsc, check-gates, landing tests,
  lint.sh). Shellcheck 0.11 on the Mac flags existing scripts with its new
  SC2218 rule, and the release test needs Java's keytool; both are
  environment-only, and CI runs the whole gate.

## Screenshots

`docs/screenshots/28-web-wasm-ios/`: `28-wasm-chromium.png` (wasm app after
add and reload), `28-js-fallback.png` (JS fallback), `28-iphone-one-tap.png`
(WebKit iPhone: sheet open after one tap, typed text in), and
`28-iphone-after-pick.png` (after tapping a suggestion).

## Missing or blocked

- A real iPhone keyboard cannot be tested from here (no device, and no soft
  keyboard in Playwright's WebKit). Peter can check on
  preview.app.hummlist.com.
- WebKit wasm waits for Flutter 3.50 (follow-up above).
