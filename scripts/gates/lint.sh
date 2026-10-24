#!/usr/bin/env bash
# Workflows (actionlint), shell scripts (shellcheck), the e2e TypeScript (tsc), the gate wiring,
# then the structural lints in scripts/lint.sh.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
actionlint
shellcheck scripts/*.sh scripts/gates/*.sh scripts/fg .githooks/*
(cd e2e && { [[ -d node_modules ]] || npm ci; } && npx tsc --noEmit -p .)
scripts/check-gates.sh
scripts/lint.sh
