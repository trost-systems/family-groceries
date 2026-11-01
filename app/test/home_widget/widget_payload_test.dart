import 'package:family_groceries/home_widget/widget_payload.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

const catalog = Catalog(
  categories: [
    Category(id: 'produce', name: 'produce', sortOrder: 10),
    Category(id: 'chilled', name: 'chilled', sortOrder: 20),
  ],
  stores: [
    Store(id: 'lidl', name: 'Lidl', sortOrder: 20),
    Store(id: 'markt', name: 'Wochenmarkt am Rathausplatz', sortOrder: 10),
  ],
  layout: [
    StoreCategory(storeId: 'lidl', categoryId: 'chilled', sortOrder: 10),
    StoreCategory(storeId: 'lidl', categoryId: 'produce', sortOrder: 20),
  ],
);

final _day = DateTime.utc(2026, 11);

Item item(
  String name, {
  String? store,
  String category = 'produce',
  String? quantity,
  ItemStatus status = ItemStatus.active,
}) => Item(
  id: name,
  name: name,
  quantity: quantity,
  storeId: store,
  categoryId: category,
  status: status,
  createdAt: _day,
  updatedAt: _day,
);

ListState listOf(List<Item> items) => ListState(
  loaded: true,
  catalog: catalog,
  server: {for (final i in items) i.id: i},
);

Map<String, Object?> json(WidgetPayload payload) => payload.toJson(_day);

void main() {
  test('signed out and without a household carry only their state', () {
    expect(json(const SignedOutPayload()), {
      'version': 1,
      'state': 'signedOut',
    });
    expect(json(const NoHouseholdPayload()), {
      'version': 1,
      'state': 'noHousehold',
    });
  });

  test('open items in the list order: stores in household order, each in '
      'its walking order, then the items without a store', () {
    final payload = readyPayloadOf(
      listOf([
        item('Brot'),
        item('Äpfel', store: 'lidl'),
        item('Milch', store: 'lidl', category: 'chilled', quantity: '2 l'),
        item('Honig', store: 'markt'),
        item('Butter', store: 'lidl', status: ItemStatus.bought),
      ]),
    );
    expect(json(payload), {
      'version': 1,
      'state': 'ready',
      'open': 4,
      'items': [
        {
          'name': 'Honig',
          'quantity': null,
          'store': 'Wochenmarkt am Rathausplatz',
        },
        {'name': 'Milch', 'quantity': '2 l', 'store': 'Lidl'},
        {'name': 'Äpfel', 'quantity': null, 'store': 'Lidl'},
        {'name': 'Brot', 'quantity': null, 'store': null},
      ],
      'updatedAt': '2026-11-01T00:00:00.000Z',
    });
  });

  test('six items at most, the count is all of them', () {
    final payload = readyPayloadOf(
      listOf([for (var i = 0; i < 9; i++) item('Ding $i', store: 'lidl')]),
    );
    expect(payload.open, 9);
    expect(payload.items, hasLength(widgetItemCount));
  });

  test('an empty list is ready with nothing open', () {
    final payload = readyPayloadOf(
      listOf([item('Brot', status: ItemStatus.bought)]),
    );
    expect(json(payload), containsPair('open', 0));
    expect(json(payload), containsPair('items', isEmpty));
  });

  test('an item of a deleted store shows without one', () {
    final payload = readyPayloadOf(listOf([item('Brot', store: 'gone')]));
    expect(payload.items.single.store, isNull);
  });
}
