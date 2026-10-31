#!/usr/bin/env bash
# Job 43: fake RevenueCat secrets for the local stack's `purchases` function (docs/PURCHASES.md,
# "Testing locally"), so the e2e specs, fg and the app's fake store can drive it through its
# local-only route /purchases/test/event, or post webhook events with the fake Authorization value.
# Sets REVENUECAT_WEBHOOK_AUTH and REVENUECAT_TOMBSTONE_HMAC_KEY in supabase/functions/.env (which
# `supabase start` loads) and leaves REVENUECAT_WEBHOOK_HMAC_SECRET unset, keeping every other line.
# Idempotent. Run before `supabase start` (scripts/lib.sh supabase_up does).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$REPO_ROOT/supabase/functions/.env"

touch "$env_file"
grep -v -E '^(REVENUECAT_WEBHOOK_AUTH|REVENUECAT_WEBHOOK_HMAC_SECRET|REVENUECAT_TOMBSTONE_HMAC_KEY)=' "$env_file" >"$env_file.new" || true
{
  echo 'REVENUECAT_WEBHOOK_AUTH="Bearer local-revenuecat-webhook"'
  echo 'REVENUECAT_TOMBSTONE_HMAC_KEY=local-revenuecat-tombstone-key'
} >>"$env_file.new"
mv "$env_file.new" "$env_file"
echo "iap local env: $env_file"
