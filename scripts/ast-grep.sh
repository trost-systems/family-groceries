#!/usr/bin/env bash
# The ast-grep rules (ast-grep/rules), from anywhere inside the repository.
# Adapted from emotely's scripts/ast-grep.sh (docs/REUSED_FROM_EMOTELY.md).
#
#   scripts/ast-grep.sh test
#     The rule tests and their snapshots (`ast-grep test`), failing on a
#     test whose rule id no rule has: ast-grep itself only prints
#     "Configuration not found" and passes, so a renamed or deleted rule
#     would silently lose its tests.
#
#   scripts/ast-grep.sh [scan arguments]
#     Every rule over every file git tracks, so build output, dependencies
#     and scratch files are never read. A bare `ast-grep-ignore` fails
#     (`no-suppress-all`): a suppression names the rule it silences.
#     Arguments go to `ast-grep scan`, e.g. `--format github` in CI.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ "${1:-}" == test ]]; then
  shift
  status=0
  output="$(ast-grep test --color never "$@" 2>&1)" || status=$?
  printf '%s\n' "${output}"
  orphans="$(sed -n 's/^Configuration not found! //p' <<<"${output}")"
  if [[ -n "${orphans}" ]]; then
    while IFS= read -r id; do
      printf 'error: a test in ast-grep/tests names "%s", but there is no rule with the id "%s": rename or remove the test with its rule\n' \
        "${id}" "${id}" >&2
    done <<<"${orphans}"
    exit 1
  fi
  exit "${status}"
fi

git ls-files -z | xargs -0 ast-grep scan --error=no-suppress-all "$@"
