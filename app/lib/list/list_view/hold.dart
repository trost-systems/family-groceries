import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// A press on [child] held for [holdDelay] calls [onHold] at once, while
/// still held. A finger may drift by the touch slop and still hold; past it
/// the press scrolls instead. Screen readers get the hold from
/// the row's or divider's own semantics node.
class const Hold({
  required final VoidCallback onHold,

  /// Whether [child] sits in a tappable semantics node (see [holdDelay]).
  required final bool tappable,
  required final Widget child,
  super.key,
}) extends StatelessWidget {
  /// How long a press is held (prototype: 300 ms). On web the engine holds
  /// a press on a tappable semantics node back for 200 ms before the app
  /// sees it (its click debouncer, `pointer_binding.dart`), so those wait
  /// 100 ms more: 300 ms for the user.
  static Duration holdDelay({required bool tappable}) =>
      Duration(milliseconds: kIsWeb && tappable ? 100 : 300);

  @override
  Widget build(BuildContext context) => RawGestureDetector(
    excludeFromSemantics: true,
    gestures: {
      LongPressGestureRecognizer:
          GestureRecognizerFactoryWithHandlers<LongPressGestureRecognizer>(
            () => LongPressGestureRecognizer(
              duration: holdDelay(tappable: tappable),
              debugOwner: this,
            ),
            (recognizer) => recognizer.onLongPress = onHold,
          ),
    },
    child: child,
  );
}
