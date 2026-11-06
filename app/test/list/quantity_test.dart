import 'dart:io';

import 'package:family_groceries/list/quantity.dart';
import 'package:flutter_test/flutter_test.dart';

/// The server's table of cases (`public.merge_quantities` is checked against
/// the same file by the db gate), so both sides merge alike.
void main() {
  final rows = [
    for (final line in File(
      '../supabase/tests/merge_quantities.tsv',
    ).readAsLinesSync())
      if (line.trim().isNotEmpty && !line.startsWith('#')) line.split('\t'),
  ];

  test("the table has the PM ruling's cases", () {
    expect(rows.length, greaterThan(40));
    expect(rows, contains(equals(['500 g', '1 kg', '1,5 kg'])));
    expect(rows, contains(equals(['1 Bund', '500 g', '1 Bund + 500 g'])));
    expect(rows, contains(equals(['', '', '2'])));
  });

  for (final [open, other, merged] in rows) {
    test('"$open" + "$other" = "$merged"', () {
      String run() => mergeQuantities(
        open.isEmpty ? null : open,
        other.isEmpty ? null : other,
      );
      if (merged == '!too_long') {
        expect(run, throwsA(isA<QuantityTooLong>()));
      } else {
        expect(run(), merged);
      }
    });
  }

  test('a thousand grams or millilitres is a kilo or a litre', () {
    expect(mergeQuantities('500 g', '500 g'), '1 kg');
    expect(mergeQuantities('500 ml', '500 ml'), '1 l');
    expect(mergeQuantities('400 g', '500 g'), '900 g');
  });
}
