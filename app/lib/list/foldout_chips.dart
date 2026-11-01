import 'package:family_groceries/design/hex_border.dart';
import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';

enum _Fold() {
  store,
  category,
}

/// The chips' and options' height: a touch target.
const _height = 44.0;

/// Room from the hex's edge to its content: the tip's depth, so the content
/// starts where the flat sides do.
const _hexPadding = EdgeInsets.symmetric(horizontal: HlHex.tip * _height);

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

  /// When set, no store means "not decided yet": the chip shows this and
  /// no option is selected (the add sheet before a store is known).
  final String? storeAutoLabel,

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
    final l10n = AppLocalizations.of(context);
    final storeName = store?.name ?? w.storeAutoLabel ?? w.storeLabel;
    final shownCategory = switch (category) {
      final c? => categoryName(c, l10n),
      null => w.categoryLabel,
    };
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
              leading: const Icon(Icons.storefront_outlined, size: 20),
              label: storeName,
              // The automatic labels already say what the chip is.
              semanticsLabel: store == null && w.storeAutoLabel != null
                  ? storeName
                  : l10n.chipStore(storeName),
              open: _fold == _Fold.store,
              changed: w.storeChanged,
              onTap: () => _toggle(_Fold.store),
            ),
            _Chip(
              key: const ValueKey('chip-category'),
              leading: const Icon(Icons.category_outlined, size: 20),
              label: shownCategory,
              semanticsLabel: category == null
                  ? shownCategory
                  : l10n.chipCategory(shownCategory),
              open: _fold == _Fold.category,
              changed: w.categoryChanged,
              onTap: () => _toggle(_Fold.category),
            ),
          ],
        ),
        AnimatedSize(
          duration: hlMotion(context, HlDuration.medium),
          curve: HlEasing.standard,
          alignment: Alignment.topCenter,
          child: switch (_fold) {
            null => const SizedBox(width: double.infinity),
            _Fold.store => _Options([
              _Option(
                key: const ValueKey('store-option-none'),
                leading: const Icon(Icons.storefront_outlined, size: 22),
                label: w.storeLabel,
                selected: w.storeId == null && w.storeAutoLabel == null,
                onTap: () => _pick(() => w.onStore(null)),
              ),
              for (final s in w.catalog.stores)
                _Option(
                  key: ValueKey('store-option-${s.id}'),
                  label: s.name,
                  selected: s.id == w.storeId,
                  onTap: () => _pick(() => w.onStore(s.id)),
                ),
            ]),
            _Fold.category => _Options([
              for (final c in w.catalog.categories)
                _Option(
                  key: ValueKey('category-option-${c.id}'),
                  label: categoryName(c, l10n),
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
    final t = HummlistColors.of(Theme.of(context).brightness);
    // A value the user picked is their choice, honey like a selected chip;
    // an open chip is lit softly while its options show.
    final (face, onFace) = switch ((changed, open)) {
      (true, _) => (t.honey, t.onHoney),
      (false, true) => (t.honeySoft, t.text),
      (false, false) => (t.surfaceRaised, t.text),
    };
    // The button's own web semantics node would take the add field's text
    // input with it on a tap; this node only taps.
    return Semantics(
      button: true,
      expanded: open,
      label: semanticsLabel,
      onTap: onTap,
      excludeSemantics: true,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          // Desktop defaults to compact density, which shrinks targets
          // under 44 px.
          visualDensity: VisualDensity.standard,
          minimumSize: const Size(0, _height),
          padding: _hexPadding,
          shape: const HexBorder(),
          side: BorderSide(color: t.border, width: HlBorder.width),
          backgroundColor: face,
          foregroundColor: onFace,
          iconColor: onFace,
          textStyle: const TextStyle(
            fontFamily: HlFont.sans,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: HlSpace.s1,
          children: [
            leading,
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            AnimatedRotation(
              turns: open ? 0.5 : 0,
              duration: hlMotion(context, HlDuration.short),
              curve: HlEasing.standard,
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
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          visualDensity: VisualDensity.standard,
          minimumSize: const Size(0, _height),
          padding: _hexPadding,
          // Lemon on the page needs the navy contour.
          shape: HexBorder(
            side: selected
                ? BorderSide(color: t.edge, width: HlBorder.width)
                : BorderSide.none,
          ),
          backgroundColor: selected ? t.honey : t.surfaceSunken,
          foregroundColor: selected ? t.onHoney : t.text,
          iconColor: selected ? t.onHoney : t.text,
          textStyle: const TextStyle(
            fontFamily: HlFont.sans,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 6,
          children: [?leading, Text(label)],
        ),
      ),
    );
  }
}
