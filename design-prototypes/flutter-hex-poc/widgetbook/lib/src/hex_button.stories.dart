import 'package:flutter/material.dart' show Icons;
import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:hummel_hex_widgetbook/src/interaction.dart';
import 'package:hummel_hex_widgetbook/src/themes.dart';
import 'package:widgetbook/widgetbook.dart';

part 'hex_button.stories.g.dart';

/// The knobs of a HexButton story.
final class const HexButtonInput({
  final String label = 'Speichern',

  /// Off: the variant comes from the Theme addon.
  final HexVariant? shape,
  final HexButtonKind kind = HexButtonKind.primary,
  final HexButtonSize size = HexButtonSize.regular,
  final bool enabled = true,
  final bool withIcon = false,
  final Interaction interaction = Interaction.rest,
});

const meta = Meta(HexButton.new, argsType: HexButtonInput.new);

const componentMeta = ComponentMeta(path: 'Hummel Hex');

final defaults = _Defaults(
  setup: (context, child, args) => withShape(
    context,
    args.shape,
    InteractionDriver(interaction: args.interaction, child: child),
  ),
  builder: (context, args) => HexButton(
    label: args.label,
    kind: args.kind,
    size: args.size,
    icon: args.withIcon ? const Icon(Icons.add_rounded) : null,
    onPressed: args.enabled ? () {} : null,
  ),
);

final $Primary = _Story(scenarios: _states(HexButtonKind.primary));

final $Secondary = _Story(
  args: _Args(
    label: StringArg('Teilen'),
    kind: EnumArg(HexButtonKind.secondary, values: HexButtonKind.values),
  ),
  scenarios: _states(HexButtonKind.secondary, label: 'Teilen'),
);

final $Quiet = _Story(
  args: _Args(
    label: StringArg('Abbrechen'),
    kind: EnumArg(HexButtonKind.quiet, values: HexButtonKind.values),
  ),
  scenarios: _states(HexButtonKind.quiet, label: 'Abbrechen'),
);

/// Every state with fixed args; hover, focus and press settle in `run` so the
/// snapshot shows them.
List<_Scenario> _states(HexButtonKind kind, {String label = 'Speichern'}) => [
  _Scenario(
    name: 'Default',
    args: _Args.fixed(label: label, kind: kind),
  ),
  for (final interaction in [
    Interaction.hover,
    Interaction.focus,
    Interaction.pressed,
  ])
    _Scenario(
      name: _title(interaction.name),
      args: _Args.fixed(label: label, kind: kind, interaction: interaction),
      run: settleInteraction,
    ),
  _Scenario(
    name: 'Disabled',
    args: _Args.fixed(label: label, kind: kind, enabled: false),
  ),
  _Scenario(
    name: 'With icon',
    args: _Args.fixed(label: 'Hinzufügen', kind: kind, withIcon: true),
  ),
  _Scenario(
    name: 'Small',
    args: _Args.fixed(label: 'OK', kind: kind, size: HexButtonSize.small),
  ),
];

String _title(String name) => name[0].toUpperCase() + name.substring(1);
