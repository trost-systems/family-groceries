import 'dart:convert';

import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // The same table is in supabase/tests/store_name_key_order.test.sql.
  const cases = {
    '\tLidl\n': 'lidl',
    '\n dm \r\n': 'dm',
    '  Rewe   City ': 'rewe city',
    'Rewe\t\tCity': 'rewe city',
    'Rewe \n City': 'rewe city',
    'EDEKA': 'edeka',
    '\t\t': '',
  };

  for (final MapEntry(key: name, value: key) in cases.entries) {
    test('nameKey(${jsonEncode(name)}) is public.store_name_key '
        'and category_name_key', () {
      expect(nameKey(name), key);
    });
  }
}
