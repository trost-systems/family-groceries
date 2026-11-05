# Job 108: hill-climb hc-ui-perf (UI frame times and jank)

Branch `job/108-hc-ui-perf`, runner: the box (moved from Hetzner by the lead at 07:59). Started
2026-11-05 08:00:54 CET. Stopped early by judgment at about 5 h, with no protocol rule triggered (see the log's "Stop reason"). PR marked DO NOT MERGE; the lead reviews and merges.

## What was built

- `tool/hillclimb/hc-ui-perf/measure.sh`: builds `app/test_driver/ui_perf_probe.dart` in Linux
  profile mode, runs 1 warm-up launch and then 3 launches under Xvfb (window 412×892) and
  `flock /tmp/fg-hc-measure.lock`, and prints one JSON line. The score is the mean over 4 flows
  of p90 build + p90 raster + 2 × jank % (frames over 16.7 ms), median of the 3 launches. The
  flows are fling 300 items down and back, add 20 items through the sheet, tick and untick 20,
  and fold 10 sections while opening and closing the sheet.
- `fake_supabase.py`: a household built from the job 18 fixtures (10 stores with walk orders,
  300 open items), with writes acknowledged.
- `trace.py`: per flow, the raster and UI thread timeline by self time, the Dart CPU profile
  (Dart profiling enabled through `FLUTTER_ENGINE_SWITCHES`), and semantics churn per node.
- `shot.py`: a screenshot of the settled list and a pixel diff between builds.
- The kept app change: the emoji icons of the list rows and the add sheet's rows name their
  font (`emojiFontFallback` in `app/lib/list/list_view/item_icon.dart`).

## Result

Baseline 7.479 (band 0.665) → **6.598** (−11.8 %), the median of 3 measurements. Fling build
p90 went from 2.6–2.9 to 1.0 ms: Skia had asked fontconfig for an emoji face for every new row's
paragraph, about 15 % of the UI thread while flinging. 6 attempts: 1 kept, 5 reverted. Patches
are in `tool/hillclimb/hc-ui-perf/attempts/`. The full log, the reasons and where frame time goes
are in [docs/hillclimb/hc-ui-perf.md](../hillclimb/hc-ui-perf.md).

## How to verify

    tool/hillclimb/hc-ui-perf/measure.sh            # one JSON line, about 6 min
    xvfb-run -a python3 tool/hillclimb/hc-ui-perf/trace.py app/build/linux/x64/profile/bundle 60881 fling test/fixtures/scenarios
    xvfb-run -a python3 tool/hillclimb/hc-ui-perf/shot.py app/build/linux/x64/profile/bundle 60881 test/fixtures/scenarios /tmp/a.png

- `flutter test` in app/: +1738 ~88 −4, about 2 min. The 4 failures are the "wide" goldens
  (13 px, 0.00 %). They fail the same way on untouched main on this box, and CI is green there.
- `flutter analyze`: No issues found.
- The settled list's screenshot is byte-identical before and after
  (`docs/screenshots/108/`).

## Missing or open

- Who benefits: the speedup is Linux-only (fontconfig), and Linux isn't shipped. The change is
  expected to be neutral on iOS, Android and web. Web is verified neutral by review 0 (0 px
  different on the list and the add sheet); the name doesn't match the web engine's
  `Noto Color Emoji 0…N` fallbacks. Android (ideally Samsung) and iOS are inferred, not tested
  on a device.
- The harness was frozen after the baseline except for trace-mode-only probe additions (log,
  "Notes from review 0"). measure.sh hangs now and then (3 of 9 runs in review 0); the fix
  needs a re-baseline and is left to the next climb.
- No local Supabase (no Docker on the box): the flows ran against the fake backend.
- Attempts 4 and 5 (add build p90 3.2 → 1.65 ms; unchanged rows not rebuilt) each came within
  0.2–0.4 of the best but not past the band. They are the first thing to retry on a quiet box.
