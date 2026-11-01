import 'dart:async';

import 'package:family_groceries/design/hex_segmented.dart';
import 'package:family_groceries/design/section_label.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/interaction.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist/Auswahl';

const _modes = ['System', 'Hell', 'Dunkel'];
const _icons = [
  Icons.brightness_auto_outlined,
  Icons.light_mode_outlined,
  Icons.dark_mode_outlined,
];

/// Einstellungen' theme control: System, Hell, Dunkel.
HexSegmented<int> _theme(
  int value,
  ValueChanged<int>? onChanged, {
  bool icons = true,
}) => HexSegmented<int>(
  label: 'Darstellung',
  value: value,
  onChanged: onChanged,
  segments: [
    for (final (i, label) in _modes.indexed)
      HexSegment(value: i, label: label, icon: icons ? _icons[i] : null),
  ],
);

/// The design system's segmented control, as Einstellungen shows the theme.
final hexSegmentedComponents = [
  component(_path, 'HlSectionLabel', [
    plain(
      'Abschnitte',
      (context) => const _Frame(
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HlSectionLabel('Darstellung'),
            SizedBox(height: HlSpace.s6),
            HlSectionLabel('Süßes und Sprache'),
          ],
        ),
      ),
    ),
  ]),
  component(_path, 'HexSegmented', [
    plain('Alle Zustände', (context) => const _AllStates()),
    plain('Animiert', (context) => const _AnimatedSegmented()),
    plain('Spielwiese', (context) => const _Playground()),
    for (final (i, label) in _modes.indexed)
      plain(label, (context) => _Frame(_theme(i, (_) {}))),
    plain(
      'Fokus',
      (context) => _Frame(
        InteractionDriver(
          interaction: Interaction.focused,
          child: _theme(1, (_) {}),
        ),
      ),
    ),
    plain('Gesperrt', (context) => _Frame(_theme(2, null))),
    plain('Ohne Symbole', (context) => _Frame(_theme(0, (_) {}, icons: false))),
    plain(
      'Schmal (358 px)',
      (context) => _Frame(_theme(1, (_) {}), width: 326),
    ),
  ]),
];

class const _Frame(final Widget child, {final double width = 360})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(width: width, child: child);
}

class const _AllStates() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    spacing: HlSpace.s5,
    children: [
      for (final i in const [0, 1, 2]) _Frame(_theme(i, (_) {})),
      _Frame(_theme(2, null)),
    ],
  );
}

/// Picks the next option by itself every 1.4 s, so the honey indicator's
/// slide shows (the Time Dilation addon slows it down). With reduced motion
/// it holds still on Hell: the poster.
class const _AnimatedSegmented() extends StatefulWidget {
  @override
  State<_AnimatedSegmented> createState() => _AnimatedSegmentedState();
}

class _AnimatedSegmentedState() extends State<_AnimatedSegmented> {
  var _value = 0;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    _timer?.cancel();
    _timer = still
        ? null
        : Timer.periodic(
            const Duration(milliseconds: 1400),
            (_) => setState(() => _value = (_value + 1) % _modes.length),
          );
    if (still) {
      _value = 1;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _Frame(_theme(_value, (v) => setState(() => _value = v)));
}

class const _Playground() extends StatefulWidget {
  @override
  State<_Playground> createState() => _PlaygroundState();
}

class _PlaygroundState() extends State<_Playground> {
  var _value = 0;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    spacing: HlSpace.s2,
    children: [
      _Frame(_theme(_value, (v) => setState(() => _value = v))),
      Text(
        _modes[_value],
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    ],
  );
}
