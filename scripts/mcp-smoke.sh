#!/usr/bin/env bash
# Smoke test of an MCP endpoint the way a client connects to it: the 401 challenge, the Protected
# Resource Metadata it points at, the authorization server's metadata, then the handshake and
# tools/list. Works on the function URL and on the mcp.hummlist.com proxy (docs/MCP.md).
# Discovery needs no credentials. MCP_SMOKE_TOKEN (a personal access token or OAuth access token)
# enables the handshake and tools/list checks; without it they report SKIP. The token is never
# printed. MCP_PROTOCOL_VERSION picks the protocol revision (default 2025-11-25).
# Usage: [MCP_SMOKE_TOKEN=…] [MCP_PROTOCOL_VERSION=…] scripts/mcp-smoke.sh <mcp endpoint URL>
#   e.g. https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp or https://mcp.hummlist.com
# Prints PASS/FAIL/SKIP per check; exits 1 on any FAIL, 2 on a usage error.
set -uo pipefail

[[ $# == 1 ]] || { echo "usage: $0 <mcp endpoint URL>" >&2; exit 2; }
base="${1%/}"

# TODO: switch the default to protocol 2026-07-28 once the MCP clients people connect with
# (Claude, ChatGPT, Cursor) speak it; our server answers both today (e2e/tests/mcp-smoke.spec.ts).
version="${MCP_PROTOCOL_VERSION:-2025-11-25}"
# Per revision: the handshake request, how its answer proves the version, the server name and the
# tools capability, and the _meta envelope every 2026-era request carries.
case $version in
  2025-11-25)
    era=legacy
    handshake=initialize
    handshake_params="$(jq -cn --arg v "$version" \
      '{protocolVersion: $v, capabilities: {}, clientInfo: {name: "mcp-smoke", version: "1"}}')"
    handshake_version='.result.protocolVersion'
    server_name='.result.serverInfo.name'
    meta='{}'
    ;;
  2026-07-28)
    era=modern
    handshake=server/discover
    handshake_params='{}'
    handshake_version='.result.supportedVersions[]?'
    server_name='.result._meta["io.modelcontextprotocol/serverInfo"].name'
    meta="$(jq -cn --arg v "$version" '{"io.modelcontextprotocol/protocolVersion": $v,
      "io.modelcontextprotocol/clientInfo": {name: "mcp-smoke", version: "1"},
      "io.modelcontextprotocol/clientCapabilities": {}}')"
    ;;
  *)
    echo "MCP_PROTOCOL_VERSION=$version: unknown; this script speaks 2025-11-25 and 2026-07-28" >&2
    exit 2
    ;;
esac

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
# A server may echo the credential in an error; the token never reaches the output.
got() {
  local text
  text="got HTTP $(status "$1") $(head -c 200 "$work/$1.body" 2>/dev/null) $(head -c 200 "$work/$1.err")"
  if [[ -n ${MCP_SMOKE_TOKEN:-} ]]; then text="${text//"$MCP_SMOKE_TOKEN"/<token>}"; fi
  echo "$text"
}
# The JSON-RPC message with id $2, from a JSON or an SSE (text/event-stream) response.
rpc() {
  local body="$work/$1.body"
  if grep -q '^data: ' "$body"; then sed -n 's/^data: //p' "$body"; else cat "$body"; fi |
    jq -cs --argjson id "$2" '[.[] | objects | select(.id == $id)][0] // empty' 2>/dev/null
}

# mcp_post <name> <method> <id, or null for a notification> <params> [curl args...]
mcp_post() {
  local name=$1 method=$2 id=$3 params=$4 body
  shift 4
  body="$(jq -cn --arg m "$method" --argjson id "$id" --argjson p "$params" --argjson meta "$meta" \
    '{jsonrpc: "2.0", method: $m, params: ($p + if $meta == {} then {} else {_meta: $meta} end)}
     + if $id == null then {} else {id: $id} end')"
  local headers=(-H 'content-type: application/json' -H 'accept: application/json, text/event-stream'
    -H "mcp-protocol-version: $version")
  if [[ $era == modern ]]; then headers+=(-H "mcp-method: $method"); fi
  request "$name" -X POST "$base" "${headers[@]}" -d "$body" "$@"
}

echo "MCP smoke test against $base (protocol $version)"

mcp_post challenge "$handshake" 1 "$handshake_params"
challenge="$(header challenge www-authenticate)"
metadata="$(sed -nE 's/.*resource_metadata="([^"]*)".*/\1/p' <<<"$challenge")"
if [[ $(status challenge) == 401 && $challenge == Bearer* && -n $metadata &&
  $(origin "$metadata") == "$(origin "$base")" ]]; then
  pass "no token: 401, resource_metadata on the same host ($metadata)"
else
  fail "no token: want 401 and WWW-Authenticate: Bearer resource_metadata=\"$(origin "$base")/…\"; $(got challenge) www-authenticate='$challenge'"
fi

mcp_post bad "$handshake" 1 "$handshake_params" -H 'authorization: Bearer mcp-smoke-not-a-token'
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
  skip "$handshake + tools/list: MCP_SMOKE_TOKEN not set"
else
  printf 'authorization: Bearer %s\n' "$MCP_SMOKE_TOKEN" >"$work/auth"
  auth=(-H @"$work/auth")
  mcp_post init "$handshake" 1 "$handshake_params" "${auth[@]}"
  answer="$(rpc init 1)"
  server="$(jq -r "$server_name // empty" <<<"$answer" 2>/dev/null)"
  if [[ $(status init) == 200 && -n $server ]] &&
    jq -e --arg v "$version" "[$handshake_version] | index(\$v) != null" <<<"$answer" >/dev/null 2>&1 &&
    jq -e '.result.capabilities.tools | type == "object"' <<<"$answer" >/dev/null 2>&1; then
    pass "$handshake: 200, protocol $version, server $server, tools capability"
  else
    fail "$handshake: want 200 with protocol $version, a server name and capabilities.tools; $(got init)"
  fi

  session="$(header init mcp-session-id)"
  if [[ -n $session ]]; then auth+=(-H "mcp-session-id: $session"); fi
  if [[ $era == legacy ]]; then
    mcp_post initialized notifications/initialized null '{}' "${auth[@]}"
    if [[ $(status initialized) == 202 ]]; then
      pass "notifications/initialized: 202${session:+ (session kept)}"
    else
      fail "notifications/initialized: want 202; $(got initialized)"
    fi
  fi

  mcp_post tools tools/list 2 '{}' "${auth[@]}"
  tools="$(rpc tools 2)"
  names="$(jq -r '[.result.tools[]?.name] | join(",")' <<<"$tools" 2>/dev/null)"
  incomplete="$(jq -r '[.result.tools[]? | select((.name | type) != "string" or
      (.description | type) != "string" or .inputSchema.type != "object") | .name // "?"]
    | join(",")' <<<"$tools" 2>/dev/null)"
  if [[ $(status tools) != 200 || -z $names ]]; then
    fail "tools/list: want 200 and a tool list; $(got tools)"
  elif [[ -n $incomplete ]]; then
    fail "tools/list: tools without a name, a description or an object inputSchema: $incomplete"
  elif [[ ,$names, != *,add_items,* ]]; then
    fail "tools/list: no add_items among $names"
  else
    pass "tools/list: $names"
  fi
fi

if ((failures > 0)); then
  echo "$failures check(s) failed against $base"
  exit 1
fi
echo "all checks passed against $base"
