import 'package:family_groceries/list/model.dart';
import 'package:flutter/foundation.dart' show immutable;

typedef _Json = Map<String, Object?>;

/// What the list shows without the network: the server state as last
/// confirmed and the ops it has not acknowledged yet.
@immutable
class const ListSnapshot({
  required final Catalog catalog,
  required final List<Item> server,

  /// Oldest first, as queued.
  required final List<ItemOp> pending,
  final List<Usual> usuals = const [],
}) {
  /// Upgrades an older snapshot first, so its queued ops survive an app
  /// update. Throws on a version newer than [version] (the app was
  /// downgraded) or one that cannot be upgraded.
  factory fromJson(Map<String, Object?> json) {
    final from = json['version'];
    if (from is! int || (from != version && !_upgrades.containsKey(from))) {
      throw FormatException('snapshot version', from);
    }
    var current = json;
    for (var v = from; v < version; v++) {
      current = _upgrades[v]!(current);
    }
    return ListSnapshot(
      catalog: Catalog.fromJson(current['catalog']! as _Json),
      server: [
        for (final row in current['server']! as List<Object?>)
          Item.fromJson(row! as _Json),
      ],
      pending: [
        for (final op in current['pending']! as List<Object?>)
          ItemOp.fromJson(op! as _Json),
      ],
      usuals: [
        for (final row in current['usuals']! as List<Object?>)
          Usual.fromJson(row! as _Json),
      ],
    );
  }

  static const version = 3;

  /// Version n to n + 1, for every n below [version].
  static const _upgrades = <int, _Json Function(_Json)>{1: _v1ToV2, 2: _v2ToV3};

  static _Json _v1ToV2(_Json json) => {
    ...json,
    'version': 2,
    'usuals': const <Object?>[],
    'catalog': {...json['catalog']! as _Json, 'members': const <Object?>[]},
  };

  /// Edits carry only their changed columns now. A v2 edit wrote all four,
  /// and a v2 move was a category-only edit. Items without brand,
  /// properties or sort key read them as null.
  static _Json _v2ToV3(_Json json) => {
    ...json,
    'version': 3,
    'pending': [
      for (final op in json['pending']! as List<Object?>)
        _v2ToV3Op(op! as _Json),
    ],
  };

  static _Json _v2ToV3Op(_Json op) => switch (op['op']) {
    'edit' => {
      'item_id': op['item_id'],
      'op': 'edit',
      'changes': {
        'name': op['name'],
        'quantity': op['quantity'],
        'category_id': op['category_id'],
        'store_id': op['store_id'],
      },
    },
    'move' => {
      'item_id': op['item_id'],
      'op': 'edit',
      'changes': {'category_id': op['category_id']},
    },
    _ => op,
  };

  Map<String, Object?> toJson() => {
    'version': version,
    'catalog': catalog.toJson(),
    'server': [for (final item in server) item.toJson()],
    'pending': [for (final op in pending) op.toJson()],
    'usuals': [for (final u in usuals) u.toJson()],
  };
}

/// The device's copy of one household's list for one user. [load] and
/// [loadSeen] return null when there is none or it cannot be read.
abstract interface class ListCache() {
  Future<ListSnapshot?> load();

  Future<void> save(ListSnapshot snapshot);

  /// Kept apart from the snapshot: it is the user's, not the server's.
  Future<SeenMark?> loadSeen();

  Future<void> saveSeen(SeenMark mark);
}
