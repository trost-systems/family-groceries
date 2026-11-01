import 'dart:async';

import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/design/hex_pill.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:family_groceries/list/store_layout_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Opens the stores screen on top of More.
Future<void> openStores(BuildContext context) {
  final cubit = context.read<ListCubit>();
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) =>
          BlocProvider.value(value: cubit, child: const StoresScreen()),
    ),
  );
}

/// The household's stores in list order, the same order the store
/// dividers' drag changes. A store opens its walking order.
class const StoresScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    final stores = context.select<ListCubit, List<Store>>(
      (c) => c.state.catalog.stores,
    );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.storesTitle)),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: pageMaxWidth),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Text(l10n.storesHint),
              ),
              Expanded(
                child: ReorderableListView(
                  key: const ValueKey('stores-screen'),
                  buildDefaultDragHandles: false,
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
                        onTap: () =>
                            unawaited(openStoreLayout(context, store.id)),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                spacing: HlSpace.s1,
                                children: [
                                  StoreBadge(store),
                                  Text(
                                    l10n.editStoreLayout,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall,
                                  ),
                                ],
                              ),
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
            ],
          ),
        ),
      ),
    );
  }
}
