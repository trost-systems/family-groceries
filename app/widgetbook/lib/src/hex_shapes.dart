import 'package:family_groceries/design/pointy_hex.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist/Formen';

/// The pointy hex (the add bar's plus); the fields are in `fields.dart`.
final hexShapeComponents = [
  component(_path, 'PointyHex', [plain('Plus', (context) => const _Plus())]),
];

class const _Plus() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: HlSpace.s4,
      children: [
        PointyHex(
          face: t.honey,
          size: 38,
          child: Icon(Icons.add, size: 22, color: t.onHoney),
        ),
        PointyHex(
          face: t.honeySoft,
          size: 38,
          child: Icon(Icons.search, size: 18, color: t.text),
        ),
      ],
    );
  }
}
