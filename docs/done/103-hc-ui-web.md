# Job 103: hill-climb of the hummlist.com UI (hc-ui-web)

PR #242 (DO NOT MERGE, the lead merges). Branch `job/103-hc-ui-web`, runner hz, 2026-11-05
06:51 to 09:27 CET.

## What was built

- `tool/hillclimb/hc-ui-web/`: the score harness and its guardrails.
  - `measure.sh` builds `site/` in production mode, serves it on 127.0.0.1 and captures 37 shots
    of 9 pages with `capture.mjs`. Three fresh opus judges score them with `judge-prompt.md`,
    under `/tmp/fg-hc-measure.lock`. The score is the minimum of the 7 category medians.
  - `guard.sh` checks the allowed paths, runs the site gate, `copy-check.mjs` (the words on
    every page) and the crawl and contrast browser checks.
- Kept step (`site/public/styles.css`, `site/build.mjs`): the text pages start on the header's
  left edge, phone h1s use a fluid size with German hyphenation, code chips are padded (code
  stays monospace after review 0), guide-card titles are tight, the empty changelog is a card,
  callout padding is even. Pages without a header (404, root) keep a centred column.
- The attempt log `docs/hillclimb/hc-ui-web.md` and the decisions in `docs/DECISIONS.md`,
  "Job 103".
- `tool/hillclimb/hc-ui-web/attempts/it6-near-miss.diff`: the best reverted attempt, as the base
  for a later run.

## Result

Score 6.5 (baseline, band 0.13) to 7.0 (final, median of 3 runs). One step kept, 5 reverted.
The run stopped on the rule of 5 consecutive iterations without a keep. The target (every
category above 9) is not reached. Layout stays at 7 in every attempt: the judges fault every
placement of the 44rem text column at 1440 px.

## Review 0 fixes

- Code back to monospace at weight 400 (iteration 1 had made it bold Inter, which hurt exact
  values like the voice URL). Re-measured on main `c220980a`: 7, 7, 7, score 7.0.
- Rebased onto main with #235's `/history`; guard (crawl and contrast included) green on the
  merged tree, `/history` checked at 390 and 1440 px.
- `guard.sh` now defaults its base to the merge-base and allows this file.
- Review 1: the committed `after-*` screenshots are now the final tree's captures (fix 1 run 1,
  monospace code); the blind-spot caveat is corrected, and the `/history` empty state and the
  Claude guide's table at 390 px are logged as known gaps.
- The log names the caveats: the capture host's font fallback, the code-block blind spot, the
  thin keep, and the deviation from one change per iteration.

## How to verify

```bash
tool/hillclimb/hc-ui-web/measure.sh     # one JSON line; HC_RUN_DIR keeps the shots and judge replies
tool/hillclimb/hc-ui-web/guard.sh       # paths, site gate, copy-check, crawl, contrast
```

## Tests

- `guard.sh` green on the kept step: 122/122 site tests, copy-check identical on 20 + 24
  pages, crawl and contrast pass. After review 0 on main `c220980a`: 132/132, 22 + 26 pages,
  crawl and contrast pass.
- `flutter test`: 1742 passed, 88 skipped, 0 failed. `flutter analyze`: no issues.
- `scripts/verify.sh --only lint,site,gitleaks`: passed.

## Missing or blocked

- Dark posters for the three demo videos and a visible dark tile for the header logo need new
  assets (the favicon's dark tile matches the page ground).
- The 404 page has no site header or footer. Adding them adds words to that page, which this
  job's no-copy rule rules out.
