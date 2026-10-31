import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:hummel_hex_widgetbook/src/interaction.dart';
import 'package:hummel_hex_widgetbook/src/themes.dart';
import 'package:widgetbook/widgetbook.dart';

part 'hex_chip.stories.g.dart';

/// The knobs of a HexChip story.
final class const HexChipInput({
  final String label = 'Rewe',

  /// Off: the variant comes from the Theme addon.
  final HexVariant? shape,
  final bool selected = false,
  final bool enabled = true,
  final Interaction interaction = Interaction.rest,
});

const meta = Meta(HexChip.new, argsType: HexChipInput.new);

const componentMeta = ComponentMeta(path: 'Hummel Hex');

final defaults = _Defaults(
  setup: (context, child, args) => withShape(
    context,
    args.shape,
    InteractionDriver(interaction: args.interaction, child: child),
  ),
  builder: (context, args) => HexChip(
    label: args.label,
    selected: args.selected,
    onSelected: args.enabled ? (_) {} : null,
  ),
);

final $Unselected = _Story(
  scenarios: [
    _Scenario(name: 'Default', args: _Args.fixed()),
    for (final interaction in [
      Interaction.hover,
      Interaction.focus,
      Interaction.pressed,
    ])
      _Scenario(
        name: interaction.name[0].toUpperCase() + interaction.name.substring(1),
        args: _Args.fixed(interaction: interaction),
        run: settleInteraction,
      ),
    _Scenario(name: 'Disabled', args: _Args.fixed(enabled: false)),
  ],
);

final $Selected = _Story(
  args: _Args(selected: BoolArg(true)),
  scenarios: [
    _Scenario(name: 'Default', args: _Args.fixed(selected: true)),
    _Scenario(
      name: 'Focus',
      args: _Args.fixed(selected: true, interaction: Interaction.focus),
      run: settleInteraction,
    ),
    _Scenario(
      name: 'Disabled',
      args: _Args.fixed(selected: true, enabled: false),
    ),
  ],
);
