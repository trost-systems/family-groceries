#!/usr/bin/env bash
# Structural lints for mistakes this project already made (CLAUDE.md, "Lint rules"): the ast-grep
# rules and their tests, then the migration and RLS guards. Runs in CI and in verify.sh.
# Usage: scripts/lint.sh [base-ref]   (default origin/main, fetched when missing)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

# The rule snapshots and squawk's findings depend on the exact versions, so the box runs CI's.
for tool in AST_GREP SQUAWK; do
  pinned="$(sed -n "s/^  ${tool}_VERSION: //p" .github/workflows/ci.yml)"
  bin="$(tr '[:upper:]_' '[:lower:]-' <<<"$tool")"
  have="$("$bin" --version 2>/dev/null | awk '{print $2}' || true)"
  if [[ "$have" != "$pinned" ]]; then
    echo "$bin ${have:-missing}, but CI pins $pinned (.github/workflows/ci.yml): run scripts/bootstrap.sh" >&2
    exit 1
  fi
done

log "ast-grep rule tests"
scripts/ast-grep.sh test
log "ast-grep scan"
scripts/ast-grep.sh

base="${1:-origin/main}"
if ! git rev-parse -q --verify "$base^{commit}" >/dev/null && [[ "$base" == origin/main ]]; then
  git fetch -q --no-tags --depth=1 origin main:refs/remotes/origin/main
fi
log "schema check against $base"
# The check before its unit tests: a bad migration fails the test over the repository's own
# migrations too, and the check's message is the one that says what to do.
deno run --allow-read --allow-run=git,squawk supabase/checks/schema_check.ts "$base"
log "schema check tests"
(cd supabase/checks && deno fmt --check -q && deno lint -q && deno test -q --allow-read --allow-write --allow-run=squawk)
