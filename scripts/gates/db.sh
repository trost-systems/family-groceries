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
supabase/classifier/sweep.sh
supabase db lint --local --fail-on warning
scripts/backup/drill.sh
