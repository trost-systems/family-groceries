# Hill-climb: hc-ui-perf

Start: 2026-11-05 08:00:54 CET (epoch 1793862054)

Job 108. Branch `job/108-hc-ui-perf`. Runner: the box. The brief said Hetzner, but the lead
moved the job to the box at 07:59 to fill a free slot. The box has no Docker and no sudo,
so there is no local Supabase here. See "Backend" below. Harness:
`tool/hillclimb/hc-ui-perf/measure.sh`, next to the other hill climbs' tools.

## What is measured

The real app (`lib/main.dart`'s `bootstrap`) is built in profile mode for Linux desktop with
the entrypoint `app/test_driver/ui_perf_probe.dart`. It runs under `xvfb-run` (screen
1280×1024×24). The window has the Linux runner's fixed default size of 412×892, so the list
shows one column, as on a phone. The engine logs `Using the Impeller rendering backend
(OpenGLESSDF)`, and Xvfb's GL is Mesa llvmpipe, so the raster thread draws on the CPU.

The probe waits for the list, then runs four flows. The input is synthetic touch events
(`PointerDeviceKind.touch`) sent through `GestureBinding.handlePointerEvent`. Every tap
asserts that the hit test reaches the widget it aims at.

1. `fling`: flicks the 300-item list from top to bottom and back. Each flick is a drag of
   6 moves × 60 px, time-stamped 8 ms apart (7,500 px/s), with one move per frame. The next
   flick starts when the list is at rest. It ends at the top, or the flow fails.
2. `add`: taps the add field, which opens the sheet. Then 20 fixed names (`_newItems`), each
   typed one letter per 40 ms through `EditableTextState.updateEditingValue` (what the engine's
   text input calls) and sent with `TextInputAction.send`. Then the sheet closes through its
   own `onClose`. The flow checks that all 20 are open items in the `ListCubit`.
3. `tick`: ticks the 20 topmost fully visible rows, one tap per 250 ms, so their
   strike/close animations overlap. Then it scrolls "Zuletzt verwendet" into view, opens it,
   and taps the 20 used rows to put them back (unticks), each scrolled into view first. It
   checks that all 20 are active again.
4. `sections`: 10 times, folds the topmost open store section (a tap on its divider), then
   opens the add sheet (a tap on the field) and closes it. Then it unfolds the 10 sections
   again, lowest first.

Between flows the app settles: no frame scheduled and no ticker running for 100 ms, then
1.5 s more so the engine's batched `FrameTiming`s arrive. Every `FrameTiming` reported
during a flow belongs to it (`SchedulerBinding.addTimingsCallback`). `idle_frames` counts
frames while nothing happens after the last flow; it is 0, so nothing animates in the
background.

### Score

Per flow, over its frames (nearest-rank percentiles, ms):

    flow score = p90(build) + p90(raster) + 2 × jank %
    jank % = 100 × frames with build + raster > 16.7 ms / frames

A run's score is the mean of the four flow scores. One measurement is 1 discarded warm-up
launch, which fills the shared Mesa shader and fontconfig caches, then 3 launches. The
`score` is the median of the 3 run scores. `parts` holds, per flow, the median over the 3
runs of: frames, p50/p90/p99 build and raster, jank %, the worst frame (build + raster),
and the flow score. It also holds `run_scores`, `idle_frames` and `seed` (0, because nothing
is random). Lower is better. The timing runs hold `flock /tmp/fg-hc-measure.lock`.

### Backend

`tool/hillclimb/hc-ui-perf/fake_supabase.py` stands in for local Supabase, which needs
Docker. It serves the endpoints the list, the add sheet and a tick call. The household comes
from the job 18 fixtures:
- the ten stores of `test/fixtures/scenarios/many-stores.yaml`, with their walk orders and
  hidden categories;
- the default categories of `public.seed_household`, plus `Tiernahrung`;
- 300 open items, built from the names of `solo-long-list.yaml` in their categories. Each
  name is used up to 5 times with a variant prefix ("Bio-", "Frische ", ...), so there is one
  open item per canonical key, as on a real list. The items are spread over the 10 stores and
  no store, every 5th has a brand, and quantities come from the fixture.

Writes (`put_item`, PATCH, DELETE) change the in-memory rows, so a tick or an add is
acknowledged as the database would acknowledge it. Every launch gets a fresh server and a
fresh data directory that holds only a signed-in session. The realtime socket answers 404,
so the list runs offline-marked, the same in every run.

Why it is repeatable: the data, the input events and their timestamps, the window size, and
the order of steps are all fixed. The flows wait for the app to settle instead of sleeping
fixed times, except for the deliberate tap and typing gaps. What is not fixed is the box.
Raster runs on llvmpipe threads across all 8 cores, and other jobs' builds and tests run
outside the lock. That is the noise the band below has to absorb.

Tried before freezing: `LP_NUM_THREADS=1` (single-threaded llvmpipe) slowed raster 2 to 3×
(p90 11 to 16 ms) and made jank dominate the score (25.8 to 32.8). `LP_NUM_THREADS=2` scored
10.8 to 13.2, which is no steadier. So the harness keeps Mesa's default.

## Baseline

Commit 82fece1a (main 03ba0617 plus the harness). There were 3 runs of `measure.sh` (each
the median of 3 launches) on the box (8 cores, 16 GB), with load average 2 to 4 from other
jobs. The raw lines are in `tool/hillclimb/hc-ui-perf/baseline.jsonl`.

| time | score | run scores | fling | add | tick | sections |
| --- | --- | --- | --- | --- | --- | --- |
| 09:34 | 7.075 | 10.055, 7.075, 6.521 | 5.968 | 7.707 | 7.705 | 6.187 |
| 09:45 | 7.740 | 7.740, 6.874, 8.072 | 5.578 | 8.613 | 7.228 | 7.087 |
| 09:51 | 7.479 | 8.869, 7.479, 6.764 | 6.315 | 9.222 | 7.407 | 7.066 |

**Baseline 7.479, band 0.665** (max − min; 2 % of the median would be 0.150). A step is kept
only if it scores below **6.814** and every guardrail passes.

Per flow, in the 09:51 run (ms, medians over its 3 launches):

| flow | frames | build p50/p90/p99 | raster p50/p90/p99 | jank % | worst |
| --- | --- | --- | --- | --- | --- |
| fling | 662 | 0.702/2.944/5.236 | 2.855/3.371/4.072 | 0.00 | 10.5 |
| add | 707 | 0.246/3.264/5.652 | 3.510/4.269/7.269 | 0.85 | 51.2 |
| tick | 1116 | 0.295/0.932/11.566 | 3.780/5.194/6.968 | 0.63 | 245.8 |
| sections | 591 | 0.331/0.776/10.133 | 3.573/4.886/6.107 | 0.68 | 20.4 |

Raster p90 is the largest term in every flow, so the work goes there first.

Load matters. A measurement at 09:13, on the same code but before the harness was frozen,
with load 5 to 6 (another job's fuzz test running at full speed on one core), scored 17.09.
In that run, tick raster p90 was 15.7 ms and jank was 10.7 %. Measurements taken under that
kind of load are not comparable, so each attempt's measurement notes the load average.

## Guardrail reference (main, this box)

`flutter test` in app/: +1738 ~88 -4. The 4 failures are the "wide" goldens (list wide and
add sheet wide, each light and dark): "Pixel test failed, 0.00%, 13px diff detected". They
fail the same way on untouched main on this box (font rasterisation of this host). CI on
main is green. A step passes this guardrail when it gives the same 1738 passes and the
same 4 box-only failures, and CI's `ci-ok` stays green on the PR. `flutter analyze`: No
issues found.

## Attempts

Load gate (from attempt 3 on): measure.sh is unchanged, but each attempt's measurement starts
only when the box's 1-minute load average is below 3.5, as during the baseline (2 to 4). A
measurement that ends with load above 6 is repeated. Other jobs' tests and builds run
outside `/tmp/fg-hc-measure.lock`, and at load 11 every raster p90 doubles.

The keep bar is score < 6.814 (best 7.479 − band 0.665).

| # | time | change | score | kept/reverted | why |
| --- | --- | --- | --- | --- | --- |
| 1 | 10:01 | One `Opacity(0.55)` around the column of "Zuletzt verwendet" rows instead of one per row (the rows never overlap, so the pixels are the same). Test `list_screen_test` "faded" assertion: Opacity looked up as an ancestor instead of a descendant. | 7.789 (6.496, 7.789, 8.059; load 6→1) | reverted | trace.py (untick window, last ~263 frames): saveLayers 5.4 → 1.8 per frame, raster 9.5 → 4.4 ms per traced frame. But that window is about ¼ of the tick flow's 1,100 frames, so the tick flow's raster p90 moved only 5.19 → 4.59 ms, inside the band. Patch kept out of tree. |
| 2 | 10:20 | The emoji icons of the list rows and the add sheet's rows name their font (`fontFamilyFallback: emojiFontFallback`, `['Noto Color Emoji']`) instead of leaving it to the per-character fallback. | **6.598** (8.075, 6.598, 6.264; load 4.5→2, 3→1, 1→5) | **kept** | trace.py CPU samples, fling: fontconfig was 259 of ~1,700 UI-isolate samples (Skia asks fontconfig for an emoji face for every new paragraph, uncached). With the font named: 0 samples. Fling build p90 2.6–2.9 → 1.0 ms in all three measurements. Screenshot of the settled list (shot.py): 0 px differ from main, the same face. Tests +1738 −4 (the same box-only goldens, still 13 px each). New bar: < 5.933. |
| 3 | 10:53 | `shownSectionsIn(state)`: the list's sections worked out once per `ListState` (an `Expando` in `sections.dart`), not on every build of the list, its frame and the add sheet (every key typed). | 7.168 (15.735, 7.168, 6.248; load 3.4→1.7) | reverted | Add build p90 3.2–3.3 → 2.91 ms. The others moved only within noise. A first measurement (21.03) ran at load 11 (another job's coverage run on every core, outside the lock) and is void. |
| 4 | 11:41 | Near-misses together (the plateau rule): attempt 1 (one fade layer for the used rows) + attempt 3 (`shownSectionsIn`) + `sheetRows`' on-list keys once per `ListState` (300 × 3 `foldName` per key typed before). | 6.394 (6.115, 7.577, 6.394; load 3.1→2.2) | reverted | Add build p90 3.2 → 1.65 ms (the memo works), but tick and sections raster p90 came out at 5.6 and 5.2 ms, so the total is 0.2 better than best, not 0.665. |
| 5 | 12:03 | The list hands back the same `ItemRow` widget for a row whose item, category, `fresh` and `last` are unchanged, so a change to one item doesn't rebuild every row on screen. (`SemanticsProperties` has no `==`, so every rebuilt row also re-sent its semantics node.) | 6.202 (6.307, 6.111, 6.202; load 3.5→0.6) | reverted | 0.40 better than best, not 0.665. Tick semantics churn is mostly transforms of rows moving up under a closing one (8,847 changed nodes), which this does not touch. |
| 6 | 12:26 | Attempts 4 and 5 together. | 11.6 (14.609, 6.761, 11.6; load 0.9→3.3) | reverted | The first try failed in the probe; its error was cut off in my log (that launch's add flow took 23.6 s instead of 15, which points to load). The retry's launches show raster p90 of 9 ms in add and tick, which is load, but by the gate's rule the result stands. I judged that a clean repeat (up to 3 gated measurements) plus the write-up would not fit before the 6 h mark, and did not repeat it. |

Every reverted attempt is in `tool/hillclimb/hc-ui-perf/attempts/` as a patch against the
commit it was tried on (`git apply` from the repo root).

## Result

| | score | fling | add | tick | sections |
| --- | --- | --- | --- | --- | --- |
| baseline (median of 3, band 0.665) | 7.479 | 6.315 | 9.222 | 7.407 | 7.066 |
| final = attempt 2 (median of 3) | **6.598** | 4.692 | 9.344 | 7.249 | 6.477 |

Flow scores are from the median measurement of each set of three. The kept step moves fling
the most: build p90 2.6–2.9 → 1.0 ms in all three measurements. It also removes fontconfig
calls from every flow that lays out new rows. −11.8 % overall.

## Where the frame time goes (for the next climb)

- **Raster p90 is the largest term in every flow, and most of it is not the app's.** In fling,
  the embedder's `FlutterCompositorPresentLayers` takes about 1.6 ms per frame (GTK draws the
  frame on the main thread, and raster waits for it). Encoding the one render pass takes about
  0.5 ms. In add and sections, present grows to 5–6.6 ms per frame. With `NO_AT_BRIDGE=1` it
  falls to 3.65 ms, so about half of it is the accessibility bridge working through semantics
  updates on the main thread. Those updates follow the sheet's resize animation and the nav
  bar sliding back, which is real geometry (trace mode counts them per node).
- **Offscreen passes:** every `Opacity` between 0 and 1 is a `saveLayer`. On Impeller GLES
  each one costs a texture create and destroy per frame (`ConsolidateHandles`). The used rows
  (attempt 1) and the leaving rows' fade are the ones in the flows. The leaving rows' fade
  covers a strike line over text, so per-element alpha would not give the same pixels.
- **Jank** on a quiet box is mostly one-off frames: Impeller compiles pipelines on llvmpipe the
  first time a flow draws something new (100–270 ms raster), and two 90 ms build frames in tick
  are `SliverList` building every row on a jump to the bottom and back (rows have no fixed
  height).
- **Build:** before attempt 2, fontconfig was 15 % of the UI isolate in fling. In add, each key
  typed reran `sectionsOf` (300 items, `foldName` sort) and `sheetRows`' 900 `foldName` calls
  (attempts 3 and 4 cut add build p90 from 3.2 to 1.65 ms, which is under the band on the
  four-flow mean).

## Stop reason

**An early stop by judgment, at about 5 h. No protocol rule triggered.** The start was 08:00:54
and the last attempt started at 12:26; the write-up began at about 12:57. The 6-hour mark
(14:00:54) had not been reached, and attempts 3 to 6 were 4 misses in a row, so the 5-in-a-row
rule had not hit either. I judged that a seventh attempt with up to three gated measurements plus
the write-up would not finish before 14:00, and stopped. An earlier version of this log, the PR
and the done summary called this "the 6-hour rule"; that was wrong (review 0). Claude weekly
usage was 0.39 → 0.50, well under the 0.95 stop.

## Notes from review 0

- **Probe edit after the baseline.** `app/test_driver/ui_perf_probe.dart`, which measure.sh
  builds, was edited at 10:43–10:45, after the baseline (09:34–09:51) and after attempt 2 was
  kept (10:20): it gained the `_SemanticsChurn` class for trace.py and dropped an unneeded
  import. The scored path does not change: the class's constructor does nothing, `watch()` runs
  only when `HC108_TRACE_FLOW` is set (trace mode), and measure runs never set it. The same
  holds for the earlier trace hook (09:55), which only skips flows and adds delays in trace
  mode. measure.sh, frames.py and fake_supabase.py were not changed after the baseline. So the
  harness stayed frozen except for these trace-mode-only additions to the probe.
- **The band underestimates the noise.** Attempt 2's own three measurements spread 1.81
  (8.075 / 6.598 / 6.264), almost 3× the 0.665 band from three baseline samples. The keep holds:
  the reviewer's interleaved rerun (main 10.037 vs branch 7.811 at load 0–2.3) and the fling
  build p90 (3.1–4.0 ms on main, 1.19–1.20 on the branch in every run) reproduce it. The next
  climb should re-baseline with more launches or score CPU time per frame.
- **Usage checks.** The first `usage-gate` call came at 09:56, after the baseline instead of
  before it. The 09:00 and 13:00 checks are missing, and the 12:00 check ran at 12:24. Weekly
  usage was 0.39–0.50 against a 0.95 stop, so nothing would have changed.
- **Kept steps are not separate commits on the branch.** `scripts/push-pr.sh`, which the repo
  requires, squashes the branch into one commit. The step commits (82fece1a baseline harness,
  04e44bef the kept step, the tooling commits) existed before that squash; this log records each step.
- **The harness hangs now and then.** The reviewer lost 3 of 9 measure.sh runs (2 on the
  branch, 1 on main): one hit the probe's 240 s timer after fling, two were
  `subprocess.TimeoutExpired` after 300 s with no probe output. Attempt 6's first try failed the
  same way. `frames.py` discards the child's stderr on a timeout, so the cause is not visible.
  Fixing that (print the stderr, retry a hung launch once) changes the measurement, so it needs
  a re-baseline and is left to the next climb.

## Next ideas

1. Attempts 4 + 5 again on a quiet box: each measured 0.2–0.4 better than the kept step, and
   they are independent (build per key typed; rows rebuilt per list change).
2. A harness with less raster noise: more launches per measurement (needs a re-baseline), or
   CPU time per frame instead of wall time. Raster under shared load swings ±1 ms per flow,
   which is more than most allowed changes move.
3. The `ExcludeSemantics` flip on the list when the sheet opens and closes removes and re-adds
   about 55 nodes each time (1,106 per sections flow). A screen reader needs that, but it is the
   biggest single semantics update and worth a look with an a11y review.
