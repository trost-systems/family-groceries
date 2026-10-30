#!/usr/bin/env bash
# Migrations apply to a fresh database, pgTAP passes, the classifier sweep holds, the classifier's
# word list and latency stay within Spec #8's targets (job 32a), db lint is clean,
# and a backup restores to identical data (scripts/backup/drill.sh, docs/BACKUP.md).
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT"
if stack_running; then
  db_reset
else
  supabase_up
fi
supabase test db
# Job 21: the PM's Monday feedback summary, exactly as docs/FEEDBACK.md has it, on fake notes.
scripts/feedback-monday.sh
supabase/classifier/sweep.sh
supabase/classifier/wordlist.sh
supabase/classifier/latency.sh
# Job 32a: the MCP and voice/Siri add code against this stack classifies like the app (AC7).
# Job 31: the alexa function's wiring (add, read, households, rate limit, revocation, consent).
db_port="$(sed -n '/^\[db\]/,/^\[/ s/^port = \([0-9]*\)$/\1/p' supabase/config.toml)"
(cd supabase/functions && FG_DB_TEST=1 SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:$db_port/postgres" \
  deno test --allow-env --allow-net _shared/add_paths_integration_test.ts alexa/store_integration_test.ts)
supabase db lint --local --fail-on warning
scripts/backup/drill.sh

# Job 18: fixtures against this stack: two scenario runs seed and pass their checks, cannot see
# each other through RLS, and tear down to zero rows; a run with a lost manifest is still removed.
fg_on_repo_stack
(cd .cursor/skills/verify-family-groceries/cli && FG_INTEGRATION=1 deno test --allow-all fixtures_integration_test.ts)
