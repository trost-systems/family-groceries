#!/usr/bin/env bash
# Migrations apply to a fresh database, pgTAP passes, the classifier sweep holds, db lint is clean,
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
supabase db lint --local --fail-on warning
scripts/backup/drill.sh

# Job 18: fixtures against this stack: two scenario runs seed and pass their checks, cannot see
# each other through RLS, and tear down to zero rows; a run with a lost manifest is still removed.
fg_on_repo_stack
(cd .cursor/skills/verify-family-groceries/cli && FG_INTEGRATION=1 deno test --allow-all fixtures_integration_test.ts)
