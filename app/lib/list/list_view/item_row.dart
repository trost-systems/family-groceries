import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_view/drag.dart';
import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/sections.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// "6×" for a count, any other quantity as typed; null for one.
String? quantityLabel(String? quantity) => switch (quantity?.trim()) {
  null || '' || '1' => null,
  final q when RegExp(r'^\d+$').hasMatch(q) => '$q×',
  final q => q,
};

/// One item: a tap ticks it, a swipe to the left (or a right click, or a
/// hold that stays put) edits it, a hold that moves drags it. The swipe
/// leaves the row in place and opens the edit sheet, which deletes the item
/// and moves it to another category or store, so only reordering within its
/// category needs a hold: on a phone's browser a hold often drifts into a
/// drag (job 29c). Screen readers get edit and delete as actions. It is also
/// a drop target that puts a dragged item before or after it.
class const ItemRow({
  required final Item item,
  required final Category? category,

  /// The item's category block, in walk order.
  required final List<Item> block,
  required final DragSession session,

  /// Not seen yet: tinted, and it reports whether it is on screen.
  required final bool fresh,

  /// The last row of its block has no rule under it.
  required final bool last,
  required final ValueChanged<bool> onVisible,
  required final ValueChanged<Item> onTick,
  required final ValueChanged<Item> onEdit,

  /// Only a screen reader's action deletes from the row; everyone else
  /// deletes in the edit sheet.
  required final ValueChanged<Item> onDelete,
  required final void Function(Item item, ItemDrop drop) onDrop,
  super.key,
}) extends StatefulWidget {
  @override
  State<ItemRow> createState() => _ItemRowState();
}

class _ItemRowState()
    extends State<ItemRow>
    with AutomaticKeepAliveClientMixin {
  /// Kept alive while lifted: auto-scroll may carry it off screen, and a
  /// disposed source never learns how its drag ended.
  var _lifted = false;
  var _travel = Offset.zero;

  /// [holdSlop] of the pointer that pressed last.
  var _slop = dragSlop;
  var _leaving = false;
  Timer? _leave;

  @override
  bool get wantKeepAlive => _lifted;

  @override
  void dispose() {
    _leave?.cancel();
    super.dispose();
  }

  void _tick() {
    if (_leaving || widget.session.active.value != null) {
      return;
    }
    if (MediaQuery.disableAnimationsOf(context)) {
      widget.onTick(widget.item);
      return;
    }
    setState(() => _leaving = true);
    _leave = Timer(const Duration(milliseconds: 260), () {
      if (mounted) {
        widget.onTick(widget.item);
      }
    });
  }

  void _lift() {
    _travel = Offset.zero;
    widget.session.active.value = DraggedItem(widget.item);
    setState(() => _lifted = true);
    updateKeepAlive();
  }

  void _dragUpdate(DragUpdateDetails details) {
    _travel += details.delta;
    if (!widget.session.moved.value && _travel.distance >= _slop) {
      _stayUnderFinger();
      widget.session.moved.value = true;
    }
  }

  /// Once the item moves, the empty stores show as drop targets, some of
  /// them above this row: the list scrolls by what they pushed it down, so
  /// it stays under the finger where the list has room to scroll.
  void _stayUnderFinger() {
    final before = _top();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || before == null) {
        return;
      }
      final after = _top();
      final position = Scrollable.maybeOf(context)?.position;
      if (after == null || position == null || after == before) {
        return;
      }
      position.jumpTo(
        (position.pixels + after - before).clamp(
          position.minScrollExtent,
          position.maxScrollExtent,
        ),
      );
    });
  }

  double? _top() {
    final box = context.findRenderObject();
    return box is RenderBox && box.attached
        ? box.localToGlobal(Offset.zero).dy
        : null;
  }

  void _dragEnd(DraggableDetails details) {
    final moved = widget.session.moved.value;
    widget.session.end();
    setState(() => _lifted = false);
    updateKeepAlive();
    if (!moved && !details.wasAccepted) {
      widget.onEdit(widget.item);
    }
  }

  void _hover(DragTargetDetails<Dragged> details) {
    final box = context.findRenderObject();
    if (box is! RenderBox) {
      return;
    }
    final y = box.globalToLocal(details.offset).dy;
    widget.session.hover.value = Hover(
      widget.item.id,
      edgeAt(y, box.size.height),
    );
  }

  void _leaveTarget(Dragged? _) {
    if (widget.session.hover.value?.target == widget.item.id) {
      widget.session.hover.value = null;
    }
  }

  void _accept(DragTargetDetails<Dragged> details) {
    final edge = widget.session.hover.value?.edge;
    widget.session.hover.value = null;
    if (details.data case DraggedItem(:final item) when edge != null) {
      if (dropOnRow(item, widget.item, edge, widget.block) case final drop?) {
        widget.onDrop(item, drop);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final item = widget.item;
    final session = widget.session;
    final tile = _semantics(
      context,
      _Tile(row: widget, leaving: _leaving, onTap: _tick),
    );
    final watched = widget.fresh
        ? VisibilityDetector(
            key: ValueKey('new-${item.id}'),
            onVisibilityChanged: (info) =>
                widget.onVisible(info.visibleFraction > 0.5),
            child: tile,
          )
        : tile;
    // Unclassified items have no group to be placed in yet: a hold edits.
    if (item.categoryId == null) {
      return GestureDetector(
        onLongPress: () => widget.onEdit(item),
        child: _swipeToEdit(context, watched, enabled: true),
      );
    }
    final draggable = LongPressDraggable<Dragged>(
      data: DraggedItem(item),
      delay: holdDelay(tappable: true),
      dragAnchorStrategy: pointerDragAnchorStrategy,
      onDragStarted: _lift,
      onDragUpdate: _dragUpdate,
      onDragEnd: _dragEnd,
      feedback: _Feedback(
        item: item,
        category: widget.category,
        session: session,
      ),
      childWhenDragging: ValueListenableBuilder(
        valueListenable: session.moved,
        builder: (_, moved, child) =>
            Opacity(opacity: moved ? 0.3 : 1, child: child),
        child: watched,
      ),
      child: watched,
    );
    return DragTarget<Dragged>(
      onWillAcceptWithDetails: (details) =>
          details.data is DraggedItem &&
          (details.data as DraggedItem).item.id != item.id,
      onMove: _hover,
      onLeave: _leaveTarget,
      onAcceptWithDetails: _accept,
      builder: (context, _, _) => Stack(
        clipBehavior: Clip.none,
        children: [
          Listener(
            onPointerDown: (event) => _slop = holdSlop(event.kind),
            child: _swipeToEdit(
              context,
              draggable,
              enabled: session.active.value == null,
            ),
          ),
          _InsertionLine(id: item.id, hover: session.hover),
        ],
      ),
    );
  }

  /// A swipe to the left past the threshold opens the edit sheet; the row
  /// springs back instead of leaving.
  Widget _swipeToEdit(
    BuildContext context,
    Widget child, {
    required bool enabled,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return Dismissible(
      key: ValueKey('dismiss-${widget.item.id}'),
      direction: enabled ? DismissDirection.endToStart : DismissDirection.none,
      background: ColoredBox(
        color: scheme.secondaryContainer,
        child: Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(right: 24),
            child: Icon(
              Icons.edit_outlined,
              color: scheme.onSecondaryContainer,
            ),
          ),
        ),
      ),
      confirmDismiss: (_) async {
        widget.onEdit(widget.item);
        return false;
      },
      child: child,
    );
  }

  Widget _semantics(BuildContext context, Widget child) {
    final l10n = AppLocalizations.of(context);
    final item = widget.item;
    final details = [?item.brand, ?item.properties].join(' · ');
    // The name leads, so the row is found by it; then the details and the
    // quantity, in the order rows have been read since job 15.
    final label = [
      item.name,
      if (details.isNotEmpty) details,
      ?item.quantity,
      if (widget.fresh) l10n.newItem,
    ].join('\n');
    return Semantics(
      container: true,
      button: true,
      label: label,
      onTap: _tick,
      onLongPress: () => widget.onEdit(item),
      customSemanticsActions: {
        CustomSemanticsAction(label: l10n.editSheet): () => widget.onEdit(item),
        CustomSemanticsAction(label: l10n.delete): () => widget.onDelete(item),
      },
      excludeSemantics: true,
      child: child,
    );
  }
}

class const _Tile({
  required final ItemRow row,
  required final bool leaving,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final item = row.item;
    final quantity = quantityLabel(item.quantity);
    final details = [?item.brand, ?item.properties].join(' · ');
    final reduce = MediaQuery.disableAnimationsOf(context);
    final fill = leaving
        ? scheme.primaryContainer
        : row.fresh
        ? scheme.tertiaryContainer
        : scheme.surface;
    final name = Text.rich(
      TextSpan(
        children: [
          if (quantity != null)
            TextSpan(
              text: '$quantity ',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: scheme.primary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          TextSpan(text: item.name),
        ],
      ),
      style: TextStyle(
        fontSize: 19,
        height: 26 / 19,
        fontWeight: const FontWeight(650),
        letterSpacing: -0.19,
        color: scheme.onSurface,
      ),
    );
    return Material(
      color: fill,
      child: InkWell(
        onTap: onTap,
        onSecondaryTap: () => row.onEdit(item),
        splashFactory: NoSplash.splashFactory,
        highlightColor: scheme.surfaceContainer,
        child: AnimatedOpacity(
          opacity: leaving ? 0.35 : 1,
          duration: reduce ? Duration.zero : const Duration(milliseconds: 240),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.fromLTRB(20, 12, 16, 11),
            decoration: row.last
                ? null
                : BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: scheme.outlineVariant),
                    ),
                  ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 12,
              children: [
                SizedBox(
                  width: 22,
                  child: Text(
                    itemIcon(item, row.category),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, height: 26 / 18),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 1,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          name,
                          Positioned(
                            left: -2,
                            right: -2,
                            top: 12,
                            height: 2.5,
                            child: TweenAnimationBuilder<double>(
                              tween: Tween(end: leaving ? 1 : 0),
                              duration: reduce
                                  ? Duration.zero
                                  : const Duration(milliseconds: 200),
                              builder: (_, grow, _) => Transform.scale(
                                scaleX: grow,
                                alignment: Alignment.centerLeft,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: scheme.primary,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (details.isNotEmpty)
                        Text(
                          details,
                          style: TextStyle(
                            fontSize: 14,
                            height: 1.3,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The 3 px line where a dragged item would land, at the row's top or bottom
/// edge.
class const _InsertionLine({
  required final String id,
  required final ValueNotifier<Hover?> hover,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ValueListenableBuilder(
    valueListenable: hover,
    builder: (context, hover, _) {
      if (hover == null || hover.target != id || hover.edge == null) {
        return const SizedBox.shrink();
      }
      final line = DecoratedBox(
        key: ValueKey('drop-line-$id'),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary,
          borderRadius: BorderRadius.circular(2),
        ),
      );
      return hover.edge == Edge.before
          ? Positioned(left: 12, right: 12, top: -2, height: 3, child: line)
          : Positioned(left: 12, right: 12, bottom: -2, height: 3, child: line);
    },
  );
}

/// The pill under the finger: icon, quantity and name. Hidden until the
/// hold moves, so a long press that edits shows nothing lifted.
class const _Feedback({
  required final Item item,
  required final Category? category,
  required final DragSession session,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final quantity = quantityLabel(item.quantity);
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
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '${itemIcon(item, category)}  '),
                    if (quantity != null)
                      TextSpan(
                        text: '$quantity ',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: scheme.primary,
                        ),
                      ),
                    TextSpan(text: item.name),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: const FontWeight(650),
                  color: scheme.onSurface,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
