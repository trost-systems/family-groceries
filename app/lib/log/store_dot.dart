import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/log/model.dart'
    show storeColourIndex, storePaletteSize;
import 'package:material_ui/material_ui.dart';

/// The store colour of slot [index] ([storeColourIndex]), or the neutral
/// one for null: the divider grey, which the dot's contour keeps visible
/// (textMuted read as a second cobalt). Cobalt, tomato, mint and lemon come
/// first, the four hues the design has; accent is cobalt again and dark
/// success is mint, so the last two slots take the nearest tokens that
/// differ in each mode.
Color storeColour(SnacklistColors t, Brightness brightness, int? index) {
  final palette = switch (brightness) {
    Brightness.light => [
      t.brand,
      t.tomato,
      t.mint,
      t.honey,
      t.success,
      t.warning,
    ],
    Brightness.dark => [
      t.brand,
      t.tomato,
      t.mint,
      t.honey,
      t.cobalt,
      t.mintEdge,
    ],
  };
  assert(palette.length == storePaletteSize, 'one colour per slot');
  return index == null ? t.divider : palette[index];
}

/// A store's round mark: its colour in the navy contour (lemon needs it on
/// a light page), inside a ring of the page's surface that parts
/// overlapping dots. [size] is the coloured dot's; the ring adds
/// [ringWidth] round it.
class const StoreDot(
  final Color color, {
  final double size = 8,
  final Color? ring,
  super.key,
}) extends StatelessWidget {
  static const ringWidth = 1.5;

  @override
  Widget build(BuildContext context) {
    final t = SnacklistColors.of(Theme.of(context).brightness);
    return Container(
      width: size + 2 * ringWidth,
      height: size + 2 * ringWidth,
      padding: const EdgeInsets.all(ringWidth),
      decoration: BoxDecoration(
        color: ring ?? t.surface,
        shape: BoxShape.circle,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: t.border),
        ),
      ),
    );
  }
}
