import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';

/// The start page: what the catalogue holds and where its controls are. It
/// replaces Widgetbook's default page, whose emoji would make the engine
/// fetch an emoji font and whose cards link to widgetbook.io.
class const CatalogHome({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Padding(
          padding: const EdgeInsets.all(HlSpace.s5),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: HlSpace.s4,
            children: [
              Text(
                'Hummlist Widgetbook',
                style: text.displaySmall?.copyWith(
                  fontFamily: HlFont.display,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'Die echten Bausteine der App, so wie appTheme sie zeichnet: '
                'Material-Buttons mit der taktilen Hex-Fläche, Auswahl, '
                'Flächen, die Widgets der Liste und die Design-Tokens.',
                style: text.bodyLarge,
              ),
              Text(
                'Links wählst du eine Komponente. Jede hat eine Story je '
                'Zustand (Ruhe, Hover, Fokus, gedrückt, deaktiviert, lädt), '
                'darunter die Szenarien Hell und Dunkel. In der Spielwiese '
                'drückst du selbst: die Fläche sinkt ein und federt zurück.',
                style: text.bodyLarge,
              ),
              Text(
                'Rechts stellst du Theme, Textgröße (1x, 1.3x, 2x), '
                'reduzierte Bewegung, Zeitlupe (Time Dilation) und einen '
                'Geräterahmen ein.',
                style: text.bodyLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
