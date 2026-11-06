# Hill-climb hc-design-v2-app (job 154)

Design quality of the Flutter app, scored by a council of three fresh Claude Opus judges against a rubric researched and frozen before the baseline (10 aspects: typography, hierarchy, colour and contrast, spacing, layout, design-system consistency, accessibility, motion, iconography, empty and error states; motion is not scorable from stills and is left out). Each judge answers every criterion yes/no/n.a., then scores each aspect 1-10 against anchors. Aspect score = median of the 3 judges; overall = minimum of the aspect medians (the mean is reported too).

The judges, the rubric, the prompts and the screenshot harness live in the job's ops directory, outside this repo; nothing in the repo calls a model. Judges are separate processes with an empty working directory and only the screenshots; they never see scores, steps, diffs or which version is new. The harness refuses to score (score 0) when any frozen input's hash differs.

## Keep rule

A step is kept only if (1) a blind pairwise council prefers it: baseline and candidate shown as "Version P" / "Version Q" in a random order per judge, each judge picks P, Q or tie per aspect, aspect verdict = majority, step verdict = majority of the decided aspects; (2) the absolute minimum does not drop by more than the noise band below the best kept state; (3) every guardrail passes.

## Screenshot set (fixed before the baseline)

44 phone frames: login, login with field errors, list, list scrolled, empty list, add sheet, edit sheet, More, settings, stores, store details; each on a large phone (430x932, light and dark, text 100 %), and a small phone (375x667, light at text 150 %, dark at 100 %). Rendered by the golden test path (flutter_tester, 1 px per logical px, the app's fonts, Noto Color Emoji as the device's emoji fallback). Two renders of the same tree are byte-identical.

## Baseline

Main at `5e639d3a`. Three absolute runs: minimum [5, 4, 4], mean [5.778, 5.333, 5.222]. Score (median) **4**, noise band 1 (max - min, floor 0.5).

| aspect | typography | hierarchy | color_contrast | spacing | layout | consistency | accessibility | iconography | empty_error_states |
|---|---|---|---|---|---|---|---|---|---|
| run 1 | 5 | 6 | 7 | 6 | 5 | 5 | 5 | 6 | 7 |
| run 2 | 5 | 6 | 6 | 5 | 5 | 5 | 4 | 6 | 6 |
| run 3 | 5 | 6 | 6 | 5 | 4 | 5 | 4 | 6 | 6 |

A-vs-A check (identical images as P and Q, 3 runs): 27 of 27 aspect verdicts tie, 81 of 81 single judge votes tie; seeds [[653842163, 762618141, 229787978], [1547579595, 1303701877, 4188707986], [4137534259, 2133147557, 1258898823]].

## Steps

| # | hypothesis | pairwise (cand / base / tie aspects) | min (mean) | verdict | note |
|---|---|---|---|---|---|
| a1 | field errors and helper text wrap instead of ellipsis (errorMaxLines app-wide) | cand 3 / base 0 / tie 6 | 4 (mean 5.556) | keep | guard-app green: analyze clean, 2038 passed / 90 skipped, widgetbook 334, no golden changed |
| a2 | edit sheet: Marke/Menge row stacks when it does not fit (no truncated label or clipped brand at 375 px / 150 %) | cand 4 / base 0 / tie 5 | 5 (mean 6.111) | keep | guard-app green: analyze clean, 2041 passed / 90 skipped, widgetbook 334; goldens edit-sheet-light/dark updated (390 px now stacks Marke/Menge); string-literal diff = moved fieldKey lines only |

Per-step aspect medians and per-aspect pairwise votes:

- **a1** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 5, layout 5, consistency 5, accessibility 4, iconography 6, empty_error_states 6; pairwise typography cand, accessibility cand, empty_error_states cand; seeds [1690377694, 3917212416, 158980696].
- **a2** (keep): medians typography 6, hierarchy 7, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise typography cand, spacing cand, layout cand, accessibility cand; seeds [1123057871, 1401365860, 3040359756].

