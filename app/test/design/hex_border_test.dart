import 'package:family_groceries/design/hex_border.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a hexagon no wider than its tips is a rhombus, not NaN', () {
    // A store badge squeezed by large text: 18.5 px wide, 53 px tall.
    const rect = Rect.fromLTWH(0, 0, 18.5, 53);
    for (final orientation in HexOrientation.values) {
      final bounds = HexBorder(
        orientation: orientation,
        side: const BorderSide(),
      ).pathFor(rect).getBounds();
      expect(bounds.isFinite, isTrue, reason: '$orientation');
      expect(bounds.width, greaterThan(0), reason: '$orientation');
    }
  });
}
