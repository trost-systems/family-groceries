import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';

enum _Fold() {
  store,
  category,
}

const _foldCurve = Cubic(0.05, 0.7, 0.1, 1);

/// The store and category chips. Tapping one folds its options out right
/// below; picking one folds them back.
class const FoldoutChips({
  required final Catalog catalog,
  required final String? storeId,
  required final String? categoryId,
  required final ValueChanged<String?> onStore,
  required final ValueChanged<String> onCategory,

  /// The store chip and the no-store option without a store.
  required final String storeLabel,

  /// The category chip without a category.
  required final String categoryLabel,

  /// Outlines a chip whose value the user changed.
  final bool storeChanged = false,
  final bool categoryChanged = false,
  super.key,
}) extends StatefulWidget {
  @override
  State<FoldoutChips> createState() => _FoldoutChipsState();
}

class _FoldoutChipsState() extends State<FoldoutChips> {
  _Fold? _fold;

  void _toggle(_Fold fold) =>
      setState(() => _fold = _fold == fold ? null : fold);

  void _pick(VoidCallback pick) {
    setState(() => _fold = null);
    pick();
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final store = switch (w.storeId) {
      final id? => w.catalog.store(id),
      null => null,
    };
    final category = w.catalog.categories
        .where((c) => c.id == w.categoryId)
        .firstOrNull;
    final still = MediaQuery.disableAnimationsOf(context);
    final l10n = AppLocalizations.of(context);
    final storeName = store?.name ?? w.storeLabel;
    final categoryName = category?.name ?? w.categoryLabel;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Chip(
              key: const ValueKey('chip-store'),
              leading: store == null
                  ? const Icon(Icons.storefront_outlined, size: 20)
                  : StoreBadge(store, size: 20),
              label: storeName,
              semanticsLabel: l10n.chipStore(storeName),
              open: _fold == _Fold.store,
              changed: w.storeChanged,
              onTap: () => _toggle(_Fold.store),
            ),
            _Chip(
              key: const ValueKey('chip-category'),
              leading: const Icon(Icons.category_outlined, size: 20),
              label: categoryName,
              semanticsLabel: l10n.chipCategory(categoryName),
              open: _fold == _Fold.category,
              changed: w.categoryChanged,
              onTap: () => _toggle(_Fold.category),
            ),
          ],
        ),
        AnimatedSize(
          duration: still ? Duration.zero : const Duration(milliseconds: 240),
          curve: _foldCurve,
          alignment: Alignment.topCenter,
          child: switch (_fold) {
            null => const SizedBox(width: double.infinity),
            _Fold.store => _Options([
              _Option(
                key: const ValueKey('store-option-none'),
                leading: const Icon(Icons.storefront_outlined, size: 22),
                label: w.storeLabel,
                selected: w.storeId == null,
                onTap: () => _pick(() => w.onStore(null)),
              ),
              for (final s in w.catalog.stores)
                _Option(
                  key: ValueKey('store-option-${s.id}'),
                  leading: StoreBadge(s, size: 22),
                  label: s.name,
                  selected: s.id == w.storeId,
                  onTap: () => _pick(() => w.onStore(s.id)),
                ),
            ]),
            _Fold.category => _Options([
              for (final c in w.catalog.categories)
                _Option(
                  key: ValueKey('category-option-${c.id}'),
                  label: c.name,
                  selected: c.id == w.categoryId,
                  onTap: () => _pick(() => w.onCategory(c.id)),
                ),
            ]),
          },
        ),
      ],
    );
  }
}

class const _Chip({
  required final Widget leading,
  required final String label,

  /// Names the chip apart from the option of the same name.
  required final String semanticsLabel,
  required final bool open,
  required final bool changed,
  required final VoidCallback onTap,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final side = switch ((open, changed)) {
      (true, _) => BorderSide.none,
      (false, true) => BorderSide(color: scheme.primary, width: 2),
      (false, false) => BorderSide(color: scheme.outline),
    };
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        // Desktop defaults to compact density, which shrinks targets
        // under 44 px.
        visualDensity: VisualDensity.standard,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsetsDirectional.fromSTEB(12, 0, 10, 0),
        shape: const StadiumBorder(),
        side: side,
        backgroundColor: open
            ? scheme.secondaryContainer
            : scheme.surfaceContainerLowest,
        foregroundColor: open ? scheme.onSecondaryContainer : scheme.onSurface,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      child: Semantics(
        expanded: open,
        label: semanticsLabel,
        excludeSemantics: true,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 8,
          children: [
            leading,
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            AnimatedRotation(
              turns: open ? 0.5 : 0,
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 200),
              child: const Icon(Icons.arrow_drop_down, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}

class const _Options(final List<Widget> options) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: SizedBox(
      width: double.infinity,
      child: Wrap(spacing: 6, runSpacing: 6, children: options),
    ),
  );
}

class const _Option({
  required final String label,
  required final bool selected,
  required final VoidCallback onTap,
  final Widget? leading,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        visualDensity: VisualDensity.standard,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsetsDirectional.fromSTEB(10, 0, 14, 0),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        backgroundColor: selected
            ? scheme.primary
            : scheme.surfaceContainerHigh,
        foregroundColor: selected ? scheme.onPrimary : scheme.onSurface,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      child: Semantics(
        selected: selected,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 6,
          children: [?leading, Text(label)],
        ),
      ),
    );
  }
}
