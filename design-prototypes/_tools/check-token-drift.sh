#!/usr/bin/env bash
# Regenerates every Hummel Hex token output from _tokens/hummel-hex.tokens.json into a temp copy
# and fails if any committed file differs: both variants' tokens.json and tokens.css, the mask
# SVGs and pages, and the Flutter PoC's tokens.g.dart.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/dp"
for d in _tokens _tools option-3-hummel option-3a-hex-sharp option-3b-hex-soft; do
  cp -r "$root/$d" "$tmp/dp/$d"
done
rm -rf "$tmp/dp/_tools/node_modules"
ln -s "$here/node_modules" "$tmp/dp/_tools/node_modules"
(cd "$tmp/dp/_tools" && node build-hex-variants.mjs >/dev/null && node build-hex-assets.mjs >/dev/null &&
  node build-dart-widgets.mjs "$tmp/tokens.g.dart" ../option-3a-hex-sharp ../option-3b-hex-soft >/dev/null)
status=0
for v in option-3a-hex-sharp option-3b-hex-soft; do
  diff -r "$root/$v" "$tmp/dp/$v" || status=1
done
diff "$root/flutter-hex-poc/lib/src/tokens.g.dart" "$tmp/tokens.g.dart" || status=1
if [ "$status" -eq 0 ]; then echo "token outputs match _tokens/hummel-hex.tokens.json"; else echo "drift: rerun the builds (see _tools/README.md)" >&2; fi
exit "$status"
