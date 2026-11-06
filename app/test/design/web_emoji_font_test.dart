import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

/// The code points a TrueType font's cmap maps (formats 4 and 12).
Set<int> _cmap(ByteData font) {
  final tables = font.getUint16(4);
  var cmap = -1;
  for (var i = 0; i < tables; i++) {
    final record = 12 + 16 * i;
    if (String.fromCharCodes([
          for (var j = 0; j < 4; j++) font.getUint8(record + j),
        ]) ==
        'cmap') {
      cmap = font.getUint32(record + 8);
    }
  }
  final covered = <int>{};
  for (var i = 0; i < font.getUint16(cmap + 2); i++) {
    final sub = cmap + font.getUint32(cmap + 4 + 8 * i + 4);
    switch (font.getUint16(sub)) {
      case 4:
        final segments = font.getUint16(sub + 6) ~/ 2;
        for (var s = 0; s < segments; s++) {
          final end = font.getUint16(sub + 14 + 2 * s);
          final start = font.getUint16(sub + 16 + 2 * segments + 2 * s);
          if (start != 0xFFFF) {
            covered.addAll([for (var c = start; c <= end; c++) c]);
          }
        }
      case 12:
        for (var g = 0; g < font.getUint32(sub + 12); g++) {
          final group = sub + 16 + 12 * g;
          covered.addAll([
            for (
              var c = font.getUint32(group);
              c <= font.getUint32(group + 4);
              c++
            )
              c,
          ]);
        }
    }
  }
  return covered;
}

void main() {
  test('the web emoji font has every emoji of the item icons', () {
    final font = ByteData.sublistView(
      File('assets/fonts/web/NotoColorEmoji-icons.ttf').readAsBytesSync(),
    );
    final icons = File('lib/list/list_view/item_icon.dart').readAsStringSync();
    // From U+2000 up: emoji such as ⌚ (U+231A) sit below the emoji blocks.
    // U+FE0F needs no glyph; a ZWJ sequence would need the font's GSUB,
    // which the icon font drops.
    final emoji = icons.runes.where((c) => c >= 0x2000 && c != 0xFE0F).toSet();

    expect(
      emoji,
      isNot(contains(0x200D)),
      reason: 'an icon is a ZWJ sequence; keep GSUB in scripts/app-fonts.py',
    );

    expect(emoji.length, greaterThan(40));
    expect(
      emoji.difference(_cmap(font)).map((c) => c.toRadixString(16)),
      isEmpty,
      reason: 'run scripts/app-fonts.sh',
    );
  });
}
