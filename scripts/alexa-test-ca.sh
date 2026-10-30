#!/usr/bin/env bash
# Job 31: a throwaway CA standing in for Amazon's, so the e2e tests can send the local stack's
# `alexa` function requests signed the way Alexa signs them (docs/ALEXA.md, "Testing").
#
# Writes supabase/.temp/alexa-test/{root.pem,chain.pem,leaf.key} (gitignored, never committed;
# the e2e spec signs with leaf.key) and sets ALEXA_SKILL_ID, ALEXA_TEST_ROOT_PEM and
# ALEXA_TEST_CHAIN_PEM in supabase/functions/.env, which `supabase start` loads. The function
# honours the test CA only inside the local stack (alexa/config.ts). Idempotent: an existing CA
# that is still valid for a day is kept. Run before `supabase start` (scripts/lib.sh supabase_up
# does); a stack that is already running picks the variables up on its next start.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dir="$REPO_ROOT/supabase/.temp/alexa-test"
env_file="$REPO_ROOT/supabase/functions/.env"
# The skill id the e2e requests carry (alexa/test_ca.ts testSkillId).
skill_id='amzn1.ask.skill.00000000-0000-4000-8000-00000000e2e0'

mkdir -p "$dir"
if ! { [[ -s $dir/leaf.key && -s $dir/chain.pem ]] && openssl x509 -in "$dir/chain.pem" -noout -checkend 86400 >/dev/null 2>&1; }; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=Hummlist Test Root' \
    -keyout "$tmp/root.key" -out "$dir/root.pem" \
    -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -subj '/CN=echo-api.amazon.com' \
    -keyout "$dir/leaf.key" -out "$tmp/leaf.csr" 2>/dev/null
  printf 'subjectAltName=DNS:echo-api.amazon.com\nbasicConstraints=CA:FALSE\n' >"$tmp/leaf.ext"
  openssl x509 -req -in "$tmp/leaf.csr" -CA "$dir/root.pem" -CAkey "$tmp/root.key" \
    -CAcreateserial -days 7 -extfile "$tmp/leaf.ext" -out "$tmp/leaf.pem" 2>/dev/null
  cat "$tmp/leaf.pem" "$dir/root.pem" >"$dir/chain.pem"
  chmod 600 "$dir/leaf.key"
fi

b64() { base64 <"$1" | tr -d '\n'; }
touch "$env_file"
grep -v -E '^(ALEXA_SKILL_ID|ALEXA_TEST_ROOT_PEM|ALEXA_TEST_CHAIN_PEM)=' "$env_file" >"$env_file.new" || true
{
  echo "ALEXA_SKILL_ID=$skill_id"
  echo "ALEXA_TEST_ROOT_PEM=$(b64 "$dir/root.pem")"
  echo "ALEXA_TEST_CHAIN_PEM=$(b64 "$dir/chain.pem")"
} >>"$env_file.new"
mv "$env_file.new" "$env_file"
echo "alexa test CA: $dir (functions env: $env_file)"
