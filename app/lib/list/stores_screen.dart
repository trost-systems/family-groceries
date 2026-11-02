import 'dart:async';

import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/design/hex_pill.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/name_dialog.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

/// The extended floating action button's height.
const fabHeight = 48.0;

/// The bottom padding of a list under the extended floating action button:
/// its height, its edge and a gap, so it never covers the last row's handle.
const fabClearance = fabHeight + HlDepth.edge + HlSpace.s4;

/// The List tab's Anpassen: the household's stores in list order, the same
/// order the store dividers show, and "Ohne Laden" where the section without
/// a store sits on the list (last). A row opens its details; the button
/// adds a store.
class const StoresScreen({super.key}) extends StatelessWidget {
  Future<void> _delete(BuildContext context, Store store) async {
    final cubit = context.read<ListCubit>();
    final open = cubit.state.items.values
        .where((i) => i.storeId == store.id && i.status == ItemStatus.active)
        .length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final l10n = AppLocalizations.of(context);
        return AlertDialog(
          title: Text(l10n.storeDeleteTitle(store.name)),
          content: Text(l10n.storeDeleteBody(open)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(l10n.cancel),
            ),
            FilledButton(
              key: const ValueKey('store-delete-confirm'),
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(l10n.delete),
            ),
          ],
        );
      },
    );
    if (confirmed ?? false) {
      await cubit.deleteStore(store.id);
    }
  }

  /// A store of that name is found rather than added twice.
  Future<void> _add(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    final view = View.of(context);
    final direction = Directionality.of(context);
    return showNameDialog(
      context,
      title: l10n.storeAdd,
      confirm: l10n.storeCreateConfirm,
      label: l10n.storeNameHint,
      maxLength: maxStoreNameLength,
      save: (name) async {
        final existing = cubit.state.catalog.storeNamed(name);
        final store = existing ?? await cubit.addStore(name);
        if (store == null) {
          return false;
        }
        if (existing == null) {
          unawaited(
            SemanticsService.sendAnnouncement(
              view,
              l10n.storeAdded(store.name),
              direction,
            ),
          );
        }
        return true;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    final stores = context.select<ListCubit, List<Store>>(
      (c) => c.state.catalog.stores,
    );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.storesTitle)),
      floatingActionButton: FloatingActionButton.extended(
        key: const ValueKey('store-add'),
        onPressed: () => unawaited(_add(context)),
        icon: const Icon(Icons.add),
        label: Text(l10n.storeAdd),
      ),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: pageMaxWidth),
          child: ReorderableListView(
            key: const ValueKey('stores-screen'),
            buildDefaultDragHandles: false,
            padding: const EdgeInsets.only(bottom: fabClearance),
            header: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                stores.isEmpty ? l10n.storesEmpty : l10n.storesHint,
                key: stores.isEmpty ? const ValueKey('stores-empty') : null,
              ),
            ),
            footer: const _NoStoreRow(),
            onReorderItem: (from, to) {
              final ids = [for (final s in stores) s.id];
              ids.insert(to, ids.removeAt(from));
              unawaited(cubit.reorderStores(ids));
            },
            proxyDecorator: HexPill.lift,
            children: [
              for (final (i, store) in stores.indexed)
                HexPill(
                  key: ValueKey('store-row-${store.id}'),
                  onTap: () => context.go(storeDetailsPath(store.id)),
                  child: Row(
                    children: [
                      Expanded(
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: StoreBadge(store),
                        ),
                      ),
                      IconButton(
                        key: ValueKey('store-delete-${store.id}'),
                        tooltip: l10n.storeDelete(store.name),
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => unawaited(_delete(context, store)),
                      ),
                      PillDragHandle(
                        index: i,
                        label: l10n.dragStore(store.name),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The section without a store, pinned: it cannot move, be renamed or go.
class const _NoStoreRow() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = HummlistColors.of(Theme.of(context).brightness);
    return HexPill(
      key: const ValueKey('store-row-none'),
      flat: true,
      onTap: () => context.go(storeDetailsPath(null)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: HlSpace.s1,
              children: [
                Text(
                  l10n.noStore,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: t.textMuted,
                  ),
                ),
                Text(
                  l10n.noStoreRowHint,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: t.textMuted),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: t.textMuted),
        ],
      ),
    );
  }
}
