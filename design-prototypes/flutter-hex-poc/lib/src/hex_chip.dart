import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/pressable.dart';
import 'package:hummel_hex_poc/src/tactile.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

/// A selectable hex chip, such as a store filter. A selected chip stays pushed
/// into its edge and turns honey, so selection reads from shape and colour, not
/// colour alone.
class const HexChip({
  required final String label,
  required final bool selected,

  /// Called with the new selection; null disables the chip.
  required final ValueChanged<bool>? onSelected,
  final FocusNode? focusNode,
  super.key,
}) extends StatelessWidget {
  static const faceKey = ValueKey('HexChip.face');
  static const double faceHeight = 36;

  @override
  Widget build(BuildContext context) {
    final theme = HexTheme.of(context);
    final c = theme.colors;
    final onSelected = this.onSelected;
    return Pressable(
      onPressed: onSelected == null ? null : () => onSelected(!selected),
      focusNode: focusNode,
      semantics: PressSemantics(label: label, selected: selected),
      builder: (context, state) {
        final colors = !state.enabled
            ? TactileColors(
                face: c.surfaceSunken,
                border: c.textMuted,
                edge: c.textMuted,
                content: c.textMuted,
              )
            : selected
            ? TactileColors(
                face: c.honey,
                border: c.ink,
                edge: c.honeyEdge,
                content: c.onHoney,
              )
            : TactileColors(
                face: c.surfaceRaised,
                border: c.border,
                edge: c.surfaceEdge,
                content: c.text,
              );
        return ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: TactileHex(
              faceKey: faceKey,
              faceHeight: faceHeight,
              colors: colors,
              faceOffset: selected || !state.enabled
                  ? HexDepth.press
                  : state.faceOffset,
              focusVisible: state.focusVisible,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: theme.shape.tip * faceHeight + HexSpace.s2,
                ),
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    label,
                    maxLines: 1,
                    softWrap: false,
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
}
