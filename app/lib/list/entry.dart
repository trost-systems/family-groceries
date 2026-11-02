import 'dart:math' as math;

import 'package:family_groceries/list/lexicon_forms.dart';
import 'package:family_groceries/list/model.dart';
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

// "Karotten x2" and "Karotten ×2": a count at the end, like "Karotten 2x".
final _trailingCount = RegExp(r'^(.+?)\s+[x×](\d+)$', caseSensitive: false);
final _trailingBare = RegExp(r'^(.+)\s([1-9]\d?)$');

// Words after which a number is a size or a model, not a count ("Windeln
// Größe 4"). With [_units], the words public.parse_item checks
// (public.item_units and its size words).
const _sizeWords = {
  'größe', 'grösse', 'groesse', 'gr', 'stufe', 'nr', 'no', 'size', 'typ', //
  'type', 'klasse', 'pack', 'pcs', 'mah', 'cl', '%', 'st', 'pkg', 'packs', //
  'päckchen', 'paket', 'pakete', 'büchse', 'büchsen', 'tube', 'tuben', //
  'sack', 'säcke', 'netze', 'karton', 'kartons', 'schale', 'schalen', //
  'scheibe', 'scheiben', 'riegel', 'paar', 'dutzend', 'laib', 'laibe', //
  'kopf', 'köpfe', //
};

/// Splits a typed line like "2 Gurken" or "Hack 500 g" into name and quantity.
/// A bare number at the end is the quantity only when it is 1 to 20, does
/// not follow a size or unit word, and the rest is a word the dictionary
/// knows or a name in [history] ("Karotten 2", not "Windeln Größe 4");
/// `supabase/tests/quantity_parse.tsv` is the table both sides pass. The
/// full German sentence splitter is a server concern (voice endpoint).
Entry parseEntry(String input, {Iterable<String> history = const []}) {
  final text = input.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (_leading.firstMatch(text) case final m?) {
    return Entry(m[3]!, _quantity(m[1]!, m[2]));
  }
  if (_trailing.firstMatch(text) case final m?) {
    return Entry(m[1]!, _quantity(m[2]!, m[3]));
  }
  if (_trailingCount.firstMatch(text) case final m?) {
    return Entry(m[1]!, m[2]);
  }
  if (_trailingBare.firstMatch(text) case final m?
      when int.parse(m[2]!) <= 20 &&
          _countMayFollow(m[1]!.split(' ').last) &&
          _known(m[1]!, history)) {
    return Entry(m[1]!, m[2]);
  }
  return Entry(text, null);
}

bool _countMayFollow(String word) {
  final w = word.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
  return !w.contains(RegExp(r'\d')) &&
      !_sizeWords.contains(w) &&
      !RegExp('^($_units)\$').hasMatch(w);
}

/// Whether the dictionary knows a word of [name] (as public.classifier_words
/// finds it, without typos) or the household bought [name] before.
bool _known(String name, Iterable<String> history) {
  final folded = foldName(name);
  if (history.any((h) => foldName(h) == folded)) {
    return true;
  }
  final words = _lexiconKey(name).split(' ').where((w) => w.isNotEmpty);
  final key = ' ${words.join(' ')} ';
  return words.any(
        (w) => [
          for (var i = 0; i <= math.max(w.length - 4, 0); i++) w.substring(i),
        ].any(lexiconForms.contains),
      ) ||
      lexiconForms.any((f) => f.contains(' ') && key.contains(' $f '));
}

/// [name] as public.fold_key(public.item_key(name)) writes it, for the
/// words without numbers: "Möhren" is "mohr", "carrots" "karot".
String _lexiconKey(String name) {
  var v = name.toLowerCase();
  for (final (from, to) in const [
    ('ä', 'a'),
    ('ö', 'o'),
    ('ü', 'u'),
    ('ß', 'ss'),
  ]) {
    v = v.replaceAll(from, to);
  }
  const accents = 'àáâãåçèéêëìíîïñòóôõùúûýÿ';
  const plain = 'aaaaaceeeeiiiinooooouuuyy';
  v = String.fromCharCodes(
    v.runes.map((r) {
      final at = accents.indexOf(String.fromCharCode(r));
      return at < 0 ? r : plain.codeUnitAt(at);
    }),
  );
  v = v.replaceAll('ae', 'a').replaceAll('oe', 'o').replaceAll('ue', 'u');
  return v
      .split(RegExp('[^a-z]+'))
      .where((w) => w.isNotEmpty)
      .map((w) => _foldWord(_stemWord(w)))
      .join(' ');
}

String _stemWord(String word) {
  var v = word;
  if (v.length >= 5 && RegExp(r'[elr]n$').hasMatch(v)) {
    v = v.substring(0, v.length - 1);
  }
  if (v.length >= 4 && v.endsWith('e')) {
    v = v.substring(0, v.length - 1);
  }
  if (v.length >= 5 &&
      RegExp(r'[^su]s$').hasMatch(v) &&
      !RegExp(r'[ae]is$').hasMatch(v)) {
    v = v.substring(0, v.length - 1);
  }
  return v;
}

String _foldWord(String word) {
  if (word.length < 5) {
    return word;
  }
  final v = word.replaceAllMapped(RegExp(r'([a-z])\1+'), (m) => m[1]!);
  if (v.length < 5) {
    return v;
  }
  return v
      .replaceAll(RegExp('c(?![hei])'), 'k')
      .replaceAll('ph', 'f')
      .replaceAll('th', 't')
      .replaceAll('gh', 'g')
      .replaceAll('kk', 'k')
      .replaceAll('dt', 't')
      .replaceAll('tz', 'z')
      .replaceAllMapped(RegExp('([aeiou])h(?![aeiou])'), (m) => m[1]!);
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
