#!/usr/bin/env bash
# The web app builds with the production config (what Vercel ships), into its own directory so
# it never replaces the e2e build in app/build/web.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
cd "$REPO_ROOT/app"
flutter pub get >/dev/null
flutter build web --release --no-web-resources-cdn --wasm --output build/web-prod

# Job 28: one --wasm build holds both entry points; flutter_bootstrap.js picks the wasm one where
# the browser runs it (WasmGC, allow list) and main.dart.js everywhere else. Every web build
# (Vercel, e2e, fg sync) builds it this way.
out=build/web-prod
for file in main.dart.wasm main.dart.mjs main.dart.js; do
  [[ -s $out/$file ]] || { echo "web-prod: $out/$file is missing; build with --wasm" >&2; exit 1; }
done
for target in '"compileTarget":"dart2wasm"' '"compileTarget":"dart2js"'; do
  grep -q "$target" "$out/flutter_bootstrap.js" \
    || { echo "web-prod: flutter_bootstrap.js has no $target build" >&2; exit 1; }
done
for script in scripts/vercel.sh scripts/gates/e2e.sh .cursor/skills/verify-family-groceries/cli/sync.ts; do
  grep -Eq -- "(flutter build web|'web',).*--wasm|'--wasm'" "$REPO_ROOT/$script" \
    || { echo "web-prod: $script builds the web app without --wasm" >&2; exit 1; }
done
