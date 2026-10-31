import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/hex_border.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

/// A pointy-top hex with a short text, for household members' initials.
class const HexAvatar({
  required final String initials,

  /// Read by screen readers instead of the initials.
  required final String name,

  /// Width across the flat sides; the height follows from the 120° corners.
  final double size = 40,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final c = theme.colors;
    return Semantics(
      label: name,
      excludeSemantics: true,
      child: SizedBox(
        width: size,
        height: size * 4 * theme.shape.tip,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: c.accentSoft,
            shape: HexBorder(
              shape: theme.shape,
              orientation: HexOrientation.pointyTop,
              side: BorderSide(color: c.border, width: HexStroke.width),
            ),
          ),
          child: Center(
            child: Text(initials, style: HexType.label.copyWith(color: c.text)),
          ),
        ),
      ),
    );
  }
}

/// A small outlined horizontal hex holding a store name or a quantity.
class const HexBadge({
  required final String text,
  final bool filled = false,
  super.key,
}) extends StatelessWidget {
  static const double height = 24;

  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final c = theme.colors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: filled ? c.honeySoft : c.surfaceRaised,
        shape: HexBorder(
          shape: theme.shape,
          side: BorderSide(color: c.border),
        ),
      ),
      child: SizedBox(
        height: height,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: theme.shape.tip * height + HexSpace.s1,
          ),
          child: Center(
            widthFactor: 1,
            child: Text(
              text,
              style: HexType.caption.copyWith(
                color: c.text,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
