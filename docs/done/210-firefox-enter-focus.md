# Job 210: Firefox keeps the add field after an add by Enter (2026-11-13)

Merged as `ab93915a` (PR [#409](https://github.com/trost-systems/snacklist/pull/409)) on
13 Nov 2026 at 23:40 Europe/Berlin. No flag: it reaches every web user with the next web
release, and TestFlight and Play internal with the next green main build (the native apps keep
`onSubmitted` and do not change).

## What was broken

In Firefox, an add by Enter in the list's „Was brauchst du?“ field often left the field without
focus about 80 ms later. The next typed item went nowhere until a click. Chromium and WebKit were
fine. It predates Flutter 3.50 (job 201 measured 7 of 12 CI runs on 3.47).

## Root cause

Flutter web delivers each Enter twice: the engine's window capture `KeyboardBinding` hands it to
the bar's `Focus.onKeyEvent`, which submits, and the input's keydown listener sends
`performAction(send)`, which also ran the field's `onSubmitted`. A non-null `onSubmitted` makes
`EditableText` restart the text connection (`clearClient`, `setClient`, `show`). On web
`clearClient` blurs the input through `FlutterViewManager.safeBlur`, a zero-delay timer, and the
next frame focuses the same input again. When the frame runs first, the stale blur moves the focus
to `<flutter-view>` after the refocus. Evidence (focus timeline, textinput spy, `--no-strip-wasm`
stacks) is in docs/DECISIONS.md, job 210: forced locally, and seen naturally on CI (probe run
43458368794: `clearClient` +5 ms, refocus +51 ms, stale blur +78 ms).

## Fix

`app/lib/list/list_screen.dart`: on web the add field has no `onSubmitted`. The bar's key handler
already submits every Enter there, soft keyboards' included, so `EditableText` keeps its
connection and nothing blurs. iOS and Android keep `onSubmitted`. No timing workaround.

## How to verify

- `scripts/verify.sh --only e2e -- tests/wasm-boot.spec.ts` (chromium, webkit, firefox): two items
  in a row by Enter, the second typed without a click, and no focusout of the field's input.
- Results: before the fix all 3 Firefox tests failed locally on the focusout count. After it,
  90 of 90 locally (3 tests, 10 times, 3 engines). On CI, Firefox and Chromium passed 60 of 60
  (run 43465478452), WebKit 30 of 30 (run 43472015701). The PR's own CI on the merged head: [run 43517330089](https://github.com/trost-systems/snacklist/actions/runs/43517330089), green.
- Opus review: PASS, no must-fix (jobs/210-firefox-enter-focus/review.opus.md in the ops dir).
- Screenshots: docs/screenshots/210/ (Firefox, Chromium, WebKit after two adds by Enter).

## Also changed

- All three wasm-boot tests are `test.slow` in WebKit. On CI the JS fallback ran out of its 60 s
  in 5 of 10 runs; it took 53 s on main already.
- verify-snacklist `quick-add.md` (`qa-enter`, coverage) and the Quick add section of
  FEATURES-FOR-WRITERS.

## Not done, and why

- No upstream Flutter issue was filed from this runner for the engine's stale `safeBlur` (it does
  not check whether the element was enabled again). Our code no longer triggers it. The engine
  sources are named in DECISIONS job 210.
- The guided start's „Noch etwas?“ field keeps its 50 ms refocus timer (job 201). It is safe:
  timers run in deadline order, so the engine's zero-delay blur always lands first (0 of 32 on
  CI). Moving it to the add bar's key-handler pattern would remove that timer and could be a
  small follow-up.
