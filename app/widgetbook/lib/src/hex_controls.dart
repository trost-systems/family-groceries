import 'dart:async';

import 'package:family_groceries/design/hex_radio.dart';
import 'package:family_groceries/design/hex_switch.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/interaction.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist/Auswahl';

/// One switch state a story shows.
typedef _SwitchState = ({
  String name,
  bool value,
  bool enabled,
  Interaction interaction,
});

const List<_SwitchState> _switchStates = [
  (name: 'Aus', value: false, enabled: true, interaction: Interaction.rest),
  (name: 'An', value: true, enabled: true, interaction: Interaction.rest),
  (name: 'Hover', value: true, enabled: true, interaction: Interaction.hover),
  (name: 'Fokus', value: true, enabled: true, interaction: Interaction.focused),
  (
    name: 'Gedrückt',
    value: false,
    enabled: true,
    interaction: Interaction.pressed,
  ),
  (
    name: 'Aus, gesperrt',
    value: false,
    enabled: false,
    interaction: Interaction.rest,
  ),
  (
    name: 'An, gesperrt',
    value: true,
    enabled: false,
    interaction: Interaction.rest,
  ),
];

/// The design system's own selection controls: the hex switch and the hex
/// radio button, alone and in their list rows.
final hexControlComponents = [
  component(_path, 'HexSwitch', [
    plain('Alle Zustände', (context) => const _AllSwitchStates()),
    plain('Animiert', (context) => const _AnimatedSwitch()),
    plain('Spielwiese', (context) => const _SwitchPlayground()),
    for (final state in _switchStates)
      plain(state.name, (context) => _SwitchIn(state)),
  ]),
  component(_path, 'HexSwitchTile', [
    plain('Mit Hinweis', (context) => const _UsageData()),
  ]),
  component(_path, 'HexRadio', [
    plain('Alle Zustände', (context) => const _AllRadioStates()),
    plain('Sprachen', (context) => const _Languages()),
  ]),
];

TextStyle? _caption(BuildContext context) =>
    Theme.of(context).textTheme.labelMedium
        ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);

class const _SwitchIn(final _SwitchState state) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => InteractionDriver(
    interaction: state.interaction,
    child: HexSwitch(
      value: state.value,
      onChanged: state.enabled ? (_) {} : null,
    ),
  );
}

class const _AllSwitchStates() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: HlSpace.s5,
    runSpacing: HlSpace.s5,
    children: [
      for (final state in _switchStates)
        Column(
          mainAxisSize: MainAxisSize.min,
          spacing: HlSpace.s2,
          children: [
            _SwitchIn(state),
            Text(state.name, style: _caption(context)),
          ],
        ),
    ],
  );
}

/// Flips by itself every 1.2 s, so the thumb's travel and the colour change
/// show (the Time Dilation addon slows them down). With reduced motion it
/// holds still, on: the poster.
class const _AnimatedSwitch() extends StatefulWidget {
  @override
  State<_AnimatedSwitch> createState() => _AnimatedSwitchState();
}

class _AnimatedSwitchState() extends State<_AnimatedSwitch> {
  var _on = true;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    _timer?.cancel();
    _timer = still
        ? null
        : Timer.periodic(
            const Duration(milliseconds: 1200),
            (_) => setState(() => _on = !_on),
          );
    if (still) {
      _on = true;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 360,
    child: HexSwitchTile(
      leading: const Icon(Icons.dark_mode_outlined),
      title: const Text('Dunkel'),
      value: _on,
      onChanged: (on) => setState(() => _on = on),
    ),
  );
}

class const _SwitchPlayground() extends StatefulWidget {
  @override
  State<_SwitchPlayground> createState() => _SwitchPlaygroundState();
}

class _SwitchPlaygroundState() extends State<_SwitchPlayground> {
  var _on = false;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    spacing: HlSpace.s2,
    children: [
      HexSwitch(value: _on, onChanged: (on) => setState(() => _on = on)),
      Text(_on ? 'An' : 'Aus', style: _caption(context)),
    ],
  );
}

/// A row with a hint, as More's usage-data setting has it.
class const _UsageData() extends StatefulWidget {
  @override
  State<_UsageData> createState() => _UsageDataState();
}

class _UsageDataState() extends State<_UsageData> {
  var _on = false;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 360,
    child: HexSwitchTile(
      title: const Text('Nutzungsdaten senden'),
      subtitle: const Text('Hilft uns, Hummlist zu verbessern'),
      value: _on,
      onChanged: (on) => setState(() => _on = on),
    ),
  );
}

/// Each state in a group of its own: a group has one pick.
class const _AllRadioStates() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: HlSpace.s5,
    children: [
      for (final (name, value, enabled) in const [
        ('Aus', 'aus', true),
        ('Gewählt', 'an', true),
        ('Aus, gesperrt', 'aus', false),
        ('Gewählt, gesperrt', 'an', false),
      ])
        RadioGroup<String>(
          groupValue: 'an',
          onChanged: (_) {},
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              HexRadio<String>(value: value, enabled: enabled),
              Text(name, style: _caption(context)),
            ],
          ),
        ),
    ],
  );
}

/// The language list as Einstellungen has it: a tap picks.
class const _Languages() extends StatefulWidget {
  @override
  State<_Languages> createState() => _LanguagesState();
}

class _LanguagesState() extends State<_Languages> {
  String? _picked;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 360,
    child: RadioGroup<String?>(
      groupValue: _picked,
      onChanged: (value) => setState(() => _picked = value),
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          HexRadioTile<String?>(
            value: null,
            title: Text('Wie Gerät'),
            subtitle: Text('Gerade Deutsch'),
          ),
          Divider(indent: 16, endIndent: 16),
          HexRadioTile<String?>(value: 'de', title: Text('Deutsch')),
          HexRadioTile<String?>(value: 'en', title: Text('English')),
        ],
      ),
    ),
  );
}
