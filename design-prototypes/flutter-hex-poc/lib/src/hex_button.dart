import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/pressable.dart';
import 'package:hummel_hex_poc/src/tactile.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

enum HexButtonKind() {
  /// Honey face on a honey edge: the one main action of a screen.
  primary,

  /// Raised surface face on an ink edge.
  secondary,

  /// No face or edge at rest: low-emphasis actions such as "Abbrechen".
  quiet,
}

enum HexButtonSize(final double faceHeight) {
  regular(48),
  small(36),
}

/// A hexagonal, tactile button. Sharp or soft corners come from the ambient
/// [HexTheme].
class const HexButton({
  required final String label,
  required final VoidCallback? onPressed,
  final HexButtonKind kind = HexButtonKind.primary,
  final HexButtonSize size = HexButtonSize.regular,
  final FocusNode? focusNode,
  final bool autofocus = false,
  super.key,
}) extends StatelessWidget {
  /// Key of the moving face inside every button, to measure where the face is.
  static const faceKey = ValueKey('HexButton.face');

  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    return Pressable(
      onPressed: onPressed,
      focusNode: focusNode,
      autofocus: autofocus,
      semantics: PressSemantics(label: label),
      builder: (context, state) {
        final colors = _colors(theme.colors, state);
        final hasEdge = colors.edge != null;
        return ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: TactileHex(
              faceKey: faceKey,
              faceHeight: size.faceHeight,
              colors: colors,
              // A disabled button sits flush in its edge: it cannot be pushed.
              faceOffset: !state.enabled
                  ? HexDepth.press
                  : hasEdge
                  ? state.faceOffset
                  : 0,
              focusVisible: state.focusVisible,
              child: Padding(
                // Text stays between the tips: the safe area is the flat-topped
                // middle.
                padding: EdgeInsets.symmetric(
                  horizontal: theme.shape.tip * size.faceHeight + HexSpace.s3,
                ),
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    label,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    style: HexType.label.copyWith(color: colors.content),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  TactileColors _colors(HexColors c, PressState state) {
    if (!state.enabled) {
      return TactileColors(
        face: c.surfaceSunken,
        border: c.textMuted,
        edge: kind == HexButtonKind.quiet ? null : c.textMuted,
        content: c.textMuted,
      );
    }
    return switch (kind) {
      HexButtonKind.primary => TactileColors(
        face: c.honey,
        border: c.ink,
        edge: c.honeyEdge,
        content: c.onHoney,
      ),
      HexButtonKind.secondary => TactileColors(
        face: c.surfaceRaised,
        border: c.border,
        edge: c.surfaceEdge,
        content: c.text,
      ),
      HexButtonKind.quiet => TactileColors(
        face: state.pressed
            ? c.honeySoft
            : state.hovered
            ? c.surfaceSunken
            : const Color(0x00000000),
        border: const Color(0x00000000),
        edge: null,
        content: c.text,
      ),
    };
  }
}
