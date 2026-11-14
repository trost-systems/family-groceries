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
# Job 61: the app's copy of the classifier's word forms (offline trailing counts) is current.
supabase/classifier/client_lexicon.sh --check
# Job 59: suggest_entries with fuzzy matching stays under 50 ms p95 on a 5000-item household.
supabase/bench/suggest_latency.sh
# Job 32a: the MCP and voice/Siri add code against this stack classifies like the app (AC7).
# Job 31: the alexa function's wiring (add, read, households, rate limit, revocation, consent).
# Job 32b: the add paths report a similar open item, and merge_quantities matches the app's table.
# Job 25: the purchases function's wiring (grant, RLS read, replay, Apple refund, rate limit).
# Job 50: the integration lock through the voice, alexa and mcp wiring (switch, lapse, events).
# Job 62: list_items counts the whole list, per household.
# Job 64: two members adding the same item at once leave one open row (items_skip_duplicate).
# Job 73: the api function's wiring (keys, limits, idempotency, pagination, households, lock).
# Job 104: the server's number words are supabase/tests/number_words.tsv, like the app's.
# Job 111: in-app dictation splits brand and details as add_item does.
# Job 112: a plain name whose item is open with a brand, a note or a product word (Q79), through
# the Shortcut, native Siri and Alexa on parser-stored items.
# Job 172: Alexa, Siri and list_items read only the open items of the caller's household.
# Job 82: the waitlist function's wiring (sign-up, confirm, one-click unsubscribe, rate limit).
# Job 169b: one default per user under concurrent leaves, joins and creates; the MCP household tools;
# W2: joins racing for a group link's last uses never pass 50.
# W3: two approvals racing for a group link's last use count one join; an approval racing the same
# user's second tap or direct join leaves one membership and no open request; Siri and Alexa use the
# default list (job 207; the first list while none is chosen).
# Job 94: Client ID Metadata Documents through the mcp function and this stack's Supabase Auth.
# Job 211: a RevenueCat customer note racing the account's deletion leaves the customer queued.
# Job 207: adds without a named list go to the member's default list (else the first) through
# voice, MCP and the API; a spoken list name ("Luftballons zur Geburtstag Liste") picks the list.
# Job 225: the feedback digest over the real database (empty, internal-only, rerun, failed send, cutoff).
db_port="$(sed -n '/^\[db\]/,/^\[/ s/^port = \([0-9]*\)$/\1/p' supabase/config.toml)"
stack_env="$(supabase status -o env 2>/dev/null)"
stack_value() { sed -n "s/^$1=\"\(.*\)\"$/\1/p" <<<"$stack_env"; }
(cd supabase/functions && FG_DB_TEST=1 SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:$db_port/postgres" \
  SUPABASE_URL="$(stack_value API_URL)" SUPABASE_ANON_KEY="$(stack_value PUBLISHABLE_KEY)" \
  SUPABASE_SERVICE_ROLE_KEY="$(stack_value SERVICE_ROLE_KEY)" \
  deno test --allow-env --allow-net --allow-read _shared/add_paths_integration_test.ts alexa/store_integration_test.ts \
  _shared/dedupe_integration_test.ts purchases/store_integration_test.ts purchases/revenuecat_customers_integration_test.ts _shared/premium_integration_test.ts \
  _shared/zero_stores_integration_test.ts _shared/list_integration_test.ts \
  _shared/one_open_item_integration_test.ts _shared/read_open_only_integration_test.ts api/api_integration_test.ts _shared/number_words_integration_test.ts \
  voice/split_integration_test.ts _shared/voice_variants_integration_test.ts waitlist/waitlist_integration_test.ts \
  _shared/households_integration_test.ts mcp/households_integration_test.ts \
  mcp/cimd_integration_test.ts _shared/default_list_integration_test.ts \
  feedback-digest/digest_integration_test.ts)
supabase db lint --local --fail-on warning
scripts/backup/drill.sh

# Job 18: fixtures against this stack: two scenario runs seed and pass their checks, cannot see
# each other through RLS, and tear down to zero rows; a run with a lost manifest is still removed.
fg_on_repo_stack
(cd .cursor/skills/verify-family-groceries/cli && FG_INTEGRATION=1 deno test --allow-all fixtures_integration_test.ts)
