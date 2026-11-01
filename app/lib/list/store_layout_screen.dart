import 'dart:async';

import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/design/hex_pill.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Opens the walking-order editor for one store on top of the list.
Future<void> openStoreLayout(BuildContext context, String storeId) {
  final cubit = context.read<ListCubit>();
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: StoreLayoutScreen(storeId: storeId),
      ),
    ),
  );
}

/// One store's walking order. Every change saves at once; which categories
/// the store carries (`hidden`, from the old store filter) is kept as it is.
class const StoreLayoutScreen({required final String storeId, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    final catalog = context.select<ListCubit, Catalog>((c) => c.state.catalog);
    final storeName = catalog.store(storeId)?.name ?? '';
    final stops = walkingOrder(catalog, storeId);

    void save(List<Stop> next) => unawaited(
      cubit.setStoreLayout(
        storeId,
        [for (final s in next) s.category.id],
        {
          for (final s in next)
            if (s.hidden) s.category.id,
        },
      ),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.storeLayoutTitle(storeName))),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: pageMaxWidth),
          child: ReorderableListView.builder(
            buildDefaultDragHandles: false,
            proxyDecorator: HexPill.lift,
            padding: const EdgeInsets.only(bottom: HlSpace.s5),
            header: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text(l10n.storeLayoutHint),
            ),
            itemCount: stops.length,
            onReorderItem: (from, to) {
              final next = [...stops];
              next.insert(to, next.removeAt(from));
              save(next);
            },
            itemBuilder: (context, index) {
              final (:category, hidden: _) = stops[index];
              return HexPill(
                key: ValueKey(category.id),
                child: Row(
                  children: [
                    HexStep(index + 1),
                    const SizedBox(width: HlSpace.s3),
                    ExcludeSemantics(
                      child: Text(
                        categoryIcon(category),
                        style: const TextStyle(fontSize: 20),
                      ),
                    ),
                    const SizedBox(width: HlSpace.s2),
                    Expanded(child: PillTitle(categoryName(category, l10n))),
                    PillDragHandle(
                      index: index,
                      label: l10n.dragCategory(categoryName(category, l10n)),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
