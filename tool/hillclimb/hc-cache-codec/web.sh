#!/usr/bin/env bash
# The web side of hc-cache-codec: builds app/test/hillclimb/web_codec_probe.dart as a release web
# app (as scripts/vercel.sh builds the app: --wasm, so Chromium runs wasm and Firefox and WebKit
# main.dart.js) and prints each engine's save/load p50 for main's JSON snapshot and for v4, through
# shared preferences (localStorage). Needs e2e/node_modules (npm ci in e2e/). Timed under the hc lock.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
cd "$root/app"
flutter pub get >/dev/null 2>&1
flutter build web --release --wasm --no-web-resources-cdn -t test/hillclimb/web_codec_probe.dart -o "$out" >/dev/null
flock /tmp/fg-hc-measure.lock node "$here/web.mjs" "$out"
