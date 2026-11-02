#!/usr/bin/env bash
# Job 69: runs Amazon's certification validation on the skill's DEVELOPMENT stage for every locale
# of the package and prints each check. Exit 1 when one fails. This only validates; it never
# submits for certification (docs/ALEXA_CERTIFICATION.md).
#
#   ALEXA_SKILL_ID=amzn1.ask.skill.… scripts/alexa-validate.sh
#
# Needs the ASK CLI (v2) signed in to the developer account.
set -euo pipefail
cd "$(dirname "$0")/.."
skill="${ALEXA_SKILL_ID:?set ALEXA_SKILL_ID (docs/ALEXA.md, Deploy)}"
locales="$(jq -r '.manifest.publishingInformation.locales | keys | join(",")' alexa/skill-package/skill.json)"

id="$(ask smapi submit-skill-validation -s "$skill" -g development --locales "$locales" | jq -r .id)"
result=""
for _ in $(seq 90); do
  result="$(ask smapi get-skill-validations -s "$skill" -g development -i "$id")"
  [[ $(jq -r .status <<<"$result") == IN_PROGRESS ]] || break
  sleep 10
done
jq -r '.result.validations[]? | "\(.status)\t\(.importance // "")\t\(.locale // "all")\t\(.title)\(if .status == "FAILED" then ": \(.description)" else "" end)"' <<<"$result" | sort
status="$(jq -r .status <<<"$result")"
echo "validation $id: $status ($locales)"
[[ $status == SUCCESSFUL ]]
