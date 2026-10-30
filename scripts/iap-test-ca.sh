#!/usr/bin/env bash
# Job 25: a throwaway CA standing in for Apple's, so the local stack's `purchases` function can be
# driven end to end without the App Store (docs/PURCHASES.md, "Testing locally"): the e2e specs, fg
# and the app's fake store ask the function's local-only route /purchases/test/sign for a StoreKit
# transaction or notification signed like Apple's, then send it to /verify or /apple/notifications.
#
# Writes supabase/.temp/iap-test/{root.pem,intermediate.pem,leaf.pem,leaf.key} (gitignored, never
# committed) and sets PURCHASES_ENVIRONMENTS=Sandbox, PURCHASES_TEST_ROOT_PEM, PURCHASES_TEST_X5C and
# PURCHASES_TEST_KEY in supabase/functions/.env, which `supabase start` loads. The function honours
# them only inside the local stack (purchases/config.ts). Idempotent: a CA still valid for a day is
# kept. Run before `supabase start` (scripts/lib.sh supabase_up does).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dir="$REPO_ROOT/supabase/.temp/iap-test"
env_file="$REPO_ROOT/supabase/functions/.env"

mkdir -p "$dir"
if ! { [[ -s $dir/leaf.key && -s $dir/leaf.pem ]] && openssl x509 -in "$dir/leaf.pem" -noout -checkend 86400 >/dev/null 2>&1; }; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  ec=(-newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes)
  openssl req -x509 "${ec[@]}" -days 30 -subj '/CN=Hummlist Test Apple Root' \
    -keyout "$tmp/root.key" -out "$dir/root.pem" \
    -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' 2>/dev/null
  openssl req "${ec[@]}" -subj '/CN=Hummlist Test Apple WWDR' -keyout "$tmp/mid.key" -out "$tmp/mid.csr" 2>/dev/null
  # Apple's WWDR intermediate marker (purchases/apple.ts intermediateOid).
  printf 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign\n1.2.840.113635.100.6.2.1=DER:0500\n' >"$tmp/mid.ext"
  openssl x509 -req -in "$tmp/mid.csr" -CA "$dir/root.pem" -CAkey "$tmp/root.key" -CAcreateserial \
    -days 30 -extfile "$tmp/mid.ext" -out "$dir/intermediate.pem" 2>/dev/null
  openssl req "${ec[@]}" -subj '/CN=Hummlist Test StoreKit Signing' -keyout "$dir/leaf.key" -out "$tmp/leaf.csr" 2>/dev/null
  # Apple's receipt-signing leaf marker (purchases/apple.ts leafOid).
  printf 'basicConstraints=CA:FALSE\n1.2.840.113635.100.6.11.1=DER:0500\n' >"$tmp/leaf.ext"
  openssl x509 -req -in "$tmp/leaf.csr" -CA "$dir/intermediate.pem" -CAkey "$tmp/mid.key" \
    -CAcreateserial -days 7 -extfile "$tmp/leaf.ext" -out "$dir/leaf.pem" 2>/dev/null
  chmod 600 "$dir/leaf.key"
fi

b64() { base64 <"$1" | tr -d '\n'; }
der() { openssl x509 -in "$1" -outform der | base64 | tr -d '\n'; }
touch "$env_file"
grep -v -E '^(PURCHASES_ENVIRONMENTS|PURCHASES_TEST_ROOT_PEM|PURCHASES_TEST_X5C|PURCHASES_TEST_KEY)=' "$env_file" >"$env_file.new" || true
{
  echo "PURCHASES_ENVIRONMENTS=Sandbox"
  echo "PURCHASES_TEST_ROOT_PEM=$(b64 "$dir/root.pem")"
  echo "PURCHASES_TEST_X5C=$(der "$dir/leaf.pem"),$(der "$dir/intermediate.pem"),$(der "$dir/root.pem")"
  echo "PURCHASES_TEST_KEY=$(b64 "$dir/leaf.key")"
} >>"$env_file.new"
mv "$env_file.new" "$env_file"
echo "iap test CA: $dir (functions env: $env_file)"
