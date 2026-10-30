#!/usr/bin/env bash
# Mirrors the fonts the Flutter web engine downloads at runtime (Roboto and its Noto fallback
# fonts for emoji, symbols and non-Latin scripts) into app/web/fonts/, at the paths it asks
# fontFallbackBaseUrl for (job 33c: the app loads nothing from fonts.gstatic.com). Run it after
# a Flutter upgrade and commit the result; the web-prod gate fails while a font the engine
# names is missing. Fonts the engine no longer names are deleted.
#
#   scripts/web-fonts.sh
set -euo pipefail
source "$(dirname "$0")/lib.sh"

flutter_root="$(cd "$(dirname "$(command -v flutter)")/.." && pwd)"
engine="$flutter_root/engine/src/flutter/lib/web_ui/lib/src/engine"
out="$REPO_ROOT/app/web/fonts"
list="$(mktemp)"
trap 'rm -f "$list"' EXIT

grep -hoE "\b[a-z0-9]+/v[0-9]+/[A-Za-z0-9._-]+\.woff2" "$engine/font_fallback_data.dart" \
  "$engine/canvaskit/fonts.dart" "$engine/skwasm/skwasm_impl/font_collection.dart" | sort -u >"$list"
(($(wc -l <"$list") > 100)) || { echo "web-fonts: found only $(wc -l <"$list") fonts in $engine" >&2; exit 1; }

missing=0
while read -r path; do
  [[ -s $out/$path ]] && continue
  missing=$((missing + 1))
  curl -sSf --retry 3 --create-dirs -o "$out/$path" "https://fonts.gstatic.com/s/$path"
  [[ "$(head -c 4 "$out/$path")" == wOF2 ]] || { echo "web-fonts: $path is not a woff2 file" >&2; exit 1; }
done <"$list"

stale=0
while read -r path; do
  grep -qxF "$path" "$list" || { rm "$out/$path"; stale=$((stale + 1)); }
done < <(cd "$out" && find . -name '*.woff2' | sed 's|^\./||')
find "$out" -mindepth 1 -type d -empty -delete

# Every family is in google/fonts under ofl/<folder>: the SIL Open Font License 1.1, whose text
# and copyright line go with the files (OFL condition 2).
ofl=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -sSf --retry 3 "$ofl/roboto/OFL.txt" | sed -n '/^SIL OPEN FONT LICENSE/,$p' >"$out/OFL.txt"
cp "$flutter_root/bin/cache/artifacts/material_fonts/Roboto_LICENSE.txt" "$out/Roboto-LICENSE.txt"
{
  echo "# Fonts served under /fonts/"
  echo
  echo "The Flutter web engine loads Roboto and, for emoji, symbols and non-Latin scripts, Noto"
  echo "fallback fonts from \`fontFallbackBaseUrl\` (\`app/web/flutter_bootstrap.js\`). These are"
  echo "copies of the files Google Fonts serves at fonts.gstatic.com/s/<path>, so the app never"
  echo "contacts Google (job 33c). \`scripts/web-fonts.sh\` writes this folder and this file."
  echo
  echo "Every font here is licensed under the SIL Open Font License, Version 1.1"
  echo "([OFL.txt](OFL.txt), https://openfontlicense.org). Copyright notices per folder:"

  echo
  echo "| Folder | Copyright |"
  echo "| --- | --- |"
  cut -d/ -f1 "$list" | sort -u | while read -r family; do
    echo "| $family | $(curl -sSf --retry 3 "$ofl/$family/OFL.txt" | head -1 | tr -d '\r' | sed 's/|/\\|/g') |"
  done
  echo
  echo "The app's own Roboto (\`/assets/fonts/fallback/Roboto-Regular.ttf\`, which a"
  echo "\`--no-web-resources-cdn\` build adds from the Flutter engine) is Roboto 2, Copyright 2011"
  echo "Google Inc., under the Apache License 2.0 ([Roboto-LICENSE.txt](Roboto-LICENSE.txt))."
} >"$out/LICENSES.md"

log "$(wc -l <"$list") fonts in app/web/fonts ($missing downloaded, $stale deleted), $(du -sh "$out" | cut -f1)"
