"""The font subsetting of scripts/app-fonts.sh.

    app-fonts.py <fontTools wheel> <Noto-COLRv1 2.047 ttf> <app dir>
"""

import sys

sys.path.insert(0, sys.argv[1])

from pathlib import Path  # noqa: E402

from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

noto, app = Path(sys.argv[2]), Path(sys.argv[3])

# The features HarfBuzz applies by default that these fonts have (frac/numr/dnom around U+2044),
# and tnum, which the list's counts ask for (FontFeature.tabularFigures).
FEATURES = ["calt", "ccmp", "locl", "kern", "mark", "mkmk", "frac", "numr", "dnom", "tnum"]


def private_use(cp):
    return 0xE000 <= cp <= 0xF8FF or cp >= 0xF0000


def trim(source, target, unicodes, options):
    font = TTFont(source, recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes(font.getBestCmap()))
    subsetter.subset(font)
    font.save(target)
    return target.stat().st_size


# Everything but the dropped glyphs, features, glyph names and TrueType hinting stays: names, the
# .notdef box. Flutter draws with slight hinting (Impeller, skwasm), which FreeType does with its
# own auto-hinter, and CoreText ignores TrueType hints, so the hint programs are never run.
app_font = subset.Options()
app_font.layout_features = FEATURES
app_font.name_IDs = ["*"]
app_font.name_languages = ["*"]
app_font.notdef_outline = True
app_font.glyph_names = False
app_font.hinting = False
icon_font = subset.Options()
icon_font.layout_features = []
icon_font.name_IDs = ["*"]


for path in sorted((app / "assets/fonts").glob("*.ttf")):
    before = path.stat().st_size
    after = trim(path, path, lambda cmap: [cp for cp in cmap if not private_use(cp)], app_font)
    print(f"app-fonts: {path.name} {before} -> {after} bytes")

icons = (app / "lib/list/list_view/item_icon.dart").read_text(encoding="utf-8")
# From U+2000 up (emoji such as U+231A sit below the emoji blocks); U+FE0F needs no glyph.
emoji = sorted({ord(c) for c in icons if ord(c) >= 0x2000} - {0xFE0F})
if 0x200D in emoji:
    sys.exit("app-fonts: an icon is a ZWJ sequence; keep GSUB (layout_features) in icon_font")
cmap = TTFont(noto).getBestCmap()
missing = [hex(cp) for cp in emoji if cp not in cmap]
if missing:
    sys.exit(f"app-fonts: Noto Color Emoji 2.047 has no {missing}")
out = app / "assets/fonts/web/NotoColorEmoji-icons.ttf"
out.parent.mkdir(exist_ok=True)
size = trim(noto, out, lambda _: emoji, icon_font)
print(f"app-fonts: {len(emoji)} icon emoji, {size} bytes in {out.relative_to(app.parent)}")
