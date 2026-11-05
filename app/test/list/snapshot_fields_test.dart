import 'dart:io';

import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

/// `lib/list/snapshot_codec.dart` writes and reads every record field by
/// field, apart from `toJson`/`fromJson`. These lists are the fields it
/// knows; a field the model gains and the codec does not would be dropped
/// on the device without a word.
const _hint =
    'The model persists a field lib/list/snapshot_codec.dart does not '
    'know. Add it to the record writer and reader there, as snapshot '
    'version 5 with a reader for version 4, then update this list.';

const _item = {
  'id', 'name', 'quantity', 'brand', 'properties', 'category_id', //
  'store_id', 'sort_key', 'status', 'created_at', 'updated_at', 'bought_at',
  'added_by', 'categorized_via', 'canonical_key',
};

const _ops = {
  'add': {'item_id', 'op', 'item', 'restored', 'no_store', 'device_parsed'},
  'status': {'item_id', 'op', 'status', 'at', 'store_id'},
  'edit': {'item_id', 'op', 'changes', 'key_before', 'device_parsed'},
  'move': {'item_id', 'op', 'category_id', 'store_id'},
  'place': {
    'item_id', 'op', 'anchor_id', 'edge', 'category_id', 'store_id', //
    'sort_key',
  },
  'delete': {'item_id', 'op'},
  'merge': {
    'item_id', 'op', 'merge_id', 'other_id', 'quantity', 'brand', //
    'properties',
  },
  'unmerge': {'item_id', 'op', 'merge_id', 'kept', 'merged'},
};

void main() {
  final at = DateTime.utc(2026, 11, 6);
  final item = Item(
    id: 'i',
    name: 'Milch',
    status: ItemStatus.bought,
    createdAt: at,
    updatedAt: at,
    quantity: '1 l',
    brand: 'Alpro',
    properties: 'bio',
    categoryId: 'c',
    storeId: 's',
    sortKey: 1,
    boughtAt: at,
    addedBy: 'm',
    categorizedVia: 'exact',
    canonicalKey: 'milch',
  );
  const changes = ItemChanges(
    name: 'Hafermilch',
    quantity: SetTo('2'),
    brand: SetTo('Oatly'),
    properties: SetTo('bio'),
    categoryId: 'c',
    storeId: SetTo('s'),
  );
  final ops = <ItemOp>[
    AddItem(item, restored: true, noStore: true, deviceParsed: true),
    SetStatus('i', ItemStatus.bought, at, storeId: 's'),
    const EditItem('i', changes, keyBefore: 'milch', deviceParsed: true),
    const MoveItem('i', categoryId: 'c', storeId: 's'),
    const PlaceItem(
      'i',
      anchorId: 'a',
      edge: Edge.after,
      categoryId: 'c',
      storeId: 's',
      sortKey: 2,
    ),
    const DeleteItem('i'),
    const MergeItems(
      'i',
      mergeId: 'g',
      otherId: 'o',
      quantity: '2',
      brand: 'Alpro',
      properties: 'bio',
    ),
    UnmergeItems('i', mergeId: 'g', kept: item, merged: item),
  ];

  test('every field of a full record is one the codec writes', () {
    expect(item.toJson().keys.toSet(), _item, reason: _hint);
    expect(changes.toColumns().keys.toSet(), {
      'name', 'quantity', 'brand', 'properties', 'category_id', 'store_id', //
    }, reason: _hint);
    expect({for (final op in ops) op.toJson()['op']}, _ops.keys.toSet());
    for (final op in ops) {
      final json = op.toJson();
      expect(json.keys.toSet(), _ops[json['op']], reason: _hint);
    }
    const catalog = Catalog(
      categories: [Category(id: 'c', name: 'K', sortOrder: 1, seedKey: 'k')],
      stores: [Store(id: 's', name: 'S', sortOrder: 1, seedKey: 's')],
      layout: [
        StoreCategory(
          storeId: 's',
          categoryId: 'c',
          sortOrder: 1,
          hidden: true,
        ),
      ],
      members: [Member(id: 'm', displayName: 'Lea', role: 'owner')],
    );
    expect(catalog.toJson().keys.toSet(), {
      'categories', 'stores', 'layout', 'members', //
    }, reason: _hint);
    expect(catalog.categories.single.toJson().keys.toSet(), {
      'id', 'name', 'sort_order', 'seed_key', //
    }, reason: _hint);
    expect(catalog.stores.single.toJson().keys.toSet(), {
      'id', 'name', 'sort_order', 'seed_key', //
    }, reason: _hint);
    expect(catalog.layout.single.toJson().keys.toSet(), {
      'store_id', 'category_id', 'sort_order', 'hidden', //
    }, reason: _hint);
    expect(catalog.members.single.toJson().keys.toSet(), {
      'id', 'display_name', 'role', //
    }, reason: _hint);
    expect(
      Usual(
        name: 'Tee',
        due: true,
        quantity: '2',
        lastUsed: at,
      ).toJson().keys.toSet(),
      {'name', 'quantity', 'due', 'last_used'},
      reason: _hint,
    );
    expect(
      ListSnapshot(
        catalog: catalog,
        server: [item],
        pending: ops,
      ).toJson().keys.toSet(),
      {'version', 'catalog', 'server', 'pending', 'usuals'},
      reason: _hint,
    );
  });

  test('fromJson reads no key the codec does not know', () {
    // Also catches a field written only when set, like `restored`.
    final model = File('lib/list/model.dart').readAsStringSync();
    final cache = File('lib/list/list_cache.dart').readAsStringSync();
    Set<String> keysRead(String source, String from) {
      final start = source.indexOf(from);
      expect(start, isNonNegative, reason: 'cannot find "$from"');
      final body = source.substring(start, source.indexOf('\n\n', start));
      return {
        for (final m in RegExp(
          r"""(?:json|current)\['(\w+)'\]|change\('(\w+)'\)""",
        ).allMatches(body))
          m[1] ?? m[2]!,
      };
    }

    expect(keysRead(model, '=> Item('), _item, reason: _hint);
    expect(
      keysRead(model, 'sealed class const ItemOp'),
      {for (final keys in _ops.values) ...keys}..addAll(const {'item_id'}),
      reason: _hint,
    );
    expect(keysRead(model, 'factory fromColumns('), {
      'name', 'quantity', 'brand', 'properties', 'category_id', 'store_id', //
    }, reason: _hint);
    expect(keysRead(model, '=> Catalog('), {
      'categories', 'stores', 'layout', 'members', //
    }, reason: _hint);
    for (final c in ['=> Category(', '=> Store(']) {
      expect(keysRead(model, c), {
        'id', 'name', 'sort_order', 'seed_key', //
      }, reason: _hint);
    }
    expect(keysRead(model, '=> StoreCategory('), {
      'store_id', 'category_id', 'sort_order', 'hidden', //
    }, reason: _hint);
    expect(keysRead(model, '=> Member('), {
      'id', 'display_name', 'role', //
    }, reason: _hint);
    expect(keysRead(model, '=> Usual('), {
      'name', 'quantity', 'due', 'last_used', //
    }, reason: _hint);
    expect(keysRead(cache, 'factory fromJson('), {
      'version', 'catalog', 'server', 'pending', 'usuals', //
    }, reason: _hint);
  });
}
