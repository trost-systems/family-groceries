import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/src/tokens.g.dart';

/// What the Hummel Hex widgets read from the tree: one colour set and one hex
/// variant.
@immutable
final class const HexThemeData({
  required final HexVariant variant,
  required final Brightness brightness,
}) {
  HexColors get colors => switch (brightness) {
    Brightness.light => HexColors.light,
    Brightness.dark => HexColors.dark,
  };

  HexShapeTokens get shape => HexShapeTokens.of(variant);

  @override
  bool operator ==(Object other) =>
      other is HexThemeData &&
      other.variant == variant &&
      other.brightness == brightness;

  @override
  int get hashCode => Object.hash(variant, brightness);
}

class const HexTheme({
  required final HexThemeData data,
  required super.child,
  super.key,
}) extends InheritedWidget {
  static HexThemeData of(BuildContext context) {
    final theme = context.dependOnInheritedWidgetOfExactType<HexTheme>();
    assert(theme != null, 'No HexTheme above this widget');
    return theme!.data;
  }

  @override
  bool updateShouldNotify(HexTheme oldWidget) => data != oldWidget.data;
}
