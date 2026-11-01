import 'dart:async';

import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
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
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {
  /// Kept alive while lifted: auto-scroll may carry it off screen, and a
  /// disposed source never learns how its drag ended.
  var _lifted = false;
  var _travel = Offset.zero;

  /// [holdSlop] of the pointer that pressed last.
  var _slop = dragSlop;

  /// The way out after a tap, from 0 (open) to 1 (gone): see
  /// [rowLeaveDuration].
  /// Null until the row is ticked.
  AnimationController? _leave;
  Timer? _still;

  @override
  bool get wantKeepAlive => _lifted;

  @override
  void dispose() {
    if (_leave != null) {
      // Not while the tree is being torn down: the dividers listen.
      final session = widget.session;
      final id = widget.item.id;
      scheduleMicrotask(() => session.left(id));
    }
    _leave?.dispose();
    _still?.cancel();
    super.dispose();
  }

  /// The line draws, the row closes, then the tick commits. With reduced
  /// motion the struck row shows at once and holds for as long before the
  /// tick, so the result is still seen.
  void _tick() {
    if (_leave != null || widget.session.active.value != null) {
      return;
    }
    final item = widget.item;
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        AppLocalizations.of(context).itemTicked(item.name),
        Directionality.of(context),
      ),
    );
    final leave = AnimationController(vsync: this, duration: rowLeaveDuration);
    setState(() => _leave = leave);
    void commit() {
      if (mounted) {
        widget.onTick(item);
      }
    }

    if (MediaQuery.disableAnimationsOf(context)) {
      leave.value = _struck;
      _still = Timer(HlDuration.medium, commit);
    } else {
      widget.session.leave(item.id);
      unawaited(leave.forward().whenComplete(commit));
    }
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
      _Tile(row: widget, leave: _leave, onTap: _tick),
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
      checked: _leave != null,
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

// The way out of a ticked row runs on one controller: the line draws
// across the name and the row tints ([HlDuration.short]), then the row
// fades and closes its gap as one eased motion ([HlDuration.medium]), so the
// rows below move up instead of jumping when the item goes. A category
// divider whose rows all leave closes on the same curves.
final rowLeaveDuration = HlDuration.short + HlDuration.medium;

/// Where the line is drawn and the close begins.
final _struck =
    HlDuration.short.inMicroseconds / rowLeaveDuration.inMicroseconds;
final _draw = Interval(0, _struck, curve: HlEasing.standard);
final rowLeaveFade = Interval(_struck, 1, curve: HlEasing.exit);
final rowLeaveClose = Interval(_struck, 1, curve: HlEasing.standard);

// The site's `.item`: Bricolage 17/1.25 names, a 28 px emoji column, a
// 10 px gap, 13 px details in medium.
const _nameSize = 17.0;
const _nameLine = 21.25;
const _iconSize = 18.0;
const _iconColumn = 28.0;
const _iconGap = 10.0;
const _detailSize = 13.0;
const _rowPadding = 6.0;

class const _Tile({
  required final ItemRow row,
  required final AnimationController? leave,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final leave = this.leave;
    if (leave == null) {
      return _content(context, 0);
    }
    return AnimatedBuilder(
      animation: leave,
      builder: (context, _) => ClipRect(
        child: Align(
          alignment: Alignment.topCenter,
          heightFactor: 1 - rowLeaveClose.transform(leave.value),
          child: _content(context, leave.value),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, double t) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final item = row.item;
    final quantity = quantityLabel(item.quantity);
    final details = [?item.brand, ?item.properties].join(' · ');
    final hl = HummlistColors.of(theme.brightness);
    final drawn = _draw.transform(t);
    // Yellow means new, mint means done, like the homepage hero (Peter).
    final base = row.fresh ? hl.honeySoft : scheme.surface;
    // A ticked name turns muted as its line draws, like the site's done row.
    final ink = Color.lerp(scheme.onSurface, hl.textMuted, drawn)!;
    final name = TextSpan(
      children: [
        if (quantity != null)
          TextSpan(
            text: '$quantity ',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: Color.lerp(scheme.primary, hl.textMuted, drawn),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        TextSpan(text: item.name),
      ],
      style: DefaultTextStyle.of(context).style.merge(
        TextStyle(
          fontFamily: HlFont.display,
          fontSize: _nameSize,
          height: _nameLine / _nameSize,
          fontWeight: FontWeight.w700,
          color: ink,
        ),
      ),
    );
    final scaler = MediaQuery.textScalerOf(context);
    return Material(
      color: Color.lerp(base, hl.mintSoft, drawn),
      child: InkWell(
        onTap: onTap,
        onSecondaryTap: () => row.onEdit(item),
        splashFactory: NoSplash.splashFactory,
        highlightColor: scheme.surfaceContainer,
        child: Opacity(
          opacity: 1 - rowLeaveFade.transform(t),
          child: Container(
            // 48, not the site's 44: the whole row is the tap target.
            constraints: const BoxConstraints(minHeight: HlSpace.s7),
            alignment: AlignmentDirectional.centerStart,
            padding: const EdgeInsets.symmetric(
              horizontal: HlSpace.s4,
              vertical: _rowPadding,
            ),
            decoration: row.last
                ? null
                : BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: scheme.outlineVariant),
                    ),
                  ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: _iconGap,
              children: [
                SizedBox(
                  width: _iconColumn,
                  child: Text(
                    itemIcon(item, row.category),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: _iconSize,
                      height: _nameLine / _iconSize,
                    ),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 1,
                    children: [
                      CustomPaint(
                        foregroundPainter: drawn == 0
                            ? null
                            : StrikePainter(
                                text: name,
                                textScaler: scaler,
                                textDirection: Directionality.of(context),
                                progress: drawn,
                                color: hl.textMuted,
                              ),
                        child: Text.rich(name, textScaler: scaler),
                      ),
                      if (details.isNotEmpty)
                        Text(
                          details,
                          style: TextStyle(
                            fontSize: _detailSize,
                            height: 1.3,
                            fontWeight: FontWeight.w500,
                            color: Color.lerp(
                              scheme.onSurfaceVariant,
                              hl.textMuted,
                              drawn,
                            ),
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

/// The strike-through of a ticked name: one line per line of text, as wide
/// as the words on it, drawn left to right and line after line as
/// [progress] runs from 0 to 1. It lays [text] out as the [RichText] it
/// covers does, at the width it was given.
class const StrikePainter({
  required final TextSpan text,
  required final TextScaler textScaler,
  required final TextDirection textDirection,
  required final double progress,
  required final Color color,
}) extends CustomPainter {
  static const thickness = HlBorder.width;

  /// Past the first and last letter, so the line reads as crossing out.
  static const overhang = 2.0;

  /// The full lines at [size], before [progress] cuts them.
  List<Rect> lines(Size size) {
    final painter = TextPainter(
      text: text,
      textScaler: textScaler,
      textDirection: textDirection,
    )..layout(maxWidth: size.width);
    // Through the middle of the lowercase letters.
    final lift = textScaler.scale(text.style?.fontSize ?? 14) * 0.28;
    final lines = [
      for (final line in painter.computeLineMetrics())
        if (line.width > 0)
          Rect.fromCenter(
            center: Offset(line.left + line.width / 2, line.baseline - lift),
            width: line.width + 2 * overhang,
            height: thickness,
          ),
    ];
    painter.dispose();
    return lines;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final lines = this.lines(size);
    var left = progress * lines.fold(0.0, (sum, line) => sum + line.width);
    final paint = Paint()..color = color;
    for (final line in lines) {
      if (left <= 0) {
        break;
      }
      final width = left < line.width ? left : line.width;
      left -= width;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(line.left, line.top, width, line.height),
          const Radius.circular(thickness),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(StrikePainter old) =>
      old.progress != progress ||
      old.color != color ||
      old.text != text ||
      old.textScaler != textScaler ||
      old.textDirection != textDirection;
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
          borderRadius: BorderRadius.circular(HlRadius.full),
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
        child: HlSticker(
          borderRadius: const BorderRadius.all(Radius.circular(HlRadius.full)),
          child: Material(
            type: MaterialType.transparency,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: HlSpace.s4,
                  vertical: HlSpace.s2,
                ),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: '${itemIcon(item, category)}  '),
                      if (quantity != null)
                        TextSpan(
                          text: '$quantity ',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: scheme.primary,
                          ),
                        ),
                      TextSpan(text: item.name),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: HlFont.display,
                    fontSize: _nameSize,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
