// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_import, prefer_relative_imports, directives_ordering, unused_element, strict_raw_type

part of 'gallery.stories.dart';

// **************************************************************************
// StoryGenerator
// **************************************************************************

typedef _Component = Component<Gallery, StoryArgs<Gallery>>;
typedef _Scenario = GalleryScenario;
typedef _Defaults = GalleryDefaults;
typedef _Story = GalleryStory;
typedef _Args = GalleryArgs;
final GalleryComponent = Component<Gallery, StoryArgs<Gallery>>(
  name: componentMeta.name ?? 'Gallery',
  path: componentMeta.path ?? '',
  docsBuilder: componentMeta.docsBuilder,
  docComment:
      r'''Every widget in both variants, light and dark, side by side.''',
  stories: [$AllVariants..$generatedName = 'AllVariants'],
);
typedef GalleryScenario = Scenario<Gallery, GalleryArgs>;
typedef GalleryDefaults = Defaults<Gallery, GalleryArgs>;

class GalleryStory extends Story<Gallery, GalleryArgs> {
  GalleryStory({
    super.name,
    super.designLink,
    super.setup,
    super.modes,
    GalleryArgs? args,
    StoryWidgetBuilder<Gallery, GalleryArgs>? builder,
    super.scenarios,
    super.excludeFromTests,
  }) : super(
         args: args ?? GalleryArgs(),
         builder: builder ?? (context, args) => Gallery(key: args.key),
       );
}

class GalleryArgs extends StoryArgs<Gallery> {
  GalleryArgs({Arg<Key?>? key}) : this.keyArg = $initArg('key', key, null);

  GalleryArgs.fixed({Key? key})
    : this.keyArg = $initArg('key', key == null ? null : Arg.fixed(key), null);

  final Arg<Key?>? keyArg;

  Key? get key => keyArg?.value;

  @override
  List<Arg?> get list => [keyArg];
}
