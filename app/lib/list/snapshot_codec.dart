import 'dart:convert';
import 'dart:typed_data';

import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/model.dart';

/// How a [ListSnapshot] is kept on the device: a String, since shared
/// preferences store strings. [encodeSnapshot] writes a JSON object whose
/// records (the catalog, each server row, op and usual) are strings of
/// [_digits]: numbers, five bits a character with the sixth set while more
/// follow, that refer to one table of the snapshot's distinct strings. The
/// table is the last key, its strings joined into one; `head` has their
/// lengths. [decodeSnapshot] also reads the JSON snapshots apps before it
/// wrote (versions 1 to 3). Throws on anything else.
String encodeSnapshot(ListSnapshot snapshot) {
  final body = _Writer()..raw('","catalog":"');
  body
    ..catalog(snapshot.catalog)
    ..raw('","server":')
    ..records(snapshot.server, body.item)
    ..raw(',"pending":')
    ..records(snapshot.pending, body.op)
    ..raw(',"usuals":')
    ..records(snapshot.usuals, body.usual)
    ..raw(_tableKey);
  final strings = body.strings;
  final head = _Writer()
    ..raw(_v4Start)
    ..uint(strings.length);
  for (final s in strings) {
    head.uint(s.length);
  }
  return (StringBuffer(head.chars())
        ..write(body.chars())
        ..write(jsonEncode(strings.join()))
        ..write('}'))
      .toString();
}

ListSnapshot decodeSnapshot(String stored) {
  if (!stored.startsWith(_v4Start)) {
    return ListSnapshot.fromJson(jsonDecode(stored) as Map<String, Object?>);
  }
  final tableAt = stored.lastIndexOf(_tableKey);
  if (tableAt < 0 || !stored.endsWith('}')) {
    throw const FormatException('list snapshot');
  }
  final table = jsonDecode(
    stored.substring(tableAt + _tableKey.length, stored.length - 1),
  );
  final r = _Reader(stored, _v4Start.length)..readStrings(table as String);
  final catalog = (r..expect('","catalog":"')).catalog();
  final server = (r..expect('","server":')).records(r.item);
  final pending = (r..expect(',"pending":')).records(r.op);
  final usuals = (r..expect(',"usuals":')).records(r.usual);
  if (r._pos != tableAt) {
    throw const FormatException('list snapshot');
  }
  return ListSnapshot(
    catalog: catalog,
    server: server,
    pending: pending,
    usuals: usuals,
  );
}

/// Snapshot versions are one sequence: 1 to 3 are the plain JSON layouts
/// ([ListSnapshot.version]), 4 is this one. A change to what a record holds
/// (a new model field, a new tag) takes the next number with a reader for
/// this one, never 4 again; `test/list/snapshot_fields_test.dart` names
/// the fields each record holds.
const _v4Start = '{"version":4,"head":"';

/// The last key. A quote inside the table is escaped, so the last match is
/// this key.
const _tableKey = ',"strings":';

/// The base64 alphabet: nothing JSON or a plist escapes.
const _digits =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

final _digitCodes = Uint8List.fromList(_digits.codeUnits);

/// -1 for a character that is no digit.
final _digitValues = () {
  final values = Int8List(128)..fillRange(0, 128, -1);
  for (var i = 0; i < _digits.length; i++) {
    values[_digits.codeUnitAt(i)] = i;
  }
  return values;
}();

const _timeNull = 0;
const _timeUtc = 1;

/// ISO text: a local time keeps its wall-clock text, as JSON snapshots did;
/// a UTC time takes it when its number would not stay exact on the web
/// ([_maxExactMicros]).
const _timeText = 2;

/// The same instant as the time before it in the item ([_Writer.time]'s
/// `after`): the server sets `updated_at` and `bought_at` from one `now()`.
const _timeSame = 3;

/// Microseconds after the item's time before it, both UTC.
const _timeUtcAfter = 4;

const _sortKeyNull = 0;
const _sortKeyHalves = 1;
const _sortKeyDouble = 2;

/// Microseconds written as numbers stay below this (2^51, about 71 years
/// from 1970 or from the time before): their zigzag stays below 2^53.
const _maxExactMicros = 2251799813685248;

/// Half steps of [_sortKeyHalves] stay exact up to here (2^52): their
/// zigzag stays below 2^53, the largest exact integer on the JS web build.
const _maxHalves = 4503599627370496;

const _comma = 0x2c;
const _closeBracket = 0x5d;

enum _Op() {
  add,
  status,
  edit,
  move,
  place,
  delete,
  merge,
  unmerge,
}

class _Writer() {
  var _buf = Uint8List(1 << 16);
  var _len = 0;

  /// The table, in order.
  final strings = <String>[];

  /// Where [strings] has each string it dedupes.
  final _index = <String, int>{};

  final _scratch = ByteData(8);

  /// Characters that are not digits: JSON punctuation and keys.
  void raw(String ascii) {
    if (_len + ascii.length > _buf.length) {
      _buf = Uint8List(_buf.length * 2 + ascii.length)..setRange(0, _len, _buf);
    }
    for (var i = 0; i < ascii.length; i++) {
      _buf[_len++] = ascii.codeUnitAt(i);
    }
  }

  String chars() => String.fromCharCodes(_buf, 0, _len);

  /// 64 bits take 13 digits. Division, not bit operators: on the JS web
  /// build those cut numbers to 32 bits, and microseconds since 1970 need 51.
  void uint(int v) {
    if (_len + 13 > _buf.length) {
      _buf = Uint8List(_buf.length * 2)..setRange(0, _len, _buf);
    }
    var x = v;
    while (x >= 32) {
      _buf[_len++] = _digitCodes[x % 32 + 32];
      x = x ~/ 32;
    }
    _buf[_len++] = _digitCodes[x];
  }

  void sint(int v) => uint(v >= 0 ? v * 2 : -v * 2 - 1);

  void boolean({required bool value}) => uint(value ? 1 : 0);

  int _intern(String s) => _index[s] ??= (strings..add(s)).length - 1;

  void string(String s) => uint(_intern(s));

  void optString(String? s) => uint(s == null ? 0 : _intern(s) + 1);

  /// An item's id: no other row has it, so it skips [_index]. An op naming
  /// it later adds it again, which costs a few bytes.
  void uniqueString(String s) {
    uint(strings.length);
    strings.add(s);
  }

  void time(DateTime? t, [DateTime? after]) {
    if (t == null) {
      uint(_timeNull);
    } else if (t == after) {
      uint(_timeSame);
    } else if (t.isUtc &&
        (after?.isUtc ?? false) &&
        (t.microsecondsSinceEpoch - after!.microsecondsSinceEpoch).abs() <
            _maxExactMicros) {
      uint(_timeUtcAfter);
      sint(t.microsecondsSinceEpoch - after.microsecondsSinceEpoch);
    } else if (t.isUtc && t.microsecondsSinceEpoch.abs() < _maxExactMicros) {
      uint(_timeUtc);
      sint(t.microsecondsSinceEpoch);
    } else {
      uint(_timeText);
      string(t.toIso8601String());
    }
  }

  void sortKey(double? k) {
    if (k == null) {
      uint(_sortKeyNull);
      return;
    }
    final halves = k * 2;
    if (halves == halves.truncateToDouble() &&
        halves.abs() < _maxHalves &&
        !(k == 0 && k.isNegative)) {
      uint(_sortKeyHalves);
      sint(halves.toInt());
    } else {
      uint(_sortKeyDouble);
      _scratch.setFloat64(0, k);
      uint(_scratch.getUint32(0));
      uint(_scratch.getUint32(4));
    }
  }

  void list<T>(List<T> xs, void Function(T) write) {
    uint(xs.length);
    xs.forEach(write);
  }

  /// A JSON array of one record per element.
  void records<T>(List<T> xs, void Function(T) write) {
    raw('[');
    for (var i = 0; i < xs.length; i++) {
      raw(i == 0 ? '"' : ',"');
      write(xs[i]);
      raw('"');
    }
    raw(']');
  }

  void catalog(Catalog c) {
    list(c.categories, (x) {
      string(x.id);
      string(x.name);
      sint(x.sortOrder);
      optString(x.seedKey);
    });
    list(c.stores, (x) {
      string(x.id);
      string(x.name);
      sint(x.sortOrder);
      optString(x.seedKey);
    });
    list(c.layout, (x) {
      string(x.storeId);
      string(x.categoryId);
      sint(x.sortOrder);
      boolean(value: x.hidden);
    });
    list(c.members, (x) {
      string(x.id);
      string(x.displayName);
      optString(x.role);
    });
  }

  void item(Item i) {
    uniqueString(i.id);
    string(i.name);
    optString(i.quantity);
    optString(i.brand);
    optString(i.properties);
    optString(i.categoryId);
    optString(i.storeId);
    sortKey(i.sortKey);
    uint(i.status.index);
    time(i.createdAt);
    time(i.updatedAt, i.createdAt);
    time(i.boughtAt, i.updatedAt);
    optString(i.addedBy);
    optString(i.categorizedVia);
    optString(i.canonicalKey);
  }

  void change(SetTo<String?>? c) {
    boolean(value: c != null);
    if (c != null) {
      optString(c.value);
    }
  }

  void op(ItemOp op) {
    switch (op) {
      case AddItem(
        item: final added,
        :final restored,
        :final noStore,
        :final deviceParsed,
      ):
        uint(_Op.add.index);
        item(added);
        uint((restored ? 1 : 0) | (noStore ? 2 : 0) | (deviceParsed ? 4 : 0));
      case SetStatus(:final itemId, :final status, :final at, :final storeId):
        uint(_Op.status.index);
        string(itemId);
        uint(status.index);
        time(at);
        optString(storeId);
      case EditItem(
        :final itemId,
        :final changes,
        :final keyBefore,
        :final deviceParsed,
      ):
        uint(_Op.edit.index);
        string(itemId);
        optString(changes.name);
        change(changes.quantity);
        change(changes.brand);
        change(changes.properties);
        optString(changes.categoryId);
        change(changes.storeId);
        optString(keyBefore);
        boolean(value: deviceParsed);
      case MoveItem(:final itemId, :final categoryId, :final storeId):
        uint(_Op.move.index);
        string(itemId);
        string(categoryId);
        optString(storeId);
      case PlaceItem(
        :final itemId,
        :final anchorId,
        :final edge,
        :final categoryId,
        :final storeId,
        :final sortKey,
      ):
        uint(_Op.place.index);
        string(itemId);
        string(anchorId);
        uint(edge.index);
        string(categoryId);
        optString(storeId);
        this.sortKey(sortKey);
      case DeleteItem(:final itemId):
        uint(_Op.delete.index);
        string(itemId);
      case MergeItems(
        :final itemId,
        :final mergeId,
        :final otherId,
        :final quantity,
        :final brand,
        :final properties,
      ):
        uint(_Op.merge.index);
        string(itemId);
        string(mergeId);
        string(otherId);
        optString(quantity);
        optString(brand);
        optString(properties);
      case UnmergeItems(
        :final itemId,
        :final mergeId,
        :final kept,
        :final merged,
      ):
        uint(_Op.unmerge.index);
        string(itemId);
        string(mergeId);
        item(kept);
        item(merged);
    }
  }

  void usual(Usual u) {
    string(u.name);
    boolean(value: u.due);
    optString(u.quantity);
    time(u.lastUsed);
  }
}

class _Reader(final String _s, var int _pos) {
  var _strings = const <String>[];

  /// Before anything that refers to the table: `head`'s count and
  /// lengths slice [table].
  void readStrings(String table) {
    var at = 0;
    _strings = [
      for (var n = uint(); n > 0; n--) table.substring(at, at += uint()),
    ];
    if (at != table.length) {
      throw const FormatException('string table');
    }
  }

  void expect(String ascii) {
    if (!_s.startsWith(ascii, _pos)) {
      throw FormatException('list snapshot', _s, _pos);
    }
    _pos += ascii.length;
  }

  int uint() {
    var result = 0;
    var scale = 1;
    while (true) {
      final d = _digitValues[_s.codeUnitAt(_pos++)];
      if (d < 0) {
        throw FormatException('digit', _s, _pos - 1);
      }
      if (d < 32) {
        return result + d * scale;
      }
      result += (d - 32) * scale;
      scale *= 32;
    }
  }

  int sint() {
    final v = uint();
    return v.isEven ? v ~/ 2 : -((v + 1) ~/ 2);
  }

  bool boolean() => switch (uint()) {
    0 => false,
    1 => true,
    final v => throw FormatException('bool', v),
  };

  String string() => _strings[uint()];

  String? optString() => switch (uint()) {
    0 => null,
    final i => _strings[i - 1],
  };

  DateTime? time([DateTime? after]) => switch (uint()) {
    _timeNull => null,
    _timeSame => after!,
    _timeUtcAfter => DateTime.fromMicrosecondsSinceEpoch(
      after!.microsecondsSinceEpoch + sint(),
      isUtc: true,
    ),
    _timeUtc => DateTime.fromMicrosecondsSinceEpoch(sint(), isUtc: true),
    _timeText => DateTime.parse(string()),
    final tag => throw FormatException('time', tag),
  };

  double? sortKey() => switch (uint()) {
    _sortKeyNull => null,
    _sortKeyHalves => sint() / 2,
    _sortKeyDouble => _float64(),
    final tag => throw FormatException('sort key', tag),
  };

  double _float64() {
    final bits = ByteData(8)
      ..setUint32(0, uint())
      ..setUint32(4, uint());
    return bits.getFloat64(0);
  }

  List<T> list<T>(T Function() read) => [
    for (var n = uint(); n > 0; n--) read(),
  ];

  List<T> records<T>(T Function() read) {
    expect('[');
    final xs = <T>[];
    if (_s.codeUnitAt(_pos) != _closeBracket) {
      do {
        expect('"');
        xs.add(read());
        expect('"');
      } while (_s.codeUnitAt(_pos++) == _comma);
      _pos--;
    }
    expect(']');
    return xs;
  }

  Catalog catalog() => Catalog(
    categories: list(
      () => Category(
        id: string(),
        name: string(),
        sortOrder: sint(),
        seedKey: optString(),
      ),
    ),
    stores: list(
      () => Store(
        id: string(),
        name: string(),
        sortOrder: sint(),
        seedKey: optString(),
      ),
    ),
    layout: list(
      () => StoreCategory(
        storeId: string(),
        categoryId: string(),
        sortOrder: sint(),
        hidden: boolean(),
      ),
    ),
    members: list(
      () => Member(id: string(), displayName: string(), role: optString()),
    ),
  );

  Item item() {
    final id = string();
    final name = string();
    final quantity = optString();
    final brand = optString();
    final properties = optString();
    final categoryId = optString();
    final storeId = optString();
    final sortKey = this.sortKey();
    final status = ItemStatus.values[uint()];
    final createdAt = time()!;
    final updatedAt = time(createdAt)!;
    return Item(
      id: id,
      name: name,
      quantity: quantity,
      brand: brand,
      properties: properties,
      categoryId: categoryId,
      storeId: storeId,
      sortKey: sortKey,
      status: status,
      createdAt: createdAt,
      updatedAt: updatedAt,
      boughtAt: time(updatedAt),
      addedBy: optString(),
      categorizedVia: optString(),
      canonicalKey: optString(),
    );
  }

  SetTo<String?>? change() => boolean() ? SetTo(optString()) : null;

  ItemOp op() => switch (_Op.values[uint()]) {
    _Op.add => _add(item(), uint()),
    _Op.status => SetStatus(
      string(),
      ItemStatus.values[uint()],
      time()!,
      storeId: optString(),
    ),
    _Op.edit => EditItem(
      string(),
      ItemChanges(
        name: optString(),
        quantity: change(),
        brand: change(),
        properties: change(),
        categoryId: optString(),
        storeId: change(),
      ),
      keyBefore: optString(),
      deviceParsed: boolean(),
    ),
    _Op.move => MoveItem(string(), categoryId: string(), storeId: optString()),
    _Op.place => PlaceItem(
      string(),
      anchorId: string(),
      edge: Edge.values[uint()],
      categoryId: string(),
      storeId: optString(),
      sortKey: sortKey(),
    ),
    _Op.delete => DeleteItem(string()),
    _Op.merge => MergeItems(
      string(),
      mergeId: string(),
      otherId: string(),
      quantity: optString(),
      brand: optString(),
      properties: optString(),
    ),
    _Op.unmerge => UnmergeItems(
      string(),
      mergeId: string(),
      kept: item(),
      merged: item(),
    ),
  };

  static AddItem _add(Item item, int flags) => AddItem(
    item,
    restored: flags & 1 != 0,
    noStore: flags & 2 != 0,
    deviceParsed: flags & 4 != 0,
  );

  Usual usual() => Usual(
    name: string(),
    due: boolean(),
    quantity: optString(),
    lastUsed: time(),
  );
}
