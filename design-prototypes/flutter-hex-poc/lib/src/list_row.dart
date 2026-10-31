import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/src/hex_badge.dart';
import 'package:hummel_hex_poc/src/hex_border.dart';
import 'package:hummel_hex_poc/src/pressable.dart';
import 'package:hummel_hex_poc/src/tactile.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

/// One shopping list item: hex check box, title, optional subtitle, and a store
/// badge or a quantity. The whole row is the tap target and toggles [checked].
class const ListRow({
  required final String title,
  required final bool checked,

  /// Called with the new checked state; null disables the row.
  required final ValueChanged<bool>? onChanged,
  final String? subtitle,
  final String? store,
  final String? quantity,
  final FocusNode? focusNode,
  super.key,
}) extends StatelessWidget {
  this
    : assert(
        store == null || quantity == null,
        'A row shows a store badge or a quantity',
      );

  static const double minHeight = 56;
  static const double boxHeight = 24;

  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final c = theme.colors;
    final onChanged = this.onChanged;
    final trailing = store ?? quantity;
    return Pressable(
      onPressed: onChanged == null ? null : () => onChanged(!checked),
      focusNode: focusNode,
      semantics: PressSemantics(
        label: [title, ?subtitle, ?trailing].join(', '),
        checked: checked,
      ),
      builder: (context, state) {
        final textColor = checked ? c.textMuted : c.text;
        return CustomPaint(
          foregroundPainter: state.focusVisible
              ? _RowFocusPainter(c.accent)
              : null,
          child: ColoredBox(
            color: state.pressed
                ? c.honeySoft
                : state.hovered
                ? c.surfaceSunken
                : c.surfaceRaised,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: minHeight),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: HexSpace.s4,
                  vertical: HexSpace.s2,
                ),
                child: Row(
                  children: [
                    _HexCheckBox(checked: checked),
                    const SizedBox(width: HexSpace.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: HexType.body.copyWith(
                              color: textColor,
                              fontWeight: FontWeight.w700,
                              fontVariations: const [
                                FontVariation('wght', 700),
                              ],
                              height: 1.3,
                              decoration: checked
                                  ? TextDecoration.lineThrough
                                  : null,
                              decorationColor: textColor,
                            ),
                          ),
                          if (subtitle case final subtitle?)
                            Text(
                              subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: HexType.label.copyWith(
                                color: c.textMuted,
                                fontWeight: FontWeight.w600,
                                fontVariations: const [
                                  FontVariation('wght', 600),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (store case final store?) ...[
                      const SizedBox(width: HexSpace.s2),
                      HexBadge(text: store),
                    ],
                    if (quantity case final quantity?) ...[
                      const SizedBox(width: HexSpace.s2),
                      Text(
                        quantity,
                        style: HexType.label.copyWith(color: textColor),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class const _HexCheckBox({required final bool checked})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final c = theme.colors;
    const height = ListRow.boxHeight;
    return SizedBox(
      // A regular hexagon: every side as long as the tip edges.
      width: height * 4 * theme.shape.tip,
      height: height,
      child: CustomPaint(
        foregroundPainter: checked ? _TickPainter(c.onHoney) : null,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: checked ? c.honey : c.surfaceRaised,
            shape: HexBorder(
              shape: theme.shape,
              side: BorderSide(color: c.border, width: HexStroke.width),
            ),
          ),
        ),
      ),
    );
  }
}

class const _TickPainter(final Color color) extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.3, h * 0.52)
        ..lineTo(w * 0.45, h * 0.7)
        ..lineTo(w * 0.72, h * 0.32),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_TickPainter oldDelegate) => oldDelegate.color != color;
}

class const _RowFocusPainter(final Color color) extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        (Offset.zero & size).deflate(focusRingWidth / 2),
        const Radius.circular(HexSpace.s1),
      ),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = focusRingWidth,
    );
  }

  @override
  bool shouldRepaint(_RowFocusPainter oldDelegate) =>
      oldDelegate.color != color;
}
