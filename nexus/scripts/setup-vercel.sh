#!/usr/bin/env bash
# One-time, idempotent setup of the Vercel project hummlist-nexus: creates it if missing (no git
# connection: the publisher deploys prebuilt output), adds nexus.hummlist.com, protects all
# deployments with Vercel Authentication (ssoProtection deploymentType "all", free on every plan
# since 2026-09-09), then checks logged out that the domain answers 401 or a redirect to the login.
# Before the first deploy it says so and exits 0: run cron.sh or publish.sh --deploy, then this again.
# Needs VERCEL_TOKEN; VERCEL_ORG_ID (the team id) when the project lives in a team. Prints the project id for
# VERCEL_PROJECT_ID. DNS needs no record: hummlist.com is on Vercel's nameservers with a wildcard.
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
PROJECT=hummlist-nexus
DOMAIN=nexus.hummlist.com
API=https://api.vercel.com
auth=(-H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json')

out="$(mktemp)"
trap 'rm -f "$out"' EXIT
# call <method> <path> [json]: sets $status and $body (not in a subshell, so both survive).
call() {
  local url="$API$2"
  if [[ -n ${VERCEL_ORG_ID:-} ]]; then
    if [[ $url == *\?* ]]; then url+="&"; else url+="?"; fi
    url+="teamId=$VERCEL_ORG_ID"
  fi
  status="$(curl -sS -o "$out" -w '%{http_code}' -X "$1" "${auth[@]}" "$url" ${3:+--data "$3"})"
  body="$(cat "$out")"
}

call GET "/v9/projects/$PROJECT"
if [[ $status == 404 ]]; then
  call POST /v11/projects "{\"name\":\"$PROJECT\",\"framework\":null}"
  [[ $status == 200 ]] || { echo "create project failed ($status): $body" >&2; exit 1; }
  echo "created project $PROJECT"
elif [[ $status != 200 ]]; then
  echo "read project failed ($status): $body" >&2
  exit 1
fi
project_id="$(jq -r .id <<<"$body")"

call POST "/v10/projects/$PROJECT/domains" "{\"name\":\"$DOMAIN\"}"
case $status in
  200) echo "added $DOMAIN (verified: $(jq -r .verified <<<"$body"))" ;;
  400 | 409)
    failed="$status: $body"
    call GET "/v9/projects/$PROJECT/domains"
    if grep -q "\"$DOMAIN\"" <<<"$body"; then echo "$DOMAIN already on $PROJECT"; else
      echo "add domain failed ($failed)" >&2
      exit 1
    fi
    ;;
  *) echo "add domain failed ($status): $body" >&2; exit 1 ;;
esac

call PATCH "/v9/projects/$PROJECT" '{"ssoProtection":{"deploymentType":"all"}}'
[[ $status == 200 && "$(jq -r .ssoProtection.deploymentType <<<"$body")" == all ]] \
  || { echo "protection failed ($status): $body" >&2; exit 1; }
echo "Vercel Authentication on all deployments"
echo "VERCEL_PROJECT_ID=$project_id"

no_deployment() {
  echo "no deployment yet: run cron.sh (or publish.sh --deploy), then rerun this"
  exit 0
}
call GET "/v6/deployments?projectId=$project_id&limit=1"
[[ $status == 200 ]] || { echo "list deployments failed ($status): $body" >&2; exit 1; }
[[ "$(jq '.deployments | length' <<<"$body")" != 0 ]] || no_deployment

code="$(curl -s -o /dev/null -D "$out" -w '%{http_code} %{redirect_url}' "https://$DOMAIN/")"
echo "logged-out https://$DOMAIN/: $code"
[[ $code == 404* ]] && grep -qi '^x-vercel-error: *DEPLOYMENT_NOT_FOUND' "$out" && no_deployment
[[ $code == 401* || $code =~ ^30[0-9]\ https://vercel.com ]] \
  || { echo "expected 401 or a redirect to vercel.com: the domain answers without the login" >&2; exit 1; }
