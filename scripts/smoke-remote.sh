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

request voice -X POST "$fn/voice" -H "authorization: Bearer $bad_token" \
  -H 'content-type: application/json' -d '{"text":"Milch"}'
challenge="$(header voice www-authenticate)"
if [[ $(status voice) == 401 && $challenge == Bearer* ]]; then
  pass 'voice with a bad token: 401, WWW-Authenticate: Bearer'
else
  fail "voice with a bad token: want 401 and WWW-Authenticate: Bearer; $(got voice) www-authenticate='$challenge'"
fi

"$(dirname "$0")/mcp-smoke.sh" "$fn/mcp" || fail 'mcp: scripts/mcp-smoke.sh (above)'

# Job 31: Alexa signs every request; an unsigned one is refused before anything is read.
request alexa -X POST "$fn/alexa" -H 'content-type: application/json' \
  -d '{"version":"1.0","request":{"type":"LaunchRequest","timestamp":"2026-01-01T00:00:00Z"}}'
if [[ $(status alexa) == 400 ]] && jq -e '.error == "missing_signature"' "$work/alexa.body" >/dev/null 2>&1; then
  pass 'alexa without a signature: 400 missing_signature'
else
  fail "alexa without a signature: want 400 {\"error\":\"missing_signature\"}; $(got alexa)"
fi

# Job 43: the purchases function answers its status, never serves test events on a hosted
# project, takes no webhook without RevenueCat's secret (503 while it is not configured) and no
# claim without the app's session.
request purchases "$fn/purchases"
if [[ $(status purchases) == 200 ]] && jq -e '.configured | type == "boolean"' "$work/purchases.body" >/dev/null 2>&1; then
  pass "purchases: 200, configured=$(jq -r .configured "$work/purchases.body")"
else
  fail "purchases: want 200 with a configured flag; $(got purchases)"
fi
request purchases_test -X POST "$fn/purchases/test/event" -H 'content-type: application/json' \
  -d '{"appUserId":"smoke","transactionId":"smoke"}'
if [[ $(status purchases_test) == 404 ]]; then
  pass 'purchases test events: 404 on a hosted project'
else
  fail "purchases test events: want 404; $(got purchases_test)"
fi
request purchases_webhook -X POST "$fn/purchases/revenuecat/webhook?forceFunctionRegion=eu-central-1" -H "authorization: Bearer $bad_token" \
  -H 'content-type: application/json' -d '{"event":{"id":"smoke","type":"TEST"}}'
if [[ $(status purchases_webhook) == 401 || $(status purchases_webhook) == 503 ]]; then
  pass "purchases webhook with a bad secret: $(status purchases_webhook)"
else
  fail "purchases webhook with a bad secret: want 401 (or 503 unconfigured); $(got purchases_webhook)"
fi
request purchases_claim -X POST "$fn/purchases/claim" -H 'content-type: application/json' \
  -d '{"store":"apple","transactionId":"smoke"}'
if [[ $(status purchases_claim) == 401 ]]; then
  pass 'purchases claim without a session: 401'
else
  fail "purchases claim without a session: want 401; $(got purchases_claim)"
fi

if ((failures > 0)); then
  echo "$failures check(s) failed against $fn"
  exit 1
fi
echo "all checks passed against $fn"
