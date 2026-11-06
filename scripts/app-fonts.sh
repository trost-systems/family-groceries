#!/usr/bin/env bash
# Trims the app's fonts to what it draws (job 133; scripts/app-fonts.py does the work):
# - app/assets/fonts/*.ttf (Inter, Bricolage Grotesque) lose their private-use glyphs, the
#   OpenType features the app never turns on, their glyph names and their TrueType hinting, which
#   Flutter's slight hinting never runs. Every character stays; text renders the same.
#   Runs in place and is idempotent; a new font version goes in first, then run this.
# - app/assets/fonts/web/*.woff2: the same fonts as WOFF2 for web builds (loadAppFonts). Android's
#   engine reads WOFF1 only, so native builds keep the .ttf files.
# - app/assets/fonts/web/NotoColorEmoji-icons.ttf (web builds only) gets the emoji of the
#   list's item and category icons (app/lib/list/list_view/item_icon.dart), cut from Noto Color
#   Emoji 2.047, the release the web engine's fallback chunks (app/web/fonts/notocoloremoji/v32,
#   scripts/web-fonts.sh) were made from. The app registers it as "Noto Color Emoji" before its
#   first frame (app/lib/design/fonts.dart), so the icons need no fallback download.
# Run it after adding a font, changing the icons or the engine's emoji chunks;
# test/design/web_emoji_font_test.dart fails while an icon is missing.
#
#   scripts/app-fonts.sh
set -euo pipefail
source "$(dirname "$0")/lib.sh"

cache="${XDG_CACHE_HOME:-$HOME/.cache}/family-groceries"
mkdir -p "$cache"

# The chunks under v32 say "Version 2.047;GOOG;noto-emoji:20240827:6c21182"; a new chunk version
# needs the matching release below.
[[ -d $REPO_ROOT/app/web/fonts/notocoloremoji/v32 ]] ||
  { echo "app-fonts: the engine's emoji chunks are no longer v32; pin their Noto release here" >&2; exit 1; }

fetch() { # <url> <sha256> <file>
  [[ -s $3 ]] || curl -sSfL --retry 3 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet
}
noto="$cache/Noto-COLRv1-2.047.ttf"
fetch https://raw.githubusercontent.com/googlefonts/noto-emoji/v2.047/fonts/Noto-COLRv1.ttf \
  23549f29b5ad741fcb4c025b8dc44652ff0f459892467ebcccec1e6bbe839b44 "$noto"
# fontTools (pure Python, its PyPI wheel) keeps COLRv1; HarfBuzz's wasm build drops COLR.
wheel="$cache/fonttools-4.60.1-py3-none-any.whl"
fetch https://files.pythonhosted.org/packages/c7/93/0dd45cd283c32dea1545151d8c3637b4b8c53cdb3a625aeb2885b184d74d/fonttools-4.60.1-py3-none-any.whl \
  906306ac7afe2156fcf0042173d6ebbb05416af70f6b370967b47f8f00103bbb "$wheel"

python3 -I "$REPO_ROOT/scripts/app-fonts.py" "$wheel" "$noto" "$REPO_ROOT/app"
for ttf in "$REPO_ROOT"/app/assets/fonts/*.ttf; do
  npm exec --yes --package=wawoff2@2.0.1 -- woff2_compress.js "$ttf" \
    "$REPO_ROOT/app/assets/fonts/web/$(basename "$ttf" .ttf).woff2" >/dev/null
done
woff2=("$REPO_ROOT"/app/assets/fonts/web/*.woff2)
echo "app-fonts: ${#woff2[@]} WOFF2 files in app/assets/fonts/web"
