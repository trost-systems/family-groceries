import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/hex_badge.dart';
import 'package:hummel_hex_poc/src/hex_button.dart';
import 'package:hummel_hex_poc/src/hex_chip.dart';
import 'package:hummel_hex_poc/src/list_row.dart';
import 'package:hummel_hex_poc/src/theme.dart';
import 'package:hummel_hex_poc/src/tokens.g.dart';

/// Every widget in both variants, light and dark, side by side.
class const Gallery({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: const Color(0xFF8E86A8),
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(HexSpace.s4),
      child: Wrap(
        spacing: HexSpace.s4,
        runSpacing: HexSpace.s4,
        children: [
          for (final variant in HexVariant.values)
            for (final brightness in Brightness.values)
              GalleryPanel(
                theme: HexThemeData(variant: variant, brightness: brightness),
              ),
        ],
      ),
    ),
  );
}

/// One variant in one brightness.
class const GalleryPanel({required final HexThemeData theme, super.key})
    extends StatefulWidget {
  static const double width = 380;

  @override
  State<GalleryPanel> createState() => _GalleryPanelState();
}

class _GalleryPanelState() extends State<GalleryPanel> {
  var _store = 'Alle';
  final _checked = <String>{'Bananen'};

  void _toggle(String item) => setState(() {
    if (!_checked.remove(item)) {
      _checked.add(item);
    }
  });

  @override
  Widget build(BuildContext context) {
    final theme = widget.theme;
    final c = theme.colors;
    final variantName = switch (theme.variant) {
      HexVariant.sharp => 'Hex Sharp',
      HexVariant.soft => 'Hex Soft',
    };
    final modeName = switch (theme.brightness) {
      Brightness.light => 'hell',
      Brightness.dark => 'dunkel',
    };
    Widget heading(String text) => Padding(
      padding: const EdgeInsets.only(top: HexSpace.s5, bottom: HexSpace.s2),
      child: Text(text, style: HexType.caption.copyWith(color: c.textMuted)),
    );
    return HexTheme(
      data: theme,
      child: SizedBox(
        width: GalleryPanel.width,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.surface,
            border: Border.all(color: c.border, width: HexStroke.width),
            borderRadius: const BorderRadius.all(Radius.circular(HexSpace.s4)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(HexSpace.s5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$variantName · $modeName',
                  style: HexType.headline.copyWith(color: c.text),
                ),
                heading('KNÖPFE'),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    HexButton(label: 'Zur Liste hinzufügen', onPressed: () {}),
                    HexButton(
                      label: 'Liste teilen',
                      kind: HexButtonKind.secondary,
                      onPressed: () {},
                    ),
                    HexButton(
                      label: 'Abbrechen',
                      kind: HexButtonKind.quiet,
                      onPressed: () {},
                    ),
                    HexButton(
                      label: 'Rückgängig',
                      size: HexButtonSize.small,
                      onPressed: () {},
                    ),
                    HexButton(
                      label: 'OK',
                      size: HexButtonSize.small,
                      kind: HexButtonKind.secondary,
                      onPressed: () {},
                    ),
                    const HexButton(label: 'Senden', onPressed: null),
                  ],
                ),
                heading('LÄDEN'),
                Wrap(
                  children: [
                    for (final store in ['Alle', 'Edeka', 'Lidl', 'dm'])
                      HexChip(
                        label: store,
                        selected: _store == store,
                        onSelected: (_) => setState(() => _store = store),
                      ),
                    const HexChip(
                      label: 'Aldi',
                      selected: false,
                      onSelected: null,
                    ),
                  ],
                ),
                heading('LISTE'),
                ClipRRect(
                  borderRadius: const BorderRadius.all(
                    Radius.circular(HexSpace.s3),
                  ),
                  child: DecoratedBox(
                    position: DecorationPosition.foreground,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: c.border,
                        width: HexStroke.width,
                      ),
                      borderRadius: const BorderRadius.all(
                        Radius.circular(HexSpace.s3),
                      ),
                    ),
                    child: Column(
                      children: [
                        for (final (title, subtitle, store, quantity) in const [
                          ('Hafermilch', '2 Liter, ungesüßt', 'Edeka', null),
                          ('Bananen', null, null, '6'),
                          ('Zahnpasta', 'Kräuter', 'dm', null),
                          ('Brot', null, null, null),
                        ])
                          ListRow(
                            title: title,
                            subtitle: subtitle,
                            store: store,
                            quantity: quantity,
                            checked: _checked.contains(title),
                            onChanged: (_) => _toggle(title),
                          ),
                      ],
                    ),
                  ),
                ),
                heading('HAUSHALT'),
                const Row(
                  children: [
                    HexAvatar(initials: 'P', name: 'Peter'),
                    SizedBox(width: HexSpace.s2),
                    HexAvatar(initials: 'L', name: 'Lea'),
                    SizedBox(width: HexSpace.s3),
                    HexBadge(text: '2 offen', filled: true),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
