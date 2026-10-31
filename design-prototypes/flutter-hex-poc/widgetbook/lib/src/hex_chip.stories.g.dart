// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_import, prefer_relative_imports, directives_ordering, unused_element, strict_raw_type

part of 'hex_chip.stories.dart';

// **************************************************************************
// StoryGenerator
// **************************************************************************

typedef _Component = Component<HexChip, StoryArgs<HexChip>>;
typedef _Scenario = HexChipScenario;
typedef _Defaults = HexChipDefaults;
typedef _Story = HexChipStory;
typedef _Args = HexChipInputArgs;
final HexChipComponent = Component<HexChip, StoryArgs<HexChip>>(
  name: componentMeta.name ?? 'HexChip',
  path: componentMeta.path ?? '',
  docsBuilder: componentMeta.docsBuilder,
  docComment: r'''A selectable hex chip, such as a store filter. A selected chip stays pushed
into its edge and turns honey, so selection reads from shape and colour, not
colour alone.''',
  stories: [
    $Unselected..$generatedName = 'Unselected',
    $Selected..$generatedName = 'Selected',
  ],
);
typedef HexChipScenario = Scenario<HexChip, HexChipInputArgs>;
typedef HexChipDefaults = Defaults<HexChip, HexChipInputArgs>;

class HexChipStory extends Story<HexChip, HexChipInputArgs> {
  HexChipStory({
    super.name,
    super.designLink,
    SetupBuilder<HexChip, HexChipInputArgs>? setup,
    super.modes,
    HexChipInputArgs? args,
    StoryWidgetBuilder<HexChip, HexChipInputArgs>? builder,
    super.scenarios,
    super.excludeFromTests,
  }) : super(
         args: args ?? HexChipInputArgs(),
         builder: builder ?? defaults.builder!,
         setup: setup ?? defaults.setup!,
       );
}

class HexChipInputArgs extends StoryArgs<HexChip> {
  HexChipInputArgs({
    Arg<String>? label,
    Arg<HexVariant?>? shape,
    Arg<bool>? selected,
    Arg<bool>? enabled,
    Arg<Interaction>? interaction,
  }) : this.labelArg = $initArg('label', label, StringArg('Rewe'))!,
       this.shapeArg = $initArg(
         'shape',
         shape,
         NullableEnumArg<HexVariant>(null, values: HexVariant.values),
       )!,
       this.selectedArg = $initArg('selected', selected, BoolArg(false))!,
       this.enabledArg = $initArg('enabled', enabled, BoolArg(true))!,
       this.interactionArg = $initArg(
         'interaction',
         interaction,
         EnumArg<Interaction>(Interaction.rest, values: Interaction.values),
       )!;

  HexChipInputArgs.fixed({
    String label = 'Rewe',
    HexVariant? shape = null,
    bool selected = false,
    bool enabled = true,
    Interaction interaction = Interaction.rest,
  }) : this.labelArg = $initArg('label', Arg.fixed(label), null)!,
       this.shapeArg = $initArg(
         'shape',
         shape == null ? null : Arg.fixed(shape),
         null,
       ),
       this.selectedArg = $initArg('selected', Arg.fixed(selected), null)!,
       this.enabledArg = $initArg('enabled', Arg.fixed(enabled), null)!,
       this.interactionArg = $initArg(
         'interaction',
         Arg.fixed(interaction),
         null,
       )!;

  final Arg<String> labelArg;

  final Arg<HexVariant?>? shapeArg;

  final Arg<bool> selectedArg;

  final Arg<bool> enabledArg;

  final Arg<Interaction> interactionArg;

  String get label => labelArg.value;

  HexVariant? get shape => shapeArg?.value;

  bool get selected => selectedArg.value;

  bool get enabled => enabledArg.value;

  Interaction get interaction => interactionArg.value;

  @override
  List<Arg?> get list => [
    labelArg,
    shapeArg,
    selectedArg,
    enabledArg,
    interactionArg,
  ];
}
