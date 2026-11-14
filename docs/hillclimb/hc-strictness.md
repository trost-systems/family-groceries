# hc-strictness

Started: 2026-11-05 06:45:05 CET (epoch 1793857505)

Job 101: apply flutter_agent_lints to the Flutter app and build a sibling pack for the repo's
TypeScript and JavaScript, then drive both to zero findings with behaviour-preserving fixes.

## The packs

**Dart.** `app/analysis_options.yaml` and `app/widgetbook/analysis_options.yaml` already include
`package:flutter_agent_lints/experimental.yaml` (1.1.0, the newest release; upstream `main` has no
rule changes since). Every rule is an error and `scripts/gates/flutter.sh` runs
`flutter analyze --fatal-infos` on both packages. At the start of this job the Dart side had no
findings and no hand-written `// ignore:` (only the generated l10n files carry them).

**TypeScript and JavaScript.** `tool/lint/ts/pack.ts` follows the same contract as
flutter_agent_lints: every rule of `deno lint --rules` (Deno 2.9.8) and every strictness compiler
option on top of `strict` is listed exactly once, on or off, with a one-line reason.
`tool/lint/ts/strict.ts` runs it:

- `deno lint` over every tracked `.ts/.mts/.tsx/.js/.mjs/.cjs` file in scope, with a generated
  config holding exactly the pack's rules. Rules whose fix is a type annotation (`tsOnly`) skip
  plain JavaScript.
- A type check of each TypeScript project (`pack.ts`, `projects`) with the pack's compiler options
  merged into the project's own `deno.json` (a temporary, gitignored `.deno.strict.json` beside
  it, so the project's lockfile and import map apply) or, for `e2e/`, `tsc` flags. A finding is
  attributed to an option when the run with that option adds it to the base run.
- It fails when the pack lists a rule the installed Deno does not know, or misses one it does
  (Deno is pinned in `.dvmrc`), when a type checker fails before checking types, when an
  in-scope TypeScript file belongs to no project (each file belongs to the nearest project above
  it), and, in enforce mode, on a `deno-lint-ignore` without ` -- <reason>`.

Levels: `error` fails the lint gate, `pending` is in the target and still has findings, `off` is
never run. The ratchet moves a rule from `pending` to `error` once it has no findings.

Scope exclusions (`pack.ts`, `excluded`), each with its reason there:

- Alexa and Siri code, frozen for hill-climbs by the brief: `supabase/functions/alexa/`,
  `supabase/functions/voice/`, `scripts/alexa/`, `scripts/siri-phrases.ts`, and the e2e specs
  `e2e/tests/alexa*` and `e2e/tests/voice.spec.ts`.
- IAP code, frozen by the brief: `scripts/iap/`, `supabase/functions/purchases/`,
  `supabase/functions/_shared/purchases*`, `supabase/functions/_shared/premium*`, and
  `e2e/tests/iap.ts`, `e2e/tests/purchases.spec.ts`, `e2e/tests/premium-yearly.spec.ts`.
- Job 106's measurement harness `tool/hillclimb/hc-backend-perf/bench.ts`: the hill-climb protocol
  freezes a goal's measurement after its baseline, so a lint fix there would re-baseline that goal.
  Review 4 excluded all of `tool/hillclimb/`; review 5 narrowed it to this one file, so a future
  harness is linted from its first commit.
- The vendored posthog-js (`app/web/posthog/`).
- The archived design prototypes in `docs/design/` (built bundles and a sandbox with its own
  oxlint config that nothing runs).

Plain JavaScript is linted but not type-checked.

## Score

`tool/hillclimb/hc-strictness/measure.sh` prints one JSON line. Score = `dart_violations` +
`ts_violations`, lower is better, target 0.

- `dart_violations`: `flutter analyze` issues in `app/` and `app/widgetbook/`, plus hand-written
  `// ignore:` comments, plus one per package that stops including the experimental pack.
- `ts_violations`: findings of every non-`off` rule of the TypeScript pack (lint rules and compiler
  options), base type errors of the projects (`typecheck`), plus suppression comments
  (`deno-lint-ignore`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`).
- `rule_counts`: per rule. `ts_target_sha`: a hash of the target rule names; measure.sh fails if
  it differs from the baseline's, so turning a rule off cannot lower the score.
- `suites_green`: the flutter, functions, fg-cli, site and lint gates plus the pack's enforced
  rules, all green (`HC_SUITES=0` skips them and prints `null`).

It is deterministic: static analysis over tracked files at one commit, no clock, no network
beyond the cached, lockfile-frozen dependencies, no randomness (`seed: null`). No part is a timing,
so it does not need `/tmp/fg-hc-measure.lock`. A probe of one Dart and one TS finding moved the
score by exactly their count (1168 -> 1172).

## Baseline

Usage check before the baseline: `weekly_util` 0.34 (06:45).

The first baseline (06:55 to 07:05, scope without the IAP and Siri/Alexa e2e exclusions) gave
1168 and 1168. It was dropped before its third run: the brief also freezes IAP code, so
`scripts/iap/`, `supabase/functions/purchases/`, `_shared/purchases*`, `_shared/premium*` and the
IAP e2e specs left the scope, and so did the Alexa and voice e2e specs. measure.sh was not changed;
the scope lives in `tool/lint/ts/pack.ts`, committed before the baseline below.

| Run | At | Score | dart | ts | suites_green |
| --- | --- | --- | --- | --- | --- |
| 1 | 07:21:08 | 1000 | 0 | 1000 | false |
| 2 | 07:24:31 | 1000 | 0 | 1000 | false |
| 3 | 07:27:51 | 1000 | 0 | 1000 | false |

Median **1000**. Noise band: max minus min is 0, so the 2 % floor applies: **20**. All three runs
had identical parts. `suites_green` is false only because of the pack's own enforcement: one
existing type error (`analytics/proofs/edge_exception.ts:31`, `typecheck`), which no gate checked
before. The five existing gates (flutter: 1742 + 336 tests, functions: 598 passed and 33 ignored
plus the classifier, deploy, analytics, IAP and Alexa script suites, fg-cli, site, lint) were green
in every run.

Baseline rule counts, pre-review-1 history (the 1000 runs above; the 989 re-baseline had
noUncheckedIndexedAccess 361 and exactOptionalPropertyTypes 24, the rest equal): noUncheckedIndexedAccess 369,
no-non-null-assertion 231, no-process-global 109, camelcase 70, explicit-module-boundary-types 54,
no-window 39, no-node-globals 30, exactOptionalPropertyTypes 27, single-var-declarator 21,
no-unused-vars 14, require-await 8, default-param-last 7, no-regex-spaces 5, no-window-prefix 5,
eqeqeq 3, no-empty-pattern 2, suppressions 2, no-empty 1, no-import-prefix 1, typecheck 1,
verbatim-module-syntax 1. The 1030 baseline's counts (the final runner) are under Result.

Work plan: one subagent per area prepared fixes in its own worktree (e2e, the edge functions, the
fg CLI, the other Deno projects, and the plain JavaScript). Each area is integrated as one
iteration below, with the rules it clears moved from `pending` to `error` in the same commit.

## Attempts

| # | Time | Change | Score | Kept | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | 07:33 | Other Deno projects (analytics, classifier, deploy, checks, marketing capture): base type error in the voice proof, noUncheckedIndexedAccess, no-non-null-assertion, explicit-module-boundary-types; lint gate runs the pack (`tool/lint/ts/strict.ts`), lint job pins Deno 2.9.8 | 919 | kept | -81, past the band; all suites green, pack's enforced rules now pass in the lint gate |
| 2 | 07:40 | Plain JavaScript (site, design, scripts, marketing, skills, app/web bootstrap): eqeqeq, no-regex-spaces, default-param-last, require-await, single-var-declarator, no-unused-vars, no-window(-prefix), camelcase (wire keys quoted), no-process-global, no-node-globals; no-regex-spaces -> error | 741 | kept | -178; suites green; site/dist byte-identical to the base build (subagent diff -r) |
| 3 | 07:45 | e2e TypeScript (not the Alexa, voice and IAP specs): exactOptionalPropertyTypes, noUncheckedIndexedAccess, no-non-null-assertion (`must`, `firstOf`, `boxOf` helpers), explicit-module-boundary-types | 504 | kept | -237; suites and e2e tsc green; Playwright specs proven on CI (scripts/ci-e2e.sh, below) |
| 4 | 07:50 | fg CLI (.cursor/skills/verify-family-groceries/cli): exactOptionalPropertyTypes, noUncheckedIndexedAccess (`NonEmpty`, `entry()`, `waitForValue`), no-non-null-assertion, explicit-module-boundary-types | 338 | kept | -166; suites green (fg-cli: 59 passed, 2 ignored) |
| 5 | 07:49 | Edge functions (not alexa/, voice/, purchases/, premium): exactOptionalPropertyTypes, noUncheckedIndexedAccess (`oneRow`, `bearerToken`, `BeginRow` union), no-non-null-assertion, explicit-module-boundary-types; no-non-null-assertion and explicit-module-boundary-types -> error | 139 | kept | -199; suites green (functions 598 passed, 33 ignored); integration tests on CI's db gate |
| M | 07:55 | Usage check at the first hour mark (07:56): `weekly_util` 0.39. Measure fix: `tool/lint/ts/strict.ts` did not drop `tsc` findings in excluded files (11 in the Alexa and voice e2e specs). Re-baseline: the baseline commit with the fixed runner scored 989, 989, 989 (07:52:06, 07:52:36, 07:53:06; `HC_SUITES=0`, the suites part does not depend on the runner). New baseline **989**, band **20** | 128 | measurement | Not an iteration; the same tree scores 139 with the old runner. CI e2e for iteration 3 (run 41982008880): db gate green, Playwright 102 + 99 passed, 0 failed |
| 6 | 08:21 | The rest: camelcase (wire names quoted, 1 local renamed), default-param-last, eqeqeq, no-empty, no-import-prefix (`scripts/deno.json` import map for brand-names_test.ts), no-node-globals, no-process-global, no-unused-vars, verbatim-module-syntax, no-window(-prefix), single-var-declarator, require-await, the `any` and `@ts-ignore` suppressions; the two Playwright `({}, use)` fixtures get a reasoned `deno-lint-ignore no-empty-pattern`. Every target rule and compiler option -> error (114 of 114 enforced) | 2 | kept | -126; suites green; the 2 left are the deliberate Playwright ignores |

Each kept commit was pushed to `origin/job/101-hc-strictness` right after it was made (the
commits 0ad2d51b to dbdc57a4); `scripts/push-pr.sh` squashed them into the PR's one commit.

## Result

| Part | Baseline (median of 3, band 21) | Final (median of 3) |
| --- | --- | --- |
| score | **1030** (989 before review 1's coverage fix, 1000 before the measure fix) | **2** |
| dart_violations | 0 | 0 |
| ts_violations | 1030 | 2 |
| ts files | 206 (the baseline commit's tracked in-scope files) | 241 (main added 35 while the PR was open) |
| ts enforced rules | 92 of 114 | 114 of 114 |
| suites_green | false (one type error the pack found) | true |

Baseline runs: the baseline commit f083c0d8 measured with the final runner (`tool/lint/ts/strict.ts`
and the `projects` list as merged) scored 1030 at 18:15:35, 18:16:07 and 18:16:39, over 206 files,
with identical parts. `scripts/deno.json` was copied in, since the brand-names test needs its import
map. The rule counts were:
- noUncheckedIndexedAccess 402, no-non-null-assertion 231, no-process-global 109, camelcase 70,
  explicit-module-boundary-types 54, no-window 39, no-node-globals 30.
- exactOptionalPropertyTypes 24, single-var-declarator 21, no-unused-vars 14, require-await 8,
  default-param-last 7, no-regex-spaces 5, no-window-prefix 5.
- eqeqeq 3, no-empty-pattern 2, suppressions 2, no-empty 1, no-import-prefix 1, typecheck 1,
  verbatim-module-syntax 1.

Final runs: the PR head's tree without its last doc edit (commit d1a09cd9). The pushed head carries the same
PR changes plus edits to the doc files `docs/hillclimb/hc-strictness.md`,
`docs/done/101-hc-strictness.md` and `DONE_SUMMARY.md`, rebased onto later main commits (#279) that
add no TS or JS file scored 2 at 05:48:45 (with suites, all green, 280 s), 05:49:04 and 05:49:21,
over 241 files, with identical parts. The 2 left are the reasoned
`deno-lint-ignore no-empty-pattern` lines on the two Playwright fixtures in `e2e/tests/fixtures.ts`.
Pre-review-1 history: the same 2 over 206 files at 08:24:56, 08:28:07 and 08:31:15.

CI proof beyond the measured suites, on GitHub Actions (`scripts/ci-e2e.sh`, db gate plus the full
Playwright suite in 2 shards): after iteration 3 (run 41982008880), after iteration 5 (run
41983671975) and after iteration 6 (run 41986663849). All green, 102 + 99 specs passed, 0 failed,
0 flaky, and the db gate ran the edge functions' integration tests (`FG_DB_TEST=1`).

## Stop

Stopped at 08:34 (1 h 49 min after the start, weekly usage 0.41): the target is met. Every rule
of the pack is enforced, and the remaining 2 are deliberate, explained ignores. None of the
protocol's three stop rules fired. Removing the last 2 would take a contortion (making each
fixture depend on a fixture it does not use), and a gain of 2 sits inside the band of 21, so the
ratchet could not keep it anyway.

Next, if pushed further: type-check the plain JavaScript (`// @ts-check` or `checkJs` for
`site/`, `scripts/`, `e2e/*.mjs`, 120-odd files that today get lint only), and bring
`no-floating-promises` in through a type-aware linter for `e2e/`, where a missing `await` before
an `expect` is the costliest mistake that no rule here catches. Both change the target set, so
they need a new baseline.

## Review 0 fixes (2026-11-05)

- The runner failed open: a checker that stopped before type checking (out-of-date lockfile under
  `--frozen`, an unresolvable package, a bad config) parsed no diagnostic and passed. Now a
  non-zero exit with no diagnostic throws with the checker's output. Diagnostics are dropped only
  in excluded paths, so a `tsconfig.json` error (TS5023) counts. Probes: the reviewer's left-pad
  import fails with "The lockfile is out of date"; an unknown tsconfig option fails as a finding;
  a plain TS2322 is still reported. The measured score is unchanged (2, sha 9ef068bcb2b4cb7a).
- Deno is pinned in one file, `.dvmrc` (2.9.8). CI's lint job reads it (`deno-version-file`;
  since job 220 every CI job does), `scripts/bootstrap.sh` installs or upgrades to it, and the
  runner's rule-list error names it and the fix.
- The temporary config is per process (`.deno.strict.<pid>.json`), so a lint gate and a
  measurement started side by side keep their own.

## Review 1 fixes (2026-11-05)

- **Rebased onto main** (#235 and #238). `docs/DECISIONS.md` conflicted, and both sections were kept.
  Main's new files had 6 findings, now fixed:
  - `node:process` and `node:buffer` imports in `scripts/release/loc.mjs`,
    `scripts/release/loc.test.mjs` and `site/scripts/history-fixture.mjs`.
  - `_match` for an unused replace-callback parameter in `site/history.mjs`.

  `site/dist` is byte-identical to main's build (`diff -r`), and the release script tests pass
  65 of 65.
- **Six TypeScript files were linted but never type-checked.** They are
  `marketing/videos/capture/*.ts` (3), `scripts/brand-names*.ts` and `site/config/stage.ts`.
  - `pack.ts` now has the projects `scripts`, `marketing/videos/capture` and `site/config`. A
    project without its own `deno.json` gets only the pack's compiler options.
  - The runner fails when an in-scope `.ts` file is in no project. A probe in a new directory
    fails with the file's name.
  - Covering them surfaced 41 findings, all fixed: a checked `member()` lookup for the
    capture shots' clients, `as const` on the shots' item table, narrowing in the capture driver
    and `take.ts`, `flatMap` over the mandatory regex group in `brand-names.ts`, and `?.` inside
    the brand-names test assertions. brand-names tests pass 13 of 13, and the brand check on the
    repo is clean.
- **Correction to the score.** The frozen measurement undercounted, because these 6 files were
  in scope but unchecked. The baseline commit with the full coverage scores **1030** (3 runs,
  10:12:12, 10:12:44, 10:13:15; `HC_SUITES=0`; `scripts/deno.json` copied in, since the brand
  test needs its import map). So the honest baseline is 1030, band 21. The target hash is
  unchanged (9ef068bcb2b4cb7a), and (history, review 1 time) the tree measured 2 over 211 files then; the final count is in Result.
- **Main moved twice more** (#244 and #243). After rebasing, main's new files had 9 more findings, all fixed:
  - `node:process` imports in two verify-hummlist journeys.
  - `databaseUrl()` and `assertExists` in `_shared/number_words_integration_test.ts`.

  At that point the tree measured 2 over 214 files, with suites green.
- **Enforce mode now rejects a `deno-lint-ignore` without ` -- <reason>`** (`ignore-needs-reason`),
  as `scripts/lint.sh` already does for ast-grep and squawk.
- **Known limits, not changed:**
  - measure.sh's Dart half counts the lines that match, so a broken `flutter` would score 0.
    measure.sh stays frozen after the baseline; `flutter analyze` ran in every measurement here
    (`No issues found!` in the suite logs).
  - `addItems` and the API's `pick` return `(Item | undefined)[]` instead of asserting `Item[]`.
    That is the same runtime with an honest type. A throwing or filtering `pick` would change an
    impossible path and was left out.

## Review 2 fixes (lead's addendum 3, 2026-11-05)

- **Counts (completed in review 4).** Everywhere the baseline is 1030 with band 21 over the baseline
  commit's 206 files, and the final score was 2 over 214 files at review 4 (240 at review 5).
  Main added the extra files while the PR was open.
- **`sole`.** It moved above `resolve`'s JSDoc in `_shared/list.ts`, so the doc sits on `resolve`
  again.
- **SUPABASE_URL.** `_shared/auth.ts` and `mcp/handler.ts` read it through a checked
  `supabaseUrl()` that throws when it is missing, as `databaseUrl()` does. Before, an unset variable
  would have reached `fetch` as the string `undefined`.
- **bootstrap.sh** installs the `.dvmrc` Deno into `~/.deno/bin` only, and never upgrades a
  Homebrew or distro deno found on PATH; it prints which Deno the gates need when PATH finds
  another. On hz, `~/.deno` is shared by every lane, so a `.dvmrc` bump moves all lanes' Deno on
  the next bootstrap run.
- **measure.sh.** The dead `FROZEN_AT_BASELINE` branch and the stale lint-gate comment are gone.
  The behaviour is the same (the sha comparison is unchanged).
- **Temporary configs.**
  - `strict.ts` removes its `.deno.strict.<pid>.json` files on SIGINT and SIGTERM as well as in
    `finally`. Probe: killed with 10 and 8 temp files on disk, it left 0 and exited 143 and 130.
  - They are gitignored, and a directory-wide `deno fmt --check` skips them: with an unformatted
    leftover in `supabase/functions`, the check still passes over 88 files. `deno lint` reads only
    JS and TS.
- **Follow-up for the frozen areas.** The Alexa, Siri and IAP exclusions are this job's freeze, not
  a property of the code. The follow-up is in docs/NEEDS_PETER.md ("Job 101").

## Review 4 fixes (lead's addendum 4, 2026-11-05)

- **Result table.** Its header says band 21. The baseline column is the baseline commit's 206 files,
  measured with the final runner (1030 three times; its rule counts are listed). The final column
  was the review 4 HEAD over 214 files. The pre-review-1 numbers (the 1000/989 rule counts, "211
  files") are labelled as history.
- **Rebased over #256, #251 and #252.** DECISIONS, DONE_SUMMARY and the fg CLI's `verifyRun` merged
  both sides (main's count queries with the checked `entry()` lookup). Main's new `fixtures_test.ts`
  had 15 findings, fixed with `assertExists`, a throwing table lookup and a quoted wire key: fg-cli
  passes 60 of 60 (2 ignored).
- **New exclusion: `tool/hillclimb/`.** The runner's coverage guard flagged job 106's
  `tool/hillclimb/hc-backend-perf/bench.ts`, which had 32 findings. That file is a frozen
  measurement harness, so it is excluded with that reason instead of edited.
- **Small fixes.** The stray blank line above `resolve` is gone, and `strict.ts` registers its
  `/tmp` lint config for signal cleanup (probe: exit 130, 0 temp files left).

## Review 5 fixes (2026-11-05)

- **Text.** The Stop section now says the band is 21. The PR body's Stop reason, its baseline rule
  counts and its Final line match the doc.
- **Rebased over 8 more main commits** (#210 waitlist, #239, #247, #248, #254, #255, #257, #262). The
  site conflicts merged both sides: main's new imports plus this PR's `node:process` import, and
  main's new test string plus this PR's ` {2}` regex. Main's new files brought 142 findings, fixed
  behaviour-preservingly:
  - The waitlist edge function: `oneRow` in `store.ts`, return types and a tuple loop in
    `crypto.ts`'s constant-time compare. Its tests use `assertExists`.
  - The site's waitlist API functions and tests: `node:process` and `node:buffer` imports, quoted
    wire keys, `Promise.resolve` fakes.
  - `scripts/waitlist`: an import map in its own `deno.json`.
  - The voice-variants integration test: `databaseUrl()` and `oneRow`; `voice/` itself is not touched.
  - The voice proof gained the new `splitItems` dependency.

  Checks: functions 639 passed, site 166 of 166 (also on Node 22), and `site/dist` is
  byte-identical to the pre-edit build.
- **Exclusion narrowed.** `tool/hillclimb/` became `tool/hillclimb/hc-backend-perf/bench.ts` alone,
  with a follow-up in NEEDS_PETER, so a future harness is linted from its first commit.
- **Final:** 2, 2, 2 over 240 files, suites green (see Result).

## Review 6 (PASS) follow-ups (2026-11-06)

- **Rebased over 6 more main commits** (#253, #274, #275, #278, #280, #282). DECISIONS merged both
  sides. Main's `add-sheet.spec.ts` brought 4 `!`, now `must()` and `boxOf()` like the rest of e2e;
  e2e `tsc` passes.
- **Final:** 2, 2, 2 over 241 files, suites green (see Result). Gates on the final tree:
  - functions 639 passed and 79 ignored, plus 12, 13, 15, 26, 11 and 8 in the other suites;
  - site 167 of 167;
  - fg-cli 60 passed and 2 ignored.
- **Text.** The done summary's file count now reads 191 files (`git diff --stat`). The PR's gate
  bullets have current numbers, and its iterations table says each score is under that iteration's
  runner.
