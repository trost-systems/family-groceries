import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/interaction.dart';
import 'package:hummlist_widgetbook/src/story.dart';
import 'package:widgetbook/widgetbook.dart';

/// A state a control is shown in: how a person would put it there, and
/// whether it is enabled or busy.
enum ControlState(final String label, final Interaction interaction) {
  rest('Ruhe', Interaction.rest),
  hover('Hover', Interaction.hover),
  focused('Fokus', Interaction.focused),
  pressed('Gedrückt', Interaction.pressed),
  disabled('Deaktiviert', Interaction.rest),
  loading('Lädt', Interaction.rest);

  bool get enabled => this != disabled;
}

/// What a control is built from in a story.
final class const ControlProps({
  required final String label,
  required final bool enabled,
  required final bool loading,
}) {
  VoidCallback? press(VoidCallback onPressed) => enabled ? onPressed : null;
}

/// One Material control as the app's theme draws it, and the states it is
/// catalogued in.
final class const Control({
  required final String name,
  required final String label,
  required final Widget Function(ControlProps props, VoidCallback onPressed)
  build,
  final Set<ControlState> states = const {...ControlState.values},

  /// Gets a "Spielwiese" story with knobs, where presses are real.
  final bool playground = false,
});

const _withoutLoading = {
  ControlState.rest,
  ControlState.hover,
  ControlState.focused,
  ControlState.pressed,
  ControlState.disabled,
};

/// The spinner a busy button shows instead of its label, as the app's
/// feedback sheet does.
Widget _spinner() => const SizedBox.square(
  dimension: 20,
  child: CircularProgressIndicator(strokeWidth: 2.5),
);

Widget _labelOr(ControlProps props) =>
    props.loading ? _spinner() : Text(props.label);

Widget _iconOr(ControlProps props, IconData icon) =>
    props.loading ? _spinner() : Icon(icon);

/// The button kinds, each with a playground.
final buttons = [
  Control(
    name: 'FilledButton',
    label: 'Anlegen',
    playground: true,
    build: (props, onPressed) =>
        FilledButton(onPressed: props.press(onPressed), child: _labelOr(props)),
  ),
  Control(
    name: 'FilledButton.icon',
    label: 'Neu',
    playground: true,
    build: (props, onPressed) => FilledButton.icon(
      onPressed: props.press(onPressed),
      icon: _iconOr(props, Icons.add),
      label: Text(props.label),
    ),
  ),
  Control(
    name: 'FilledButton.tonal',
    label: 'Teilen',
    playground: true,
    build: (props, onPressed) => FilledButton.tonal(
      onPressed: props.press(onPressed),
      child: _labelOr(props),
    ),
  ),
  Control(
    name: 'OutlinedButton',
    label: 'Später',
    playground: true,
    build: (props, onPressed) => OutlinedButton(
      onPressed: props.press(onPressed),
      child: _labelOr(props),
    ),
  ),
  Control(
    name: 'TextButton',
    label: 'Abbrechen',
    playground: true,
    build: (props, onPressed) =>
        TextButton(onPressed: props.press(onPressed), child: _labelOr(props)),
  ),
  Control(
    name: 'IconButton',
    label: 'Mehr',
    playground: true,
    build: (props, onPressed) => IconButton(
      tooltip: props.label,
      onPressed: props.press(onPressed),
      icon: _iconOr(props, Icons.more_vert),
    ),
  ),
  Control(
    name: 'FloatingActionButton.extended',
    label: 'Kategorie',
    playground: true,
    build: (props, onPressed) => FloatingActionButton.extended(
      heroTag: null,
      onPressed: props.press(onPressed),
      icon: _iconOr(props, Icons.add),
      label: Text(props.label),
    ),
  ),
];

/// The selection controls, which have no busy state.
final selection = [
  Control(
    name: 'ChoiceChip',
    label: 'Lidl',
    states: _withoutLoading,
    build: (props, onPressed) => ChoiceChip(
      label: Text(props.label),
      selected: false,
      onSelected: props.enabled ? (_) => onPressed() : null,
    ),
  ),
  Control(
    name: 'ChoiceChip gewählt',
    label: 'dm',
    states: _withoutLoading,
    build: (props, onPressed) => ChoiceChip(
      label: Text(props.label),
      selected: true,
      onSelected: props.enabled ? (_) => onPressed() : null,
    ),
  ),
  Control(
    name: 'Checkbox',
    label: 'Erledigt',
    states: _withoutLoading,
    build: (props, onPressed) => Checkbox(
      semanticLabel: props.label,
      value: true,
      onChanged: props.enabled ? (_) => onPressed() : null,
    ),
  ),
  Control(
    name: 'CheckboxListTile',
    label: 'Bananen',
    states: _withoutLoading,
    build: (props, onPressed) => _Tile(
      child: CheckboxListTile(
        title: Text(props.label),
        subtitle: const Text('6×'),
        value: false,
        enabled: props.enabled,
        onChanged: (_) => onPressed(),
      ),
    ),
  ),
  Control(
    name: 'Switch',
    label: 'Benachrichtigungen',
    states: _withoutLoading,
    build: (props, onPressed) => Switch(
      value: true,
      onChanged: props.enabled ? (_) => onPressed() : null,
    ),
  ),
  Control(
    name: 'RadioListTile',
    label: 'Deutsch',
    states: _withoutLoading,
    build: (props, onPressed) => _Tile(
      child: RadioGroup<String>(
        groupValue: 'de',
        onChanged: (_) => onPressed(),
        child: RadioListTile<String>(
          title: Text(props.label),
          value: 'de',
          enabled: props.enabled,
        ),
      ),
    ),
  ),
  Control(
    name: 'TextField',
    label: 'Was fehlt?',
    states: _withoutLoading,
    build: (props, onPressed) => SizedBox(
      width: 320,
      child: TextField(
        enabled: props.enabled,
        decoration: InputDecoration(
          labelText: props.label,
          hintText: 'Milch, 2 l',
        ),
      ),
    ),
  ),
];

class const _Tile({required final Widget child}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(width: 320, child: child);
}

/// The knobs of a playground.
final class PlaygroundArgs(String label) extends StoryArgs<Widget> {
  this
    : enabled = BoolArg(true, name: 'Aktiv'),
      loading = BoolArg(false, name: 'Laden');

  final label = StringArg(label, name: 'Text');
  final BoolArg enabled;
  final BoolArg loading;

  @override
  List<Arg?> get list => [label, enabled, loading];
}

/// A control's stories: its playground, all states side by side, then one
/// story per state.
List<Story<Widget, StoryArgs<Widget>>> controlStories(Control control) => [
  if (control.playground)
    CatalogStory<PlaygroundArgs>(
      name: 'Spielwiese',
      args: PlaygroundArgs(control.label),
      builder: (context, args) => _Playground(
        control: control,
        props: ControlProps(
          label: args.label.value,
          enabled: args.enabled.value,
          loading: args.loading.value,
        ),
      ),
    ),
  plain('Alle Zustände', (context) => _AllStates(control)),
  for (final state in ControlState.values)
    if (control.states.contains(state))
      plain(state.label, (context) => _InState(control, state)),
];

class const _InState(final Control control, final ControlState state)
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => InteractionDriver(
    interaction: state.interaction,
    child: control.build(
      ControlProps(
        label: control.label,
        enabled: state.enabled,
        loading: state == ControlState.loading,
      ),
      () {},
    ),
  );
}

class const _AllStates(final Control control) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final caption = Theme.of(context).textTheme.labelMedium
        ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Wrap(
      spacing: HlSpace.s5,
      runSpacing: HlSpace.s5,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [
        for (final state in ControlState.values)
          if (control.states.contains(state))
            Column(
              mainAxisSize: MainAxisSize.min,
              spacing: HlSpace.s3,
              children: [
                _InState(control, state),
                Text(state.label, style: caption),
              ],
            ),
      ],
    );
  }
}

/// The control with real input: a press sinks the face and lets it bounce
/// back. Counts the presses, so a tap visibly lands.
class const _Playground({
  required final Control control,
  required final ControlProps props,
}) extends StatefulWidget {
  @override
  State<_Playground> createState() => _PlaygroundState();
}

class _PlaygroundState() extends State<_Playground> {
  var _presses = 0;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    spacing: HlSpace.s4,
    children: [
      widget.control.build(widget.props, () => setState(() => _presses++)),
      Text(
        'Gedrückt: $_presses×',
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    ],
  );
}
