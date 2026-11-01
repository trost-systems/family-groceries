import 'package:family_groceries/design/hex_border.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';

/// How a [StoreBadge] marks its store.
enum StoreBadgeStyle() {
  /// The store's full name in a pill with hexagonal ends. Every store has one.
  name,

  /// The store's logo inside a hexagon. Only a store with a logo in
  /// [_logos] gets it; any other falls back to [name]. No logo ships yet
  /// (retailer logos wait for the legal review), so this is the switch
  /// point for that step.
  logo,
}

/// The logo assets by store seed key. Empty until the legal review clears
/// retailer logos; then add the entries here and nothing else changes.
const _logos = <String, String>{};

/// The one marker of a store: the divider in the list, the Läden screen and
/// the add sheet's suggestions all use it, so a store looks the same
/// everywhere. Job 58's custom stores need nothing more: an own store has no
/// logo and shows its name.
///
/// Token colours only: a raised face, the navy contour and the text colour
/// of the theme; a store has no colour of its own. A name too long for
/// [maxWidth] ends in an ellipsis; the semantics label always has the full
/// name.
class const StoreBadge(
  final Store store, {
  final double height = 28,
  final double maxWidth = 220,
  final StoreBadgeStyle style = StoreBadgeStyle.name,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    // The tips are the hexagon's own, so the text never runs into them.
    final tip = HlHex.tip * height;
    return Semantics(
      label: store.name,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: height,
          maxWidth: maxWidth < 2 * tip ? 2 * tip : maxWidth,
        ),
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: t.surfaceRaised,
            shape: HexBorder(
              side: BorderSide(color: t.border, width: HlBorder.width),
            ),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: tip + HlSpace.s1),
            child: Center(widthFactor: 1, heightFactor: 1, child: _face(t)),
          ),
        ),
      ),
    );
  }

  Widget _face(HummlistColors t) {
    // `logo` has no asset to draw yet: `_logos` is empty.
    if (style == StoreBadgeStyle.logo && _logos.containsKey(store.seedKey)) {
      return Image.asset(_logos[store.seedKey]!, height: height * 0.6);
    }
    return Text(
      store.name,
      maxLines: 1,
      softWrap: false,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontFamily: HlFont.display,
        fontSize: height * 0.5,
        fontWeight: FontWeight.w800,
        height: 1.1,
        letterSpacing: -0.2,
        color: t.text,
      ),
    );
  }
}
