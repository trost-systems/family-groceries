import 'package:family_groceries/design/pointy_hex.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// The temporary card at the top that names the gestures, until dismissed.
class const ExplainerCard({required final VoidCallback onDismiss, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      key: const ValueKey('list-hint'),
      padding: const EdgeInsets.symmetric(
        horizontal: HlSpace.s3,
        vertical: HlSpace.s2,
      ),
      child: HlSticker(
        depth: StickerDepth.s,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            HlSpace.s3,
            HlSpace.s2,
            HlSpace.s2,
            HlSpace.s2,
          ),
          child: Row(
            spacing: HlSpace.s3,
            children: [
              Icon(Icons.touch_app_outlined, size: 22, color: t.brand),
              Expanded(
                child: Text(
                  l10n.listHint,
                  style: TextStyle(fontSize: 13, height: 1.35, color: t.text),
                ),
              ),
              TextButton(
                key: const ValueKey('list-hint-dismiss'),
                onPressed: onDismiss,
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 44),
                  textStyle: const TextStyle(
                    fontFamily: HlFont.sans,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: Text(l10n.listHintDismiss),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A honey hex with the cart over the empty list's text, like the site's
/// numbered step hexes (Peter, job 56 item 31).
class const EmptyList({super.key}) extends StatelessWidget {
  static const _hex = 72.0;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      key: const ValueKey('list-empty'),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 80),
      child: Column(
        spacing: 12,
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
          Text(
            AppLocalizations.of(context).emptyList,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
