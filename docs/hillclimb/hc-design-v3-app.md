# Hill-climb hc-design-v3-app (job 154b, harness v3)

Continues job 154 (`hc-design-v2-app.md`) on its final state with harness v3: the shots draw the phone's status bar, and More, settings and the stores pages sit inside the app shell with its tab pill, as on a phone. v3 numbers are not comparable with v2's.

Design quality of the Flutter app, scored by a council of three fresh Claude Opus judges against a rubric researched and frozen before the baseline (10 aspects: typography, hierarchy, colour and contrast, spacing, layout, design-system consistency, accessibility, motion, iconography, empty and error states; motion is not scorable from stills and is left out). Each judge answers every criterion yes/no/n.a., then scores each aspect 1-10 against anchors. Aspect score = median of the 3 judges; overall = minimum of the aspect medians (the mean is reported too).

The judges, the rubric, the prompts and the screenshot harness live in the job's ops directory, outside this repo; nothing in the repo calls a model. Judges are separate processes with an empty working directory and only the screenshots; they never see scores, steps, diffs or which version is new. The harness refuses to score (score 0) when any frozen input's hash differs.

## Keep rule

A step is kept only if (1) a blind pairwise council prefers it: baseline and candidate shown as "Version P" / "Version Q" in a random order per judge, each judge picks P, Q or tie per aspect, aspect verdict = majority, step verdict = majority of the decided aspects; (2) the absolute minimum is not below the floor: the baseline median minus the noise band, raised (never lowered) to a kept step's minimum minus the band; (3) every guardrail passes. Each step targets the aspect with the lowest median in the best kept state; its delegate gets that aspect's name and the judges' one-line reasons, no other scores, and views the current screenshots before and after its change.

## Screenshot set (fixed before the baseline)

44 phone frames: login, login with field errors, list, list scrolled, empty list, add sheet, edit sheet, More, settings, stores, store details; each on a large phone (430x932, light and dark, text 100 %), and a small phone (375x667, light at text 150 %, dark at 100 %). Rendered by the golden test path (flutter_tester, 1 px per logical px, the app's fonts, Noto Color Emoji as the device's emoji fallback). v3: an iOS status bar (clock, signal, Wi-Fi, battery; the camera island on the large phone) drawn over the top inset; More, settings, stores and store details rendered through the app's own routes, inside the shell with the floating tab pill. Two renders of the same tree are byte-identical.

## Baseline

Main at `31d5086a`. Three absolute runs: minimum [5, 5, 6], mean [6.333, 6.444, 6.556]. Score (median) **5**, noise band 1 (max - min, floor 0.5).

| aspect | typography | hierarchy | color_contrast | spacing | layout | consistency | accessibility | iconography | empty_error_states |
|---|---|---|---|---|---|---|---|---|---|
| run 1 | 6 | 6 | 7 | 6 | 5 | 6 | 6 | 7 | 8 |
| run 2 | 7 | 6 | 7 | 6 | 6 | 6 | 5 | 7 | 8 |
| run 3 | 6 | 7 | 7 | 6 | 6 | 6 | 6 | 7 | 8 |

A-vs-A check (identical images as P and Q, 3 runs): 27 of 27 aspect verdicts tie, 81 of 81 single judge votes tie; seeds [[2500517405, 119950134, 793517491], [815195760, 1978718378, 55260746], [463581022, 1219383487, 207674993]].

## Steps

| # | target aspect | hypothesis | pairwise (cand / base / tie aspects) | min (mean) | verdict | note |
|---|---|---|---|---|---|---|
| b1 | accessibility | add sheet: the band under the add field grows to fit the wrapped hint (only while the sheet is open), so the hint is no longer cut off at 150 % on the small phone | cand 2 / base 0 / tie 7 | 5 (mean 6.333) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; goldens add-sheet-compact light/dark updated (hint wraps there) |

Per-step aspect medians and per-aspect pairwise votes:

- **b1** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 5, iconography 7, empty_error_states 8; pairwise layout cand, accessibility cand; seeds [4124828050, 3597097864, 2767896956].

