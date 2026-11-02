#!/usr/bin/env bash
# Job 69: types utterances into the skill's DEVELOPMENT stage with Amazon's simulator and prints,
# per utterance, what Alexa did: the request she sent to the skill (LaunchRequest, an intent) and
# what she said, or that it never reached the skill. Text only: the simulator skips speech
# recognition, so a misheard "Hummlist" cannot show up here (docs/ALEXA.md).
#
#   ALEXA_SKILL_ID=amzn1.ask.skill.… scripts/alexa-simulate.sh [locale …]   default: every locale
#
# Needs the ASK CLI (v2) signed in to the developer account, with testing enabled for development.
set -euo pipefail
cd "$(dirname "$0")/.."
skill="${ALEXA_SKILL_ID:?set ALEXA_SKILL_ID (docs/ALEXA.md, Deploy)}"
declare -A utterances=(
  [de]='öffne hummlist|sag hummlist füge milch hinzu|sag hummlist ich brauche milch|sag hummlist setz milch drauf|frag hummlist was auf der liste steht'
  [en]="open hummlist|ask hummlist to add milk|tell hummlist we need milk|ask hummlist to put milk on the list|ask hummlist what's on the list"
)
locales=("$@")
((${#locales[@]})) || mapfile -t locales < <(jq -r '.manifest.publishingInformation.locales | keys[]' alexa/skill-package/skill.json)

failed=0
for locale in "${locales[@]}"; do
  IFS='|' read -ra said <<<"${utterances[${locale%%-*}]}"
  for utterance in "${said[@]}"; do
    id="$(ask smapi simulate-skill -s "$skill" -g development --device-locale "$locale" \
      --input-content "$utterance" --session-mode FORCE_NEW_SESSION | jq -r .id)"
    result=""
    for _ in $(seq 30); do
      result="$(ask smapi get-skill-simulation -s "$skill" -g development -i "$id")"
      [[ $(jq -r .status <<<"$result") == IN_PROGRESS ]] || break
      sleep 2
    done
    line="$(jq -r '
      (.result.skillExecutionInfo.invocations[0].invocationRequest.body.request // null) as $r
      | if .status != "SUCCESSFUL" then "simulation \(.status): \(.result.error.message // "")"
        elif $r == null then "NOT ROUTED to the skill: \(.result.error.message // ([.result.alexaExecutionInfo.alexaResponses[]?.content.caption] | join(" ")))"
        else "\($r.type)\(if $r.intent then " \($r.intent.name) \($r.intent.slots // {} | [.[] | select(.value) | "\(.name)=\(.value)"] | join(" "))" else "" end) -> \([.result.alexaExecutionInfo.alexaResponses[]?.content.caption] | join(" "))"
        end' <<<"$result")"
    [[ $line == NOT\ ROUTED* || $line == simulation* ]] && failed=1
    printf '%s  %-45s %s\n' "$locale" "$utterance" "$line"
  done
done
exit "$failed"
