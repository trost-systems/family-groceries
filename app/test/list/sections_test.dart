import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/item_row.dart';
import 'package:family_groceries/list/list_view/sections.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'model_test.dart' show item;

const catalog = Catalog(
  categories: [
    Category(id: 'produce', name: 'produce', sortOrder: 10),
    Category(id: 'chilled', name: 'chilled', sortOrder: 20),
    Category(id: 'pantry', name: 'pantry', sortOrder: 30),
    Category(id: 'new', name: 'new', sortOrder: 40),
    Category(id: 'other', name: 'other', sortOrder: 1000),
  ],
  stores: [
    Store(id: 'lidl', name: 'Lidl', sortOrder: 20),
    Store(id: 'dm', name: 'dm', sortOrder: 10),
  ],
  // Neither store has a row for 'new' yet.
  layout: [
    StoreCategory(storeId: 'lidl', categoryId: 'other', sortOrder: 10),
    StoreCategory(storeId: 'lidl', categoryId: 'pantry', sortOrder: 20),
    StoreCategory(storeId: 'lidl', categoryId: 'chilled', sortOrder: 30),
    StoreCategory(storeId: 'lidl', categoryId: 'produce', sortOrder: 40),
    StoreCategory(storeId: 'dm', categoryId: 'pantry', sortOrder: 10),
    StoreCategory(storeId: 'dm', categoryId: 'other', sortOrder: 20),
    StoreCategory(
      storeId: 'dm',
      categoryId: 'produce',
      sortOrder: 30,
      hidden: true,
    ),
    StoreCategory(
      storeId: 'dm',
      categoryId: 'chilled',
      sortOrder: 40,
      hidden: true,
    ),
  ],
);

/// `section| category: ids; ...` per section.
List<String> describe(List<StoreSection> sections) => [
  for (final s in sections)
    '${s.key}| ${[for (final b in s.blocks) _block(b)].join('; ')}',
];

String _block(CategoryBlock b) =>
    '${b.category?.id ?? '?'}: ${b.items.map((i) => i.id).join(' ')}';

void main() {
  group('sections', () {
    test('stores in household order, then no store; one block per '
        "category in the store's walking order", () {
      final sections = sectionsOf([
        item('apple', category: 'produce'),
        item('milk', category: 'chilled', at: 1),
        item('yoghurt', category: 'chilled', store: 'dm', at: 2),
        item('rice', category: 'pantry'),
        item('noodles', category: 'new'),
        item('soap', category: 'other', store: 'dm', at: 1),
        item('beer', category: 'other', store: 'lidl', at: 2),
        item('chips', category: 'pantry', store: 'lidl', key: 2048),
        item('nuts', category: 'pantry', store: 'lidl', key: 1024, at: 9),
        item('typed', category: null),
        item('lost', category: 'deleted'),
        item('closed', category: 'pantry', store: 'deleted-store'),
        item('bought', category: 'pantry', status: ItemStatus.bought),
      ], catalog);
      expect(describe(sections), [
        // A store carries every category its items are in, even one its
        // layout hides.
        'dm| other: soap; chilled: yoghurt',
        // Walk order inside a block: sort key, not age.
        // Then every item without a store, deleted stores' too.
        'lidl| other: beer; pantry: nuts chips',
        '$noStoreKey| ${[
          '?: typed', 'produce: apple', 'chilled: milk', //
          'pantry: closed rice', 'new: noodles', '?: lost',
        ].join('; ')}',
      ]);
      expect([for (final s in sections) s.count], [2, 3, 7]);
    });

    test('an empty list still has every store and the no-store section', () {
      expect(describe(sectionsOf(const [], catalog)), [
        'dm| ',
        'lidl| ',
        '$noStoreKey| ',
      ]);
    });

    test('an unknown store walks the route order', () {
      expect(
        [for (final s in walkingOrder(catalog, 'gone')) s.category.id],
        ['produce', 'chilled', 'pantry', 'new', 'other'],
      );
      expect(
        [for (final s in walkingOrder(catalog, 'lidl')) s.category.id],
        ['other', 'pantry', 'chilled', 'produce', 'new'],
      );
    });
  });

  group('columns', () {
    StoreSection section(String id, int items) => StoreSection(
      store: Store(id: id, name: id, sortOrder: 0),
      blocks: [
        CategoryBlock(null, [for (var i = 0; i < items; i++) item('$id$i')]),
      ],
    );
    List<List<String>> ids(List<List<StoreSection>> columns) => [
      for (final c in columns) [for (final s in c) s.key],
    ];
    double count(StoreSection s) => s.count.toDouble();

    test('runs of whole stores in order, the tallest as short as can be', () {
      final sections = [
        section('a', 8),
        section('b', 2),
        section('c', 3),
        section('d', 6),
      ];
      expect(ids(columnsOf(sections, 1, count)), [
        ['a', 'b', 'c', 'd'],
      ]);
      expect(ids(columnsOf(sections, 2, count)), [
        ['a', 'b'],
        ['c', 'd'],
      ]);
      expect(ids(columnsOf(sections, 3, count)), [
        ['a'],
        ['b', 'c'],
        ['d'],
      ]);
    });

    test('never more columns than stores', () {
      expect(ids(columnsOf([section('a', 1)], 3, count)), [
        ['a'],
      ]);
      expect(ids(columnsOf(const [], 2, count)), [<String>[]]);
    });
  });

  group('drops', () {
    final a = item('a', key: 1024);
    final b = item('b', key: 2048);
    final c = item('c', key: 3072);
    final block = [a, b, c];

    test('the pointer above a row half drops before it, below after it', () {
      expect(edgeAt(10, 52), Edge.before);
      expect(edgeAt(25.9, 52), Edge.before);
      expect(edgeAt(26, 52), Edge.after);
      expect(edgeAt(51, 52), Edge.after);
    });

    test('before or after a row places the item there', () {
      expect(_place(dropOnRow(c, a, Edge.before, block)), ('a', Edge.before));
      expect(_place(dropOnRow(a, c, Edge.after, block)), ('c', Edge.after));
      final other = item('x', category: 'b', store: 'dm');
      expect(_place(dropOnRow(other, b, Edge.after, block)), ('b', Edge.after));
    });

    test('a drop that leaves the item where it is does nothing', () {
      expect(dropOnRow(a, a, Edge.after, block), isNull);
      expect(dropOnRow(a, b, Edge.before, block), isNull);
      expect(dropOnRow(b, a, Edge.after, block), isNull);
      expect(dropOnCategory(c, null, 'a', block), isNull);
      expect(dropOnStore(item('x', store: 'dm'), 'dm'), isNull);
    });

    test('a category divider takes the item to the end of its category', () {
      expect(_move(dropOnCategory(a, null, 'a', block)), (null, 'a'));
      expect(_move(dropOnCategory(a, 'dm', 'b', const [])), ('dm', 'b'));
    });

    test('a store divider, folded or not, keeps the category', () {
      expect(_move(dropOnStore(item('x', category: 'chilled'), 'lidl')), (
        'lidl',
        'chilled',
      ));
      expect(_move(dropOnStore(item('x', category: 'b', store: 'dm'), null)), (
        null,
        'b',
      ));
      expect(
        dropOnStore(item('typed', category: null), 'lidl'),
        isNull,
        reason: 'not classified yet',
      );
    });

    test('reordering puts the moved id at the edge of the target', () {
      const ids = ['a', 'b', 'c', 'd'];
      expect(reordered(ids, 'd', 'b', Edge.before), ['a', 'd', 'b', 'c']);
      expect(reordered(ids, 'a', 'c', Edge.after), ['b', 'c', 'a', 'd']);
      expect(reordered(ids, 'a', 'a', Edge.after), ids);
      expect(reordered(ids, 'x', 'a', Edge.after), ids);
    });
  });

  group('rows', () {
    test(
      'a count shows as "6×", other quantities as typed, one not at all',
      () {
        expect(quantityLabel('6'), '6×');
        expect(quantityLabel('500 g'), '500 g');
        expect(quantityLabel('1'), isNull);
        expect(quantityLabel(null), isNull);
      },
    );

    test('icons come from the name, else the category', () {
      const chilled = Category(
        id: 'c',
        name: 'Kühlregal',
        sortOrder: 1,
        seedKey: 'chilled',
      );
      const baby = Category(
        id: 'd',
        name: '👶 Drogerie',
        sortOrder: 2,
        seedKey: 'drugstore',
      );
      Item named(String name) => item('x').copyWith(name: name);
      expect(itemIcon(named('Bananen'), chilled), '🍌');
      expect(itemIcon(named('Vollmilch'), chilled), '🥛');
      expect(itemIcon(named('Reis'), null), '🍚');
      expect(itemIcon(named('Quark'), chilled), '🥛');
      expect(itemIcon(named('Creme'), baby), '👶');
      expect(categoryLabel(baby), 'Drogerie');
      expect(categoryLabel(chilled), 'Kühlregal');
    });
  });
}

(String, Edge)? _place(ItemDrop? drop) => switch (drop) {
  PlaceDrop(:final anchorId, :final edge) => (anchorId, edge),
  _ => null,
};

(String?, String)? _move(ItemDrop? drop) => switch (drop) {
  MoveDrop(:final storeId, :final categoryId) => (storeId, categoryId),
  _ => null,
};
