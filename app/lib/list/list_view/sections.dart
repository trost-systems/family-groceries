import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/foundation.dart' show immutable;

/// One category's active items inside a section, in walk order. A null
/// category holds items still being classified, or whose category is gone.
@immutable
class const CategoryBlock(final Category? category, final List<Item> items);

/// A store and its items, one block per category in the store's walking
/// order. A null [store] is the section for items without a store, in route
/// order.
@immutable
class const StoreSection({
  required final Store? store,
  required final List<CategoryBlock> blocks,
}) {
  /// The section's key in [ListPrefs.folded].
  String get key => store?.id ?? noStoreKey;

  int get count => blocks.fold(0, (n, block) => n + block.items.length);
}

/// Every store in household order, then the section without a store. A
/// category is one block per section, never repeated; empty ones are left
/// out. Unclassified items come first, items of unknown categories last.
List<StoreSection> sectionsOf(Iterable<Item> items, Catalog catalog) {
  final byStore = <String?, List<Item>>{};
  final storeIds = {for (final s in catalog.stores) s.id};
  for (final item in items) {
    if (item.status != ItemStatus.active) {
      continue;
    }
    // An item of a deleted store shows without one until the server says so.
    final storeId = storeIds.contains(item.storeId) ? item.storeId : null;
    byStore.putIfAbsent(storeId, () => []).add(item);
  }
  final stores = [...catalog.stores]
    ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  return [
    for (final store in stores)
      StoreSection(
        store: store,
        blocks: _blocks(byStore[store.id] ?? const [], catalog, store.id),
      ),
    StoreSection(
      store: null,
      blocks: _blocks(byStore[null] ?? const [], catalog, null),
    ),
  ];
}

List<CategoryBlock> _blocks(
  List<Item> items,
  Catalog catalog,
  String? storeId,
) {
  final byCategory = <String?, List<Item>>{};
  for (final item in items) {
    byCategory.putIfAbsent(item.categoryId, () => []).add(item);
  }
  for (final list in byCategory.values) {
    list.sort(compareWalk);
  }
  final stops = walkingOrder(catalog, storeId);
  final known = {for (final stop in stops) stop.category.id};
  final orphans = [
    for (final MapEntry(:key, :value) in byCategory.entries)
      if (key != null && !known.contains(key)) ...value,
  ]..sort(compareWalk);
  return [
    if (byCategory[null] case final pending?) CategoryBlock(null, pending),
    for (final (:category, hidden: _) in stops)
      if (byCategory[category.id] case final list?)
        CategoryBlock(category, list),
    if (orphans.isNotEmpty) CategoryBlock(null, orphans),
  ];
}

/// [sections] cut into at most [count] columns, each a run of whole sections
/// in order, so that the tallest column (by [weight]) is as short as it can
/// be.
List<List<StoreSection>> columnsOf(
  List<StoreSection> sections,
  int count,
  double Function(StoreSection section) weight,
) {
  final n = sections.length;
  final k = count.clamp(1, n == 0 ? 1 : n);
  if (k == 1) {
    return [
      [...sections],
    ];
  }
  final prefix = [0.0];
  for (final section in sections) {
    prefix.add(prefix.last + weight(section));
  }
  double run(int from, int to) => prefix[to] - prefix[from];
  // best[j][i]: the tallest column when the first i sections fill j columns;
  // cut[j][i]: where the last of those columns starts.
  final best = List.generate(k + 1, (_) => List.filled(n + 1, double.infinity));
  final cut = List.generate(k + 1, (_) => List.filled(n + 1, 0));
  best[0][0] = 0;
  for (var j = 1; j <= k; j++) {
    for (var i = 1; i <= n; i++) {
      for (var start = j - 1; start < i; start++) {
        final tallest = best[j - 1][start] > run(start, i)
            ? best[j - 1][start]
            : run(start, i);
        if (tallest < best[j][i]) {
          best[j][i] = tallest;
          cut[j][i] = start;
        }
      }
    }
  }
  final columns = <List<StoreSection>>[];
  var end = n;
  for (var j = k; j >= 1; j--) {
    final start = cut[j][end];
    columns.insert(0, sections.sublist(start, end));
    end = start;
  }
  return columns;
}

/// Which half of a [height] tall row the pointer at [y] is in.
Edge edgeAt(double y, double height) =>
    y < height / 2 ? Edge.before : Edge.after;

/// [ids] with [moved] taken out and put [edge] of [target]. Unchanged when
/// either is missing or they are the same.
List<String> reordered(
  List<String> ids,
  String moved,
  String target,
  Edge edge,
) {
  if (moved == target || !ids.contains(moved) || !ids.contains(target)) {
    return ids;
  }
  final next = [...ids]..remove(moved);
  final at = next.indexOf(target) + (edge == Edge.after ? 1 : 0);
  return next..insert(at, moved);
}

/// What dropping a dragged item does.
sealed class const ItemDrop();

/// Directly [edge] of [anchorId], in the anchor's store and category.
final class const PlaceDrop(final String anchorId, final Edge edge)
    extends ItemDrop;

/// To the end of category [categoryId] in [storeId] (null: no store).
final class const MoveDrop({
  required final String? storeId,
  required final String categoryId,
}) extends ItemDrop;

/// Dropping [item] [edge] of [anchor], whose block is [block]; null when the
/// item would stay where it is.
ItemDrop? dropOnRow(Item item, Item anchor, Edge edge, List<Item> block) {
  if (item.id == anchor.id) {
    return null;
  }
  final sameGroup =
      item.storeId == anchor.storeId && item.categoryId == anchor.categoryId;
  if (sameGroup) {
    final from = block.indexWhere((i) => i.id == item.id);
    final to = block.indexWhere((i) => i.id == anchor.id);
    if (from >= 0 && to >= 0 && from == to + (edge == Edge.before ? -1 : 1)) {
      return null;
    }
  }
  return PlaceDrop(anchor.id, edge);
}

/// Dropping [item] on the divider of [categoryId] in [storeId], whose block
/// is [block]: to the end of it; null when it is last there already.
ItemDrop? dropOnCategory(
  Item item,
  String? storeId,
  String categoryId,
  List<Item> block,
) {
  if (item.storeId == storeId &&
      item.categoryId == categoryId &&
      block.lastOrNull?.id == item.id) {
    return null;
  }
  return MoveDrop(storeId: storeId, categoryId: categoryId);
}

/// Dropping [item] on the divider of [storeId] (folded or not): it keeps its
/// category and goes to the end of that category in the store, which every
/// store has (a store walks the categories it has no layout row for in route
/// order). Null when it is in that store already or still unclassified.
ItemDrop? dropOnStore(Item item, String? storeId) {
  final categoryId = item.categoryId;
  if (categoryId == null || item.storeId == storeId) {
    return null;
  }
  return MoveDrop(storeId: storeId, categoryId: categoryId);
}
