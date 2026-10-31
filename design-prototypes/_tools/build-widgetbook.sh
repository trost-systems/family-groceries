#!/usr/bin/env bash
# Builds the Hummel Hex Widgetbook (flutter-hex-poc/widgetbook/) and writes the
# web build to design-prototypes/widgetbook/, which publish.mjs copies into
# site/public/design-prototypes/widgetbook/. Regenerates the stories, runs both
# packages' analyze and tests first, so a red catalog never gets published.
#
#   design-prototypes/_tools/build-widgetbook.sh
set -euo pipefail

prototypes="$(cd "$(dirname "$0")/.." && pwd)"
poc="$prototypes/flutter-hex-poc"
catalog="$poc/widgetbook"
out="$prototypes/widgetbook"
base_href=/design-prototypes/widgetbook/

(cd "$poc" && flutter pub get && flutter analyze && flutter test)
cd "$catalog"
flutter pub get
dart run build_runner build
flutter analyze
flutter test

# One `flutter build web` at a time on a shared host.
exec 9>/tmp/flutter-build-web.lock
flock 9
flutter build web --release --no-web-resources-cdn --no-source-maps \
  --base-href "$base_href" --output build/web-catalog

rm -rf "$out"
cp -R build/web-catalog "$out"
# Files a dart2js + CanvasKit build never loads: the service worker (an
# unregister stub; flutter_bootstrap.js registers none), the skwasm and wimp
# engines (only for --wasm), the webparagraph CanvasKit (only with
# preferWebParagraph) and debug symbols.
rm -rf "$out/flutter_service_worker.js" "$out/canvaskit/webparagraph" \
  "$out"/canvaskit/skwasm* "$out"/canvaskit/wimp*
find "$out" -name '*.symbols' -delete
echo "widgetbook: $(find "$out" -type f | wc -l) files, $(du -sh "$out" | cut -f1) in $out"
