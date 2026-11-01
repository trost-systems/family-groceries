import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';

/// A section title in the list's category-label style (the site's `.cat`):
/// 11 px heavy capitals, 0.12 em tracking, muted, and a 1 px rule running
/// on after the text. A heading for screen readers, which read [text] as
/// written. Pass [padding] to fit the page; the default is the list's.
class const HlSectionLabel(
  final String text, {
  final EdgeInsetsGeometry padding = const EdgeInsets.fromLTRB(20, 20, 16, 4),
  super.key,
}) extends StatelessWidget {
  static const _size = 11.0;

  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      padding: padding,
      child: Semantics(
        header: true,
        label: text,
        excludeSemantics: true,
        child: Row(
          spacing: HlSpace.s3,
          children: [
            Text(
              // German capitals spell ß as SS (SÜSSES), as CSS does.
              text.toUpperCase().replaceAll('ß', 'SS'),
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                fontSize: _size,
                fontWeight: FontWeight.w800,
                letterSpacing: _size * 0.12,
                color: t.textMuted,
              ),
            ),
            Expanded(child: Container(height: 1, color: t.divider)),
          ],
        ),
      ),
    );
  }
}
