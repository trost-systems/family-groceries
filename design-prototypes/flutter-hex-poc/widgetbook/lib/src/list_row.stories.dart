import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:hummel_hex_widgetbook/src/interaction.dart';
import 'package:hummel_hex_widgetbook/src/themes.dart';
import 'package:widgetbook/widgetbook.dart';

part 'list_row.stories.g.dart';

/// What a ListRow shows at its end.
enum Trailing() { none, store, quantity }

/// The knobs of a ListRow story.
final class const ListRowInput({
  final String title = 'Hafermilch',
  final String subtitle = '',

  /// Off: the variant comes from the Theme addon.
  final HexVariant? shape,
  final bool checked = false,
  final Trailing trailing = Trailing.store,
  final String store = 'Rewe',
  final String quantity = '2 l',
  final bool enabled = true,
  final Interaction interaction = Interaction.rest,
});

const meta = Meta(ListRow.new, argsType: ListRowInput.new);

const componentMeta = ComponentMeta(path: 'Hummel Hex');

final defaults = _Defaults(
  setup: (context, child, args) => withShape(
    context,
    args.shape,
    // A row fills its list's width; this keeps it phone-sized on a desktop
    // preview and bounded in snapshots.
    ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: InteractionDriver(interaction: args.interaction, child: child),
    ),
  ),
  builder: (context, args) => ListRow(
    title: args.title,
    subtitle: args.subtitle.isEmpty ? null : args.subtitle,
    store: args.trailing == Trailing.store ? args.store : null,
    quantity: args.trailing == Trailing.quantity ? args.quantity : null,
    checked: args.checked,
    onChanged: args.enabled ? (_) {} : null,
  ),
);

final $Unchecked = _Story(
  scenarios: [
    _Scenario(name: 'Default', args: _Args.fixed()),
    _Scenario(
      name: 'With subtitle',
      args: _Args.fixed(subtitle: 'Ohne Zucker, Barista'),
    ),
    _Scenario(
      name: 'Quantity',
      args: _Args.fixed(title: 'Äpfel', trailing: Trailing.quantity),
    ),
    _Scenario(
      name: 'Plain',
      args: _Args.fixed(title: 'Brot', trailing: Trailing.none),
    ),
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

final $Checked = _Story(
  args: _Args(checked: BoolArg(true)),
  scenarios: [
    _Scenario(name: 'Default', args: _Args.fixed(checked: true)),
    _Scenario(
      name: 'With subtitle',
      args: _Args.fixed(checked: true, subtitle: 'Ohne Zucker, Barista'),
    ),
  ],
);
