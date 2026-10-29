import 'package:family_groceries/list/list_view/sections.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

Item item(
  String id, {
  String? category = 'a',
  String? store,
  ItemStatus status = ItemStatus.active,
  int at = 0,
  int updated = 0,
  String? by,
  double? key,
}) => Item(
  id: id,
  name: id,
  categoryId: category,
  storeId: store,
  sortKey: key,
  status: status,
  createdAt: DateTime.utc(2026).add(Duration(minutes: at)),
  updatedAt: DateTime.utc(2026).add(Duration(minutes: updated)),
  boughtAt: status == ItemStatus.bought
      ? DateTime.utc(2026).add(Duration(minutes: at))
      : null,
  addedBy: by,
);

Duration minutes(int n) => Duration(minutes: n);

void main() {
  const categories = [
    Category(id: 'b', name: 'B', sortOrder: 20),
    Category(id: 'a', name: 'A', sortOrder: 10),
  ];

  /// The blocks of a list without stores.
  List<CategoryBlock> blocksOf(Iterable<Item> items) =>
      sectionsOf(items, const Catalog(categories: categories)).single.blocks;

  test('pending ops fold over server rows in order', () {
    final server = {'x': item('x'), 'y': item('y')};
    final view = visibleItems(server, [
      SetStatus('x', ItemStatus.bought, DateTime.utc(2026)),
      const DeleteItem('y'),
      AddItem(item('z')),
      const EditItem(
        'z',
        ItemChanges(name: 'Zitronen', quantity: SetTo('3'), categoryId: 'b'),
      ),
    ]);
    expect(view['x']!.status, ItemStatus.bought);
    expect(view.containsKey('y'), isFalse);
    expect(view['z']!.name, 'Zitronen');
    expect(view['z']!.quantity, '3');
    expect(view['z']!.categoryId, 'b');
    expect(server['x']!.status, ItemStatus.active, reason: 'server untouched');
  });

  test('an add of a row the server already has keeps the server row', () {
    final server = {'x': item('x', category: 'b')};
    expect(visibleItems(server, [AddItem(item('x'))])['x']!.categoryId, 'b');
  });

  test('stale echoes do not overwrite newer rows', () {
    final server = {'x': item('x', updated: 5)};
    final stale = item('x', status: ItemStatus.bought, updated: 4);
    expect(mergeServerRow(server, stale), same(server));
    final fresh = item('x', status: ItemStatus.bought, updated: 6);
    expect(mergeServerRow(server, fresh)['x']!.status, ItemStatus.bought);
  });

  test('groups follow category sort order; unclassified items lead', () {
    final groups = blocksOf([
      item('b1', category: 'b', at: 1),
      item('a2', at: 2),
      item('a1', at: 1),
      item('new', category: null),
      item('gone', status: ItemStatus.bought),
      item('orphan', category: 'deleted-category'),
    ]);
    expect([for (final g in groups) g.category?.id], [null, 'a', 'b', null]);
    expect([for (final i in groups[1].items) i.id], ['a1', 'a2']);
    expect(groups.last.items.single.id, 'orphan');
  });

  test('a tick with a store tags the item; a plain tick keeps its tag', () {
    final at = DateTime.utc(2026);
    final tagged = {'x': item('x', store: 'dm')};
    final atLidl = SetStatus('x', ItemStatus.bought, at, storeId: 'lidl');
    expect(visibleItems(tagged, [atLidl])['x']!.storeId, 'lidl');
    final anywhere = SetStatus('x', ItemStatus.bought, at);
    expect(visibleItems(tagged, [anywhere])['x']!.storeId, 'dm');
  });

  test('an edit changes only its columns, null clearing one', () {
    final server = {
      'x': item(
        'x',
        store: 'dm',
        key: 5,
      ).copyWith(quantity: () => '2', brand: () => 'Ja!'),
    };
    Item edited(ItemChanges changes) =>
        visibleItems(server, [EditItem('x', changes)])['x']!;
    final brand = edited(
      const ItemChanges(brand: SetTo('Weihenstephan'), quantity: SetTo('3')),
    );
    expect(
      (brand.name, brand.brand, brand.quantity, brand.storeId, brand.sortKey),
      ('x', 'Weihenstephan', '3', 'dm', 5),
    );
    final cleared = edited(
      const ItemChanges(storeId: SetTo(null), brand: SetTo(null)),
    );
    expect((cleared.storeId, cleared.brand), (null, null));
    expect(cleared.quantity, '2', reason: 'untouched');
    expect(const ItemChanges().isEmpty, isTrue);
    expect(const ItemChanges(properties: SetTo(null)).isEmpty, isFalse);
  });

  test('a move changes store and category and goes last', () {
    final server = {
      'x': item('x', store: 'dm', at: 3, key: 1),
      'y': item('y', category: 'b', key: 5000),
    };
    final view = visibleItems(server, [
      const MoveItem('x', categoryId: 'b', storeId: null),
    ]);
    final moved = view['x']!;
    expect((moved.categoryId, moved.storeId), ('b', null));
    expect(moved.createdAt, server['x']!.createdAt);
    final groups = blocksOf(view.values);
    expect([for (final i in groups.single.items) i.id], ['y', 'x']);
    expect(
      visibleItems({}, [
        const MoveItem('gone', categoryId: 'b', storeId: null),
      ]),
      isEmpty,
    );
  });

  test('a group walks by sort key, unnumbered last, then by age', () {
    final groups = blocksOf([
      item('late', at: 1, key: 3072),
      item('early', at: 9, key: 1024),
      item('typed2', at: 5),
      item('typed1', at: 4),
      item('tie-b', at: 2, key: 2048),
      item('tie-a', at: 2, key: 2048),
    ]);
    expect(
      [for (final i in groups.single.items) i.id],
      ['early', 'tie-a', 'tie-b', 'late', 'typed1', 'typed2'],
    );
  });

  test('a placed item takes the gap next to its anchor', () {
    final group = [
      item('a', key: 1024),
      item('b', key: 2048),
      item('c', key: 4096),
    ];
    expect(placeKey(group, group[1], Edge.before), 1536);
    expect(placeKey(group, group[1], Edge.after), 3072);
    expect(placeKey(group, group[0], Edge.before), 0);
    expect(placeKey(group, group[2], Edge.after), 5120);
    expect(placeKey([item('n')], item('n'), Edge.after), isNull);
    final placed = visibleItems(
      {'x': item('x', store: 'dm', key: 1)},
      [
        const PlaceItem(
          'x',
          anchorId: 'b',
          edge: Edge.before,
          categoryId: 'b',
          storeId: null,
          sortKey: 1536,
        ),
      ],
    )['x']!;
    expect(
      (placed.categoryId, placed.storeId, placed.sortKey),
      ('b', null, 1536),
    );
  });

  test('every op survives its JSON', () {
    final at = DateTime.utc(2026, 10, 22, 12);
    final ops = <ItemOp>[
      AddItem(
        item('x', key: 2048).copyWith(
          brand: () => 'Pampers',
          properties: () => 'Größe 3',
          quantity: () => '2',
        ),
      ),
      SetStatus('x', ItemStatus.bought, at, storeId: 'dm'),
      const EditItem(
        'x',
        ItemChanges(
          name: 'Windeln',
          quantity: SetTo(null),
          brand: SetTo('Pampers'),
          properties: SetTo('Größe 3, Big Pack'),
          categoryId: 'b',
          storeId: SetTo(null),
        ),
      ),
      const EditItem('x', ItemChanges(storeId: SetTo('dm'))),
      const MoveItem('x', categoryId: 'b', storeId: 'dm'),
      const PlaceItem(
        'x',
        anchorId: 'y',
        edge: Edge.after,
        categoryId: 'a',
        storeId: null,
        sortKey: null,
      ),
      const DeleteItem('x'),
    ];
    for (final op in ops) {
      final back = ItemOp.fromJson(op.toJson());
      expect(back.runtimeType, op.runtimeType);
      expect(back.toJson(), op.toJson());
    }
    final edit = ItemOp.fromJson(ops[3].toJson()) as EditItem;
    expect(edit.changes, const ItemChanges(storeId: SetTo('dm')));
    expect(
      Item.fromJson({...item('x').toJson(), 'sort_key': 2048}).sortKey,
      2048.0,
      reason: 'PostgREST sends a whole double as an int',
    );
  });

  test('a parsed entry reads the parse_item row', () {
    final parsed = ParsedEntry.fromJson(const {
      'name': 'Windeln',
      'brand': 'Pampers',
      'properties': 'Größe 3',
      'quantity': '2',
      'store_id': 'dm',
      'category_id': 'drugstore',
    });
    expect(
      (
        parsed.name,
        parsed.brand,
        parsed.properties,
        parsed.quantity,
        parsed.storeId,
        parsed.categoryId,
      ),
      ('Windeln', 'Pampers', 'Größe 3', '2', 'dm', 'drugstore'),
    );
  });

  test('a store reorder renumbers the stores', () {
    const catalog = Catalog(
      stores: [
        Store(id: 'dm', name: 'dm', sortOrder: 10),
        Store(id: 'lidl', name: 'Lidl', sortOrder: 20),
      ],
    );
    final next = catalog.withStoreOrder(['lidl', 'dm']);
    expect(
      [for (final s in next.stores) (s.id, s.sortOrder)],
      [('lidl', 10), ('dm', 20)],
    );
  });

  test('recently bought is newest first', () {
    final bought = recentlyBought([
      item('old', status: ItemStatus.bought, at: 1),
      item('new', status: ItemStatus.bought, at: 2),
      item('active'),
    ]);
    expect([for (final i in bought) i.id], ['new', 'old']);
  });

  test('a member is found by id', () {
    const catalog = Catalog(
      members: [Member(id: 'l', displayName: 'Lea')],
    );
    expect(catalog.member('l')?.displayName, 'Lea');
    expect(catalog.member('unknown'), isNull);
  });

  group('seen mark', () {
    final items = [
      item('old', by: 'lea', at: 1),
      item('a', by: 'lea', at: 5),
      item('b', by: 'lea', at: 6),
      item('mine', by: 'peter', at: 7),
      item('pending', at: 8),
      item('gone', by: 'lea', at: 9, status: ItemStatus.bought),
    ];
    final baseline = SeenMark(until: DateTime.utc(2026).add(minutes(2)));
    List<Item> withStatus(String id, ItemStatus status) => [
      for (final i in items)
        if (i.id == id) i.copyWith(status: status) else i,
    ];

    test('fresh is what a partner added after the mark', () {
      expect(baseline.fresh(items, 'peter'), {'a', 'b'});
      expect(const SeenMark().fresh(items, 'peter'), {'old', 'a', 'b'});
      expect(baseline.fresh(items, 'lea'), {'mine'});
    });

    test('marking some keeps their ids, marking all moves the mark', () {
      final some = baseline.marking({'a', 'mine'}, items, 'peter');
      expect(some.fresh(items, 'peter'), {'b'});
      expect(some.ids, {'a'});
      final all = some.marking({'b'}, items, 'peter');
      expect(all.fresh(items, 'peter'), isEmpty);
      expect(all.ids, isEmpty);
      expect(all.until, DateTime.utc(2026).add(minutes(6)));
    });

    test('ids of items that are gone are pruned', () {
      final some = baseline.marking({'a'}, items, 'peter');
      final later = some.marking(const {}, [items[2]], 'peter');
      expect(later.ids, isEmpty);
      expect(later.fresh(items, 'peter'), {'a', 'b'});
    });

    test('a seen item ticked and put back is no news', () {
      final seen = baseline.marking({'a'}, items, 'peter');
      final ticked = withStatus('a', ItemStatus.bought);
      final afterTick = seen.marking(const {}, ticked, 'peter');
      expect(afterTick.fresh(items, 'peter'), {'b'});
    });

    test('an unseen partner item that comes back is news', () {
      final all = baseline.marking({'a', 'b'}, items, 'peter');
      expect(all.until, DateTime.utc(2026).add(minutes(6)));
      final back = withStatus('gone', ItemStatus.active);
      expect(all.fresh(back, 'peter'), {'gone'});
    });
  });

  test('suggestions match whole names first, then word starts', () {
    const usuals = [
      Usual(name: 'Bio-Milch', due: false),
      Usual(name: 'Hafermilch', due: false),
      Usual(name: 'Milch', due: true),
      Usual(name: 'Käse', due: true),
      Usual(name: 'Brot', due: true),
    ];
    List<String> names(List<Usual> list) => [for (final u in list) u.name];
    expect(names(suggestUsuals(usuals, const [], ' MILCH ')), [
      'Milch',
      'Bio-Milch',
    ]);
    expect(names(suggestUsuals(usuals, const [], 'kae')), ['Käse']);
    expect(names(suggestUsuals(usuals, const [], 'Kä')), ['Käse']);
    expect(suggestUsuals(usuals, const [], '  '), isEmpty);
    final brot = Item(
      id: 'x',
      name: 'brot',
      status: ItemStatus.active,
      createdAt: DateTime.utc(2026),
      updatedAt: DateTime.utc(2026),
    );
    expect(names(dueUsualsOf(usuals, [brot])), ['Milch', 'Käse']);
  });
}
