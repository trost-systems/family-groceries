#!/usr/bin/env bash
# The ops dashboard (nexus/, job 156): Deno fmt, lint, type check and tests of the snapshot
# pipeline and the page, and one browser bundle of the page (what publish.sh ships).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/nexus"
deno fmt --check
deno lint
deno check --frozen pipeline/ scripts/ src/ test/ web/
deno test --frozen --allow-read --allow-write --allow-env --allow-run=bash
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
deno bundle --frozen --quiet --platform browser -o "$out/app.js" web/main.ts
