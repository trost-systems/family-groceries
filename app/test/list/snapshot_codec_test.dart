import 'dart:convert';

import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/snapshot_codec.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import '../hillclimb/snapshot_generator.dart';
import 'fixtures/list_snapshot_v3.dart';

void main() {
  const home = Household(id: 'home', name: 'Zuhause');
  late SharedPreferencesAsync prefs;
  late DeviceCache device;

  setUp(() async {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    prefs = SharedPreferencesAsync();
    device = DeviceCache(prefs);
    await device.remember('peter', home);
  });

  test(
    'a snapshot the JSON app wrote still loads, and saves compact',
    () async {
      const v3 = listSnapshotV3;
      await prefs.setString('list.peter.home', v3);
      final cache = device.list('peter', 'home');
      final loaded = await cache.load();
      expect(loaded?.toJson(), jsonDecode(v3));
      expect(loaded!.server, hasLength(40));
      expect(loaded.pending, hasLength(12));

      await cache.save(loaded);
      final stored = (await prefs.getString('list.peter.home'))!;
      expect(stored.length, lessThan(v3.length ~/ 3));
      expect((await cache.load())?.toJson(), jsonDecode(v3));
    },
  );

  test('every field survives, local times and odd sort keys too', () {
    final local = DateTime(2026, 11, 5, 21, 30, 15, 123, 456);
    final utc = DateTime.utc(2026, 11, 5, 20, 30, 15, 999, 1);
    Item item(String id, double? sortKey) => Item(
      id: id,
      name: 'Grüner Tee 🍵',
      status: ItemStatus.bought,
      createdAt: local,
      updatedAt: utc,
      boughtAt: DateTime.utc(1969, 7, 20, 20, 17),
      quantity: '',
      sortKey: sortKey,
    );
    final snapshot = ListSnapshot(
      catalog: const Catalog(
        categories: [Category(id: 'c', name: 'Tee', sortOrder: -3)],
        members: [Member(id: 'm', displayName: 'Lea')],
      ),
      server: [
        item('a', 0.1),
        item('b', -1536.5),
        item('c', 1e300),
        item('d', double.minPositive),
        item('e', double.parse('-0')),
        item('f', null),
        item('g', 4503599627370497),
        Item(
          id: 'same-utc',
          name: 'Brot',
          status: ItemStatus.bought,
          createdAt: utc,
          updatedAt: utc,
          boughtAt: utc,
        ),
        Item(
          id: 'far',
          name: 'Brot',
          status: ItemStatus.bought,
          createdAt: DateTime.utc(1850, 1, 2, 3, 4, 5, 6, 7),
          updatedAt: DateTime.utc(2200, 12, 31, 23, 59, 59, 999, 999),
          boughtAt: DateTime.utc(1922, 6, 2),
        ),
        Item(
          id: 'same-local',
          name: 'Brot',
          status: ItemStatus.bought,
          createdAt: local,
          updatedAt: local,
          boughtAt: local,
        ),
      ],
      pending: [
        SetStatus('a', ItemStatus.active, local),
        const EditItem(
          'a',
          ItemChanges(
            quantity: SetTo(null),
            properties: SetTo('bio'),
            storeId: SetTo(null),
          ),
        ),
        const PlaceItem(
          'b',
          anchorId: 'a',
          edge: Edge.before,
          categoryId: 'c',
          storeId: null,
          sortKey: null,
        ),
      ],
      usuals: [Usual(name: 'Tee', due: false, lastUsed: local)],
    );
    final back = decodeSnapshot(encodeSnapshot(snapshot));
    expect(jsonEncode(back.toJson()), jsonEncode(snapshot.toJson()));
    expect(back.server.first.createdAt.isUtc, isFalse);
    expect(back.server.first.updatedAt, utc);
    expect(
      [for (final i in back.server) i.sortKey],
      [for (final i in snapshot.server) i.sortKey],
    );
    expect(back.server[4].sortKey!.isNegative, isTrue, reason: '-0.0');
    for (final i in back.server.where((i) => i.id.startsWith('same'))) {
      expect([i.createdAt, i.updatedAt, i.boughtAt], everyElement(i.createdAt));
      expect(i.boughtAt!.isUtc, i.id == 'same-utc');
    }
  });

  test('the stored value is JSON with one element per row, op and usual', () {
    // e2e/tests/offline-start.spec.ts and suggestions.spec.ts count them.
    final s = generateSnapshot(seed: 4, items: 30, openShare: 0.5);
    final json = jsonDecode(encodeSnapshot(s)) as Map<String, Object?>;
    expect(json['version'], 4);
    expect((json['server']! as List).length, 30);
    expect((json['pending']! as List).length, s.pending.length);
    expect((json['usuals']! as List).length, s.usuals.length);
    final empty = jsonDecode(
      encodeSnapshot(
        const ListSnapshot(catalog: Catalog(), server: [], pending: []),
      ),
    ) as Map<String, Object?>;
    expect([
      empty['server'],
      empty['pending'],
      empty['usuals'],
    ], everyElement(isEmpty));
  });

  test('the bench snapshots round-trip', () {
    for (final s in [
      generateSnapshot(seed: 1, items: 500, openShare: 0.1),
      generateSnapshot(seed: 2, items: 50, openShare: 1),
    ]) {
      expect(
        jsonEncode(decodeSnapshot(encodeSnapshot(s)).toJson()),
        jsonEncode(s.toJson()),
      );
    }
  });

  test(
    'an unreadable or newer snapshot is refused and loads as none',
    () async {
      final good = encodeSnapshot(
        generateSnapshot(seed: 3, items: 5, openShare: 1),
      );
      for (final stored in [
        'b4:!!!',
        good.replaceFirst('"version":4', '"version":5'),
        good.replaceFirst('","server":["', '","server":"'),
        good.substring(0, good.length - 4),
        '${good}x',
        'x',
      ]) {
        expect(() => decodeSnapshot(stored), throwsA(anything), reason: stored);
        await prefs.setString('list.peter.home', stored);
        expect(await device.list('peter', 'home').load(), isNull);
      }
    },
  );
}
