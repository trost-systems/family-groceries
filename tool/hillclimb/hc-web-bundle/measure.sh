#!/usr/bin/env bash
# HC hc-web-bundle (job 133): the bytes a first-time browser downloads before the signed-in list
# shows (lower is better). Builds the web app like Vercel (--release --no-web-resources-cdn
# --wasm), opens the list in a fresh Chromium against fake_supabase.py, records every file the
# page fetches from the web origin, and sums their brotli (quality 11) sizes. Prints one JSON
# line on stdout; logs go to stderr. docs/hillclimb/hc-web-bundle.md explains the score.
#
#   tool/hillclimb/hc-web-bundle/measure.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
web_port=63380
supabase_port=63381
out=build/web-hc133
export PATH="$HOME/flutter/bin:$PATH"

work="$(mktemp -d /tmp/hc133-measure.XXXXXX)"
fake=""
cleanup() {
  if [[ -n $fake ]]; then kill "$fake" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

[[ -d $root/e2e/node_modules/playwright-core ]] || (cd "$root/e2e" && npm ci --no-audit --no-fund --silent >&2)
cd "$root/app"
flutter pub get >/dev/null
echo "measure: building the web app" >&2
started="$(date +%s.%N)"
flock /tmp/flutter-build-web.lock flutter build web --release --no-web-resources-cdn --wasm --base-href / \
  --output "$out" \
  --dart-define=SUPABASE_URL="http://127.0.0.1:$supabase_port" \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_probe \
  --dart-define-from-file=config/auth.json >"$work/build.log" 2>&1 || { tail -40 "$work/build.log" >&2; exit 1; }
build_s="$(python3 -c "import sys; print(round(float(sys.argv[2]) - float(sys.argv[1]), 1))" "$started" "$(date +%s.%N)")"

python3 -I "$here/fake_supabase.py" "$supabase_port" 2>"$work/fake.log" &
fake=$!
echo "measure: capturing the boot fetches under /tmp/fg-hc-measure.lock" >&2
capture="$(cd "$root" && flock /tmp/fg-hc-measure.lock node "$here/capture.mjs" "$root/app/$out" \
  "$web_port" "$supabase_port" /tmp/hc133-last.png)"
if [[ -s $work/fake.log ]]; then cat "$work/fake.log" >&2; fi

node "$here/score.mjs" "$root/app/$out" "$capture" "$build_s" \
  "$(git -C "$root" rev-parse --short HEAD)$(git -C "$root" diff --quiet HEAD -- app || echo -dirty)"
