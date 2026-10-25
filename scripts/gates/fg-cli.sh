#!/usr/bin/env bash
# The fg verification CLI (.cursor/skills/verify-family-groceries, job 05): Deno fmt, lint, tests.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/.cursor/skills/verify-family-groceries/cli"
deno fmt --check
deno lint
deno test --allow-all
