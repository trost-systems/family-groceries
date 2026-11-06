import 'dart:io';

import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:flutter_test/flutter_test.dart';

/// The samples `tool/item_icons/build.mjs` checks with its JS matcher, run
/// through the app's: both must agree on every name.
void main() {
  final dir = Directory('../tool/item_icons/samples');
  final files = dir.existsSync()
      ? dir.listSync().whereType<File>().where((f) => f.path.endsWith('.tsv'))
      : const <File>[];

  test('there are samples', () => expect(files, isNotEmpty));

  for (final file in files) {
    test(file.uri.pathSegments.last, () {
      final mismatches = <String>[];
      for (final (i, line) in file.readAsLinesSync().indexed) {
        if (line.trim().isEmpty || line.startsWith('#')) {
          continue;
        }
        final [name, expected] = line.split('\t');
        final got = ItemIcons.bundled.emojiFor(name) ?? '-';
        if (got != expected) {
          mismatches.add('${i + 1}: "$name" wants $expected, gets $got');
        }
      }
      expect(mismatches, isEmpty, reason: mismatches.join('\n'));
    });
  }
}
