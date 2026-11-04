#!/usr/bin/env bash
# Has Amazon sign a de-DE LaunchRequest and POST it to the skill's endpoint (the hosted `alexa`
# function) through `ask smapi invoke-skill-end-point`, unlinked and, with ALEXA_SMOKE_TOKEN,
# linked; checks the answers (docs/ALEXA.md, Troubleshooting).
#   scripts/alexa/smoke.sh [--dry-run]
# ALEXA_SKILL_ID (from the ops env if unset), ALEXA_SMOKE_TOKEN (an OAuth access token of the test
# household's account; without it only the unlinked request runs), ASK (the ask binary).
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dry_run=0
for arg in "$@"; do
  case $arg in
    --dry-run) dry_run=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown argument $arg (usage: scripts/alexa/smoke.sh [--dry-run])" >&2; exit 2 ;;
  esac
done
ops_env="${FG_OPS_ENV:-$HOME/groceries-ops/env}"
if [[ -z ${ALEXA_SKILL_ID:-} && -f $ops_env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ops_env"
  set +a
fi
ask="${ASK:-ask}"
skill="${ALEXA_SKILL_ID:-}"
token="${ALEXA_SMOKE_TOKEN:-}"
placeholder='<ALEXA_SMOKE_TOKEN>'
if ((dry_run)); then
  skill="${skill:-amzn1.ask.skill.00000000-0000-0000-0000-000000000000}"
else
  [[ -n $skill ]] || { echo "ALEXA_SKILL_ID is not set (nor in $ops_env)" >&2; exit 2; }
  command -v "$ask" >/dev/null ||
    { echo "'$ask' not found: install ask-cli v2 and sign in (ask configure), or set ASK" >&2; exit 2; }
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"

# The token reaches jq through the environment, never through argv.
body() { # <variant> <token or ''>
  SMOKE_TOKEN="$2" jq -c --arg skill "$skill" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg id "$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')" '
    .session.application.applicationId = $skill
    | .context.System.application.applicationId = $skill
    | .session.sessionId = "amzn1.echo-api.session.smoke-\($id)"
    | .request.requestId = "amzn1.echo-api.request.smoke-\($id)"
    | .request.timestamp = $ts
    | if $ENV.SMOKE_TOKEN == "" then .
      else .session.user.accessToken = $ENV.SMOKE_TOKEN
        | .context.System.user.accessToken = $ENV.SMOKE_TOKEN end' \
    "$dir/fixtures/launch-request.json" > "$work/$1.json"
  chmod 600 "$work/$1.json"
}

command_line() { # <variant>
  echo "$ask smapi invoke-skill-end-point --skill-id $skill --stage development" \
    "--endpoint-region Default --skill-request-body file:$1.json"
}

if ((dry_run)); then
  body unlinked ''
  body linked "$placeholder"
  for variant in unlinked linked; do
    echo "# $variant"
    command_line "$variant"
    cat "$work/$variant.json"
  done
  exit 0
fi

failed=0
# Prints one PASS or FAIL line; never Amazon's echo of the request, which holds the token.
run() { # <variant>
  local variant=$1 out status speech card end ms problem=''
  if ! out="$("$ask" smapi invoke-skill-end-point --skill-id "$skill" --stage development \
    --endpoint-region Default --skill-request-body "file:$work/$variant.json" 2>"$work/stderr")"; then
    out="$(cat "$work/stderr")"
    [[ -n $token ]] && out="${out//"$token"/$placeholder}"
    echo "FAIL $variant: ask failed: $(head -c 400 <<<"$out")"
    failed=1
    return
  fi
  if ! jq -e . >/dev/null 2>&1 <<<"$out"; then
    echo "FAIL $variant: ask printed no JSON"
    failed=1
    return
  fi
  local r='.result.skillExecutionInfo.invocationResponse.body.response'
  status="$(jq -r '.status // ""' <<<"$out")"
  speech="$(jq -r "$r.outputSpeech.text // \"\"" <<<"$out")"
  card="$(jq -r "$r.card.type // \"\"" <<<"$out")"
  end="$(jq -r "$r.shouldEndSession | tostring" <<<"$out")"
  ms="$(jq -r '.result.skillExecutionInfo.metrics.skillExecutionTimeInMilliseconds // "?"' <<<"$out")"
  if [[ $status != SUCCESSFUL ]]; then
    problem="status ${status:-missing}: $(jq -r '.result.error.message // "no message"' <<<"$out")"
  elif [[ -z $speech ]]; then
    problem='no speech'
  elif [[ $variant == unlinked && $card != LinkAccount ]]; then
    problem="no LinkAccount card (card: ${card:-none})"
  elif [[ $variant == linked && $card == LinkAccount ]]; then
    problem='LinkAccount card: the token is not a live link'
  elif [[ $variant == linked && $end != false ]]; then
    problem="shouldEndSession is $end, not the launch prompt"
  fi
  [[ -n $token ]] && speech="${speech//"$token"/$placeholder}" problem="${problem//"$token"/$placeholder}"
  if [[ -n $problem ]]; then
    echo "FAIL $variant: $problem; speech \"$speech\" ($ms ms at Amazon)"
    failed=1
  else
    echo "PASS $variant: \"$speech\" (${card:-no card}, $ms ms at Amazon)"
  fi
}

body unlinked ''
run unlinked
if [[ -n $token ]]; then
  body linked "$token"
  run linked
else
  echo "SKIP linked: set ALEXA_SMOKE_TOKEN to an OAuth access token of the test household's account"
fi
echo "Next: scripts/alexa/diagnose.sh --last 15m should show" \
  "'alexa: LaunchRequest - de-DE linked=false -> link'" \
  "${token:+and 'alexa: LaunchRequest - de-DE linked=true -> launch'}"
exit "$failed"
