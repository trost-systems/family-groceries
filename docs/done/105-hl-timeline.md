# DONE_SUMMARY: Job 105, hummlist.com/history release timeline (2026-11-05, Mac runner)

PR: https://github.com/trost-systems/family-groceries/pull/235 (ready for review, **not merged**; the lead merges).

## What was built

- `/history` (German) and `/en/history` (English): release timeline, one entry per public release
  in `releases/releases.json`, newest first. Each entry has the date, day N (since
  `project.day_zero`, 2026-10-22), commits since the previous release, contributors (people only),
  lines of code total and by language, the top 3 people, the bot share ("Bots und
  KI-Assistenten" / "Bots and AI assistants") and a changelog link. Empty state while the record
  is empty (today). The footer of every page links it. noindex comes through the existing
  `X-Robots-Tag` header; stage and noindex rules are unchanged.
  Code: `site/history.mjs`, `site/build.mjs`, `site/agent.mjs` (llms.txt "Optional"),
  `site/public/styles.css`.
- Record format: `stats.automated_commits` and `stats.loc` are optional and validated
  (`site/releases.mjs`). Older entries stay valid.
- Automation: `scripts/release/record.mjs add` computes both in the same entry and commit
  (`scripts/release/loc.mjs` counts lines from git objects). Backfill:
  `record.mjs stats --version X [--dry-run]`. The workflow already had `fetch-depth: 0`; dry run is
  still the default. The real workflow was not run.
- Copy: 19 new strings in `HISTORY_COPY`, listed in `site/COPY_NEEDED.md` ("Release timeline") and
  in the PR body as NEEDS_COPY_REVIEW.
- Docs: `site/README.md` ("History"), `releases/README.md` ("Lines of code", "Recomputing
  stats"), `docs/DECISIONS.md` ("Job 105").

## How to verify

```bash
cd site && npm ci && npm test              # history.test.mjs + the rest
node scripts/history-fixture.mjs           # dist-history/ with 3 fixture releases
node --test ../scripts/release/loc.test.mjs ../scripts/release/record.test.mjs
```

Preview (Vercel login): https://hummlist-site-git-job-105-hl-timeline-peter-trost.vercel.app/history

## Results

Site gate passed (132 tests). loc 6/6, record 23/23, changelog 36/36. lint.sh, actionlint,
check-gates, gitleaks and the design checks passed. Browser crawl and contrast pass for both
pages in the empty and the fixture state. Screenshots: `docs/screenshots/105/` (de/en,
desktop/mobile, empty/fixture).

## Open / not done

- Two focus-indicator findings on `/en/support` from `site/checks/crawl.mjs` (wrapped links).
  They are on main already and outside this job (no edits to existing pages); recorded in
  DECISIONS (Job 105, item 7).
- On macOS, `site/test/versions.test.mjs` "the CLI logs the live version" fails unless
  `TMPDIR=$(realpath /tmp)` (`/var` vs `/private/var` breaks the main-module check). This is
  already on main; Linux CI is unaffected.
- Copy review of the 19 strings (NEEDS_COPY_REVIEW in the PR).
- pstack and poteto-mode skills are not installed on the Mac, so this job worked without them.
