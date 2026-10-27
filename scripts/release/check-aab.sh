#!/usr/bin/env bash
# Fails unless the App Bundle is signed by the certificate with the given SHA-256 fingerprint.
# build.gradle.kts falls back to the debug key without android/key.properties, and Play rejects
# a bundle signed by anything but the app's upload key, so the Release run checks before uploading.
# Usage: scripts/release/check-aab.sh <app-release.aab> <SHA-256 fingerprint, AA:BB:...>
set -euo pipefail
aab="$1" want="${2^^}"
got="$(keytool -printcert -jarfile "$aab" | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)"
if [[ -z $got ]]; then
  echo "::error::$aab is not signed" >&2
  exit 1
fi
if [[ $got != "$want" ]]; then
  echo "::error::$aab is signed by $got, not by the upload key $want (docs/RELEASE.md, Android signing)" >&2
  exit 1
fi
echo "$aab is signed by the upload key ($got)"
