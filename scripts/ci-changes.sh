#!/usr/bin/env bash
# Which CI gates a change needs, as key=value lines for $GITHUB_OUTPUT:
#   heavy     every gate but gitleaks and lint; false only when every file is documentation
#   native    android and ios; only when the native projects or pubspec change. They compile the
#             app's Swift and Kotlin and the plugin registrant from pubspec; the Dart in app/lib
#             is compiled by the flutter, web-prod and e2e gates already.
#   fastlane  only when app/fastlane/ or app/Gemfile* changes
# Without a range (a push to main, a manual run) and when the CI definition itself changes
# (this script, ci.yml, a gate, lib.sh), everything runs.
# Usage: scripts/ci-changes.sh [<base> <head>]
set -euo pipefail

all() { printf 'heavy=true\nnative=true\nfastlane=true\n'; exit 0; }
[[ $# == 2 ]] || all
files="$(git diff --name-only "$1" "$2")"
[[ -n $files ]] || all
grep -qE '^(\.github/workflows/ci\.yml|scripts/ci-changes\.sh|scripts/lib\.sh|scripts/gates/)' <<<"$files" && all

# Documentation: docs/ and Markdown, except the verify skill's files, which its CLI reads.
code="$(grep -vE '^docs/' <<<"$files" | grep -vE '^[^.].*\.md$|^\.github/.*\.md$' || true)"
heavy=false native=false fastlane=false
[[ -n $code ]] && heavy=true
grep -qE '^app/(ios|android)/|^app/pubspec\.(yaml|lock)$' <<<"$files" && native=true
grep -qE '^app/(fastlane/|Gemfile)' <<<"$files" && fastlane=true
printf 'heavy=%s\nnative=%s\nfastlane=%s\n' "$heavy" "$native" "$fastlane"
