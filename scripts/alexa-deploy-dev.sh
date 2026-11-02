#!/usr/bin/env bash
# Job 69: uploads alexa/skill-package (manifest, every locale's model, icons) to the skill's DEVELOPMENT
# stage and checks what Amazon now serves (docs/ALEXA.md, "Deploy"). Never certifies, publishes
# or invites: `ask deploy` writes the development stage only.
#
#   ALEXA_SKILL_ID=amzn1.ask.skill.… scripts/alexa-deploy-dev.sh
#
# Needs the ASK CLI (v2) signed in to the developer account (`ask configure`), jq, curl, node.
set -euo pipefail
cd "$(dirname "$0")/.."
skill="${ALEXA_SKILL_ID:?set ALEXA_SKILL_ID (docs/ALEXA.md, Deploy)}"
images=alexa/skill-package/assets/images

git diff --quiet HEAD -- alexa/ || { echo "alexa/ has uncommitted changes; ask deploy rewrites it, so commit or drop them first" >&2; exit 2; }
node design/app-icon/build.mjs --check

# Without the state file ask deploy creates a second skill.
mkdir -p alexa/.ask
jq -n --arg id "$skill" '{askcliStatesVersion: "2020-03-31", profiles: {default: {skillId: $id}}}' \
  > alexa/.ask/ask-states.json
(cd alexa && ask deploy --target skill-metadata)
git checkout -- alexa/

locales="$(jq -r '.manifest.publishingInformation.locales | keys[]' alexa/skill-package/skill.json)"
for locale in $locales; do
  status=""
  for _ in $(seq 60); do
    status="$(ask smapi get-skill-status -s "$skill" | jq -r --arg l "$locale" '.interactionModel[$l].lastUpdateRequest.status // empty')"
    [[ $status == IN_PROGRESS ]] || break
    sleep 10
  done
  # get-skill-status lists only locales whose model was last written by a direct model update; after
  # a package import (ask deploy) the other locales have no entry. ask deploy already waited for every
  # build, so no entry is fine and the invocation-name check below proves the model is there.
  [[ -z $status || $status == SUCCEEDED ]] || { echo "$locale model build: $status" >&2; exit 1; }
  echo "$locale model build: ${status:-SUCCEEDED (via ask deploy, no per-locale status entry)}"
done

manifest="$(ask smapi get-skill-manifest -s "$skill" -g development)"
for locale in $locales; do
  name="$(jq -r --arg l "$locale" '.manifest.publishingInformation.locales[$l].name' <<<"$manifest")"
  [[ $name == Hummlist ]] || { echo "development manifest $locale: name '$name'" >&2; exit 1; }
  invocation="$(ask smapi get-interaction-model -s "$skill" -g development -l "$locale" | jq -r .interactionModel.languageModel.invocationName)"
  [[ $invocation == hummlist ]] || { echo "development model $locale: invocation name '$invocation'" >&2; exit 1; }
done
echo "development stage: name Hummlist, invocation hummlist in $(echo "$locales" | xargs)"
locale="$(jq '.manifest.publishingInformation.locales["de-DE"]' <<<"$manifest")"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for size in small large; do
  url="$(jq -r ".${size}IconUri" <<<"$locale")"
  curl -fsSL "$url" -o "$tmp/$size.png"
  if cmp -s "$tmp/$size.png" "$images/de-DE_${size}IconUri.png"; then
    echo "${size} icon: Amazon serves the committed file byte for byte"
  else
    # Amazon may re-encode; then the dimensions and a look at the file are the check.
    node -e "const b = require('fs').readFileSync(process.argv[1]); console.log(process.argv[2] + ' icon: re-encoded by Amazon, ' + b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) + ', saved to ' + process.argv[3])" \
      "$tmp/$size.png" "$size" "/tmp/alexa-dev-$size.png"
    cp "$tmp/$size.png" "/tmp/alexa-dev-$size.png"
  fi
done
