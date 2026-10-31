import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/tokens.g.dart';

/// What a pressable surface looks like right now.
@immutable
final class const PressState({
  required final bool enabled,
  required final bool hovered,

  /// Keyboard focus that should show a ring (not focus that followed a tap).
  required final bool focusVisible,

  /// Held down by a pointer, or briefly after Enter or Space.
  required final bool pressed,

  /// Vertical offset of the face from its resting place: negative is lifted,
  /// `HexDepth.press` is sunk fully into the edge.
  required final double faceOffset,
});

/// The semantics the pressable announces besides `button` and `enabled`.
@immutable
final class const PressSemantics({
  required final String label,
  final bool? selected,
  final bool? checked,
});

/// Shared interaction for the Hummel Hex controls: keyboard activation (Enter,
/// Space), focus, hover and pointer press, one semantics node, and the face's
/// travel between lifted, resting and sunk. Animated with the press and release
/// tokens; instant when the platform asks for reduced motion.
class const Pressable({
  required final VoidCallback? onPressed,
  required final PressSemantics semantics,
  required final Widget Function(BuildContext context, PressState state)
  builder,
  final FocusNode? focusNode,
  final bool autofocus = false,
  super.key,
}) extends StatefulWidget {
  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState()
    extends State<Pressable>
    with SingleTickerProviderStateMixin {
  static const _shortcuts = <ShortcutActivator, Intent>{
    SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
    SingleActivator(LogicalKeyboardKey.numpadEnter): ActivateIntent(),
    SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
  };

  late final _face = AnimationController.unbounded(vsync: this);
  late final Map<Type, Action<Intent>> _actions = {
    ActivateIntent: CallbackAction<ActivateIntent>(
      onInvoke: (_) => _activateByKey(),
    ),
  };
  var _hovered = false;
  var _pointerDown = false;
  var _keyPulse = false;
  var _focusVisible = false;

  // Read here, not in _moveFace: a held pointer is cancelled while the tree
  // tears down, when ancestors can no longer be looked up.
  var _reduceMotion = false;

  bool get _enabled => widget.onPressed != null;

  double get _target => switch ((_enabled, _pointerDown || _keyPulse)) {
    (false, _) => 0,
    (true, true) => HexDepth.press,
    (true, false) => _hovered ? -HexDepth.lift : 0,
  };

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
  }

  @override
  void didUpdateWidget(Pressable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_enabled) {
      _pointerDown = false;
      _keyPulse = false;
    }
    unawaited(_moveFace());
  }

  @override
  void dispose() {
    _face.dispose();
    super.dispose();
  }

  TickerFuture _moveFace() {
    final target = _target;
    if (_reduceMotion) {
      _face.value = target;
      return TickerFuture.complete();
    }
    final sinking = target > _face.value;
    return _face.animateTo(
      target,
      duration: sinking ? HexDuration.press : HexDuration.release,
      curve: HexEasing.press,
    );
  }

  void _update(VoidCallback change) {
    setState(change);
    unawaited(_moveFace());
  }

  void _activateByKey() {
    widget.onPressed?.call();
    setState(() => _keyPulse = true);
    // Sink fully, then rise again; with reduced motion both happen at once.
    _moveFace().whenCompleteOrCancel(() {
      if (mounted) {
        _update(() => _keyPulse = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final enabled = _enabled;
    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      label: widget.semantics.label,
      selected: widget.semantics.selected,
      checked: widget.semantics.checked,
      onTap: enabled ? widget.onPressed : null,
      child: FocusableActionDetector(
        enabled: enabled,
        focusNode: widget.focusNode,
        autofocus: widget.autofocus,
        shortcuts: _shortcuts,
        actions: _actions,
        mouseCursor: enabled
            ? SystemMouseCursors.click
            : SystemMouseCursors.basic,
        onShowFocusHighlight: (v) => setState(() => _focusVisible = v),
        // Hover comes from the mouse itself: FocusableActionDetector only
        // reports it while the focus highlight mode is traditional.
        child: MouseRegion(
          onEnter: (_) => _update(() => _hovered = true),
          onExit: (_) => _update(() => _hovered = false),
          child: GestureDetector(
            excludeFromSemantics: true,
            behavior: HitTestBehavior.opaque,
            onTapDown: enabled
                ? (_) => _update(() => _pointerDown = true)
                : null,
            onTapUp: enabled
                ? (_) => _update(() => _pointerDown = false)
                : null,
            onTapCancel: enabled
                ? () => _update(() => _pointerDown = false)
                : null,
            onTap: widget.onPressed,
            child: ExcludeSemantics(
              child: AnimatedBuilder(
                animation: _face,
                builder: (context, _) => widget.builder(
                  context,
                  PressState(
                    enabled: enabled,
                    hovered: _hovered && enabled,
                    focusVisible: _focusVisible && enabled,
                    pressed: (_pointerDown || _keyPulse) && enabled,
                    faceOffset: _face.value,
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
