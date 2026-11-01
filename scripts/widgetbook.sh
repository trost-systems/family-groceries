#!/usr/bin/env bash
# Builds the Hummlist Widgetbook (app/widgetbook/, the catalogue of the app's real components)
# for the web. Analyzes and tests it first, so a red catalogue never gets built. CI builds it in
# .github/workflows/widgetbook.yml and uploads the result as the artifact `widgetbook`; it is
# never published on hummlist.com.
#
#   scripts/widgetbook.sh [--out <dir>] [--base-href </path/>]
#
# --out defaults to app/widgetbook/build/web, --base-href to /.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

out="$REPO_ROOT/app/widgetbook/build/web"
base_href=/
while [[ $# -gt 0 ]]; do
  case $1 in
    --out) out="$(realpath -m "$2")"; shift 2 ;;
    --base-href) base_href="$2"; shift 2 ;;
    *) echo "widgetbook: unknown argument $1" >&2; exit 2 ;;
  esac
done

cd "$REPO_ROOT/app/widgetbook"
flutter pub get >/dev/null
flutter analyze --fatal-infos
flutter test

# One `flutter build web` at a time on a shared host.
exec 9>/tmp/flutter-build-web.lock
flock 9
flutter build web --release --no-web-resources-cdn --no-source-maps \
  --base-href "$base_href" --output "$out"
exec 9>&-

# flutter_bootstrap.js points the engine's fallback fonts (emoji, symbols) at fonts/, as the
# app does: no request leaves the catalogue's origin. Files a dart2js + CanvasKit build never
# loads go: the service worker stub, the skwasm and wimp engines (only for --wasm), the
# webparagraph CanvasKit and debug symbols.
rm -rf "$out/fonts"
cp -R "$REPO_ROOT/app/web/fonts" "$out/fonts"
rm -rf "$out/flutter_service_worker.js" "$out/canvaskit/webparagraph" \
  "$out"/canvaskit/skwasm* "$out"/canvaskit/wimp*
find "$out" -name '*.symbols' -delete
log "$(find "$out" -type f | wc -l) files, $(du -sh "$out" | cut -f1) in $out"
