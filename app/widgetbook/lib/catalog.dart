/// The Hummlist Widgetbook: components, addons and the scenario matrix,
/// shared by the app (`main.dart`) and the tests.
library;

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart' hide ThemeMode;
import 'package:hummlist_widgetbook/src/addons.dart';
import 'package:hummlist_widgetbook/src/app_widgets.dart';
import 'package:hummlist_widgetbook/src/controls.dart';
import 'package:hummlist_widgetbook/src/home.dart';
import 'package:hummlist_widgetbook/src/story.dart';
import 'package:hummlist_widgetbook/src/surfaces.dart';
import 'package:hummlist_widgetbook/src/tokens.dart';
import 'package:widgetbook/widgetbook.dart';

export 'package:hummlist_widgetbook/src/fonts.dart';

/// Every component of the catalogue, in navigation order.
final components = [
  for (final control in buttons)
    component('Material/Buttons', control.name, controlStories(control)),
  for (final control in selection)
    component('Material/Auswahl', control.name, controlStories(control)),
  ...surfaceComponents,
  ...appComponents,
  ...tokenComponents,
];

/// Puts the story on the theme's surface, centred with a gutter, on a
/// [Material] so ink and text styles come from the theme.
Widget _themed(BuildContext context, ThemeData theme, Widget child) => Theme(
  data: theme,
  child: Material(
    color: theme.colorScheme.surface,
    child: Center(
      child: Padding(padding: const EdgeInsets.all(24), child: child),
    ),
  ),
);

Config catalogConfig({ScenarioCallback? setUp}) => Config(
  components: components,
  home: const CatalogHome(),
  appBuilder: (context, child) => MaterialApp(
    debugShowCheckedModeBanner: false,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('de'),
    home: child,
  ),
  addons: [
    ThemeAddon<ThemeData>(themes, _themed),
    TextSizeAddon(),
    ReducedMotionAddon(),
    TimeDilationAddon(),
    ViewportAddon([
      Viewports.none,
      IosViewports.iPhone13,
      IosViewports.iPhoneSE,
      AndroidViewports.samsungGalaxyS20,
    ]),
  ],
  scenarioConfig: ScenarioConfig(
    definitions: [
      for (final MapEntry(key: name, value: theme) in themes.entries)
        ScenarioDefinition(
          name: name,
          modes: [ThemeMode<ThemeData>(name, theme, _themed)],
          strategy: ScenarioStrategy.perStory,
        ),
    ],
    setUp: setUp,
  ),
);
