// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_import, prefer_relative_imports, directives_ordering, unused_element, strict_raw_type

part of 'hex_button.stories.dart';

// **************************************************************************
// StoryGenerator
// **************************************************************************

typedef _Component = Component<HexButton, StoryArgs<HexButton>>;
typedef _Scenario = HexButtonScenario;
typedef _Defaults = HexButtonDefaults;
typedef _Story = HexButtonStory;
typedef _Args = HexButtonInputArgs;
final HexButtonComponent = Component<HexButton, StoryArgs<HexButton>>(
  name: componentMeta.name ?? 'HexButton',
  path: componentMeta.path ?? '',
  docsBuilder: componentMeta.docsBuilder,
  docComment: r'''A hexagonal, tactile button. Sharp or soft corners come from the ambient
[HexTheme].''',
  stories: [
    $Primary..$generatedName = 'Primary',
    $Secondary..$generatedName = 'Secondary',
    $Quiet..$generatedName = 'Quiet',
  ],
);
typedef HexButtonScenario = Scenario<HexButton, HexButtonInputArgs>;
typedef HexButtonDefaults = Defaults<HexButton, HexButtonInputArgs>;

class HexButtonStory extends Story<HexButton, HexButtonInputArgs> {
  HexButtonStory({
    super.name,
    super.designLink,
    SetupBuilder<HexButton, HexButtonInputArgs>? setup,
    super.modes,
    HexButtonInputArgs? args,
    StoryWidgetBuilder<HexButton, HexButtonInputArgs>? builder,
    super.scenarios,
    super.excludeFromTests,
  }) : super(
         args: args ?? HexButtonInputArgs(),
         builder: builder ?? defaults.builder!,
         setup: setup ?? defaults.setup!,
       );
}

class HexButtonInputArgs extends StoryArgs<HexButton> {
  HexButtonInputArgs({
    Arg<String>? label,
    Arg<HexVariant?>? shape,
    Arg<HexButtonKind>? kind,
    Arg<HexButtonSize>? size,
    Arg<bool>? enabled,
    Arg<bool>? withIcon,
    Arg<Interaction>? interaction,
  }) : this.labelArg = $initArg('label', label, StringArg('Speichern'))!,
       this.shapeArg = $initArg(
         'shape',
         shape,
         NullableEnumArg<HexVariant>(null, values: HexVariant.values),
       )!,
       this.kindArg = $initArg(
         'kind',
         kind,
         EnumArg<HexButtonKind>(
           HexButtonKind.primary,
           values: HexButtonKind.values,
         ),
       )!,
       this.sizeArg = $initArg(
         'size',
         size,
         EnumArg<HexButtonSize>(
           HexButtonSize.regular,
           values: HexButtonSize.values,
         ),
       )!,
       this.enabledArg = $initArg('enabled', enabled, BoolArg(true))!,
       this.withIconArg = $initArg('withIcon', withIcon, BoolArg(false))!,
       this.interactionArg = $initArg(
         'interaction',
         interaction,
         EnumArg<Interaction>(Interaction.rest, values: Interaction.values),
       )!;

  HexButtonInputArgs.fixed({
    String label = 'Speichern',
    HexVariant? shape = null,
    HexButtonKind kind = HexButtonKind.primary,
    HexButtonSize size = HexButtonSize.regular,
    bool enabled = true,
    bool withIcon = false,
    Interaction interaction = Interaction.rest,
  }) : this.labelArg = $initArg('label', Arg.fixed(label), null)!,
       this.shapeArg = $initArg(
         'shape',
         shape == null ? null : Arg.fixed(shape),
         null,
       ),
       this.kindArg = $initArg('kind', Arg.fixed(kind), null)!,
       this.sizeArg = $initArg('size', Arg.fixed(size), null)!,
       this.enabledArg = $initArg('enabled', Arg.fixed(enabled), null)!,
       this.withIconArg = $initArg('withIcon', Arg.fixed(withIcon), null)!,
       this.interactionArg = $initArg(
         'interaction',
         Arg.fixed(interaction),
         null,
       )!;

  final Arg<String> labelArg;

  final Arg<HexVariant?>? shapeArg;

  final Arg<HexButtonKind> kindArg;

  final Arg<HexButtonSize> sizeArg;

  final Arg<bool> enabledArg;

  final Arg<bool> withIconArg;

  final Arg<Interaction> interactionArg;

  String get label => labelArg.value;

  HexVariant? get shape => shapeArg?.value;

  HexButtonKind get kind => kindArg.value;

  HexButtonSize get size => sizeArg.value;

  bool get enabled => enabledArg.value;

  bool get withIcon => withIconArg.value;

  Interaction get interaction => interactionArg.value;

  @override
  List<Arg?> get list => [
    labelArg,
    shapeArg,
    kindArg,
    sizeArg,
    enabledArg,
    withIconArg,
    interactionArg,
  ];
}
