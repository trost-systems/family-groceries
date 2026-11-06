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
| a3 | add sheet: return hex and close button drawn as visible 52x48 hex targets (were 36x28 / bare 24 px) | cand 3 / base 0 / tie 6 | 5 (mean 5.889) | keep | guard-app green: analyze clean, 2041 passed / 90 skipped, widgetbook 334; 8 add-sheet goldens updated (light/dark x normal, compact, wide, new store) |
| a4 | status-bar backing for scrolled list/login | - | not measured | dropped | app already paints a surface strip over the top inset (_Header) and login sits in SafeArea; judges read the cut rows as unbacked because the harness draws no status bar; fidelity gap, not an app defect |
| a5 | hex labels keep clear of the hex points at large text (settings segments drop icons/shrink, pill titles pad, chip insets scale) | cand 3 / base 0 / tie 6 | 5 (mean 5.889) | keep | guard-app green: analyze clean, 2044 passed / 90 skipped, widgetbook 334; goldens components-light/dark updated (300 px segmented sample drops its icons by the new fit rule) |
| a6 | add-sheet hint never clipped: the bottom band grows with the wrapped hint (min height, bottom inset padding) | cand 0 / base 1 / tie 8 | 4 (mean 5.667) | revert | pairwise prefers baseline or tie; all 3 judges: the grown bottom band lifts the add field into the empty-state heading (list-empty-small-light-150); reverted |
| a7 | section overlines (list categories, settings/More labels) raised from 11 to 12 px via one shared style | cand 1 / base 0 / tie 8 | 5 (mean 5.778) | keep | guard-app green: analyze clean, 2044 passed / 90 skipped, widgetbook 334; 32 goldens updated (16 screens x light/dark showing overlines: list, list-long, list-wide, add-sheet x4, more x5, settings x2, shell-pill x2) |
| a8 | edit sheet chips and footer buttons align to the fields' 16 px column | cand 2 / base 0 / tie 7 | 5 (mean 5.889) | keep | guard-app green: analyze clean, 2044 passed / 90 skipped, widgetbook 334; goldens edit-sheet-light/dark updated |

Per-step aspect medians and per-aspect pairwise votes:

- **a1** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 5, layout 5, consistency 5, accessibility 4, iconography 6, empty_error_states 6; pairwise typography cand, accessibility cand, empty_error_states cand; seeds [1690377694, 3917212416, 158980696].
- **a2** (keep): medians typography 6, hierarchy 7, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise typography cand, spacing cand, layout cand, accessibility cand; seeds [1123057871, 1401365860, 3040359756].
- **a3** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 5, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise consistency cand, accessibility cand, iconography cand; seeds [2038420474, 1736877222, 3676789202].
- **a5** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 5, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise spacing cand, layout cand, accessibility cand; seeds [3036915393, 2606075486, 2047378293].
- **a6** (revert): medians typography 6, hierarchy 6, color_contrast 6, spacing 6, layout 5, consistency 6, accessibility 4, iconography 6, empty_error_states 6; pairwise empty_error_states base; seeds [1951736743, 3218814032, 4143746600].
- **a7** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 5, layout 5, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise typography cand; seeds [872893802, 4136359585, 2474242037].
- **a8** (keep): medians typography 7, hierarchy 6, color_contrast 6, spacing 6, layout 5, consistency 6, accessibility 5, iconography 6, empty_error_states 6; pairwise spacing cand, layout cand; seeds [1168973824, 1866001727, 2759076947].

