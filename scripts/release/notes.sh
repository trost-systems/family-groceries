#!/usr/bin/env bash
# TestFlight "What to Test" for a Release run: the PRs merged into main since the last uploaded
# commit, one line each. main takes one "<PR title> (#n)" commit per PR (docs/CI.md).
# Usage: scripts/release/notes.sh <de|en> <previous sha, or empty for the first upload> <head sha>
# PRs about the repo's own machinery (docs, CI, lints, gates, deploys, backups, release
# tooling, the verify skill) change nothing a tester sees and are left out; job prefixes,
# PR numbers and anything that looks like an email address are stripped.
set -euo pipefail
lang="$1" from="$2" to="$3"
max=12
internal='\b(ci|ci-ok|lints?|gates?|merges?|push-pr|merge-pr|backups?|keepalive|deploys?|workflows?|e2e|flakes?|flaky|fastlane|certificates?|match|testflight|release pipeline|release status|schema|migrations?|rls|gitleaks|pgtap|vercel|smoke test|timeouts?|trailers?|pr description|hard-coded text|summary)\b'

if [[ -n $from ]] && git cat-file -e "$from^{commit}" 2>/dev/null; then
  range=("$from..$to")
else
  range=(-n 20 "$to")
fi

mapfile -t titles < <(
  git log --first-parent --format=%s "${range[@]}" |
    sed -E 's/ \(#[0-9]+\)$//; s/^Job [0-9]+[a-z]*[^:]*: //I' |
    sed -E 's/[[:alnum:]._%+-]+@[[:alnum:].-]+//g' |
    grep -viE '^(docs|ci|chore|test|build|style)(\(.*\))?!?:|^verify[- ]skill|^revert "' |
    grep -viE "$internal" |
    grep -v '^[[:space:]]*$' || true
)

case "$lang" in
  de) head="Neu in diesem Build von Hummlist:" none="Kleine Verbesserungen und Fehlerbehebungen." more="und %d weitere Änderungen" ;;
  en) head="New in this Hummlist build:" none="Small improvements and fixes." more="and %d more changes" ;;
  *) echo "usage: $0 <de|en> <previous sha> <head sha>" >&2; exit 2 ;;
esac

if [[ ${#titles[@]} -eq 0 ]]; then
  echo "$none"
  exit 0
fi
echo "$head"
for title in "${titles[@]:0:max}"; do echo "- $title"; done
if [[ ${#titles[@]} -gt $max ]]; then
  # shellcheck disable=SC2059 # the format string is one of the fixed texts above
  printf -- "- $more\n" "$((${#titles[@]} - max))"
fi
