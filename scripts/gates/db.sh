#!/usr/bin/env bash
# Migrations apply to a fresh database, pgTAP passes, the classifier sweep holds, db lint is clean.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
if stack_running; then
  reserve_port_block
  supabase db reset >/dev/null
else
  supabase_up
fi
supabase test db
supabase/classifier/sweep.sh
supabase db lint --local --fail-on warning
