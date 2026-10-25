#!/usr/bin/env bash
# CI and verify.sh run the same checks because both only call scripts/gates/<gate>.sh. This keeps
# it that way: every gate has a ci.yml job of its name that runs it and is in ci-ok's needs, and
# is listed in verify.sh; no check command is written into ci.yml or verify.sh directly.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

CI=.github/workflows/ci.yml
problems=()
needs="$(sed -n '/^  ci-ok:/,/^  [a-z]/s/^    needs: \[\(.*\)\]$/\1/p' "$CI" | tr -d ' ')"
listed="$(sed -n 's/^\(GATES\|CI_ONLY\)=(\(.*\))$/\2/p' scripts/verify.sh | tr '\n' ' ')"
for file in scripts/gates/*.sh; do
  gate="$(basename "$file" .sh)"
  [[ -x $file && "$(git ls-files -s "$file" | cut -c1-6)" != 100644 ]] || problems+=("$file is not executable (chmod +x, git add)")
  grep -q "^  $gate:$" "$CI" || problems+=("ci.yml has no job '$gate'")
  [[ "$(sed -n "/^  $gate:$/,/^  [a-z]/p" "$CI" | grep -c "run: scripts/gates/$gate.sh")" == 1 ]] \
    || problems+=("ci.yml job '$gate' does not run scripts/gates/$gate.sh once")
  [[ ",$needs," == *",$gate,"* ]] || problems+=("ci-ok does not need '$gate'")
  [[ " $listed " == *" $gate "* ]] || problems+=("verify.sh lists '$gate' in neither GATES nor CI_ONLY")
done
for word in $listed; do
  [[ -f scripts/gates/$word.sh ]] || problems+=("verify.sh lists '$word', which has no scripts/gates/$word.sh")
done

for pattern in 'flutter analyze' 'flutter test' 'flutter build' 'dart format' 'deno test' 'deno lint' \
  'playwright test' 'supabase test' 'db lint' 'gitleaks git' 'fastlane lanes' 'shellcheck ' 'run: actionlint' 'tsc '; do
  for file in "$CI" scripts/verify.sh; do
    if grep -v '^\s*#' "$file" | grep -q -- "$pattern"; then
      problems+=("$file runs '$pattern' itself; put it in a scripts/gates/ script")
    fi
  done
done

if [[ ${#problems[@]} -gt 0 ]]; then
  printf 'check-gates: %s\n' "${problems[@]}" >&2
  exit 1
fi
