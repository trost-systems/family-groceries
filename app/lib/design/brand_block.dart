import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// The in-app brand: the approved app icon (exported by
/// `design/app-icon/build.mjs` into `assets/brand/`, 56 dp at 1x/2x/3x) over
/// the wordmark, as the site's header sets it. Login and welcome open on it.
class const BrandBlock({super.key}) extends StatelessWidget {
  static const double markSize = 56;
  static const double wordmarkSize = 28;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final t = HummlistColors.of(theme.brightness);
    return Column(
      children: [
        ExcludeSemantics(
          child: Image.asset(
            'assets/brand/mark-${dark ? 'dark' : 'light'}.png',
            width: markSize,
            height: markSize,
          ),
        ),
        const SizedBox(height: HlSpace.s3),
        Text(
          AppLocalizations.of(context).appTitle,
          style: TextStyle(
            fontFamily: HlFont.display,
            fontSize: wordmarkSize,
            fontWeight: FontWeight.w800,
            height: 1,
            letterSpacing: -0.035 * wordmarkSize,
            color: t.text,
          ),
        ),
      ],
    );
  }
}
