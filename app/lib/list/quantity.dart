/// The duplicate hint's merge rule for quantities (job 32b), the same as
/// `public.merge_quantities`, which decides on the server. The app uses it
/// only to show a merge at once; `supabase/tests/merge_quantities.tsv` is
/// both sides' table of cases.
///
/// Same or convertible units sum ("500 g" + "1 kg" = "1,5 kg", "2" +
/// "3 Stück" = "5 Stück"); anything else is kept and the other quantity added
/// as a note ("1 Bund" + "500 g" = "1 Bund + 500 g"). No quantity is one
/// piece when the other side counts pieces, and nothing otherwise.
library;

/// The merged quantity would not fit the 40 characters the server keeps.
final class QuantityTooLong() implements Exception {
  @override
  String toString() => 'QuantityTooLong';
}

/// [open]'s quantity with [other]'s merged in. Throws [QuantityTooLong].
String mergeQuantities(String? open, String? other) {
  var a = _terms(open);
  var b = _terms(other);
  if (a.isEmpty && b.isEmpty) {
    return '2';
  }
  if ((a.isEmpty || b.isEmpty) &&
      [...a, ...b].any((t) => _Term.parse(t).kind == 'count')) {
    if (a.isEmpty) {
      a = ['1'];
    } else {
      b = ['1'];
    }
  }
  final terms = <_Term>[];
  for (final (side, list) in [(1, a), (2, b)]) {
    for (final text in list) {
      final term = _Term.parse(text);
      final at = side == 2 && term.kind != null
          ? terms.indexWhere((t) => t.kind == term.kind)
          : -1;
      if (at < 0) {
        terms.add(term);
      } else {
        terms[at] = terms[at].plus(term);
      }
    }
  }
  final result = terms.map((t) => t.text).join(' + ');
  if (result.length > 40) {
    throw QuantityTooLong();
  }
  return result;
}

List<String> _terms(String? quantity) => (quantity ?? '')
    .trim()
    .split(RegExp(r'\s*\+\s*'))
    .where((t) => t.isNotEmpty)
    .toList();

final _scale = BigInt.from(10000);

/// One "number unit" part. [amount] is in ten-thousandths of the base unit
/// (g, ml, piece, the unit itself); [kind] is null for text that is not a
/// number and a unit.
final class _Term(
  final String text,
  final String? kind,
  final BigInt amount,
  final String? word,
) {
  factory parse(String text) {
    final match = RegExp(r'^(\d+(?:[.,]\d+)?)\s*(\S*)$').firstMatch(text);
    final number = match == null ? null : _number(match[1]!);
    if (number == null) {
      return _Term(text, null, BigInt.zero, null);
    }
    final word = match![2]!;
    final unit = _Unit.of(word);
    return _Term(
      text,
      unit.kind,
      number * BigInt.from(unit.factor),
      word.isEmpty ? null : word,
    );
  }

  _Term plus(_Term other) {
    final total = amount + other.amount;
    final word = this.word ?? other.word;
    final thousand = BigInt.from(1000) * _scale;
    final text = switch (kind) {
      'mass' when total >= thousand => '${_format(_perThousand(total))} kg',
      'mass' => '${_format(total)} g',
      'vol' when total >= thousand => '${_format(_perThousand(total))} l',
      'vol' => '${_format(total)} ml',
      'count' => [_format(total), ?word].join(' '),
      _ => '${_format(total)} ${_unitWord(word!, total)}',
    };
    return _Term(text, kind, total, word);
  }

  static String _unitWord(String word, BigInt total) {
    final unit = _Unit.of(word);
    final w = total == _scale ? unit.singular : unit.plural;
    return word[0] == word[0].toUpperCase()
        ? w[0].toUpperCase() + w.substring(1)
        : w;
  }
}

/// Rounded half up to four decimals, like Postgres' `round(x / 1000, 4)`.
BigInt _perThousand(BigInt value) =>
    (value + BigInt.from(500)) ~/ BigInt.from(1000);

/// "1,5" and "1.5" are 1.5; "1.000" (a point, three digits, not after a lone
/// 0) is a thousand. At most four decimals count.
BigInt? _number(String text) {
  final match = RegExp(r'^(\d+)(?:([.,])(\d+))?$').firstMatch(text);
  if (match == null) {
    return null;
  }
  final whole = match[1]!;
  final frac = match[3];
  if (match[2] == '.' && frac!.length == 3 && whole != '0') {
    return BigInt.parse('$whole$frac') * _scale;
  }
  final digits = (frac ?? '').padRight(4, '0').substring(0, 4);
  return BigInt.parse(whole) * _scale + BigInt.parse(digits);
}

/// German style, up to four decimals: "1,5", "2".
String _format(BigInt value) {
  final whole = value ~/ _scale;
  final frac = (value % _scale)
      .toString()
      .padLeft(4, '0')
      .replaceFirst(RegExp(r'0+$'), '');
  return frac.isEmpty ? '$whole' : '$whole,$frac';
}

final class _Unit(
  final String kind,
  final int factor,
  final String singular,
  final String plural,
) {
  factory of(String word) {
    var w = word.trim().toLowerCase();
    while (w.endsWith('.')) {
      w = w.substring(0, w.length - 1);
    }
    switch (w) {
      case '' || 'stk' || 'stück' || 'st':
        return _Unit('count', 1, w, w);
      case 'g' || 'gr' || 'gramm':
        return _Unit('mass', 1, w, w);
      case 'kg' || 'kilo' || 'kilogramm':
        return _Unit('mass', 1000, w, w);
      case 'ml' || 'milliliter':
        return _Unit('vol', 1, w, w);
      case 'l' || 'liter':
        return _Unit('vol', 1000, w, w);
    }
    final pair = _pairs.where((p) => p.$1 == w || p.$2 == w).firstOrNull;
    final singular = pair?.$1 ?? w;
    return _Unit('unit:$singular', 1, singular, pair?.$2 ?? w);
  }
}

const _pairs = [
  ('packung', 'packungen'),
  ('pack', 'packs'),
  ('paket', 'pakete'),
  ('dose', 'dosen'),
  ('büchse', 'büchsen'),
  ('flasche', 'flaschen'),
  ('glas', 'gläser'),
  ('tüte', 'tüten'),
  ('tube', 'tuben'),
  ('sack', 'säcke'),
  ('netz', 'netze'),
  ('kiste', 'kisten'),
  ('kasten', 'kästen'),
  ('karton', 'kartons'),
  ('rolle', 'rollen'),
  ('tafel', 'tafeln'),
  ('stange', 'stangen'),
  ('schale', 'schalen'),
  ('scheibe', 'scheiben'),
  ('laib', 'laibe'),
  ('kopf', 'köpfe'),
];
