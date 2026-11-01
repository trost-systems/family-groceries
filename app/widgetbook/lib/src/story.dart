import 'package:flutter/widgets.dart';
import 'package:widgetbook/widgetbook.dart';

/// A story without knobs.
final class NoArgs() extends StoryArgs<Widget> {
  @override
  List<Arg?> get list => const [];
}

/// A hand-written story: Widgetbook's generator writes one subclass per
/// widget, the catalogue needs only this one.
final class CatalogStory<A extends StoryArgs<Widget>>({
  required String super.name,
  required super.args,
  required super.builder,
  super.setup,
}) extends Story<Widget, A>;

/// A story of [name] that builds [build].
CatalogStory<NoArgs> plain(String name, WidgetBuilder build) => CatalogStory(
  name: name,
  args: NoArgs(),
  builder: (context, _) => build(context),
);

/// A component in the navigation folder [path].
Component<Widget, StoryArgs<Widget>> component(
  String path,
  String name,
  List<Story<Widget, StoryArgs<Widget>>> stories,
) => Component(name: name, path: path, stories: stories);
