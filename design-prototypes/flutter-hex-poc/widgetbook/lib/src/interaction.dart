import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:widgetbook/widgetbook.dart';

/// The pointer and keyboard state a story shows its control in.
enum Interaction() { rest, hover, focus, pressed }

/// Puts the control in [child] into [interaction] the way a person would,
/// so the catalog and its snapshots show the widget's own hover, focus and
/// press rendering: a synthetic mouse rests on it, a synthetic finger holds it
/// down, or keyboard focus lands on it with the focus highlight on.
class const InteractionDriver({
  required final Interaction interaction,
  required final Widget child,
  super.key,
}) extends StatefulWidget {
  @override
  State<InteractionDriver> createState() => _InteractionDriverState();
}

class _InteractionDriverState() extends State<InteractionDriver> {
  // Each driver gets its own pointer device, so the real mouse and other
  // drivers do not cancel its hover or press.
  static var _nextDevice = 0x4800;

  final _device = _nextDevice++;
  late final _scope = FocusScopeNode(debugLabel: 'InteractionDriver');
  Interaction _applied = Interaction.rest;
  ({int view, Offset position})? _at;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(InteractionDriver oldWidget) {
    super.didUpdateWidget(oldWidget);
    _release();
    _schedule();
  }

  @override
  void dispose() {
    _release();
    _scope.dispose();
    super.dispose();
  }

  void _schedule() =>
      WidgetsBinding.instance.addPostFrameCallback((_) => _apply());

  void _apply() {
    final box = context.findRenderObject();
    if (!mounted || box is! RenderBox || !box.hasSize) {
      return;
    }
    final at = (
      view: View.of(context).viewId,
      position: box.localToGlobal(box.size.center(Offset.zero)),
    );
    _at = at;
    _applied = widget.interaction;
    switch (_applied) {
      case Interaction.rest:
        break;
      case Interaction.hover:
        _send(
          PointerAddedEvent(
            viewId: at.view,
            kind: PointerDeviceKind.mouse,
            device: _device,
            position: at.position,
          ),
        );
        _send(
          PointerHoverEvent(
            viewId: at.view,
            kind: PointerDeviceKind.mouse,
            device: _device,
            position: at.position,
          ),
        );
      case Interaction.pressed:
        _send(
          PointerDownEvent(
            viewId: at.view,
            pointer: _device,
            device: _device,
            position: at.position,
          ),
        );
      case Interaction.focus:
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.alwaysTraditional;
        _scope.traversalDescendants.firstOrNull?.requestFocus();
    }
  }

  void _release() {
    final at = _at;
    final applied = _applied;
    _applied = Interaction.rest;
    if (at == null) {
      return;
    }
    switch (applied) {
      case Interaction.rest:
        break;
      case Interaction.hover:
        _send(
          PointerRemovedEvent(
            viewId: at.view,
            kind: PointerDeviceKind.mouse,
            device: _device,
            position: at.position,
          ),
        );
      case Interaction.pressed:
        _send(
          PointerCancelEvent(
            viewId: at.view,
            pointer: _device,
            device: _device,
            position: at.position,
          ),
        );
      case Interaction.focus:
        _scope.unfocus();
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic;
    }
  }

  void _send(PointerEvent event) =>
      GestureBinding.instance.handlePointerEvent(event);

  @override
  Widget build(BuildContext context) =>
      FocusScope(node: _scope, child: widget.child);
}

/// A scenario `run` that lets the driver's synthetic input land and the face
/// animation finish: a held touch only counts as a press after
/// [kPressTimeout].
Future<void> settleInteraction(WidgetTester tester, Object? _) async {
  await tester.pump(kPressTimeout);
  await tester.pumpAndSettle();
}
