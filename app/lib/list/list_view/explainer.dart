import 'package:family_groceries/design/pointy_hex.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// A honey hex with the cart over the empty list's text, like the site's
/// numbered step hexes (Peter, job 56 item 31). The text is the screen's
/// heading, narrow enough to wrap into even lines.
class const EmptyList({super.key}) extends StatelessWidget {
  static const _hex = 72.0;
  static const _textWidth = 240.0;

  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      key: const ValueKey('list-empty'),
      padding: const EdgeInsets.symmetric(
        horizontal: HlSpace.s6,
        vertical: HlSpace.s7,
      ),
      child: Column(
        spacing: HlSpace.s4,
        children: [
          ExcludeSemantics(
            child: PointyHex(
              key: const ValueKey('list-empty-mark'),
              face: t.honey,
              size: _hex,
              child: Icon(
                Icons.shopping_cart_outlined,
                size: 32,
                color: t.onHoney,
              ),
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _textWidth),
            child: Text(
              AppLocalizations.of(context).emptyList,
              textAlign: TextAlign.center,
              style: HlType.title.copyWith(color: t.text),
            ),
          ),
        ],
      ),
    );
  }
}
