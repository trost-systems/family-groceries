#!/usr/bin/env bash
# Read-only diagnosis of the production Alexa skill (diagnose.ts; docs/ALEXA.md, Troubleshooting).
#   scripts/alexa/diagnose.sh [--last 6h | --from 'YYYY-MM-DD HH:MM' --to 'YYYY-MM-DD HH:MM']
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ops_env="${FG_OPS_ENV:-$HOME/groceries-ops/env}"
if [[ -z ${SUPABASE_ACCESS_TOKEN:-} && -f $ops_env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ops_env"
  set +a
fi
exec deno run --quiet --config "$dir/deno.json" --allow-net=api.supabase.com --allow-env --allow-read \
  "$dir/diagnose.ts" "$@"
