#!/usr/bin/env bash
# Read-only smoke test of a deployed project's edge functions. Uses no credentials: the bad-token
# checks send a made-up bearer token. Run after every deploy (supabase-deploy.yml) or by hand.
# Usage: scripts/smoke-remote.sh [project URL]
#   default https://$SUPABASE_PROJECT_REF.supabase.co, else the production project.
# Prints PASS/FAIL per check; exits 1 on any FAIL.
# A FAIL against production before a deploy can be the expected signal: it checks what main's
# functions do, and production runs the last deployed version until the deploy finishes.
set -uo pipefail

base="${1:-https://${SUPABASE_PROJECT_REF:-jdwqrallbpdbshrdhenk}.supabase.co}"
fn="${base%/}/functions/v1"
bad_token='fg-smoke-not-a-token'
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; failures=$((failures + 1)); }

# request <name> <curl args...>: status to $work/<name>.status, headers and body beside it.
# Retries timeouts and transient 5xx, so a cold start passes and a lasting outage fails.
request() {
  local name=$1
  shift
  curl -sS --max-time 15 --retry 2 --retry-delay 3 --retry-connrefused \
    -D "$work/$name.headers" -o "$work/$name.body" -w '%{http_code}' "$@" \
    >"$work/$name.status" 2>"$work/$name.err" || true
}
status() { cat "$work/$1.status"; }
header() { grep -i "^$2:" "$work/$1.headers" | tail -1 | cut -d' ' -f2- | tr -d '\r'; }
got() { echo "got HTTP $(status "$1") $(head -c 200 "$work/$1.body" 2>/dev/null) $(head -c 200 "$work/$1.err")"; }

echo "smoke test against $fn"

request health "$fn/health"
if [[ $(status health) == 200 ]] && jq -e '.ok == true and .database == true' "$work/health.body" >/dev/null 2>&1; then
  pass 'health: 200, Postgres answered'
else
  fail "health: want 200 with {\"ok\":true,\"database\":true}; $(got health)"
fi

request prm "$fn/mcp/.well-known/oauth-protected-resource"
if [[ $(status prm) == 200 ]] &&
  jq -e '(.resource | type == "string") and (.authorization_servers | length > 0)' "$work/prm.body" >/dev/null 2>&1; then
  pass 'mcp protected resource metadata: 200'
else
  fail "mcp protected resource metadata: want 200 with resource and authorization_servers; $(got prm)"
fi

request voice -X POST "$fn/voice" -H "authorization: Bearer $bad_token" \
  -H 'content-type: application/json' -d '{"text":"Milch"}'
challenge="$(header voice www-authenticate)"
if [[ $(status voice) == 401 && $challenge == Bearer* ]]; then
  pass 'voice with a bad token: 401, WWW-Authenticate: Bearer'
else
  fail "voice with a bad token: want 401 and WWW-Authenticate: Bearer; $(got voice) www-authenticate='$challenge'"
fi

request mcp -X POST "$fn/mcp" -H "authorization: Bearer $bad_token" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{}'
challenge="$(header mcp www-authenticate)"
if [[ $(status mcp) == 401 && $challenge == Bearer* && $challenge == *'error="invalid_token"'* &&
  $challenge =~ resource_metadata=\"[^\"]*/mcp/\.well-known/oauth-protected-resource\" ]]; then
  pass 'mcp with a bad token: 401, WWW-Authenticate with resource_metadata and invalid_token'
else
  fail "mcp with a bad token: want 401 and WWW-Authenticate: Bearer resource_metadata=\".../mcp/.well-known/oauth-protected-resource\", error=\"invalid_token\"; $(got mcp) www-authenticate='$challenge'"
fi

if ((failures > 0)); then
  echo "$failures check(s) failed against $fn"
  exit 1
fi
echo "all checks passed against $fn"
