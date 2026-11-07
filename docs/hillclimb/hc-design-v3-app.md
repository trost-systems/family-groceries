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
| b2 | accessibility | targets read as >=44 pt: the selected tab's hex face 34 -> 44 px, Verstanden on a sunken hex face filling its 44 px, Impressum/Datenschutz at 14 px underlined (wrap when narrow) | cand 3 / base 0 / tie 6 | 5 (mean 6.222) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; 30 goldens updated (add-sheet x4, list x4, login, shell-pill x2, sync x4; light/dark) |
| b3 | accessibility | list category overlines at the full secondary grey (no 75 % fade): 3.9:1 -> 7.1:1 light, 5.9 -> 9.7 dark; edit-sheet field hint at full grey | cand 0 / base 0 / tie 9 | 5 (mean 6.556) | revert | pairwise all tie (27/27 votes): judges did not see the colour change side by side; abs run accessibility 6, colour 8, mean 6.556 (near-miss) |
| b4 | layout | scrolled content fades out under the status bar (StatusBarBackdrop on the list and login) instead of a hard cut line right under the clock | cand 1 / base 0 / tie 8 | 6 (mean 6.333) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; no golden changed (goldens have no top inset) |
| b5 | layout | scroll edge: scrolled rows fade out across the whole floating top band, under the Anpassen pill (pinned header backdrop), login 48 px fade, only once scrolled; More's group dividers end inside the card | cand 2 / base 0 / tie 7 | 6 (mean 6.444) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; goldens list-long x2, more x10 updated; post-measure: the pinned header's fade moved under IgnorePointer (BoxDecoration hit-tests opaque), 44 shots byte-identical to the measured ones |
| b6 | consistency | dark mode draws the same components as light: the sticker shadow is a hard offset edge in the dark contour colour (was near-black + blurred glow, invisible), Verstanden's hex fill differs from its card | cand 1 / base 0 / tie 8 | 6 (mean 6.333) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; 25 dark goldens updated (light goldens unchanged); sync_indicator.dart draws no sticker shadow (unaffected) |
| b7 | consistency | one sheet scrim for add and edit sheets (shared sheetBarrier in the theme); the item hairline starts at the item name like the section rules (one divider language) | cand 3 / base 0 / tie 6 | 6 (mean 6.667) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; 30 goldens updated (sheets, list, list rows, shell pill, sync x8 for the rows behind the indicator); chip part of the delegate's change reverted before measuring (job 149: add sheet keeps chip icons) |
| b8 | consistency | More's row hexes draw glyph + outline in the border colour (dark read filled); settings grouped in More's group card; pushed pages share one page bar with the title at More's start line | cand 2 / base 4 / tie 3 | 5 (mean 6.111) | revert | pairwise prefers baseline or tie; consistency + iconography 3-0 cand, layout + accessibility 3-0 base (the taller two-row page bar; Kategorie hinzufügen covers the last store-details row at 150 %); retried without the page bar as b9 |
| b9 | consistency | b8 without the page bar: More's row hexes draw glyph + outline in the border colour (dark read filled); settings grouped in More's group card (shared HlGroup) | cand 2 / base 1 / tie 6 | 6 (mean 6.667) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; goldens more x5 dark, settings x4 updated; trade-off: colour and contrast 3-0 for the baseline (dimmer dark row icons), consistency and iconography 3-0 for the candidate |
| b10 | typography | small end of the type scale collapsed to one 13 px caption tier (bodySmall, labelMedium, labelSmall, section overlines with tracking, field errors): nothing must-read under 13 px | cand 3 / base 0 / tie 6 | 6 (mean 6.778) | keep | guard-app green: analyze clean, 2220 passed / 92 skipped, widgetbook 334; 50 goldens updated (app design + widgetbook) for the 13 px caption tier |

Per-step aspect medians and per-aspect pairwise votes:

- **b1** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 5, iconography 7, empty_error_states 8; pairwise layout cand, accessibility cand; seeds [4124828050, 3597097864, 2767896956].
- **b2** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 5, consistency 6, accessibility 5, iconography 7, empty_error_states 8; pairwise typography cand, color_contrast cand, accessibility cand; seeds [1696506243, 2607387522, 2480894823].
- **b3** (revert): medians typography 7, hierarchy 6, color_contrast 8, spacing 6, layout 5, consistency 6, accessibility 6, iconography 7, empty_error_states 8; pairwise all tie; seeds [957609782, 1537572406, 3532021854].
- **b4** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 6, iconography 6, empty_error_states 8; pairwise layout cand; seeds [604524403, 2385689957, 120412176].
- **b5** (keep): medians typography 7, hierarchy 6, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 6, iconography 6, empty_error_states 8; pairwise color_contrast cand, layout cand; seeds [2372193414, 3287340771, 622042132].
- **b6** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 6, layout 6, consistency 6, accessibility 6, iconography 6, empty_error_states 8; pairwise consistency cand; seeds [1347319041, 2011597623, 2430628441].
- **b7** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 7, layout 7, consistency 6, accessibility 7, iconography 6, empty_error_states 8; pairwise spacing cand, layout cand, consistency cand; seeds [3993741814, 916649784, 4111327304].
- **b8** (revert): medians typography 6, hierarchy 7, color_contrast 6, spacing 6, layout 5, consistency 6, accessibility 5, iconography 6, empty_error_states 8; pairwise color_contrast base, spacing base, layout base, consistency cand, accessibility base, iconography cand; seeds [4152576033, 289460143, 3192893742].
- **b9** (keep): medians typography 6, hierarchy 6, color_contrast 7, spacing 7, layout 7, consistency 6, accessibility 7, iconography 6, empty_error_states 8; pairwise color_contrast base, consistency cand, iconography cand; seeds [1368710045, 958000447, 3880342817].
- **b10** (keep): medians typography 7, hierarchy 7, color_contrast 7, spacing 6, layout 7, consistency 6, accessibility 6, iconography 7, empty_error_states 8; pairwise typography cand, accessibility cand, empty_error_states cand; seeds [3278225445, 1116531254, 3053506062].

