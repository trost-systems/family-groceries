import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

/// A device cache that answers only once [gate] completes, with what it
/// holds then, as a slow disk read does.
class _SlowCache() extends MemoryListCache {
  final gate = Completer<void>();

  @override
  Future<ListSnapshot?> load() async {
    await gate.future;
    return saved;
  }

  @override
  Future<SeenMark?> loadSeen() async {
    await gate.future;
    return seen;
  }
}

/// Counts the realtime unsubscribes the list makes.
class _CountingRepository() extends FakeRepository {
  var unsubscribes = 0;

  @override
  Future<void> Function() watch({
    required void Function(Item item) onItem,
    required void Function(String id, DateTime at) onItemDeleted,
    required void Function() onCatalogChanged,
    required void Function(ConnectionStatus status) onStatus,
  }) {
    final unwatch = super.watch(
      onItem: onItem,
      onItemDeleted: onItemDeleted,
      onCatalogChanged: onCatalogChanged,
      onStatus: onStatus,
    );
    return () {
      unsubscribes++;
      return unwatch();
    };
  }
}

/// Records what the list tracks, with its properties.
class _Tracked() implements Analytics {
  final events = <(String, Map<String, Object>)>[];

  @override
  void track(String event, [Map<String, Object> properties = const {}]) =>
      events.add((event, properties));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  Future<void> settle() => pumpEventQueue();

  /// The fake server's clock before its first write.
  final serverStart = DateTime.utc(2026, 10, 22, 12);

  group('the device cache before the server', () {
    test('an add made before the device cache answers keeps the cached '
        'list', () async {
      final milk = Item(
        id: 'milk',
        name: 'Milch',
        status: ItemStatus.active,
        createdAt: serverStart,
        updatedAt: serverStart,
      );
      final cache = _SlowCache()
        ..saved = ListSnapshot(
          catalog: const Catalog(),
          server: [milk],
          pending: const [],
        );
      final repo = FakeRepository()..online = false;
      final cubit = ListCubit(repo, cache, userId: 'peter')..start();
      addTearDown(cubit.close);

      cubit.addEntry(const Entry('Brot', null));
      await settle();
      cache.gate.complete();
      await settle();

      expect(
        cubit.state.items.values.map((i) => i.name),
        unorderedEquals(['Milch', 'Brot']),
      );
      expect(cache.saved?.server.map((i) => i.id), ['milk']);
      expect(cache.saved?.pending, hasLength(1));
    });

    test('a resync that answers before the device cache keeps the cached '
        'seen mark', () async {
      final repo = FakeRepository();
      final bread = repo.remoteAdd('Brot');
      final cache = _SlowCache()..seen = SeenMark(until: serverStart);
      final cubit = ListCubit(repo, cache, userId: 'peter')..start();
      addTearDown(cubit.close);

      await cubit.resync();
      cache.gate.complete();
      await settle();

      expect(cubit.fresh, {bread.id});
      expect(cache.seen?.until, serverStart);
    });

    test("a seen mark from the device cache keeps the partner's newer items "
        'fresh after a restart', () async {
      final repo = FakeRepository();
      final bread = repo.remoteAdd('Brot');
      final cache = MemoryListCache()..seen = SeenMark(until: serverStart);
      final cubit = ListCubit(repo, cache, userId: 'peter')..start();
      addTearDown(cubit.close);
      await settle();

      expect(cubit.fresh, {bread.id});
    });
  });

  test('the list loads once the server is back, three seconds after a '
      'failed resync', () {
    fakeAsync((async) {
      final repo = FakeRepository()..online = false;
      final milk = repo.remoteAdd('Milch');
      final cubit = ListCubit(repo, MemoryListCache(), userId: 'peter')
        ..start();
      async.flushMicrotasks();
      expect(cubit.state.loaded, isFalse);
      expect(cubit.state.connection, ConnectionStatus.offline);

      repo.online = true;
      async
        ..elapse(const Duration(seconds: 3))
        ..flushMicrotasks();

      expect(cubit.state.loaded, isTrue);
      expect(cubit.state.items.keys, [milk.id]);
      unawaited(cubit.close());
      async.flushMicrotasks();
    });
  });

  test('usuals refreshed after a partner change are saved to the device '
      'cache', () {
    fakeAsync((async) {
      final repo = FakeRepository();
      final cache = MemoryListCache();
      final cubit = ListCubit(repo, cache, userId: 'peter')..start();
      async
        ..elapse(const Duration(seconds: 1))
        ..flushMicrotasks();
      expect(cache.saved?.usuals, isEmpty);

      const eggs = Usual(name: 'Eier', due: true);
      repo.usuals = [eggs];
      repo.emitItem!(repo.remoteAdd('Brot'));
      async
        ..elapse(const Duration(seconds: 5))
        ..flushMicrotasks();

      expect(cache.saved?.usuals.map((u) => u.name), ['Eier']);
      unawaited(cubit.close());
      async.flushMicrotasks();
    });
  });

  test('a channel closing while the list closes is not subscribed or '
      'unsubscribed again', () {
    fakeAsync((async) {
      final repo = _CountingRepository();
      final cubit = ListCubit(repo, MemoryListCache(), userId: 'peter')
        ..start();
      async.flushMicrotasks();
      repo.emitStatus!(ConnectionStatus.online);
      async.flushMicrotasks();

      final unsubscribed = Completer<void>();
      repo.unwatchGates.add(unsubscribed);
      final closing = cubit.close();
      async.flushMicrotasks();
      repo.emitStatus!(ConnectionStatus.offline);
      unsubscribed.complete();
      async.flushMicrotasks();
      unawaited(closing);
      async
        ..elapse(const Duration(minutes: 1))
        ..flushMicrotasks();

      expect(repo.unsubscribes, 1);
      expect(repo.watches, 1);
    });
  });

  test('a tick reports household sizes up to 100 and none above', () async {
    Future<Map<String, Object>> tickProperties(int members) async {
      final tracked = _Tracked();
      final repo = FakeRepository()
        ..members = [
          for (var i = 0; i < members; i++)
            Member(id: 'm$i', displayName: 'M$i'),
        ];
      final milk = repo.remoteAdd('Milch');
      final cubit = ListCubit(
        repo,
        MemoryListCache(),
        userId: 'peter',
        analytics: tracked,
      )..start();
      addTearDown(cubit.close);
      await settle();
      cubit.tick(milk.id);
      return tracked.events.singleWhere((e) => e.$1 == 'item_ticked').$2;
    }

    expect(await tickProperties(100), {'household_size': 100});
    expect(await tickProperties(101), isEmpty);
  });

  group('catalog order', () {
    const catalog = Catalog(
      categories: [
        Category(id: 'produce', name: 'Obst & Gemüse', sortOrder: 10),
        Category(id: 'chilled', name: 'Kühlregal', sortOrder: 20),
        Category(id: 'other', name: 'Sonstiges', sortOrder: 30),
      ],
      layout: [
        StoreCategory(
          storeId: 'lidl',
          categoryId: 'chilled',
          sortOrder: 10,
          hidden: true,
        ),
      ],
    );

    test('a new route order numbers the categories 10, 20, 30 as '
        'reorder_categories does', () {
      final reordered = catalog.withRouteOrder(['other', 'produce', 'chilled']);

      expect(
        [for (final c in reordered.categories) (c.id, c.sortOrder)],
        [('other', 10), ('produce', 20), ('chilled', 30)],
      );
    });

    test('with no store every category is a stop and none is hidden, even '
        'one a store hides', () {
      final stops = walkingOrder(catalog, null);

      expect(
        [for (final s in stops) (s.category.id, s.hidden)],
        [('produce', false), ('chilled', false), ('other', false)],
      );
    });
  });
}
