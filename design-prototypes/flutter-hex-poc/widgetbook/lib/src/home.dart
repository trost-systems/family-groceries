import 'package:flutter/material.dart';

/// The start page: what the catalog holds and where its controls are. It
/// replaces Widgetbook's default page, whose emoji would make the engine fetch
/// an emoji font and whose cards link to widgetbook.io.
class const CatalogHome({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 16,
            children: [
              Text('Hummel Hex', style: text.displaySmall),
              Text(
                'Die Bausteine des Flutter-Proof-of-Concept aus Job 41: '
                'HexButton, HexChip, ListRow und die Galerie aller Varianten.',
                style: text.bodyLarge,
              ),
              Text(
                'Links wählst du eine Komponente und eine Story. Unter jeder '
                'Story liegen Szenarien mit festen Werten für jeden Zustand: '
                'Ruhe, Hover, Fokus, gedrückt, deaktiviert, mit Icon.',
                style: text.bodyLarge,
              ),
              Text(
                'Rechts änderst du Beschriftung und Form (shape: aus folgt dem '
                'Theme) und stellst Theme (Sharp oder Soft, hell oder dunkel), '
                'Textgröße und Gerätrahmen ein.',
                style: text.bodyLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
