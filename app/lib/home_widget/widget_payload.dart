import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_view/sections.dart';
import 'package:flutter/foundation.dart' show immutable;

/// How many open items the widgets get; the medium size shows five.
const widgetItemCount = 6;

/// What the Home Screen widgets show (docs/HOME_WIDGETS.md, "The payload").
sealed class const WidgetPayload() {
  static const version = 1;

  /// The payload as the widgets read it; [updatedAt] only for [ReadyPayload].
  Map<String, Object?> toJson(DateTime updatedAt);
}

final class const SignedOutPayload() extends WidgetPayload {
  @override
  Map<String, Object?> toJson(DateTime updatedAt) => const {
    'version': WidgetPayload.version,
    'state': 'signedOut',
  };
}

final class const NoHouseholdPayload() extends WidgetPayload {
  @override
  Map<String, Object?> toJson(DateTime updatedAt) => const {
    'version': WidgetPayload.version,
    'state': 'noHousehold',
  };
}

final class const ReadyPayload({
  /// Every open item on the list.
  required final int open,

  /// The first [widgetItemCount] of them, in the list's order.
  required final List<WidgetItem> items,
}) extends WidgetPayload {
  @override
  Map<String, Object?> toJson(DateTime updatedAt) => {
    'version': WidgetPayload.version,
    'state': 'ready',
    'open': open,
    'items': items.map((item) => item.toJson()).toList(),
    'updatedAt': updatedAt.toUtc().toIso8601String(),
  };
}

@immutable
class const WidgetItem({
  required final String name,
  final String? quantity,

  /// The store's full name; null for an item without a store.
  final String? store,
}) {
  Map<String, Object?> toJson() => {
    'name': name,
    'quantity': quantity,
    'store': store,
  };
}

/// The list's open items as the List tab orders them: stores in the
/// household's order, then the items without a store.
ReadyPayload readyPayloadOf(ListState state) {
  final open = <WidgetItem>[];
  for (final section in sectionsOf(state.items.values, state.catalog)) {
    for (final block in section.blocks) {
      for (final item in block.items) {
        open.add(
          WidgetItem(
            name: item.name,
            quantity: item.quantity,
            store: section.store?.name,
          ),
        );
      }
    }
  }
  return ReadyPayload(
    open: open.length,
    items: open.take(widgetItemCount).toList(),
  );
}
