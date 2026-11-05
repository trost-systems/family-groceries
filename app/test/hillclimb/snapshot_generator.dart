import 'dart:math';

import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/model.dart';

const _names = [
  'Milch',
  'Hafermilch',
  'Brot',
  'Vollkornbrot',
  'Butter',
  'Käse',
  'Gouda',
  'Äpfel',
  'Bananen',
  'Möhren',
  'Karotten',
  'Gurken',
  'Tomaten',
  'Zwiebeln',
  'Knoblauch',
  'Kartoffeln',
  'Nudeln',
  'Reis',
  'Mehl',
  'Zucker',
  'Salz',
  'Eier',
  'Joghurt',
  'Quark',
  'Sahne',
  'Kaffee',
  'Tee',
  'Orangensaft',
  'Mineralwasser',
  'Bier',
  'Wein',
  'Spülmittel',
  'Klopapier',
  'Zahnpasta',
  'Shampoo',
  'Waschmittel',
  'Müsli',
  'Haferflocken',
  'Honig',
  'Marmelade',
  'Hähnchenbrust',
  'Hackfleisch',
  'Lachs',
  'Tofu',
  'Paprika',
  'Brokkoli',
  'Spinat',
  'Feldsalat',
  'Zitronen',
  'Avocado',
  'Schokolade',
  'Chips',
  'Olivenöl',
  'Essig',
  'Senf',
  'Ketchup',
  'Mayonnaise',
  'Pesto',
  'Basilikum',
  'Petersilie',
  'Brötchen',
  'Croissants',
  'Frischkäse',
  'Mozzarella',
];
const _quantities = [
  '1',
  '2',
  '3',
  '500 g',
  '1 kg',
  '2 l',
  '6 Stück',
  '1 Pck.',
  '250 g',
  '1 Bund',
];
const _brands = [
  'Alpro',
  'Weihenstephan',
  'Barilla',
  'Tchibo',
  'Kerrygold',
  'Ja!',
  'Bio',
];
const _properties = [
  'bio',
  'laktosefrei',
  '1,5 %',
  'groß, reif',
  'vegan',
  'ohne Zucker',
];
const _via = ['household', 'exact', 'synonym', 'fuzzy', 'fallback', 'picked'];

/// A household's snapshot of [items] server rows, [openShare] of them still
/// open, with a full catalog, one queued op of every kind and some usuals.
/// Ids are uuids and times carry microseconds, as PostgREST sends them.
ListSnapshot generateSnapshot({
  required int seed,
  required int items,
  required double openShare,
}) {
  final rng = Random(seed);
  String uuid() {
    final b = [for (var i = 0; i < 16; i++) rng.nextInt(256)];
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    final h = [for (final x in b) x.toRadixString(16).padLeft(2, '0')].join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-'
        '${h.substring(16, 20)}-${h.substring(20)}';
  }

  T pick<T>(List<T> xs) => xs[rng.nextInt(xs.length)];
  String? maybe(double p, String Function() f) =>
      rng.nextDouble() < p ? f() : null;
  final epoch = DateTime.utc(2025, 3, 2);
  DateTime at() => epoch.add(
    Duration(
      microseconds:
          rng.nextInt(600 * 24 * 3600) * 1000000 + rng.nextInt(1000000),
    ),
  );

  final members = [
    Member(id: uuid(), displayName: 'Peter', role: 'owner'),
    Member(id: uuid(), displayName: 'Lea', role: 'member'),
  ];
  const seeds = [
    'produce',
    'bakery',
    'dairy',
    'meat',
    'fish',
    'frozen',
    'pantry',
    'drinks',
    'snacks',
    'household',
    'care',
    'baby',
    'pets',
    'other',
  ];
  final categories = [
    for (final (i, key) in seeds.indexed)
      Category(
        id: uuid(),
        name: 'Kategorie $key',
        sortOrder: i * 10,
        seedKey: key,
      ),
    Category(id: uuid(), name: 'Asiatisch', sortOrder: 145),
  ];
  final stores = [
    for (final (i, name) in [
      'Rewe',
      'Edeka',
      'Aldi Süd',
      'dm',
      'Wochenmarkt',
    ].indexed)
      Store(
        id: uuid(),
        name: name,
        sortOrder: i,
        seedKey: i < 4 ? name.toLowerCase() : null,
      ),
  ];
  final layout = [
    for (final s in stores)
      for (final (i, c) in categories.indexed)
        StoreCategory(
          storeId: s.id,
          categoryId: c.id,
          sortOrder: (i * 7) % categories.length,
          hidden: rng.nextDouble() < 0.15,
        ),
  ];

  Item item({required bool open}) {
    final created = at();
    final updated = created.add(
      Duration(microseconds: rng.nextInt(3600000000)),
    );
    final name = pick(_names);
    return Item(
      id: uuid(),
      name: name,
      status: open ? ItemStatus.active : ItemStatus.bought,
      createdAt: created,
      updatedAt: updated,
      quantity: maybe(0.45, () => pick(_quantities)),
      brand: maybe(0.12, () => pick(_brands)),
      properties: maybe(0.1, () => pick(_properties)),
      categoryId: pick(categories).id,
      storeId: maybe(0.4, () => pick(stores).id),
      sortKey: rng.nextDouble() < 0.97
          ? rng.nextInt(4000) * 1024 + (rng.nextBool() ? 0.0 : 512.5)
          : null,
      boughtAt: open ? null : updated,
      addedBy: rng.nextDouble() < 0.98 ? pick(members).id : null,
      categorizedVia: maybe(0.9, () => pick(_via)),
      canonicalKey: name.toLowerCase().replaceAll(RegExp('[^a-z]'), ''),
    );
  }

  final server = [
    for (var i = 0; i < items; i++) item(open: rng.nextDouble() < openShare),
  ];
  final a = server[0];
  final b = server[1 % server.length];
  final pending = <ItemOp>[
    AddItem(item(open: true)),
    AddItem(item(open: true), restored: true, noStore: true),
    AddItem(item(open: true), deviceParsed: true),
    SetStatus(a.id, ItemStatus.bought, at(), storeId: stores.first.id),
    SetStatus(b.id, ItemStatus.active, at()),
    EditItem(
      a.id,
      ItemChanges(
        name: 'Hafermilch',
        quantity: const SetTo(null),
        brand: const SetTo('Alpro'),
        categoryId: categories.first.id,
      ),
      keyBefore: 'milch',
    ),
    EditItem(b.id, const ItemChanges(storeId: SetTo(null)), deviceParsed: true),
    MoveItem(a.id, categoryId: categories[2].id, storeId: stores[1].id),
    PlaceItem(
      b.id,
      anchorId: a.id,
      edge: Edge.after,
      categoryId: categories[2].id,
      storeId: null,
      sortKey: 2048.25,
    ),
    DeleteItem(b.id),
    MergeItems(
      a.id,
      mergeId: uuid(),
      otherId: b.id,
      quantity: '3',
      brand: null,
      properties: 'bio',
    ),
    UnmergeItems(a.id, mergeId: uuid(), kept: a, merged: b),
  ];
  final usuals = [
    for (final (i, name) in _names.take(40).indexed)
      Usual(
        name: name,
        due: i.isEven,
        quantity: maybe(0.3, () => pick(_quantities)),
        lastUsed: rng.nextDouble() < 0.9 ? at() : null,
      ),
  ];
  return ListSnapshot(
    catalog: Catalog(
      categories: categories,
      stores: stores,
      layout: layout,
      members: members,
    ),
    server: server,
    pending: pending,
    usuals: usuals,
  );
}
