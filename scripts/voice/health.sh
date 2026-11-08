#!/usr/bin/env bash
# Checks everything a Siri or Alexa test session depends on that no phone is needed for
# (docs/voice/TEST-SESSION-2026-11-08.md, "Before the session"). Read-only: deploys, links and
# changes nothing.
#   scripts/voice/health.sh            # server, auth and release checks (SUPABASE_ACCESS_TOKEN)
#   scripts/voice/health.sh --amazon   # also the skill's development stage (needs ask, the box)
# Prints PASS, WARN or FAIL per check; exits 1 when one FAILs. Ops env: ~/groceries-ops/env.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2
amazon=0
for arg in "$@"; do
  case $arg in
    --amazon) amazon=1 ;;
    -h | --help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown argument $arg" >&2; exit 2 ;;
  esac
done
ops_env="${FG_OPS_ENV:-$HOME/groceries-ops/env}"
if [[ ( -z ${SUPABASE_ACCESS_TOKEN:-} || -z ${ALEXA_VENDOR_ID:-} || -z ${ALEXA_SKILL_ID:-} ) && -f $ops_env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ops_env"
  set +a
fi
ref="${SUPABASE_PROJECT_REF:-jdwqrallbpdbshrdhenk}"
base="https://$ref.supabase.co"
repo="${GH_REPO:-trost-systems/family-groceries}"
api="https://api.supabase.com/v1/projects/$ref"
failed=0
pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; failed=1; }
mgmt() { curl -sS --max-time 20 -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-}" "$api$1"; }
sql() {
  curl -sS --max-time 20 -X POST "$api/database/query/read-only" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-}" -H 'content-type: application/json' \
    -d "$(jq -n --arg q "$1" '{query: $q}')"
}

echo "== Server ($base)"
nonce="health-$(date +%s)"
status="$(curl -sS -o /tmp/voice-health.$$ -w '%{http_code}' --max-time 15 -X POST "$base/functions/v1/voice" \
  -H 'content-type: application/json' -H "x-hummlist-client: $nonce" -d '{"mode":"read","lang":"de"}')"
if [[ $status == 401 ]] && jq -e '.outcome == "unauthorized"' /tmp/voice-health.$$ >/dev/null 2>&1; then
  pass "voice answers an unsigned call with 401 unauthorized"
else
  fail "voice: unsigned call got HTTP $status $(head -c 200 /tmp/voice-health.$$)"
fi
status="$(curl -sS -o /tmp/voice-health.$$ -w '%{http_code}' --max-time 15 -X POST "$base/functions/v1/alexa" \
  -H 'content-type: application/json' -d '{"version":"1.0","request":{"type":"LaunchRequest"}}')"
if [[ $status == 400 ]]; then
  pass "alexa refuses an unsigned request with 400 ($(jq -r .error /tmp/voice-health.$$ 2>/dev/null))"
else
  fail "alexa: unsigned request got HTTP $status (Amazon needs 400)"
fi
rm -f /tmp/voice-health.$$

if [[ -z ${SUPABASE_ACCESS_TOKEN:-} ]]; then
  fail "SUPABASE_ACCESS_TOKEN unset: no deploy, secret, auth or database checks"
else
  functions="$(mgmt /functions)"
  for slug in voice alexa; do
    row="$(jq -c --arg s "$slug" '.[]? | select(.slug == $s)' <<<"$functions")"
    if [[ -z $row ]]; then
      fail "$slug is not deployed"
    elif jq -e '.status == "ACTIVE" and .verify_jwt == false' <<<"$row" >/dev/null; then
      pass "$slug ACTIVE, verify_jwt off, v$(jq -r .version <<<"$row"), deployed $(jq -r '.updated_at / 1000 | strflocaltime("%Y-%m-%d %H:%M")' <<<"$row")"
    else
      fail "$slug: $(jq -c '{status, verify_jwt}' <<<"$row")"
    fi
  done
  deployed="$(gh run list --repo "$repo" --workflow supabase-deploy.yml --branch main --status success -L 1 --json headSha -q '.[0].headSha' 2>/dev/null)"
  git fetch -q origin main 2>/dev/null
  changed="$(git log -1 --format=%H origin/main -- supabase/functions/voice supabase/functions/alexa supabase/functions/_shared)"
  if [[ -n $deployed && -n $changed ]] && git merge-base --is-ancestor "$changed" "$deployed" 2>/dev/null; then
    pass "the last voice/alexa change on main (${changed:0:8}) is deployed (deploy ${deployed:0:8})"
  else
    fail "main's last voice/alexa change ${changed:0:8} is not in the last good deploy ${deployed:0:8}"
  fi
  if mgmt /secrets | jq -e '[.[].name] | index("ALEXA_SKILL_ID")' >/dev/null; then
    pass "secret ALEXA_SKILL_ID is set"
  else
    fail "secret ALEXA_SKILL_ID is missing: every Alexa request is refused as wrong_skill"
  fi
  if mgmt /config/auth | jq -e '.oauth_server_enabled == true' >/dev/null; then
    pass "Supabase OAuth server on (account linking)"
  else
    fail "Supabase OAuth server off: account linking cannot work"
  fi
  client="$(sql "select id as client_id, client_type, redirect_uris from auth.oauth_clients where client_name = 'Amazon Alexa' and deleted_at is null")"
  vendor="${ALEXA_VENDOR_ID:-}"
  if [[ -n $vendor ]] && jq -e --arg v "$vendor" 'length == 1 and .[0].client_type == "confidential"
      and (.[0].redirect_uris | contains("layla.amazon.com/api/skill/link/" + $v))' <<<"$client" >/dev/null 2>&1; then
    pass "OAuth client 'Amazon Alexa' $(jq -r '.[0].client_id' <<<"$client"): confidential, layla (EU) redirect for vendor ${vendor:-?}"
  else
    fail "OAuth client 'Amazon Alexa': $(jq -c '[.[]? | {client_type, redirect_uris}]' <<<"$client" 2>/dev/null || echo "$client")"
  fi
  lock="$(sql "select enabled from public.app_switches where key = 'integration_lock'" | jq -r '.[0].enabled | tostring')"
  if [[ $lock == false ]]; then
    pass "integration_lock off: Siri works without Premium"
  else
    warn "integration_lock is $lock: Siri answers 'needs Premium' for households without it"
  fi
  links="$(sql "select count(*) as links, max(last_seen) as last_seen from public.alexa_links")"
  echo "INFO  alexa_links: $(jq -c '.[0]' <<<"$links")"
  # The logs reach the API 10-60 s late: look for this run's two calls for up to 2 min.
  logq="select event_message from logs where source = 'function_logs' and (event_message like '%client=$nonce%' or (event_message like 'alexa: - - - linked=false -> refused % ms=%' and timestamp > now() - interval 5 minute)) limit 10"
  lines=""
  for _ in 1 2 3 4 5 6; do
    sleep 20
    lines="$(curl -sS --max-time 30 -G "$api/analytics/endpoints/logs" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      --data-urlencode "sql=$logq" --data-urlencode "iso_timestamp_start=$(date -u -d '-10 minutes' +%FT%TZ)" \
      --data-urlencode "iso_timestamp_end=$(date -u +%FT%TZ)" | jq -r '.result[]?.event_message' 2>/dev/null)"
    grep -q "client=$nonce" <<<"$lines" && grep -q '^alexa: .* ms=' <<<"$lines" && break
  done
  if grep -q "^voice: none read de client=$nonce -> unauthorized status=401" <<<"$lines"; then
    pass "voice logs its request line ($(grep -m1 "client=$nonce" <<<"$lines"))"
  else
    fail "no voice request line for this run's call in 2 min: the deployed voice predates job 170, or logging is broken"
  fi
  if grep -q '^alexa: .* ms=' <<<"$lines"; then
    pass "alexa logs the job 170 line ($(grep -m1 '^alexa: ' <<<"$lines"))"
  else
    fail "no alexa line with ms= in 2 min: the deployed alexa predates job 170"
  fi
fi

echo "== Builds"
release="$(gh run list --repo "$repo" --workflow release.yml -L 10 --json databaseId,number,headSha,conclusion,createdAt 2>/dev/null)"
last="$(jq -c '[.[] | select(.conclusion == "success")][0] // empty' <<<"$release")"
if [[ -n $last ]]; then
  number="$(jq -r .number <<<"$last")"
  offset="$(sed -n 's/^ *BUILD_NUMBER_OFFSET: *\([0-9]*\).*/\1/p' .github/workflows/release.yml | head -1)"
  ios="$(gh run view "$(jq -r .databaseId <<<"$last")" --repo "$repo" --json jobs -q '.jobs[] | select(.name == "ios") | .conclusion' 2>/dev/null)"
  if [[ $ios == success ]]; then
    pass "TestFlight build $((offset + number)) from $(jq -r '.headSha[0:8] + ", " + .createdAt' <<<"$last") (ios job success)"
  else
    warn "last release run $(jq -r .number <<<"$last") ios job: ${ios:-none} (build $((offset + number)) may not be on TestFlight)"
  fi
  if [[ -n ${VOICE_NEED_SHA:-} ]]; then
    if git merge-base --is-ancestor "$VOICE_NEED_SHA" "$(jq -r .headSha <<<"$last")" 2>/dev/null; then
      pass "that build contains $VOICE_NEED_SHA"
    else
      fail "that build does not contain $VOICE_NEED_SHA yet"
    fi
  fi
else
  warn "no successful release run in the last 10"
fi

if ((amazon)); then
  echo "== Alexa development stage"
  skill="${ALEXA_SKILL_ID:-}"
  if ! command -v ask >/dev/null; then
    fail "ask (ASK CLI) not found: run --amazon on the box"
  elif [[ -z $skill ]]; then
    fail "ALEXA_SKILL_ID unset"
  else
    manifest="$(ask smapi get-skill-manifest -s "$skill" -g development 2>&1)"
    want="$(jq -c '.manifest.apis.custom.endpoint' alexa/skill-package/skill.json)"
    got="$(jq -c '.manifest.apis.custom.endpoint' <<<"$manifest" 2>/dev/null)"
    if [[ $got == "$want" ]]; then pass "endpoint $got"; else fail "endpoint $got, repo $want"; fi
    for locale in $(jq -r '.manifest.publishingInformation.locales | keys[]' alexa/skill-package/skill.json); do
      model="$(ask smapi get-interaction-model -s "$skill" -g development -l "$locale" 2>&1)"
      norm='.interactionModel | walk(if type == "array" then sort_by(tostring) else . end)'
      invocation="$(jq -r .interactionModel.languageModel.invocationName <<<"$model" 2>/dev/null)"
      if diff <(jq -S "$norm" <<<"$model" 2>/dev/null) \
        <(jq -S "$norm" "alexa/skill-package/interactionModels/custom/$locale.json") >/dev/null; then
        pass "$locale model = repo (invocation '$invocation')"
      else
        fail "$locale model differs from the repo (invocation '$invocation'): run scripts/alexa-deploy-dev.sh"
      fi
    done
    linking="$(ask smapi get-account-linking-info -s "$skill" -g development 2>&1)"
    if jq -e --arg b "$base" '.accountLinkingResponse | .type == "AUTH_CODE"
        and .authorizationUrl == ($b + "/auth/v1/oauth/authorize")
        and .accessTokenUrl == ($b + "/auth/v1/oauth/token")
        and .accessTokenScheme == "HTTP_BASIC"' <<<"$linking" >/dev/null 2>&1; then
      pass "account linking: auth code grant against $base, HTTP Basic"
    else
      fail "account linking: $(jq -c '.accountLinkingResponse | del(.clientSecret)?' <<<"$linking" 2>/dev/null || echo "$linking" | head -3)"
    fi
    linked_client="$(jq -r '.accountLinkingResponse.clientId // empty' <<<"$linking" 2>/dev/null)"
    if [[ -n ${client:-} ]] && jq -e --arg c "$linked_client" '.[0].client_id == $c' <<<"$client" >/dev/null 2>&1; then
      pass "account linking client id = Supabase's 'Amazon Alexa' client"
    else
      fail "account linking client id '$linked_client' is not Supabase's 'Amazon Alexa' client"
    fi
    if ask smapi get-skill-enablement-status -s "$skill" -g development >/dev/null 2>&1; then
      pass "skill enabled for the developer account (development stage)"
    else
      warn "skill not enabled for the developer account: enable it in the Alexa app (Skills, Ihre Skills, Entwicklung) or the console Test tab"
    fi
    status="$(ask smapi get-skill-status -s "$skill" 2>&1)"
    if jq -e '[.. | .lastUpdateRequest?.status? // empty] | all(. == "SUCCEEDED")' <<<"$status" >/dev/null 2>&1; then
      pass "manifest and model builds SUCCEEDED"
    else
      fail "skill status: $(jq -c '[.. | .lastUpdateRequest?.status? // empty]' <<<"$status" 2>/dev/null || echo "$status" | head -3)"
    fi
    beta="$(ask smapi get-beta-test -s "$skill" 2>&1)"
    echo "INFO  beta test: $(jq -c '{status, expiryDate}' <<<"$beta" 2>/dev/null || echo none)"
    echo "INFO  testers: $(ask smapi get-list-of-testers -s "$skill" 2>/dev/null | jq -c '[.testers[]? | .invitationStatus] | group_by(.) | map({(.[0]): length}) | add' 2>/dev/null)"
  fi
fi
exit "$failed"
