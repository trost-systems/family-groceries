import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

/// The WOFF2 known-table tags, by their 6-bit index (WOFF2 spec, 5.1).
const _knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', //
  'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp',
  'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF',
  'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc',
  'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx',
  'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

String _tag(ByteData data, int at) =>
    String.fromCharCodes([for (var i = 0; i < 4; i++) data.getUint8(at + i)]);

/// Table tag to length, from a TrueType file's table directory.
Map<String, int> _ttfTables(ByteData font) => {
  for (var i = 0; i < font.getUint16(4); i++)
    _tag(font, 12 + 16 * i): font.getUint32(12 + 16 * i + 12),
};

/// Table tag to the length of the original table, from a WOFF2 directory.
Map<String, int> _woff2Tables(ByteData font) {
  var at = 48;
  int base128() {
    var value = 0;
    int byte;
    do {
      byte = font.getUint8(at++);
      value = (value << 7) | (byte & 0x7F);
    } while (byte & 0x80 != 0);
    return value;
  }

  final tables = <String, int>{};
  for (var i = 0; i < font.getUint16(12); i++) {
    final flags = font.getUint8(at++);
    final String tag;
    if (flags & 0x3F == 0x3F) {
      tag = _tag(font, at);
      at += 4;
    } else {
      tag = _knownTags[flags & 0x3F];
    }
    tables[tag] = base128();
    final version = flags >> 6;
    final glyphTable = tag == 'glyf' || tag == 'loca';
    if (glyphTable ? version == 0 : version != 0) {
      base128();
    }
  }
  return tables;
}

/// glyf and loca are rebuilt from WOFF2's transformed form, padded per
/// glyph, so their lengths differ by design.
Map<String, int> _untransformed(Map<String, int> tables) =>
    Map.of(tables)..removeWhere((tag, _) => tag == 'glyf' || tag == 'loca');

void main() {
  test('the web WOFF2 fonts hold the same tables as the TrueType ones', () {
    final ttfs = Directory('assets/fonts')
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.ttf'))
        .toList();
    expect(ttfs, hasLength(6));
    for (final ttf in ttfs) {
      final name = ttf.uri.pathSegments.last.replaceFirst('.ttf', '');
      final woff2 = File('assets/fonts/web/$name.woff2');
      final ttfTables = _ttfTables(ByteData.sublistView(ttf.readAsBytesSync()));
      final woff2Tables = _woff2Tables(
        ByteData.sublistView(woff2.readAsBytesSync()),
      );
      expect(woff2Tables.keys.toSet(), ttfTables.keys.toSet());
      expect(
        _untransformed(woff2Tables),
        _untransformed(ttfTables),
        reason: '$name: run scripts/app-fonts.sh',
      );
    }
  });
}
