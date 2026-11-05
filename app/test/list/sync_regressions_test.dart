import 'dart:async';

import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

/// Bugs the sync fuzz harness (test/fuzz, docs/hillclimb/hc-sync.md) found,
/// one test each, named after the seed that found it.
void main() {
  late FakeRepository repo;
  late ListCubit cubit;

  Future<void> settle() => pumpEventQueue();

  /// [item] as a later commit leaves it.
  Item later(Item item, {ItemStatus? status, String? name}) => Item.fromJson({
    ...item.toJson(),
    'status': (status ?? item.status).name,
    'name': name ?? item.name,
    'updated_at': item.updatedAt
        .add(const Duration(seconds: 5))
        .toIso8601String(),
  });

  setUp(() async {
    repo = FakeRepository();
    cubit = ListCubit(repo, MemoryListCache(), userId: 'peter')..start();
    await settle();
  });

  tearDown(() => cubit.close());

  /// A resync whose items were read now and whose answer waits for [gate].
  Future<void> slowResync(Completer<void> gate) {
    repo.catalogGate = gate;
    return cubit.resync();
  }

  test('seed 59: a realtime row heard during a resync beats the older '
      'snapshot', () async {
    final milk = repo.remoteAdd('Milch');
    await cubit.resync();
    final gate = Completer<void>();
    final resync = slowResync(gate);
    await settle();

    final ticked = later(milk, status: ItemStatus.bought);
    repo.rows[milk.id] = ticked;
    repo.emitItem!(ticked);
    gate.complete();
    await resync;

    expect(cubit.state.items[milk.id]?.status, ItemStatus.bought);
  });

  test('seed 59: a realtime delete heard during a resync beats the '
      'snapshot', () async {
    final milk = repo.remoteAdd('Milch');
    await cubit.resync();
    final gate = Completer<void>();
    final resync = slowResync(gate);
    await settle();

    repo.rows.remove(milk.id);
    repo.emitDelete!(milk.id);
    gate.complete();
    await resync;

    expect(cubit.state.items, isNot(contains(milk.id)));
  });

  test('seed 59: an older realtime row heard during a resync does not beat '
      'the snapshot', () async {
    final milk = repo.remoteAdd('Milch');
    await cubit.resync();
    final renamed = later(milk, name: 'Hafermilch');
    repo.rows[milk.id] = renamed;
    final gate = Completer<void>();
    final resync = slowResync(gate);
    await settle();

    repo.emitItem!(milk);
    gate.complete();
    await resync;

    expect(cubit.state.items[milk.id]?.name, 'Hafermilch');
  });

  test('seed 961: an older resync that answers last does not undo a newer '
      'one', () async {
    final bread = repo.remoteAdd('Brot', quantity: '3 Stück');
    await cubit.resync();
    final (older, newer) = (Completer<void>(), Completer<void>());
    repo.catalogGate = older;
    final first = cubit.resync();
    repo.rows[bread.id] = Item.fromJson({
      ...later(bread).toJson(),
      'quantity': '2',
    });
    repo.catalogGate = newer;
    final second = cubit.resync();
    newer.complete();
    await second;
    older.complete();
    await first;

    expect(cubit.state.items[bread.id]?.quantity, '2');
  });

  test('seed 961: a late answer from before a realtime delete does not bring '
      'the item back', () async {
    final bread = repo.remoteAdd('Brot');
    await cubit.resync();
    repo.gate = Completer();
    cubit.tick(bread.id);
    await settle();

    final ticked = Item.fromJson({
      ...bread.toJson(),
      'status': 'bought',
      'updated_at': bread.updatedAt
          .add(const Duration(hours: 1))
          .toIso8601String(),
    });
    repo.emitItem!(ticked);
    repo.emitDelete!(bread.id);
    repo.gate!.complete();
    await settle();

    expect(cubit.state.pending, isEmpty);
    expect(cubit.state.items, isNot(contains(bread.id)));
  });

  test('seed 961: an item deleted and then restored by a partner comes '
      'back', () async {
    final bread = repo.remoteAdd('Brot');
    await cubit.resync();
    repo.emitDelete!(bread.id);
    final restored = later(bread);
    repo.emitItem!(restored);
    await settle();

    expect(cubit.state.items[bread.id]?.updatedAt, restored.updatedAt);
  });

  test('seed 2940: an answer heard during a resync does not bring back an '
      'item the snapshot no longer has', () async {
    final slow = _SlowAnswers();
    await cubit.close();
    repo = slow;
    cubit = ListCubit(slow, MemoryListCache(), userId: 'peter')..start();
    await settle();
    final milk = slow.remoteAdd('Milch');
    await cubit.resync();

    slow.answerGate = Completer();
    cubit.edit(milk.id, const ItemChanges(quantity: SetTo('2')));
    await settle();
    slow.rows.remove(milk.id);
    final gate = Completer<void>();
    final resync = slowResync(gate);
    slow.answerGate!.complete();
    await settle();
    gate.complete();
    await resync;
    await settle();

    expect(cubit.state.pending, isEmpty);
    expect(cubit.state.items, isNot(contains(milk.id)));
  });

  test('seed 11580: an add made offline before the first load survives a '
      'restart', () async {
    await cubit.close();
    final cache = MemoryListCache();
    repo = FakeRepository()..online = false;
    cubit = ListCubit(repo, cache, userId: 'peter')..start();
    await settle();
    expect(cubit.state.loaded, isFalse);

    cubit.addEntry(const Entry('Milch', null));
    await settle();
    await cubit.close();
    cubit = ListCubit(repo, cache, userId: 'peter')..start();
    await settle();

    expect(
      [
        for (final op in cubit.state.pending)
          if (op case AddItem(:final item)) item.name,
      ],
      ['Milch'],
    );
  });

  test('seed 12133: a "gone" answer does not remove an item restored over '
      'realtime while the op was in flight', () async {
    final slow = _SlowAnswers();
    await cubit.close();
    repo = slow;
    cubit = ListCubit(slow, MemoryListCache(), userId: 'peter')..start();
    await settle();
    final eggs = slow.remoteAdd('Eier');
    await cubit.resync();

    slow
      ..rows.remove(eggs.id)
      ..answerGate = Completer();
    cubit.edit(eggs.id, const ItemChanges(storeId: SetTo('lidl')));
    await settle();
    final restored = later(eggs);
    slow
      ..rows[eggs.id] = restored
      ..emitItem!(restored);
    slow.answerGate!.complete();
    await settle();

    expect(cubit.state.pending, isEmpty);
    expect(cubit.state.items[eggs.id]?.updatedAt, restored.updatedAt);
  });

  test('seed 43676: a late answer from before a realtime delete stays out '
      'even when realtime never brought its row', () async {
    final slow = _SlowAnswers();
    await cubit.close();
    repo = slow;
    cubit = ListCubit(slow, MemoryListCache(), userId: 'peter')..start();
    await settle();
    final cheese = slow.remoteAdd('Käse');
    await cubit.resync();

    slow.answerGate = Completer();
    cubit.tick(cheese.id);
    await settle();
    slow.emitDelete!(cheese.id);
    slow.answerGate!.complete();
    await settle();

    expect(cubit.state.pending, isEmpty);
    expect(cubit.state.items, isNot(contains(cheese.id)));
  });

  test('seed 43676: an answer after a snapshot without the item does not '
      'bring it back', () async {
    final slow = _SlowAnswers();
    await cubit.close();
    repo = slow;
    cubit = ListCubit(slow, MemoryListCache(), userId: 'peter')..start();
    await settle();
    final cheese = slow.remoteAdd('Käse');
    await cubit.resync();

    slow.answerGate = Completer();
    cubit.tick(cheese.id);
    await settle();
    slow.rows.remove(cheese.id);
    await cubit.resync();
    slow.answerGate!.complete();
    await settle();

    expect(cubit.state.pending, isEmpty);
    expect(cubit.state.items, isNot(contains(cheese.id)));
  });
}

/// Applies each op at once and holds its answer until [answerGate] opens.
class _SlowAnswers() extends FakeRepository {
  Completer<void>? answerGate;

  @override
  Future<Map<String, Item?>> send(ItemOp op) async {
    final rows = await super.send(op);
    await answerGate?.future;
    return rows;
  }
}
