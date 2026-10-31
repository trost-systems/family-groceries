import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/hex_border.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

/// Gap between a control and its focus ring, and the ring's stroke width.
const double focusRingGap = 3;
const double focusRingWidth = 3;

/// Room kept around a control so its focus ring is never clipped by a neighbour
/// or a parent.
const double focusRingRoom = focusRingGap + focusRingWidth;

/// Colours of one tactile hex.
@immutable
final class const TactileColors({
  required final Color face,
  required final Color border,

  /// The solid bottom edge the face sits on; null for a flat control.
  required final Color? edge,
  required final Color content,
});

/// A hexagonal face resting on a solid edge of `HexDepth.edge`, with room above
/// for the hover lift. [faceOffset] moves the face: `-HexDepth.lift` lifted, 0
/// resting, `HexDepth.press` sunk flush with the edge. The face carries
/// [faceKey] so its position can be measured.
class const TactileHex({
  required final double faceHeight,
  required final TactileColors colors,
  required final double faceOffset,
  required final bool focusVisible,
  required final Widget child,
  final Key? faceKey,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final shape = HexBorder(
      shape: theme.shape,
      side: BorderSide(color: colors.border, width: HexStroke.width),
    );
    final edge = colors.edge;
    return Padding(
      padding: const EdgeInsets.all(focusRingRoom),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (edge != null)
            Positioned(
              left: 0,
              right: 0,
              top: HexDepth.lift + HexDepth.edge,
              height: faceHeight,
              child: DecoratedBox(
                decoration: ShapeDecoration(shape: shape, color: edge),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(
              top: HexDepth.lift,
              bottom: HexDepth.edge,
            ),
            child: Transform.translate(
              offset: Offset(0, faceOffset),
              child: CustomPaint(
                key: faceKey,
                foregroundPainter: focusVisible
                    ? _FocusRingPainter(
                        border: shape,
                        color: theme.colors.accent,
                      )
                    : null,
                child: DecoratedBox(
                  decoration: ShapeDecoration(shape: shape, color: colors.face),
                  child: SizedBox(height: faceHeight, child: child),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A hex ring parallel to the face's outline, painted outside it and never
/// clipped.
class const _FocusRingPainter({
  required final HexBorder border,
  required final Color color,
}) extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(
      border.pathFor(
        Offset.zero & size,
        outset: focusRingGap + focusRingWidth / 2,
      ),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = focusRingWidth
        ..color = color
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(_FocusRingPainter oldDelegate) =>
      oldDelegate.border != border || oldDelegate.color != color;
}
