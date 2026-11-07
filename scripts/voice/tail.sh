#!/usr/bin/env bash
# Follows a Siri or Alexa test session live (docs/voice/TEST-SESSION-2026-11-08.md): every
# `voice:` and `alexa:` request line, each call's HTTP status and time at the edge, and the
# account-linking steps of Supabase Auth (method, path, status, grant, error code; never an id,
# e-mail or address).
#   scripts/voice/tail.sh [--since 10m] [--every 20]
# Polls the hosted project's logs (Management API, SUPABASE_ACCESS_TOKEN from the ops env); the
# logs arrive there 10-60 s after the request. Times are Europe/Berlin. Ctrl-C stops.
set -uo pipefail
since=10m
every=20
while (($#)); do
  case $1 in
    --since) since="${2:?--since 10m}"; shift 2 ;;
    --every) every="${2:?--every 20}"; shift 2 ;;
    -h | --help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
[[ $since =~ ^([0-9]+)([mh])$ ]] || { echo "--since takes 15m or 2h" >&2; exit 2; }
((every >= 15)) || { echo "--every is at least 15 (the logs API throttles)" >&2; exit 2; }
ops_env="${FG_OPS_ENV:-$HOME/groceries-ops/env}"
if [[ -z ${SUPABASE_ACCESS_TOKEN:-} && -f $ops_env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ops_env"
  set +a
fi
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN or FG_OPS_ENV}"
ref="${SUPABASE_PROJECT_REF:-jdwqrallbpdbshrdhenk}"
unit=minutes
[[ ${BASH_REMATCH[2]} == h ]] && unit=hours
from="$(date -u -d "-${BASH_REMATCH[1]} $unit" +%Y-%m-%dT%H:%M:%SZ)"

query="select timestamp, source, event_message,
  log_attributes['request.pathname'] as fn_path, log_attributes['response.status_code'] as fn_status,
  log_attributes['execution_time_ms'] as fn_ms
from logs
where (source = 'function_logs' and (event_message like 'voice: %' or event_message like 'alexa: %'))
  or (source = 'function_edge_logs' and log_attributes['request.pathname'] in ('/functions/v1/voice', '/functions/v1/alexa'))
  or (source = 'auth_logs' and event_message like '%\"path\":\"/oauth/%')
order by timestamp desc limit 500"

declare -A seen=()
echo "Following voice + alexa from $(TZ=Europe/Berlin date -d "$from" +%H:%M:%S) (every ${every}s; logs lag 10-60 s)"
while :; do
  to="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  answer="$(curl -sS --max-time 30 -G "https://api.supabase.com/v1/projects/$ref/analytics/endpoints/logs" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" --data-urlencode "sql=$query" \
    --data-urlencode "iso_timestamp_start=$from" --data-urlencode "iso_timestamp_end=$to" 2>&1)"
  if ! jq -e '.result' <<<"$answer" >/dev/null 2>&1; then
    echo "$(TZ=Europe/Berlin date +%H:%M:%S)  (logs API: $(jq -r '.error.message? // .message? // .' <<<"$answer" 2>/dev/null | head -c 160))"
  else
    while IFS=$'\t' read -r key _ line; do
      [[ -n ${seen[$key]:-} ]] && continue
      seen[$key]=1
      printf '%s\n' "$line"
    done < <(TZ=Europe/Berlin jq -r '
      # Hosted auth rows carry the request only as JSON in event_message (path is "/" in the
      # attributes). Authorization ids in the path become <id>; e-mails, IPs and ids never print.
      def oauth: (.event_message | fromjson? // {}) as $m
        | ($m.auth_event.traits.provider_type // "") as $type
        | ($m.auth_event.action // "") as $action
        | "auth  \($m.method // "?") \(($m.path // "?") | sub("/oauth/authorizations/[^/]+"; "/oauth/authorizations/<id>")) \($m.status // "?")"
          + (if $type == "oauth_provider_authorization_code" then " grant=authorization_code"
             elif $action == "token_refreshed" then " grant=refresh_token" else "" end)
          + (if (($m.error_code // "") | test("^[a-z_]{1,64}$")) then " error=\($m.error_code)" else "" end);
      .result[] |
      ((.timestamp | sub("\\.[0-9]+$"; "") + "Z" | fromdateiso8601) as $t
      | ($t | strflocaltime("%H:%M:%S")) as $at
      | (if .source == "function_logs" then (.event_message | gsub("[\\r\\n]"; " ") | .[0:220])
         elif .source == "function_edge_logs" then
           "edge  \(.fn_path | sub("/functions/v1/"; "")) HTTP \(.fn_status) \(.fn_ms // "?") ms"
         else oauth
         end) as $msg
      | [(.timestamp + .source + $msg), .timestamp, "\($at)  \($msg)"] | @tsv)' <<<"$answer" | sort -t$'\t' -k2,2)
  fi
  from="$(date -u -d '-3 minutes' +%Y-%m-%dT%H:%M:%SZ)"
  sleep "$every"
done
