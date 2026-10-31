/// The Hummel Hex Widgetbook: components, addons and the scenario matrix,
/// shared by the app (`main.dart`) and `testWidgetbook`.
library;

import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:hummel_hex_widgetbook/components.g.dart';
import 'package:hummel_hex_widgetbook/src/home.dart';
import 'package:hummel_hex_widgetbook/src/themes.dart';
import 'package:widgetbook/widgetbook.dart';

export 'package:hummel_hex_widgetbook/src/fonts.dart';

Config catalogConfig({ScenarioCallback? tearDown}) => Config(
  components: components,
  home: const CatalogHome(),
  appBuilder: (context, child) => WidgetsApp(
    color: HexColors.light.honey,
    debugShowCheckedModeBanner: false,
    builder: (context, _) => child,
  ),
  addons: [
    ThemeAddon<HexThemeData>(hexThemes, hexThemeBuilder),
    TextScaleAddon(),
    ViewportAddon([
      Viewports.none,
      IosViewports.iPhone13,
      AndroidViewports.samsungGalaxyS20,
    ]),
  ],
  scenarioConfig: ScenarioConfig(
    definitions: [
      ...themeScenarios,
      ScenarioDefinition(
        name: 'Text x2',
        modes: [TextScaleMode(2)],
        strategy: ScenarioStrategy.perStory,
      ),
      ScenarioDefinition(
        name: 'iPhone 13',
        modes: [ViewportMode(IosViewports.iPhone13)],
        strategy: ScenarioStrategy.perStory,
      ),
    ],
    tearDown: tearDown,
  ),
);
