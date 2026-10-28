import 'package:family_groceries/list/entry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const cases = {
    'Milch': Entry('Milch', null),
    '  Milch  ': Entry('Milch', null),
    '2 Gurken': Entry('Gurken', '2'),
    '1 Packung Eier': Entry('Eier', '1 Packung'),
    '1 Kasten Wasser': Entry('Wasser', '1 Kasten'),
    '10 Stück Eier': Entry('Eier', '10 Stück'),
    '1 Pfund Kaffee': Entry('Kaffee', '1 Pfund'),
    '0,5 kg Hackfleisch': Entry('Hackfleisch', '0,5 kg'),
    'Milch 2 Flaschen': Entry('Milch', '2 Flaschen'),
    '2x Milch': Entry('Milch', '2'),
    '2 x Milch': Entry('Milch', '2'),
    '500g Hackfleisch': Entry('Hackfleisch', '500 g'),
    '1,5 l Apfelsaft': Entry('Apfelsaft', '1,5 l'),
    '3 Dosen Tomaten': Entry('Tomaten', '3 Dosen'),
    'Hack 500 g': Entry('Hack', '500 g'),
    'Milch 2x': Entry('Milch', '2'),
    'Windeln Größe 4': Entry('Windeln Größe 4', null),
    '7up': Entry('7up', null),
    'Vitamin D3': Entry('Vitamin D3', null),
    'Eier   10': Entry('Eier 10', null),
  };
  for (final MapEntry(:key, :value) in cases.entries) {
    test('"$key" parses to $value', () => expect(parseEntry(key), value));
  }

  group('Menge steppers', () {
    // (Menge, after +, after −); null: that stepper is off.
    const cases = <(String, String?, String?)>[
      ('2', '3', '1'),
      ('1', '2', null),
      ('', '2', null),
      ('  ', '2', null),
      ('2 l', '3 l', '1 l'),
      ('1,5 l', '2,5 l', null),
      ('2,5 l', '3,5 l', '1,5 l'),
      ('0,5 l', '1,5 l', null),
      ('1.25 kg', '2.25 kg', null),
      ('500 g', '600 g', '400 g'),
      ('100 g', '200 g', null),
      ('150 g', '250 g', null),
      ('99 g', '100 g', '98 g'),
      ('250ml', '350ml', '150ml'),
      ('500 Stück', '501 Stück', '499 Stück'),
      ('2x', '3x', '1x'),
      ('3 Packungen', '4 Packungen', '2 Packungen'),
      ('eine Packung', null, null),
      ('etwas', null, null),
      ('1-2', null, null),
    ];
    for (final (quantity, up, down) in cases) {
      test('"$quantity"', () {
        expect(stepQuantity(quantity, up: true), up, reason: 'plus');
        expect(stepQuantity(quantity, up: false), down, reason: 'minus');
      });
    }
  });
}
