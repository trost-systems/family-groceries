#!/usr/bin/env bash
# Workflows (actionlint), shell scripts (shellcheck), the e2e TypeScript (tsc), the TypeScript lint
# pack (tool/lint/ts), the gate wiring, the landing, e2e gate and release scripts' tests, the
# structural lints in scripts/lint.sh, and
# the generated files against their source: the design tokens (design/tokens/build.mjs) and the
# app icon and splash screens (design/app-icon/build.mjs), the Android widget's hex shapes
# (design/widget/build.mjs) and the item icon table with its samples (tool/item_icons/build.mjs, its
# test build.test.mjs).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
actionlint
shellcheck scripts/*.sh scripts/gates/*.sh scripts/backup/*.sh scripts/release/*.sh scripts/fg .githooks/*
(cd e2e && { [[ -d node_modules ]] || npm ci; } && npx tsc --noEmit -p .)
# The TypeScript pack (tool/lint/ts/pack.ts, job 101): its own fmt and lint, then every `error` rule.
(cd tool/lint/ts && deno fmt --check && deno lint)
deno run --allow-all tool/lint/ts/strict.ts
scripts/check-gates.sh
scripts/landing-test.sh
scripts/e2e-gate-test.sh
scripts/release/test.sh
scripts/lint.sh
node design/tokens/build.mjs --check
node design/app-icon/build.mjs --check
node design/widget/build.mjs --check
node --test tool/item_icons/build.test.mjs
# CI checks out depth 1 without origin/main; the REVISION rule compares the table with main's.
git rev-parse --verify --quiet 'origin/main^{commit}' >/dev/null ||
  git fetch --quiet --no-tags --depth=1 origin +refs/heads/main:refs/remotes/origin/main
node tool/item_icons/build.mjs --check
