import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:widgetbook/widgetbook.dart';

/// The four themes of the Theme addon and the scenario matrix: both hex
/// variants in light and dark.
final hexThemes = {
  for (final variant in HexVariant.values)
    for (final brightness in [Brightness.light, Brightness.dark])
      themeName(variant, brightness): HexThemeData(
        variant: variant,
        brightness: brightness,
      ),
};

String themeName(HexVariant variant, Brightness brightness) =>
    '${_title(variant.name)} · ${_title(brightness.name)}';

String _title(String name) => name[0].toUpperCase() + name.substring(1);

/// Provides [theme] to the story, paints its surface behind it and sets the
/// text style a Hummel Hex screen starts from, so text never inherits the
/// Viewport frame's Material fallback style (a yellow underline).
Widget hexThemeBuilder(
  BuildContext context,
  HexThemeData theme,
  Widget child,
) => HexTheme(
  data: theme,
  child: DefaultTextStyle(
    style: HexType.body.copyWith(color: theme.colors.text),
    child: ColoredBox(
      color: theme.colors.surface,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(HexSpace.s5),
          child: child,
        ),
      ),
    ),
  ),
);

/// One scenario dimension per theme: every state in Sharp and Soft, light
/// and dark.
final themeScenarios = [
  for (final MapEntry(key: name, value: theme) in hexThemes.entries)
    ScenarioDefinition(
      name: name,
      modes: [ThemeMode<HexThemeData>(name, theme, hexThemeBuilder)],
    ),
];

/// Applies a story's `shape` arg: null keeps the variant from the Theme addon.
Widget withShape(BuildContext context, HexVariant? shape, Widget child) {
  if (shape == null) {
    return child;
  }
  final theme = HexTheme.of(context);
  return HexTheme(
    data: HexThemeData(variant: shape, brightness: theme.brightness),
    child: child,
  );
}
