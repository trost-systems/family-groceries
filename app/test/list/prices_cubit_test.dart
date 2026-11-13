import 'dart:convert';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/pricing.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

class _Tracked() implements Analytics {
  final events = <(String, Map<String, Object>)>[];

  @override
  void track(String event, [Map<String, Object> properties = const {}]) {
    checkEvent(event, properties);
    events.add((event, properties));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final _now = DateTime(2026, 11, 13, 18);

Price _price(int cents, {PricePer per = PricePer.piece, DateTime? at}) => Price(
  unitMicros: cents * microsPerCent,
  basis: PriceBasis.unit,
  per: per,
  currency: 'EUR',
  pricedAt: at ?? _now,
);

const _weekly = HouseholdList(id: 'weekly', name: 'Wocheneinkauf', position: 0);
const _diy = HouseholdList(id: 'diy', name: 'Baumarkt', position: 1);

/// Job 190: prices on items, the list's total and the household currency.
void main() {
  late FakeRepository repo;
  late MemoryListCache cache;
  late _Tracked tracked;
  late ListCubit cubit;

  Future<void> settle() => pumpEventQueue();

  setUp(() async {
    tracked = _Tracked();
    cache = MemoryListCache();
    repo = FakeRepository()
      ..lists = const [_weekly, _diy]
      ..remoteAdd('Milch', storeId: 'lidl', quantity: '2')
      ..remoteAdd('Bananen', storeId: 'lidl', quantity: '846 g')
      ..remoteAdd('Schrauben', listId: 'diy', price: _price(500));
    cubit = ListCubit(
      repo,
      cache,
      userId: 'peter',
      analytics: tracked,
      clock: () => _now,
    )..start();
    await settle();
  });

  tearDown(() => cubit.close());

  Item named(String name) =>
      cubit.state.allItems.values.firstWhere((i) => i.name == name);

  test('saving a price never ticks, and a tick needs no price', () async {
    final milk = named('Milch');
    cubit.setPrice(milk.id, price: _price(119));
    await settle();
    expect(repo.rows[milk.id]!.price, _price(119));
    expect(repo.rows[milk.id]!.status, ItemStatus.active);
    expect(named('Milch').status, ItemStatus.active);

    final bananas = named('Bananen');
    cubit.tick(bananas.id);
    await settle();
    expect(repo.rows[bananas.id]!.status, ItemStatus.bought);
    expect(repo.rows[bananas.id]!.price, isNull);

    // A bought item keeps its status when priced afterwards.
    cubit.setPrice(bananas.id, price: _price(199, per: PricePer.kg));
    await settle();
    expect(repo.rows[bananas.id]!.status, ItemStatus.bought);
    expect(repo.sent.whereType<SetPrice>(), hasLength(2));
  });

  test('undoing a delete brings the price back', () async {
    cubit.setPrice(named('Milch').id, price: _price(119));
    await settle();
    final milk = named('Milch');
    cubit.delete(milk.id);
    await settle();
    cubit.restore(milk);
    await settle();
    expect(repo.rows[milk.id]!.price, _price(119));
    expect(named('Milch').price, _price(119));
  });

  test('the scale weight replaces the planned one when the price is saved', () {
    final bananas = named('Bananen');
    cubit.setPrice(
      bananas.id,
      price: _price(199, per: PricePer.kg),
      quantity: const SetTo('1,24 kg'),
    );
    // Optimistic at once.
    expect(named('Bananen').quantity, '1,24 kg');
    expect(named('Bananen').lineCentsNow, 247);
  });

  test('clearing a price clears all five columns', () async {
    final milk = named('Milch');
    cubit.setPrice(milk.id, price: _price(119));
    await settle();
    cubit.setPrice(milk.id, price: null);
    await settle();
    expect(repo.rows[milk.id]!.price, isNull);
    expect(SetPrice(milk.id, price: null).toColumns(), Price.noColumns);
  });

  test('the total sums the shown list across stores, not other lists', () {
    cubit
      ..setPrice(named('Milch').id, price: _price(119))
      ..setPrice(named('Bananen').id, price: _price(199, per: PricePer.kg));
    final trip = cubit.trip;
    // 2 x 1,19 + 0,846 kg x 1,99.
    expect(trip.cents, 238 + 168);
    expect(trip.priced, 2);
    expect(trip.open, 0);
    expect(trip.byStore, {'lidl': 406});
    cubit.showList('diy');
    expect(cubit.trip.cents, 500);
  });

  test("a partner's price arrives live and moves the total", () {
    final milk = repo.rows.values.firstWhere((i) => i.name == 'Milch');
    repo.emitItem!(
      Item.fromJson({
        ...milk.copyWith(price: () => _price(129)).toJson(),
        'updated_at': DateTime.utc(2026, 11, 13, 17).toIso8601String(),
      }),
    );
    expect(named('Milch').price?.unitMicros, 129 * microsPerCent);
    expect(cubit.trip.cents, 258);
  });

  test(
    'the currency defaults to EUR, changes for the household, live',
    () async {
      expect(cubit.state.catalog.currency, 'EUR');
      expect(await cubit.setCurrency('CHF'), isTrue);
      expect(repo.catalogCalls, contains('setCurrency(CHF)'));
      expect(cubit.state.catalog.currency, 'CHF');
      // A price in euros no longer counts toward a total in francs.
      cubit.setPrice(named('Milch').id, price: _price(119));
      expect(cubit.trip.cents, 0);

      // Lea switches back on her phone.
      repo.currency = 'EUR';
      repo.emitCatalogChanged!();
      await Future<void>.value();
      await cubit.stream.firstWhere((s) => s.catalog.currency == 'EUR');
      expect(cubit.trip.cents, 238);
    },
  );

  List<Map<String, Object>> sent(String event) => [
    for (final (name, properties) in tracked.events)
      if (name == event) properties,
  ];

  test('price_entered says only that a price was typed, once per save', () {
    cubit
      ..setPrice(named('Milch').id, price: _price(119))
      ..setPrice(named('Milch').id, price: null);
    expect(sent('price_entered'), [
      {'confirmed': false},
    ]);
  });

  test('trip_total_viewed once per list and cubit, the running total', () {
    cubit
      ..totalViewed()
      ..totalViewed()
      ..showList('diy')
      ..totalViewed()
      ..totalViewed();
    expect(sent('trip_total_viewed'), [
      {'final': false},
      {'final': false},
    ]);
  });

  test('a queued price and the currency survive the device cache', () {
    final milk = named('Milch');
    final op = SetPrice(
      milk.id,
      price: _price(-25, per: PricePer.kg),
      quantity: const SetTo('1,5 kg'),
    );
    final snapshot = ListSnapshot(
      catalog: const Catalog().withCurrency('CHF'),
      server: [milk.copyWith(price: () => _price(119))],
      pending: [op, SetPrice(milk.id, price: null)],
    );
    final back = ListSnapshot.fromJson(
      jsonDecode(jsonEncode(snapshot.toJson())) as Map<String, Object?>,
    );
    expect(back.catalog.currency, 'CHF');
    expect(back.server.single.price, _price(119));
    final [a, b] = back.pending;
    expect(a, isA<SetPrice>());
    expect((a as SetPrice).price, op.price);
    expect(a.quantity, const SetTo<String?>('1,5 kg'));
    expect((b as SetPrice).price, isNull);
    expect(b.quantity, isNull);
  });

  test('a price on an add that turned out to be an open item moves to it', () {
    final op = SetPrice('copy', price: _price(119));
    final moved = op.ontoKept('copy', 'kept')! as SetPrice;
    expect(moved.itemId, 'kept');
    expect(moved.price, op.price);
  });

  test("an undone delete's price never lands on a partner's open twin", () {
    final op = SetPrice('copy', price: _price(119), restored: true);
    expect(op.ontoKept('copy', 'kept'), isNull);
    expect(ItemOp.fromJson(op.toJson()), isA<SetPrice>());
    expect((ItemOp.fromJson(op.toJson()) as SetPrice).restored, isTrue);
  });
}
