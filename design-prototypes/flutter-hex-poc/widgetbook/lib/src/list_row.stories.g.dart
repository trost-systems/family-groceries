// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_import, prefer_relative_imports, directives_ordering, unused_element, strict_raw_type

part of 'list_row.stories.dart';

// **************************************************************************
// StoryGenerator
// **************************************************************************

typedef _Component = Component<ListRow, StoryArgs<ListRow>>;
typedef _Scenario = ListRowScenario;
typedef _Defaults = ListRowDefaults;
typedef _Story = ListRowStory;
typedef _Args = ListRowInputArgs;
final ListRowComponent = Component<ListRow, StoryArgs<ListRow>>(
  name: componentMeta.name ?? 'ListRow',
  path: componentMeta.path ?? '',
  docsBuilder: componentMeta.docsBuilder,
  docComment: r'''One shopping list item: hex check box, title, optional subtitle, and a store
badge or a quantity. The whole row is the tap target and toggles [checked].''',
  stories: [
    $Unchecked..$generatedName = 'Unchecked',
    $Checked..$generatedName = 'Checked',
  ],
);
typedef ListRowScenario = Scenario<ListRow, ListRowInputArgs>;
typedef ListRowDefaults = Defaults<ListRow, ListRowInputArgs>;

class ListRowStory extends Story<ListRow, ListRowInputArgs> {
  ListRowStory({
    super.name,
    super.designLink,
    SetupBuilder<ListRow, ListRowInputArgs>? setup,
    super.modes,
    ListRowInputArgs? args,
    StoryWidgetBuilder<ListRow, ListRowInputArgs>? builder,
    super.scenarios,
    super.excludeFromTests,
  }) : super(
         args: args ?? ListRowInputArgs(),
         builder: builder ?? defaults.builder!,
         setup: setup ?? defaults.setup!,
       );
}

class ListRowInputArgs extends StoryArgs<ListRow> {
  ListRowInputArgs({
    Arg<String>? title,
    Arg<String>? subtitle,
    Arg<HexVariant?>? shape,
    Arg<bool>? checked,
    Arg<Trailing>? trailing,
    Arg<String>? store,
    Arg<String>? quantity,
    Arg<bool>? enabled,
    Arg<Interaction>? interaction,
  }) : this.titleArg = $initArg('title', title, StringArg('Hafermilch'))!,
       this.subtitleArg = $initArg('subtitle', subtitle, StringArg(''))!,
       this.shapeArg = $initArg(
         'shape',
         shape,
         NullableEnumArg<HexVariant>(null, values: HexVariant.values),
       )!,
       this.checkedArg = $initArg('checked', checked, BoolArg(false))!,
       this.trailingArg = $initArg(
         'trailing',
         trailing,
         EnumArg<Trailing>(Trailing.store, values: Trailing.values),
       )!,
       this.storeArg = $initArg('store', store, StringArg('Rewe'))!,
       this.quantityArg = $initArg('quantity', quantity, StringArg('2 l'))!,
       this.enabledArg = $initArg('enabled', enabled, BoolArg(true))!,
       this.interactionArg = $initArg(
         'interaction',
         interaction,
         EnumArg<Interaction>(Interaction.rest, values: Interaction.values),
       )!;

  ListRowInputArgs.fixed({
    String title = 'Hafermilch',
    String subtitle = '',
    HexVariant? shape = null,
    bool checked = false,
    Trailing trailing = Trailing.store,
    String store = 'Rewe',
    String quantity = '2 l',
    bool enabled = true,
    Interaction interaction = Interaction.rest,
  }) : this.titleArg = $initArg('title', Arg.fixed(title), null)!,
       this.subtitleArg = $initArg('subtitle', Arg.fixed(subtitle), null)!,
       this.shapeArg = $initArg(
         'shape',
         shape == null ? null : Arg.fixed(shape),
         null,
       ),
       this.checkedArg = $initArg('checked', Arg.fixed(checked), null)!,
       this.trailingArg = $initArg('trailing', Arg.fixed(trailing), null)!,
       this.storeArg = $initArg('store', Arg.fixed(store), null)!,
       this.quantityArg = $initArg('quantity', Arg.fixed(quantity), null)!,
       this.enabledArg = $initArg('enabled', Arg.fixed(enabled), null)!,
       this.interactionArg = $initArg(
         'interaction',
         Arg.fixed(interaction),
         null,
       )!;

  final Arg<String> titleArg;

  final Arg<String> subtitleArg;

  final Arg<HexVariant?>? shapeArg;

  final Arg<bool> checkedArg;

  final Arg<Trailing> trailingArg;

  final Arg<String> storeArg;

  final Arg<String> quantityArg;

  final Arg<bool> enabledArg;

  final Arg<Interaction> interactionArg;

  String get title => titleArg.value;

  String get subtitle => subtitleArg.value;

  HexVariant? get shape => shapeArg?.value;

  bool get checked => checkedArg.value;

  Trailing get trailing => trailingArg.value;

  String get store => storeArg.value;

  String get quantity => quantityArg.value;

  bool get enabled => enabledArg.value;

  Interaction get interaction => interactionArg.value;

  @override
  List<Arg?> get list => [
    titleArg,
    subtitleArg,
    shapeArg,
    checkedArg,
    trailingArg,
    storeArg,
    quantityArg,
    enabledArg,
    interactionArg,
  ];
}
