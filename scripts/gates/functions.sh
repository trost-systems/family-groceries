#!/usr/bin/env bash
# Edge functions, the classifier dictionary (job 2) and the deploy tooling (job 07): Deno fmt, lint, tests.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
(cd "$REPO_ROOT/supabase/functions" && deno fmt --check && deno lint && deno test --allow-env --allow-net)
(cd "$REPO_ROOT/supabase/classifier" && deno fmt --check && deno lint && deno test --allow-read)
(cd "$REPO_ROOT/supabase/deploy" && deno fmt --check && deno lint && deno test --allow-read)
