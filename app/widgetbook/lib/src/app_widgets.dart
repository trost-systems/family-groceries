import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/foldout_chips.dart';
import 'package:family_groceries/list/list_view/dividers.dart';
import 'package:family_groceries/list/list_view/drag.dart';
import 'package:family_groceries/list/list_view/explainer.dart';
import 'package:family_groceries/list/list_view/item_row.dart';
import 'package:family_groceries/list/list_view/sections.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/fixtures.dart' as fixtures;
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist';

/// The app's own widgets from `lib/list`, built standalone.
final appComponents = [
  component(_path, 'StoreBadge', [
    plain('Ketten', (context) => const _Badges(fixtures.seededStores)),
    plain('Eigene Läden', (context) => const _Badges(fixtures.ownStores)),
    plain(
      'Größen',
      (context) => Row(
        mainAxisSize: MainAxisSize.min,
        spacing: HlSpace.s4,
        children: [
          for (final size in const <double>[20, 24, 32, 48])
            StoreBadge(fixtures.seededStores.first, size: size),
        ],
      ),
    ),
  ]),
  component(_path, 'ExplainerCard', [
    plain(
      'Hinweis',
      (context) => SizedBox(width: 390, child: ExplainerCard(onDismiss: () {})),
    ),
  ]),
  component(_path, 'FoldoutChips', [
    plain('Laden und Kategorie', (context) => const _Chips()),
    plain('Geändert', (context) => const _Chips(changed: true)),
  ]),
  component(_path, 'Liste', [
    plain('Ausschnitt', (context) => const _ListExcerpt()),
    plain('Eintrag', (context) => _ListExcerpt(only: fixtures.items[2])),
    plain(
      'Neuer Eintrag',
      (context) => _ListExcerpt(only: fixtures.items[0], fresh: true),
    ),
    plain(
      'Laden zugeklappt',
      (context) => const _ListExcerpt(folded: {'lidl'}),
    ),
  ]),
];

class const _Badges(final List<Store> stores) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: HlSpace.s3,
    children: [
      for (final store in stores)
        Row(
          mainAxisSize: MainAxisSize.min,
          spacing: HlSpace.s3,
          children: [StoreBadge(store), Text(store.name)],
        ),
    ],
  );
}

class const _Chips({final bool changed = false}) extends StatefulWidget {
  @override
  State<_Chips> createState() => _ChipsState();
}

class _ChipsState() extends State<_Chips> {
  String? _store = 'lidl';
  String? _category = 'produce';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: 390,
      child: FoldoutChips(
        catalog: fixtures.catalog,
        storeId: _store,
        categoryId: _category,
        storeLabel: l10n.noStore,
        categoryLabel: l10n.categoryAuto,
        storeChanged: widget.changed,
        categoryChanged: widget.changed,
        onStore: (id) => setState(() => _store = id),
        onCategory: (id) => setState(() => _category = id),
      ),
    );
  }
}

/// The list as the app lays it out, from the app's own sections: store
/// dividers, category dividers and rows. A tap on a row ticks it off, a tap
/// on a store divider folds it; "Zurücksetzen" brings the items back.
class const _ListExcerpt({
  final Item? only,
  final bool fresh = false,
  final Set<String> folded = const {},
}) extends StatefulWidget {
  @override
  State<_ListExcerpt> createState() => _ListExcerptState();
}

class _ListExcerptState() extends State<_ListExcerpt> {
  final _session = DragSession();
  late var _items = _initial;
  late final _folded = {...widget.folded};

  List<Item> get _initial => switch (widget.only) {
    final item? => [item],
    null => fixtures.items,
  };

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  void _tick(Item item) =>
      setState(() => _items = [..._items.where((i) => i.id != item.id)]);

  @override
  Widget build(BuildContext context) {
    final sections = sectionsOf(
      _items,
      fixtures.catalog,
    ).where((s) => s.count > 0);
    return SizedBox(
      width: 390,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final section in sections) ...[
            StoreDivider(
              section: section,
              folded: _folded.contains(section.key),
              session: _session,
              onToggle: () => setState(
                () => _folded.contains(section.key)
                    ? _folded.remove(section.key)
                    : _folded.add(section.key),
              ),
              onMenu: () {},
              onDropItem: (_, _) {},
              onDropStore: (_, _) {},
              onMoveUp: null,
              onMoveDown: null,
            ),
            if (!_folded.contains(section.key))
              for (final block in section.blocks) ...[
                CategoryDivider(
                  sectionKey: section.key,
                  storeId: section.store?.id,
                  block: block,
                  session: _session,
                  onMenu: () {},
                  onDropItem: (_, _) {},
                  onDropCategory: (_, _) {},
                  onMoveUp: null,
                  onMoveDown: null,
                ),
                for (final (i, item) in block.items.indexed)
                  ItemRow(
                    key: ValueKey(item.id),
                    item: item,
                    category: block.category,
                    block: block.items,
                    session: _session,
                    fresh: widget.fresh,
                    last: i == block.items.length - 1,
                    onVisible: (_) {},
                    onTick: _tick,
                    onEdit: (_) {},
                    onDelete: _tick,
                    onDrop: (_, _) {},
                  ),
              ],
          ],
          if (widget.only == null)
            Padding(
              padding: const EdgeInsets.only(top: HlSpace.s4),
              child: Center(
                child: TextButton(
                  onPressed: () => setState(() => _items = _initial),
                  child: const Text('Zurücksetzen'),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
