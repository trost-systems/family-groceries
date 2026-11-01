import 'package:family_groceries/list/model.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// What is being dragged.
@immutable
sealed class const Dragged();

final class const DraggedItem(final Item item) extends Dragged;

/// A category divider, inside section [sectionKey].
final class const DraggedCategory({
  required final String sectionKey,
  required final String categoryId,
}) extends Dragged;

final class const DraggedStore(final String storeId) extends Dragged;

/// Where a drag would land: on the drop target [target] (a row's item id, a
/// category divider's or a store divider's key), at [edge] for rows and
/// reordered dividers.
@immutable
class const Hover(final String target, [final Edge? edge]) {
  @override
  bool operator ==(Object other) =>
      other is Hover && other.target == target && other.edge == edge;

  @override
  int get hashCode => Object.hash(target, edge);
}

/// The drag in progress and the rows on their way out, shared by every row
/// and divider of one list. [active] changes the layout (dragging a store
/// folds every store); [hover] only paints a line or a tint.
class DragSession() {
  final active = ValueNotifier<Dragged?>(null);
  final hover = ValueNotifier<Hover?>(null);

  /// Ids of ticked items whose rows are closing: a divider whose rows all
  /// close closes with them.
  final leaving = ValueNotifier<Set<String>>(const {});
  var _disposed = false;

  /// Whether the lifted thing went past the slop: a hold that stays put is
  /// a long press, not a drag.
  final moved = ValueNotifier(false);

  /// Ends a drag that ended at a pointer up or cancel, or one whose source
  /// left the tree without saying so.
  void end() {
    active.value = null;
    hover.value = null;
    moved.value = false;
  }

  void leave(String id) => leaving.value = {...leaving.value, id};

  /// Drops [id] from [leaving] once its row is gone; a list torn down with
  /// it has nothing left to tell.
  void left(String id) {
    if (!_disposed && leaving.value.contains(id)) {
      leaving.value = {...leaving.value}..remove(id);
    }
  }

  void dispose() {
    _disposed = true;
    active.dispose();
    hover.dispose();
    moved.dispose();
    leaving.dispose();
  }
}

/// How far a held mouse may move and still be a long press (prototype:
/// 8 px).
const dragSlop = 8.0;

/// How far a held pointer of [kind] may move and still be a long press. A
/// finger drifts while it waits for the hold, and nothing shows on lift, so
/// it gets Flutter's touch slop (18 px): with 8 px a hold on a phone's
/// browser kept turning into a drag (job 29c).
double holdSlop(PointerDeviceKind kind) =>
    kind == PointerDeviceKind.mouse ? dragSlop : kTouchSlop;

/// How long a press is held before it lifts (prototype: 300 ms). On web
/// the engine holds a press on a tappable semantics node back for 200 ms
/// before the app sees it (its click debouncer, `pointer_binding.dart`), so
/// those lift 200 ms after the app sees them: 300 ms for the user.
Duration holdDelay({required bool tappable}) =>
    Duration(milliseconds: kIsWeb && tappable ? 100 : 300);
