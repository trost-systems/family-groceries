#!/usr/bin/env bash
# Smoke test of an MCP endpoint the way a client connects to it: the 401 challenge, the Protected
# Resource Metadata it points at, the authorization server's metadata, then initialize and
# tools/list. Works on the function URL and on the mcp.hummlist.com proxy (docs/MCP.md).
# Discovery needs no credentials. MCP_SMOKE_TOKEN (a personal access token or OAuth access token)
# enables the tools/list check; without it that check reports SKIP. The token is never printed.
# Usage: [MCP_SMOKE_TOKEN=…] scripts/mcp-smoke.sh <mcp endpoint URL>
#   e.g. https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp or https://mcp.hummlist.com
# Prints PASS/FAIL/SKIP per check; exits 1 on any FAIL.
set -uo pipefail

[[ $# == 1 ]] || { echo "usage: $0 <mcp endpoint URL>" >&2; exit 2; }
base="${1%/}"
origin() { sed -E 's#^([a-z]+://[^/]+).*#\1#' <<<"$1"; }
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; failures=$((failures + 1)); }
skip() { echo "SKIP $1"; }

# request <name> <curl args...>: status to $work/<name>.status, headers and body beside it.
# Retries timeouts and transient 5xx, so a cold start passes and a lasting outage fails.
request() {
  local name=$1
  shift
  curl -sS --max-time 20 --retry 2 --retry-delay 3 --retry-connrefused \
    -D "$work/$name.headers" -o "$work/$name.body" -w '%{http_code}' "$@" \
    >"$work/$name.status" 2>"$work/$name.err" || true
}
status() { cat "$work/$1.status"; }
header() { grep -i "^$2:" "$work/$1.headers" | tail -1 | cut -d' ' -f2- | tr -d '\r'; }
got() { echo "got HTTP $(status "$1") $(head -c 200 "$work/$1.body" 2>/dev/null) $(head -c 200 "$work/$1.err")"; }
# The JSON-RPC message with id $2, from a JSON or an SSE (text/event-stream) response.
rpc() {
  local body="$work/$1.body"
  if grep -q '^data: ' "$body"; then sed -n 's/^data: //p' "$body"; else cat "$body"; fi |
    jq -cs --argjson id "$2" '[.[] | objects | select(.id == $id)][0] // empty' 2>/dev/null
}

mcp_post() { # mcp_post <name> <json-rpc body> [curl args...]
  local name=$1 body=$2
  shift 2
  request "$name" -X POST "$base" -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-11-25' \
    -d "$body" "$@"
}
initialize='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"mcp-smoke","version":"1"}}}'

echo "MCP smoke test against $base"

mcp_post challenge "$initialize"
challenge="$(header challenge www-authenticate)"
metadata="$(sed -nE 's/.*resource_metadata="([^"]*)".*/\1/p' <<<"$challenge")"
if [[ $(status challenge) == 401 && $challenge == Bearer* && -n $metadata &&
  $(origin "$metadata") == "$(origin "$base")" ]]; then
  pass "no token: 401, resource_metadata on the same host ($metadata)"
else
  fail "no token: want 401 and WWW-Authenticate: Bearer resource_metadata=\"$(origin "$base")/…\"; $(got challenge) www-authenticate='$challenge'"
fi

mcp_post bad "$initialize" -H 'authorization: Bearer mcp-smoke-not-a-token'
challenge="$(header bad www-authenticate)"
if [[ $(status bad) == 401 && $challenge == *'error="invalid_token"'* &&
  $challenge == *"resource_metadata=\"$metadata\""* ]]; then
  pass 'bad token: 401 invalid_token, same resource_metadata'
else
  fail "bad token: want 401 with error=\"invalid_token\" and resource_metadata=\"$metadata\"; $(got bad) www-authenticate='$challenge'"
fi

issuer=''
request prm "${metadata:-$base/.well-known/oauth-protected-resource}"
request prm2 "${metadata:-$base/.well-known/oauth-protected-resource}"
resource="$(jq -r '.resource // empty' "$work/prm.body" 2>/dev/null)"
if [[ $(status prm) == 200 && ${resource%/} == "$base" ]] &&
  jq -e '.authorization_servers | length > 0' "$work/prm.body" >/dev/null 2>&1; then
  issuer="$(jq -r '.authorization_servers[0]' "$work/prm.body")"
  pass "protected resource metadata: 200, resource $resource, authorization server $issuer"
else
  fail "protected resource metadata: want 200 with resource \"$base\" and authorization_servers; $(got prm)"
fi
if [[ $(header prm2 x-vercel-cache) == HIT ]]; then
  fail 'protected resource metadata: the proxy served it from its cache (x-vercel-cache: HIT)'
fi

# RFC 8414 inserts the well-known part before the issuer's path; Supabase also serves it after.
as_ok=''
if [[ -n $issuer ]]; then
  issuer_path="${issuer#"$(origin "$issuer")"}"
  for url in "$(origin "$issuer")/.well-known/oauth-authorization-server$issuer_path" \
    "$issuer/.well-known/oauth-authorization-server" "$issuer/.well-known/openid-configuration"; do
    request as "$url"
    if [[ $(status as) == 200 ]] && jq -e --arg iss "$issuer" '.issuer == $iss and
        (.authorization_endpoint | type == "string") and (.token_endpoint | type == "string") and
        (.registration_endpoint | type == "string")' "$work/as.body" >/dev/null 2>&1; then
      as_ok="$url"
      break
    fi
  done
fi
if [[ -z $issuer ]]; then
  fail 'authorization server metadata: no authorization server to check (see the metadata check)'
elif [[ -n $as_ok ]]; then
  pass "authorization server metadata: $as_ok has authorization, token and registration endpoints"
else
  fail "authorization server metadata: want 200 with issuer \"$issuer\" and authorization/token/registration endpoints; $(got as)"
fi

# A client refreshing without the 401's resource_metadata hint treats the MCP URL as the
# authorization server and probes <endpoint>/.well-known/openid-configuration (the root-level
# probes on supabase.co hit Supabase's gateway). It must find a token endpoint there without a
# token, or the refresh never starts (incident 2026-10-31, docs/MCP.md).
request asfallback "$base/.well-known/openid-configuration"
if [[ $(status asfallback) == 200 ]] && jq -e --arg iss "$issuer" '.issuer == $iss and
    (.token_endpoint | type == "string") and (.grant_types_supported | index("refresh_token"))' \
  "$work/asfallback.body" >/dev/null 2>&1; then
  pass "hint-less discovery: $base/.well-known/openid-configuration names the token endpoint"
else
  fail "hint-less discovery: want 200 with issuer \"$issuer\" and a refresh_token token endpoint at $base/.well-known/openid-configuration; $(got asfallback)"
fi

if [[ -z ${MCP_SMOKE_TOKEN:-} ]]; then
  skip 'initialize + tools/list: MCP_SMOKE_TOKEN not set'
else
  printf 'authorization: Bearer %s\n' "$MCP_SMOKE_TOKEN" >"$work/auth"
  mcp_post init "$initialize" -H @"$work/auth"
  mcp_post tools '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' -H @"$work/auth"
  server="$(rpc init 1 | jq -r '.result.serverInfo.name // empty')"
  tools="$(rpc tools 2 | jq -r '[.result.tools[]?.name] | join(",")')"
  if [[ $(status init) == 200 && -n $server && $(status tools) == 200 && $tools == *add_items* ]]; then
    pass "initialize + tools/list: server $server, tools $tools"
  else
    fail "initialize + tools/list: want 200 and a tool list with add_items; initialize $(got init); tools/list $(got tools)"
  fi
fi

if ((failures > 0)); then
  echo "$failures check(s) failed against $base"
  exit 1
fi
echo "all checks passed against $base"
