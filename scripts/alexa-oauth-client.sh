#!/usr/bin/env bash
# Job 31: registers the Alexa skill's OAuth client with Supabase Auth's OAuth 2.1 server, for
# account linking (docs/ALEXA.md, "Deploy"). Run once by Hummlist Ops after the Amazon Developer
# account exists, with the vendor id the Alexa console shows under Account Linking ("Alexa Redirect
# URLs" end in /api/skill/link/<vendor id>).
#
#   scripts/alexa-oauth-client.sh <vendor id> [project URL]
#
# Registers a confidential client "Amazon Alexa" (client_secret_basic) with the three Alexa
# redirect URLs (pitangui: US, layla: EU incl. de-DE, alexa.amazon.co.jp: FE) and prints its
# client id and client secret ONCE, to paste into the Alexa console's Account Linking page (or
# into alexa/account-linking.json's clientId and the --client-secret of the SMAPI call). The
# secret is not stored anywhere else; never commit or post it. Uses Supabase's dynamic client
# registration (allow_dynamic_registration), so no service key is needed.
set -euo pipefail
vendor="${1:?usage: $0 <vendor id> [project URL]}"
base="${2:-https://jdwqrallbpdbshrdhenk.supabase.co}"
[[ $vendor =~ ^[A-Z0-9]{6,20}$ ]] || { echo "the vendor id looks like M1ABCDEF2GHIJ; got '$vendor'" >&2; exit 2; }

body="$(jq -n --arg v "$vendor" '{
  client_name: "Amazon Alexa",
  redirect_uris: [
    "https://pitangui.amazon.com/api/skill/link/\($v)",
    "https://layla.amazon.com/api/skill/link/\($v)",
    "https://alexa.amazon.co.jp/api/skill/link/\($v)"
  ],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "client_secret_basic"
}')"
answer="$(curl -sS --fail-with-body -X POST "${base%/}/auth/v1/oauth/clients/register" \
  -H 'content-type: application/json' -d "$body")"
jq -e '.client_type == "confidential" and (.client_secret | length > 0)' <<<"$answer" >/dev/null || {
  echo "unexpected answer (no confidential client):" >&2
  jq 'del(.client_secret)' <<<"$answer" >&2
  exit 1
}
echo "Authorization URI:  ${base%/}/auth/v1/oauth/authorize"
echo "Access Token URI:   ${base%/}/auth/v1/oauth/token"
echo "Client ID:          $(jq -r .client_id <<<"$answer")"
echo "Client Secret:      $(jq -r .client_secret <<<"$answer")   (shown once; paste it, then clear the terminal)"
echo "Authentication:     HTTP Basic (Credentials in Header)"
echo "PKCE:               on, S256"
