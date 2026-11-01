import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/list_view/drag.dart';
import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/sections.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

/// A section's divider: badge, name, a rule in the store's colour, the count
/// and a caret. A tap folds the section; a hold that moves drags the store
/// (not the section without a store); a hold that stays put or a right
/// click opens [onMenu]. Dragged items dropped on it go to that store.
class const StoreDivider({
  required final StoreSection section,

  /// Shows only the divider: folded by the user, or while stores are
  /// dragged.
  required final bool folded,
  required final DragSession session,
  required final VoidCallback onToggle,
  required final VoidCallback onMenu,
  required final void Function(Item item, ItemDrop drop) onDropItem,
  required final void Function(String storeId, Edge edge) onDropStore,

  /// Moves the store one place up or down; null where it cannot go.
  required final VoidCallback? onMoveUp,
  required final VoidCallback? onMoveDown,
  super.key,
}) extends StatefulWidget {
  @override
  State<StoreDivider> createState() => _StoreDividerState();
}

class _StoreDividerState() extends State<StoreDivider> {
  var _travel = Offset.zero;

  /// [holdSlop] of the pointer that pressed last.
  var _slop = dragSlop;

  String get _key => widget.section.key;

  void _hover(DragTargetDetails<Dragged> details) {
    final box = context.findRenderObject();
    if (box is! RenderBox) {
      return;
    }
    widget.session.hover.value = switch (details.data) {
      DraggedStore() => Hover(
        _key,
        edgeAt(box.globalToLocal(details.offset).dy, box.size.height),
      ),
      _ => Hover(_key),
    };
  }

  void _accept(DragTargetDetails<Dragged> details) {
    final edge = widget.session.hover.value?.edge;
    widget.session.hover.value = null;
    switch (details.data) {
      case DraggedItem(:final item):
        if (dropOnStore(item, widget.section.store?.id) case final drop?) {
          widget.onDropItem(item, drop);
        }
      case DraggedStore(:final storeId) when edge != null:
        widget.onDropStore(storeId, edge);
      case _:
        break;
    }
  }

  bool _accepts(Dragged data) => switch (data) {
    DraggedItem() => true,
    DraggedStore(:final storeId) =>
      widget.section.store != null && storeId != widget.section.store!.id,
    DraggedCategory() => false,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final section = widget.section;
    final store = section.store;
    final name = store?.name ?? l10n.noStore;
    final head = _Head(
      section: section,
      name: name,
      folded: widget.folded,
      hover: widget.session.hover,
    );
    final body = store == null
        ? head
        : Listener(
            onPointerDown: (event) => _slop = holdSlop(event.kind),
            child: LongPressDraggable<Dragged>(
              data: DraggedStore(store.id),
              delay: holdDelay(tappable: true),
              dragAnchorStrategy: pointerDragAnchorStrategy,
              onDragStarted: () {
                _travel = Offset.zero;
                widget.session.active.value = DraggedStore(store.id);
              },
              onDragUpdate: (details) {
                _travel += details.delta;
                if (_travel.distance >= _slop) {
                  widget.session.moved.value = true;
                }
              },
              onDragEnd: (details) {
                final moved = widget.session.moved.value;
                widget.session.end();
                if (!moved && !details.wasAccepted) {
                  widget.onMenu();
                }
              },
              feedback: _DragPill(
                session: widget.session,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 10,
                  children: [StoreBadge(store), Text(name)],
                ),
              ),
              childWhenDragging: Opacity(opacity: 0.6, child: head),
              child: head,
            ),
          );
    final label = l10n.storeSectionLabel(name, section.count);
    return Semantics(
      container: true,
      button: true,
      expanded: !widget.folded,
      label: label,
      hint: widget.folded ? l10n.expandSection : l10n.collapseSection,
      onTap: widget.onToggle,
      onLongPress: widget.onMenu,
      customSemanticsActions: {
        CustomSemanticsAction(label: l10n.moveStoreUp): ?widget.onMoveUp,
        CustomSemanticsAction(label: l10n.moveStoreDown): ?widget.onMoveDown,
      },
      excludeSemantics: true,
      child: DragTarget<Dragged>(
        onWillAcceptWithDetails: (details) => _accepts(details.data),
        onMove: _hover,
        onLeave: (_) {
          if (widget.session.hover.value?.target == _key) {
            widget.session.hover.value = null;
          }
        },
        onAcceptWithDetails: _accept,
        builder: (context, _, _) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onToggle,
          onSecondaryTap: widget.onMenu,
          // The section without a store doesn't drag; a hold opens its menu.
          onLongPress: store == null ? widget.onMenu : null,
          child: body,
        ),
      ),
    );
  }
}

class const _Head({
  required final StoreSection section,
  required final String name,
  required final bool folded,
  required final ValueNotifier<Hover?> hover,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final store = section.store;
    final tint = store == null
        ? scheme.outline
        : storeTint(store, scheme.surface);
    final reduce = MediaQuery.disableAnimationsOf(context);
    final key = section.key;
    return ValueListenableBuilder(
      valueListenable: hover,
      builder: (context, hover, child) {
        final over = hover?.target == key;
        final line = over ? hover?.edge : null;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            AnimatedContainer(
              duration: reduce
                  ? Duration.zero
                  : const Duration(milliseconds: 120),
              constraints: const BoxConstraints(minHeight: 52),
              padding: const EdgeInsets.fromLTRB(16, 6, 12, 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: over && line == null
                    ? Color.alphaBlend(
                        tint.withValues(alpha: 0.16),
                        scheme.surface,
                      )
                    : Colors.transparent,
                border: over && line == null
                    ? Border.all(color: tint, width: 2)
                    : Border.all(color: Colors.transparent, width: 2),
              ),
              child: child,
            ),
            if (line != null)
              Positioned(
                left: 12,
                right: 12,
                top: line == Edge.before ? -2 : null,
                bottom: line == Edge.after ? -2 : null,
                height: 3,
                child: DecoratedBox(
                  key: ValueKey('drop-line-$key'),
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
          ],
        );
      },
      child: _row(context),
    );
  }

  Widget _row(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final store = section.store;
    final tint = store == null
        ? scheme.outline
        : storeTint(store, scheme.surface);
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Row(
      spacing: 10,
      children: [
        if (store == null)
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(
              Icons.storefront_outlined,
              size: 16,
              color: scheme.onSurfaceVariant,
            ),
          )
        else
          StoreBadge(store),
        // The name takes what it needs of this space and the rule the rest,
        // at least 12 px; a name too long for it ends in an ellipsis.
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => Row(
              spacing: 10,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: (constraints.maxWidth - 22).clamp(0, 1e9),
                  ),
                  child: Text(
                    name,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: HlFont.display,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    height: 2,
                    decoration: BoxDecoration(
                      color: tint,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: '${section.count}',
                style: TextStyle(
                  fontFamily: HlFont.display,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: scheme.onSurface,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              TextSpan(text: ' ${l10n.itemsWord(section.count)}'),
            ],
          ),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: scheme.onSurfaceVariant,
          ),
        ),
        AnimatedRotation(
          turns: folded ? -0.25 : 0,
          duration: reduce ? Duration.zero : const Duration(milliseconds: 220),
          child: Icon(
            Icons.expand_more,
            size: 22,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// A category's quiet divider inside a section: its name in small faded
/// capitals and a hairline. A hold that moves drags the category within its
/// section; a right click or a hold that stays put opens [onMenu]. Dragged
/// items dropped on it go to the end of the category.
class const CategoryDivider({
  required final String sectionKey,
  required final String? storeId,
  required final CategoryBlock block,
  required final DragSession session,
  required final VoidCallback onMenu,
  required final void Function(Item item, ItemDrop drop) onDropItem,
  required final void Function(String categoryId, Edge edge) onDropCategory,
  required final VoidCallback? onMoveUp,
  required final VoidCallback? onMoveDown,
  super.key,
}) extends StatefulWidget {
  @override
  State<CategoryDivider> createState() => _CategoryDividerState();
}

class _CategoryDividerState() extends State<CategoryDivider> {
  var _travel = Offset.zero;

  /// [holdSlop] of the pointer that pressed last.
  var _slop = dragSlop;

  String get _key => '${widget.sectionKey}/${widget.block.category?.id}';

  void _hover(DragTargetDetails<Dragged> details) {
    final box = context.findRenderObject();
    if (box is! RenderBox) {
      return;
    }
    widget.session.hover.value = switch (details.data) {
      DraggedCategory() => Hover(
        _key,
        edgeAt(box.globalToLocal(details.offset).dy, box.size.height),
      ),
      _ => Hover(_key),
    };
  }

  void _accept(DragTargetDetails<Dragged> details) {
    final edge = widget.session.hover.value?.edge;
    widget.session.hover.value = null;
    final categoryId = widget.block.category?.id;
    if (categoryId == null) {
      return;
    }
    switch (details.data) {
      case DraggedItem(:final item):
        final drop = dropOnCategory(
          item,
          widget.storeId,
          categoryId,
          widget.block.items,
        );
        if (drop != null) {
          widget.onDropItem(item, drop);
        }
      case DraggedCategory(categoryId: final moved) when edge != null:
        widget.onDropCategory(moved, edge);
      case _:
        break;
    }
  }

  bool _accepts(Dragged data) {
    final categoryId = widget.block.category?.id;
    return categoryId != null &&
        switch (data) {
          DraggedItem() => true,
          DraggedCategory(:final sectionKey, categoryId: final moved) =>
            sectionKey == widget.sectionKey && moved != categoryId,
          DraggedStore() => false,
        };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final category = widget.block.category;
    final label = category == null
        ? l10n.sortingItem
        : categoryLabel(category, l10n);
    final line = _Line(label: label, hover: widget.session.hover, id: _key);
    final body = category == null
        ? line
        : Listener(
            onPointerDown: (event) => _slop = holdSlop(event.kind),
            child: LongPressDraggable<Dragged>(
              data: DraggedCategory(
                sectionKey: widget.sectionKey,
                categoryId: category.id,
              ),
              delay: holdDelay(tappable: false),
              dragAnchorStrategy: pointerDragAnchorStrategy,
              onDragStarted: () {
                _travel = Offset.zero;
                widget.session.active.value = DraggedCategory(
                  sectionKey: widget.sectionKey,
                  categoryId: category.id,
                );
              },
              onDragUpdate: (details) {
                _travel += details.delta;
                if (_travel.distance >= _slop) {
                  widget.session.moved.value = true;
                }
              },
              onDragEnd: (details) {
                final moved = widget.session.moved.value;
                widget.session.end();
                if (!moved && !details.wasAccepted) {
                  widget.onMenu();
                }
              },
              feedback: _DragPill(session: widget.session, child: Text(label)),
              childWhenDragging: Opacity(opacity: 0.5, child: line),
              child: line,
            ),
          );
    return Semantics(
      container: true,
      header: true,
      // The category's full name, as the edit sheet's chip calls it.
      label: category == null ? label : categoryName(category, l10n),
      onLongPress: category == null ? null : widget.onMenu,
      customSemanticsActions: {
        CustomSemanticsAction(label: l10n.moveCategoryUp): ?widget.onMoveUp,
        CustomSemanticsAction(label: l10n.moveCategoryDown): ?widget.onMoveDown,
      },
      excludeSemantics: true,
      child: DragTarget<Dragged>(
        onWillAcceptWithDetails: (details) => _accepts(details.data),
        onMove: _hover,
        onLeave: (_) {
          if (widget.session.hover.value?.target == _key) {
            widget.session.hover.value = null;
          }
        },
        onAcceptWithDetails: _accept,
        builder: (context, _, _) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onSecondaryTap: category == null ? null : widget.onMenu,
          child: body,
        ),
      ),
    );
  }
}

class const _Line({
  required final String label,
  required final ValueNotifier<Hover?> hover,
  required final String id,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final faded = Color.lerp(scheme.surface, scheme.onSurfaceVariant, 0.75)!;
    return ValueListenableBuilder(
      valueListenable: hover,
      builder: (context, hover, _) {
        final over = hover?.target == id;
        final edge = over ? hover?.edge : null;
        final color = over && edge == null ? scheme.primary : faded;
        final rule = over && edge == null
            ? scheme.primary
            : scheme.outlineVariant;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              height: 32,
              padding: const EdgeInsets.fromLTRB(20, 0, 16, 0),
              child: Row(
                spacing: 10,
                children: [
                  Text(
                    // German capitals spell ß as SS (SÜSSES), as CSS does.
                    label.toUpperCase().replaceAll('ß', 'SS'),
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.035,
                      color: color,
                    ),
                  ),
                  Expanded(child: Container(height: 1, color: rule)),
                ],
              ),
            ),
            if (edge != null)
              Positioned(
                left: 12,
                right: 12,
                top: edge == Edge.before ? -2 : null,
                bottom: edge == Edge.after ? -2 : null,
                height: 3,
                child: DecoratedBox(
                  key: ValueKey('drop-line-$id'),
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// A lifted divider under the finger, shown once the hold moves.
class const _DragPill({
  required final DragSession session,
  required final Widget child,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ValueListenableBuilder(
      valueListenable: session.moved,
      builder: (context, moved, child) =>
          Opacity(opacity: moved ? 1 : 0, child: child),
      child: FractionalTranslation(
        translation: const Offset(-0.15, -0.5),
        child: Material(
          elevation: 3,
          color: scheme.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: DefaultTextStyle.merge(
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
