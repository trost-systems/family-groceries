#!/usr/bin/env bash
# Drops from the bundled fonts (app/assets/fonts/*.ttf) what the app can never draw: the
# private-use code points (Inter's alternates under U+E000-F8FF) and the OpenType features no
# TextStyle asks for (cv01-14, ss01-08, salt, aalt, dlig, frac, sups, ...), with the glyphs only
# they reach. Kept: every other code point, the features HarfBuzz applies by default, tnum
# (item quantities), hinting, names and glyph names. Idempotent. Attempt 1 in
# docs/hillclimb/hc-size-start.md (reverted: the fonts in the repo are the originals).
# Needs fontTools (pyftsubset).
set -euo pipefail
cd "$(dirname "$0")/../../../app/assets/fonts"
originals="$(mktemp -d)"
trap 'rm -rf "$originals"' EXIT
cp ./*.ttf "$originals/"
for font in *.ttf; do
  pyftsubset "$font" --output-file="$font.subset" \
    --unicodes='U+0000-DFFF,U+F900-10FFFF' \
    --layout-features='ccmp,locl,mark,mkmk,calt,kern,liga,rlig,clig,rclt,curs,dist,tnum' \
    --hinting --name-IDs='*' --name-languages='*' --name-legacy \
    --notdef-outline --notdef-glyph --glyph-names --legacy-kern
  mv "$font.subset" "$font"
done
# Every code point outside the private-use area survives and draws the same outline.
python3 - "$originals" <<'PY'
import glob, os, sys
from fontTools.ttLib import TTFont
for path in sorted(glob.glob("*.ttf")):
    a, b = TTFont(os.path.join(sys.argv[1], path)), TTFont(path)
    ca, cb = a.getBestCmap(), b.getBestCmap()
    lost = [c for c in ca if c not in cb and not 0xE000 <= c <= 0xF8FF]
    ga, gb = a["glyf"], b["glyf"]
    moved = [c for c in cb if ga[ca[c]].getCoordinates(ga)[0] != gb[cb[c]].getCoordinates(gb)[0]]
    print(f"{path}: {len(cb)} code points, {len(lost)} lost, {len(moved)} outlines changed")
    if lost or moved:
        sys.exit(1)
PY
