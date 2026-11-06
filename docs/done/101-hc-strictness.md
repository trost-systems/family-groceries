# Job 101: hill-climb hc-strictness (2026-11-05)

Strict lint packs for the whole repo. The attempt log, baseline and stop reason are in
[docs/hillclimb/hc-strictness.md](../hillclimb/hc-strictness.md); the decisions are in
docs/DECISIONS.md, "Job 101".

## What was built

- **Dart.** The app and the Widgetbook already include flutter_agent_lints' experimental set
  (1.1.0, the newest; upstream has no newer rules), with every rule an error. Findings went from 0
  to 0, and no Dart file changed.
- **TypeScript and JavaScript pack** in `tool/lint/ts/`. `pack.ts` lists every `deno lint` rule
  of Deno 2.9.8 and every strictness compiler option, on or off, with a reason. `strict.ts` runs
  it over 241 tracked files, and the lint gate fails on any finding (`scripts/gates/lint.sh`; the
  lint job pins Deno 2.9.8). All 114 target rules are enforced, including
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `!` and return types on exports.
- **Measurement.** `tool/hillclimb/hc-strictness/measure.sh` prints one JSON line. The target
  rule set is frozen by hash.
- **Fixes, all behaviour-preserving.** They cover e2e, the edge functions (not Alexa, voice,
  purchases or premium), the fg CLI, analytics, the classifier, deploy and checks tooling,
  marketing capture, and the site, design, scripts and skills JavaScript. One real latent type
  error was fixed in `analytics/proofs/edge_exception.ts`. The diff spans 191 files (after the rebases).

## Result

Score 1030 (median of 3, band 21, over the baseline commit's 206 files) went to 2 (median of 3,
over 241 files; main added 35 while the PR was open). The baseline read 989
until review 1 found 6 TypeScript files that were linted but not type-checked. The 2 left are the reasoned
`deno-lint-ignore no-empty-pattern` lines on Playwright's `({}, use)` fixtures. The job stopped
because the target was met, 1 h 49 min after the start, with weekly usage at 0.41.

## How to verify

- `tool/hillclimb/hc-strictness/measure.sh` prints score 2 and `suites_green: true`.
- `deno run -A tool/lint/ts/strict.ts` prints "241 files clean". Add a `x!` to any in-scope `.ts`
  file and it fails.
- `scripts/verify.sh --only lint`.

## Tests

The final local gates were all green:

- flutter: 1742 + 336 tests passed, `flutter analyze` clean on both packages (93 s).
- functions: 598 passed and 33 ignored, plus the classifier (12), deploy (13), analytics (15), IAP
  (26) and Alexa scripts (11) suites (14 s).
- fg-cli: 59 passed, 2 ignored.
- site: 122 of 122.
- lint, including the pack: green (37 s).

The full Playwright suite and the db gate ran on GitHub Actions after iterations 3, 5 and 6 (runs
41982008880, 41983671975 and 41986663849). Each run was green: 201 specs passed, 0 failed, 0 flaky.
Goldens are unchanged, since no Dart changed.

## Incidents and open items

- **A subagent ran `scripts/configure-social-auth.mjs` without `--dry-run`.** It most likely
  PATCHed the hosted auth `uri_allow_list` with its own current value. Peter should check it in
  the dashboard (docs/NEEDS_PETER.md, "Job 101").
- **The final sweep's subagent seeded two fixture runs on the shared local stack (54321).** It
  tore both down afterwards, and every leftover count came back 0.
- **Not covered:** plain JavaScript is not type-checked, and there is no `no-floating-promises`.
  Both are listed as next steps in the log.

## Review 0 fixes

- **The pack's type check now fails closed.** If `deno check` or `tsc` exits non-zero without a type diagnostic, the gate fails and prints the checker's output. Examples are a stale lockfile, an unresolvable package and a config error. A diagnostic is ignored only when it sits in an excluded path.
  - The reviewer's left-pad probe now fails ("The lockfile is out of date").
  - An unknown tsconfig option fails.
  - A plain type error is still reported.
- **Deno is pinned in `.dvmrc` (2.9.8).** CI's lint job reads that file, `scripts/bootstrap.sh` installs that version, and the runner's error message names the pin and the fix.
- **Each run writes its temporary config under its own name.** It is now per process (`.deno.strict.<pid>.json`).
- **Docs.** The doc and DECISIONS have the full scope list, the 07:56 usage check (0.39), labelled rule counts, and the error-class note. NEEDS_PETER has the lead's 07:41 read-only check.

## Review 1 fixes

- **Rebased onto main.** The DECISIONS conflict was resolved by keeping both sides. Main's new files had 6 findings, now fixed. `site/dist` is byte-identical to main's build.
- **Six TypeScript files are now type-checked.** They are in `marketing/videos/capture`, `scripts` and `site/config`; before, they were only linted.
  - The runner now fails when a `.ts` file belongs to no project.
  - Covering them surfaced 41 findings, all fixed.
  - The honest baseline with full coverage is 1030, not 989. The score was still 2, over 214 files, at review 1's last rebase.
- **A `deno-lint-ignore` now needs ` -- <reason>` in the lint gate.**

## Review 2 fixes (lead's addendum 3)

- **Counts.** The baseline is 1030 with band 21 over 206 files, and the final score was 2 over 214 files at review 4 (240 at review 5), everywhere (finished in review 4).
- **`sole` helper.** It moved above `resolve`'s doc comment.
- **SUPABASE_URL.** It is read through a checked `supabaseUrl()` in auth and MCP.
- **bootstrap.sh** touches only `~/.deno/bin/deno`.
- **measure.sh.** The dead branch is gone.
- **Temporary configs.** They are removed on SIGINT and SIGTERM, and `deno fmt` skips them.
- **Follow-up.** NEEDS_PETER has a follow-up to bring the Alexa, Siri and IAP code under the pack.
- **CI.** e2e and db ran on the final HEAD (run linked in the PR).

## Review 4 fixes (lead's addendum 4)

- **Result table.** Its header now says band 21. The baseline column shows the baseline commit's 206 files, measured with the final runner (3 runs at 1030, with its rule counts listed).
- **Final column (at review 4).** The review 4 tree scored 2, 2, 2 over 214 files, with suites green.
- **History labels.** The 1000/989 rule counts and the "211 files" line are now marked as history.
- **PR body.** Its table and Counts line match the doc.
- **Small fixes.** The stray blank line above `resolve` is gone, and `strict.ts` also removes its `/tmp` lint config on SIGINT and SIGTERM.
- **Rebased over #256, #251 and #252.** Main's new CLI test had 15 findings, all fixed. Job 106's frozen bench harness is excluded (`tool/hillclimb/`, with its reason).

## Review 5 fixes

- **Text.** The doc and PR now agree on band 21, the baseline rule counts and the final measurement.
- **Rebased over 8 main commits.** That includes the waitlist from #210. Main's 142 new findings are fixed, the site output is byte-identical, functions pass 639 and site passes 166.
- **Exclusion narrowed.** It now covers `tool/hillclimb/hc-backend-perf/bench.ts` only, with a follow-up in NEEDS_PETER.
- **Final.** 2, 2, 2 over 240 files, with suites green.

## Review 6 (PASS) follow-ups

- **Rebased over 6 more main commits.** Main's add-sheet spec brought 4 `!`, all fixed.
- **Final.** 2, 2, 2 over 241 files, with suites green.
- **Gates.** Functions 639 passed, site 167, fg-cli 60.
