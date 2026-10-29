#!/usr/bin/env bash
# Summarizes Playwright JSON reports (the CI reporter writes e2e/playwright-results.json, job 27).
#   scripts/e2e-summary.sh <results.json>...           Markdown: counts, a table per spec file,
#                                                     failed and flaky titles (the job summary)
#   scripts/e2e-summary.sh --brief <results.json>...   plain text: counts, failed and flaky titles
# Needs only jq. Exits 0 either way; the gate's own exit status says whether e2e passed.
set -euo pipefail

brief=0
if [[ ${1:-} == --brief ]]; then brief=1; shift; fi
[[ $# -gt 0 ]] || { echo "usage: $0 [--brief] <results.json>..." >&2; exit 2; }

# One line per test: {file, title, status}. status is Playwright's outcome: expected (passed),
# unexpected (failed), flaky (passed on its retry) or skipped. Describe titles join with " › ".
tests="$(jq -c '
  def walk_suite($path):
    (.specs[]? as $s | $s.tests[] | {file: $s.file, title: ($path + [$s.title] | join(" › ")), status}),
    (.suites[]? as $c | $c | walk_suite($path + [$c.title]));
  (.suites[]? | walk_suite([])),
  (.errors[]? | {file: "(run)", title: ((.message // "error") | split("\n")[0]), status: "error"})
' "$@")"

count() { jq -s --arg s "$1" '[.[] | select(.status == $s)] | length' <<<"$tests"; }
passed="$(count expected)" failed="$(count unexpected)" flaky="$(count flaky)" skipped="$(count skipped)" errors="$(count error)"
titles() { jq -rs --arg s "$1" '.[] | select(.status == $s) | "\(.file): \(.title)"' <<<"$tests"; }

if [[ $brief == 1 ]]; then
  echo "passed $passed, failed $failed, flaky $flaky, skipped $skipped$([[ $errors == 0 ]] || echo ", run errors $errors")"
  while read -r line; do [[ -n $line ]] && echo "  FAILED  $line"; done < <(titles unexpected; titles error)
  while read -r line; do [[ -n $line ]] && echo "  flaky   $line"; done < <(titles flaky)
  exit 0
fi

if [[ $failed == 0 && $errors == 0 ]]; then icon="✅"; else icon="❌"; fi
echo "### $icon Playwright: $passed passed, $failed failed, $flaky flaky, $skipped skipped"
[[ $errors == 0 ]] || echo "$errors run error(s), outside any test."
echo
echo "| Spec | Passed | Failed | Flaky | Skipped |"
echo "| --- | ---: | ---: | ---: | ---: |"
jq -rs 'group_by(.file)[] | [.[0].file,
    ([.[] | select(.status == "expected")] | length),
    ([.[] | select(.status == "unexpected" or .status == "error")] | length),
    ([.[] | select(.status == "flaky")] | length),
    ([.[] | select(.status == "skipped")] | length)]
  | "| `\(.[0])` | \(.[1]) | \(.[2]) | \(.[3]) | \(.[4]) |"' <<<"$tests"
if [[ $failed != 0 || $errors != 0 ]]; then
  printf '\n**Failed**\n\n'
  { titles unexpected; titles error; } | sed 's/^/- /'
fi
if [[ $flaky != 0 ]]; then
  printf '\n**Flaky** (passed on the retry)\n\n'
  titles flaky | sed 's/^/- /'
fi

# Job 28: tests/perf.spec.ts prints one `PERF {json}` line per build it measured.
perf="$(jq -r '.. | objects | select(has("stdout")) | .stdout[]? | .text? // empty' "$@" \
  | sed -n 's/^PERF //p')"
if [[ -n $perf ]]; then
  printf '\n**Timings** (tests/perf.spec.ts: navigation to the drawn list, median of 3; frame intervals while scrolling 200 items, first and second pass)\n\n'
  echo "| Browser | Build | List drawn | 1st scroll mean / p95 / max, frames > 25 ms | 2nd scroll mean / p95 / max, frames > 25 ms |"
  echo "| --- | --- | ---: | --- | --- |"
  jq -r 'def f: if . == null then "-" else "\(.meanMs) / \(.p95Ms) / \(.maxMs) ms, \(.over25ms) of \(.frames)" end;
    if .failed then "| \(.browser) | \(.build) | did not run: \(.failed) | | |"
    else "| \(.browser) | \(.build) | \(.loadMedianMs) ms | \(.firstScroll | f) | \(.secondScroll | f) |" end' <<<"$perf"
fi
