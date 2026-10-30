import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/model.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum ConnectionStatus() {
  connecting,
  online,
  offline,
}

/// The list's only door to the backend. Errors from [send] other than a
/// [RejectedOp] are treated as transient and retried.
abstract interface class ListRepository() {
  Future<Catalog> fetchCatalog();

  /// Active items plus the most recently bought ones.
  Future<List<Item>> fetchItems();

  /// What the household buys again and again, best first, without what is
  /// on the list now.
  Future<List<Usual>> fetchUsuals();

  /// Applies [op] on the server and returns the resulting row, or null when
  /// the item no longer exists.
  Future<Item?> send(ItemOp op);

  Future<void> renameCategory(String id, String name);

  /// Appends the category to the route and to every store layout.
  Future<void> createCategory(String name);

  /// [ids] is every category, in the new route order.
  Future<void> reorderCategories(List<String> ids);

  /// [ids] is every store, in the new order.
  Future<void> reorderStores(List<String> ids);

  /// Splits one typed entry into its fields with the server's parser.
  /// Throws when the server can't be reached.
  Future<ParsedEntry> parse(String text);

  /// The add sheet's rows for one typed entry, the parsed entry first
  /// (`public.suggest_entries`). Throws when the server can't be reached.
  Future<List<Suggestion>> suggest(String text);

  /// Moves the category's items to [reassignTo], by default the fallback.
  Future<void> deleteCategory(String id, {String? reassignTo});

  /// [orderedIds] is every category in the store's walking order.
  Future<void> setStoreLayout(
    String storeId,
    List<String> orderedIds,
    Set<String> hiddenIds,
  );

  /// Splits a dictated sentence into entries with the server's German
  /// splitter (the voice endpoint Siri uses); empty when it found nothing.
  Future<List<Entry>> splitSpoken(String text);

  /// Live changes for the household; returns a function that unsubscribes.
  Future<void> Function() watch({
    required void Function(Item item) onItem,
    required void Function(String id) onItemDeleted,
    required void Function() onCatalogChanged,
    required void Function(ConnectionStatus status) onStatus,
  });
}

/// The server refused a write (constraint, policy); retrying will not help.
final class const RejectedOp(
  final String message, {

  /// A category or store with that name already exists.
  final bool nameTaken = false,
}) implements Exception {
  @override
  String toString() => 'RejectedOp($message)';
}

/// Runs a write; a PostgREST answer means the database refused it, except a
/// JWT error (PGRST3xx): the token lapsed in flight, and a retry refreshes it.
Future<T> _refusable<T>(Future<T> Function() write) async {
  try {
    return await write();
  } on PostgrestException catch (e) {
    if (e.code?.startsWith('PGRST3') ?? false) {
      rethrow;
    }
    throw RejectedOp(e.message, nameTaken: e.code == '23505');
  }
}

class SupabaseListRepository(
  final SupabaseClient _client,
  final String householdId,
) implements ListRepository {
  static const _itemColumns =
      'id, name, quantity, brand, properties, category_id, store_id, '
      'sort_key, status, created_at, updated_at, bought_at, added_by';

  @override
  Future<Catalog> fetchCatalog() async {
    final (categories, stores, layout, memberIds, profiles) = await (
      _client.rest
          .from('categories')
          .select('id, name, sort_order, seed_key')
          .eq('household_id', householdId)
          .order('sort_order', ascending: true),
      _client.rest
          .from('stores')
          .select('id, name, sort_order, seed_key')
          .eq('household_id', householdId)
          .order('sort_order', ascending: true),
      _client.rest
          .from('store_category_order')
          .select('store_id, category_id, sort_order, hidden')
          .eq('household_id', householdId),
      _client.rest
          .from('household_members')
          .select('user_id, role')
          .eq('household_id', householdId),
      // No foreign key to join on; RLS returns everyone the user shares a
      // household with, and the member ids pick this one's.
      _client.rest.from('profiles').select('id, display_name'),
    ).wait;
    final roles = {
      for (final row in memberIds)
        row['user_id']! as String: row['role'] as String?,
    };
    return Catalog(
      categories: categories.map(Category.fromJson).toList(),
      stores: stores.map(Store.fromJson).toList(),
      layout: layout.map(StoreCategory.fromJson).toList(),
      members: [
        for (final member in profiles.map(Member.fromJson))
          if (roles.containsKey(member.id))
            Member(
              id: member.id,
              displayName: member.displayName,
              role: roles[member.id],
            ),
      ],
    );
  }

  @override
  Future<void> renameCategory(String id, String name) => _refusable(
    () => _client.rest.from('categories').update({'name': name}).eq('id', id),
  );

  @override
  Future<void> createCategory(String name) => _refusable(
    () => _client.rpc<void>(
      'create_category',
      params: {'p_household': householdId, 'p_name': name},
    ),
  );

  @override
  Future<void> reorderCategories(List<String> ids) => _refusable(
    () => _client.rpc<void>(
      'reorder_categories',
      params: {'p_household': householdId, 'p_ids': ids},
    ),
  );

  @override
  Future<void> reorderStores(List<String> ids) => _refusable(
    () => _client.rpc<void>(
      'reorder_stores',
      params: {'p_household': householdId, 'p_ids': ids},
    ),
  );

  @override
  Future<ParsedEntry> parse(String text) async {
    final Object? result = await _client.rpc<dynamic>(
      'parse_item',
      params: {'p_household': householdId, 'p_text': text},
    );
    return ParsedEntry.fromJson(_singleRow(result)!);
  }

  @override
  Future<List<Suggestion>> suggest(String text) async {
    final rows = await _client.rpc<List<dynamic>>(
      'suggest_entries',
      params: {'p_household': householdId, 'p_text': text},
    );
    return [
      for (final row in rows) Suggestion.fromJson(row as Map<String, Object?>),
    ];
  }

  @override
  Future<void> deleteCategory(String id, {String? reassignTo}) => _refusable(
    () => _client.rpc<void>(
      'delete_category',
      params: {'p_category': id, 'p_reassign_to': reassignTo},
    ),
  );

  @override
  Future<void> setStoreLayout(
    String storeId,
    List<String> orderedIds,
    Set<String> hiddenIds,
  ) => _refusable(
    () => _client.rpc<void>(
      'set_store_layout',
      params: {
        'p_store': storeId,
        'p_categories': orderedIds,
        'p_hidden': hiddenIds.toList(),
      },
    ),
  );

  @override
  Future<List<Item>> fetchItems() async {
    final results = await Future.wait([
      _client.rest
          .from('items')
          .select(_itemColumns)
          .eq('household_id', householdId)
          .eq('status', 'active'),
      _client.rest
          .from('items')
          .select(_itemColumns)
          .eq('household_id', householdId)
          .eq('status', 'bought')
          .order('bought_at', ascending: false)
          .limit(50),
    ]);
    return [for (final rows in results) ...rows.map(Item.fromJson)];
  }

  @override
  Future<List<Usual>> fetchUsuals() async {
    final rows = await _client.rpc<List<dynamic>>(
      'suggest_items',
      params: {'p_household': householdId, 'p_prefix': '', 'p_limit': 200},
    );
    return [
      for (final row in rows) Usual.fromJson(row as Map<String, Object?>),
    ];
  }

  @override
  Future<Item?> send(ItemOp op) => _refusable(() async {
    final items = _client.rest.from('items');
    final List<Map<String, dynamic>> rows;
    switch (op) {
      case AddItem(:final item):
        rows = await items
            .upsert({
              'id': item.id,
              'household_id': householdId,
              'name': item.name,
              'quantity': item.quantity,
              'brand': ?item.brand,
              'properties': ?item.properties,
              'category_id': ?item.categoryId,
              // None given: the server fills in the remembered store.
              'store_id': ?item.storeId,
              // A restored item keeps its place.
              'sort_key': ?item.sortKey,
              'status': item.status.name,
            }, ignoreDuplicates: true)
            .select(_itemColumns);
      case SetStatus(:final status, :final storeId):
        rows = await items
            .update({'status': status.name, 'store_id': ?storeId})
            .eq('id', op.itemId)
            .select(_itemColumns);
      case EditItem(:final changes):
        rows = await items
            .update(changes.toColumns())
            .eq('id', op.itemId)
            .select(_itemColumns);
      case MoveItem(:final categoryId, :final storeId):
        return await _rpcItem(op, 'move_item', {
          'p_item': op.itemId,
          'p_store': storeId,
          'p_category': categoryId,
        });
      case PlaceItem(:final anchorId, :final edge):
        return await _rpcItem(op, 'place_item', {
          'p_item': op.itemId,
          'p_anchor': anchorId,
          'p_edge': edge.name,
        });
      case DeleteItem():
        await items.delete().eq('id', op.itemId).select('id');
        return null;
    }
    // No row back: the item is gone, or an upsert hit an existing id.
    return rows.isEmpty
        ? await _fetchItem(op.itemId)
        : Item.fromJson(rows.single);
  });

  /// An RPC that returns the item's row. `P0002`: the item or the anchor is
  /// gone; the item's current row (or null) acknowledges the op.
  Future<Item?> _rpcItem(
    ItemOp op,
    String function,
    Map<String, Object?> params,
  ) async {
    try {
      final Object? result = await _client.rpc<dynamic>(
        function,
        params: params,
      );
      final row = _singleRow(result);
      return row == null ? await _fetchItem(op.itemId) : Item.fromJson(row);
    } on PostgrestException catch (e) {
      if (e.code == 'P0002') {
        return await _fetchItem(op.itemId);
      }
      rethrow;
    }
  }

  /// A function returning one row answers with an object, a set-returning
  /// one with a list.
  static Map<String, Object?>? _singleRow(Object? result) => switch (result) {
    final Map<String, Object?> row => row,
    [final Map<String, Object?> row, ...] => row,
    _ => null,
  };

  @override
  Future<List<Entry>> splitSpoken(String text) async {
    try {
      final response = await _client.functions.invoke(
        'voice',
        body: {'text': text, 'mode': 'parse'},
      );
      final items = switch (response.data) {
        {'items': final List<Object?> items} => items,
        _ => const <Object?>[],
      };
      return [
        for (final item in items)
          if (item case {
            'name': final String name,
            'quantity': final String? quantity,
          })
            Entry(name, quantity),
      ];
    } on FunctionException catch (e) {
      if (e.status == 422) {
        return const [];
      }
      rethrow;
    }
  }

  Future<Item?> _fetchItem(String id) async {
    final row = await _client.rest
        .from('items')
        .select(_itemColumns)
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : Item.fromJson(row);
  }

  @override
  Future<void> Function() watch({
    required void Function(Item item) onItem,
    required void Function(String id) onItemDeleted,
    required void Function() onCatalogChanged,
    required void Function(ConnectionStatus status) onStatus,
  }) {
    final mine = PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'household_id',
      value: householdId,
    );
    final channel = _client.channel('household:$householdId');
    for (final table in ['categories', 'stores', 'store_category_order']) {
      for (final event in [
        PostgresChangeEvent.insert,
        PostgresChangeEvent.update,
      ]) {
        channel.onPostgresChanges(
          event: event,
          schema: 'public',
          table: table,
          filter: mine,
          callback: (_) => onCatalogChanged(),
        );
      }
      // Delete events cannot be filtered; another household's only costs a
      // reload.
      channel.onPostgresChanges(
        event: PostgresChangeEvent.delete,
        schema: 'public',
        table: table,
        callback: (_) => onCatalogChanged(),
      );
    }
    channel
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'items',
          filter: mine,
          callback: (p) => onItem(Item.fromJson(p.newRecord)),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'items',
          filter: mine,
          callback: (p) => onItem(Item.fromJson(p.newRecord)),
        )
        // Delete events cannot be filtered; unknown ids are ignored.
        .onPostgresChanges(
          event: PostgresChangeEvent.delete,
          schema: 'public',
          table: 'items',
          callback: (p) => switch (p.oldRecord['id']) {
            final String id => onItemDeleted(id),
            _ => null,
          },
        )
        // The join is confirmed before the server's Postgres listener runs;
        // "Subscribed to PostgreSQL" says it does, and a resync then picks up
        // what changed in between. Errors arrive as channelError below.
        .onSystemEvents((payload) {
          final Object? system = payload;
          if (system case {'extension': 'postgres_changes', 'status': 'ok'}) {
            onStatus(ConnectionStatus.online);
          }
        })
        .subscribe(
          (status, _) => onStatus(switch (status) {
            RealtimeSubscribeStatus.subscribed => ConnectionStatus.online,
            RealtimeSubscribeStatus.channelError ||
            RealtimeSubscribeStatus.timedOut ||
            RealtimeSubscribeStatus.closed => ConnectionStatus.offline,
          }),
        );
    return () async {
      await _client.removeChannel(channel);
    };
  }
}
