import 'package:family_groceries/design/hex_checkbox.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/interaction.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist/Flächen';

/// The sticker and the opt-in check box built on the same contour. Light and
/// dark come from the theme addon.
final stickerComponents = [
  component(_path, 'HlSticker', [
    plain('Tiefen s, m, l', (context) => const _Depths()),
    for (final depth in StickerDepth.values)
      plain(
        'Tiefe ${depth.name}',
        (context) => SizedBox(
          width: 320,
          child: HlSticker(depth: depth, child: const _Note()),
        ),
      ),
  ]),
  component('Hummlist/Auswahl', 'HexCheckbox', [
    plain('Alle Zustände', (context) => const _AllCheckboxStates()),
    plain('Kontakt-Zeile', (context) => const _ContactRow()),
    plain('Spielwiese', (context) => const _CheckboxPlayground()),
    for (final (name, value, enabled, interaction) in _states)
      plain(
        name,
        (context) => InteractionDriver(
          interaction: interaction,
          child: HexCheckbox(value: value, onChanged: enabled ? (_) {} : null),
        ),
      ),
  ]),
];

const _states = [
  ('Aus', false, true, Interaction.rest),
  ('An', true, true, Interaction.rest),
  ('Fokus', true, true, Interaction.focused),
  ('Gedrückt', false, true, Interaction.pressed),
  ('Aus, gesperrt', false, false, Interaction.rest),
  ('An, gesperrt', true, false, Interaction.rest),
];

class const _Note() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const ListTile(
    title: Text('Teil von Hummlist Premium'),
    subtitle: Text('Kontur und harter Schatten'),
  );
}

class const _Depths() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: HlSpace.s5,
    runSpacing: HlSpace.s5,
    children: [
      for (final depth in StickerDepth.values)
        SizedBox(
          width: 260,
          child: HlSticker(depth: depth, child: const _Note()),
        ),
    ],
  );
}

class const _AllCheckboxStates() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: HlSpace.s5,
    runSpacing: HlSpace.s5,
    children: [
      for (final (name, value, enabled, interaction) in _states)
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            InteractionDriver(
              interaction: interaction,
              child: HexCheckbox(
                value: value,
                onChanged: enabled ? (_) {} : null,
              ),
            ),
            Text(
              name,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
    ],
  );
}

class const _ContactRow() extends StatefulWidget {
  @override
  State<_ContactRow> createState() => _ContactRowState();
}

class _ContactRowState() extends State<_ContactRow> {
  var _on = true;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 360,
    child: HexCheckboxListTile(
      title: const Text('Peter darf mich dazu kontaktieren'),
      value: _on,
      onChanged: (on) => setState(() => _on = on),
    ),
  );
}

class const _CheckboxPlayground() extends StatefulWidget {
  @override
  State<_CheckboxPlayground> createState() => _CheckboxPlaygroundState();
}

class _CheckboxPlaygroundState() extends State<_CheckboxPlayground> {
  var _on = false;

  @override
  Widget build(BuildContext context) =>
      HexCheckbox(value: _on, onChanged: (on) => setState(() => _on = on));
}
