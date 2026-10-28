import 'dart:math' as math;

import 'package:flutter/foundation.dart';

@immutable
class const Entry(final String name, final String? quantity) {
  @override
  bool operator ==(Object other) =>
      other is Entry && other.name == name && other.quantity == quantity;

  @override
  int get hashCode => Object.hash(name, quantity);

  @override
  String toString() => 'Entry($name, $quantity)';
}

// Keep in sync with public.parse_entry (supabase/tests/classifier.test.sql).
const _units =
    'x|kg|g|gr|l|ml|stk|stück|pck|packung|packungen|dose|dosen|flasche|'
    'flaschen|bund|becher|glas|gläser|tüte|tüten|beutel|netz|kiste|kisten|'
    'kasten|kästen|pfund|liter|kilo|gramm|rolle|rollen|tafel|tafeln|stange|'
    'stangen';

final _leading = RegExp(
  '^(\\d+(?:[.,]\\d+)?)(?:\\s*($_units)\\.?)?\\s+(.+)\$',
  caseSensitive: false,
);
final _trailing = RegExp(
  // A unit is required at the end: "Windeln Größe 4" is a name, not 4 Windeln.
  '^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*($_units)\\.?\$',
  caseSensitive: false,
);

/// Splits a typed line like "2 Gurken" or "Hack 500 g" into name and quantity.
/// The full German sentence splitter is a server concern (voice endpoint).
Entry parseEntry(String input) {
  final text = input.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (_leading.firstMatch(text) case final m?) {
    return Entry(m[3]!, _quantity(m[1]!, m[2]));
  }
  if (_trailing.firstMatch(text) case final m?) {
    return Entry(m[1]!, _quantity(m[2]!, m[3]));
  }
  return Entry(text, null);
}

String _quantity(String amount, String? unit) => switch (unit) {
  null => amount,
  final u when u.toLowerCase() == 'x' => amount,
  final u => '$amount $u',
};

final _amount = RegExp(
  r'^(\d{1,6})(?:([.,])(\d{1,3}))?(\s*\p{L}.*)?$',
  unicode: true,
);
const _hundredUnits = {'g', 'gr', 'gramm', 'ml'};

/// Menge one step up ([up]) or down, keeping the unit and the decimal
/// separator: "2 l" to "3 l", "1,5 l" to "2,5 l". Grams and millilitres
/// from 100 step by 100. An empty Menge counts as 1. Null when the step
/// would go below one step ("1" down, "100 g" down) or the Menge does not
/// start with a number ("eine Packung").
String? stepQuantity(String quantity, {required bool up}) {
  final text = quantity.trim().isEmpty ? '1' : quantity.trim();
  final match = _amount.firstMatch(text);
  if (match == null) {
    return null;
  }
  final fraction = match[3] ?? '';
  final scale = math.pow(10, fraction.length).toInt();
  final value =
      int.parse(match[1]!) * scale +
      (fraction.isEmpty ? 0 : int.parse(fraction));
  final unit = match[4] ?? '';
  final hundreds =
      _hundredUnits.contains(unit.trim().toLowerCase()) && value >= 100 * scale;
  final step = (hundreds ? 100 : 1) * scale;
  final next = up ? value + step : value - step;
  if (next < step) {
    return null;
  }
  final decimals = fraction.isEmpty
      ? ''
      : '${match[2]}${(next % scale).toString().padLeft(fraction.length, '0')}';
  return '${next ~/ scale}$decimals$unit';
}
