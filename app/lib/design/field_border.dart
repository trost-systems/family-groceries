import 'dart:math' as math;

import 'package:family_groceries/design/hex_border.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';

/// The outline of a text field: a hex for single-line fields, a rounded
/// rectangle ([HlRadius.s]) for multi-line ones.
enum FieldShape() {
  hex,
  rounded,
}

/// A text field's 2 px contour in [shape], with an optional focus [ring]
/// [HlFocus.ringGap] outside it. Every state uses the same shape and width,
/// so focus changes only colours and never the field's padding.
///
/// [isOutline] is false, so a floating label stays inside the face instead
/// of cutting a gap into the contour.
class const ContourInputBorder({
  final FieldShape shape = FieldShape.hex,
  super.borderSide,
  final BorderSide ring = BorderSide.none,
}) extends InputBorder {
  static const _hex = HexBorder();

  /// [rect]'s outline moved outward by [outset].
  Path _path(Rect rect, double outset) => switch (shape) {
    FieldShape.hex => _hex.pathFor(rect, outset: outset),
    FieldShape.rounded =>
      Path()..addRRect(
        RRect.fromRectAndRadius(
          rect.inflate(outset),
          Radius.circular(math.max(0, HlRadius.s + outset)),
        ),
      ),
  };

  @override
  bool get isOutline => false;

  @override
  ContourInputBorder copyWith({BorderSide? borderSide, BorderSide? ring}) =>
      ContourInputBorder(
        shape: shape,
        borderSide: borderSide ?? this.borderSide,
        ring: ring ?? this.ring,
      );

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(borderSide.strokeInset);

  @override
  ContourInputBorder scale(double t) =>
      copyWith(borderSide: borderSide.scale(t), ring: ring.scale(t));

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      _path(rect, -borderSide.strokeInset);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      _path(rect, 0);

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    double? gapStart,
    double gapExtent = 0,
    double gapPercentage = 0,
    TextDirection? textDirection,
  }) {
    if (borderSide.style != BorderStyle.none && borderSide.width > 0) {
      canvas.drawPath(
        _path(rect, borderSide.strokeOffset / 2),
        borderSide.toPaint()..isAntiAlias = true,
      );
    }
    if (ring.style != BorderStyle.none && ring.width > 0) {
      canvas.drawPath(
        _path(rect, HlFocus.ringGap + ring.width / 2),
        ring.toPaint()..isAntiAlias = true,
      );
    }
  }

  ContourInputBorder _lerp(
    ContourInputBorder a,
    ContourInputBorder b,
    double t,
  ) => ContourInputBorder(
    shape: b.shape,
    borderSide: BorderSide.lerp(a.borderSide, b.borderSide, t),
    ring: BorderSide.lerp(a.ring, b.ring, t),
  );

  @override
  ShapeBorder? lerpFrom(ShapeBorder? a, double t) =>
      a is ContourInputBorder && a.shape == shape
      ? _lerp(a, this, t)
      : super.lerpFrom(a, t);

  @override
  ShapeBorder? lerpTo(ShapeBorder? b, double t) =>
      b is ContourInputBorder && b.shape == shape
      ? _lerp(this, b, t)
      : super.lerpTo(b, t);

  @override
  bool operator ==(Object other) =>
      other is ContourInputBorder &&
      other.shape == shape &&
      other.borderSide == borderSide &&
      other.ring == ring;

  @override
  int get hashCode => Object.hash(shape, borderSide, ring);
}

/// Text starts this far in from a hex field's edge: past the tip of a
/// 48 dp field plus a little air, which also clears the slant beside the
/// text and the floating label of a taller, labelled field.
const hexFieldInset = HlHex.tip * HlSize.target + HlSpace.s1;

/// Text field decoration in [shape], from the tokens: a raised face, the
/// 2 px contour (cobalt plus the focus ring when focused, the error colour
/// on an error, faded when disabled).
///
/// The app theme gives every field the hex. A theme cannot tell a
/// multi-line field from a single-line one, so multi-line fields sit in a
/// [RoundedFields].
InputDecorationThemeData fieldTheme(HummlistColors t, FieldShape shape) {
  ContourInputBorder contour(Color color, {bool focused = false}) =>
      ContourInputBorder(
        shape: shape,
        borderSide: BorderSide(color: color, width: HlBorder.width),
        ring: focused
            ? BorderSide(color: t.accent, width: HlFocus.ringWidth)
            : BorderSide.none,
      );
  final idle = contour(t.border);
  return InputDecorationThemeData(
    filled: true,
    fillColor: WidgetStateColor.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? t.surfaceSunken
          : t.surfaceRaised,
    ),
    hoverColor: Colors.transparent,
    contentPadding: switch (shape) {
      FieldShape.hex => const EdgeInsets.symmetric(
        horizontal: hexFieldInset,
        vertical: HlSpace.s2,
      ),
      FieldShape.rounded => const EdgeInsets.all(HlSpace.s3),
    },
    border: idle,
    enabledBorder: idle,
    focusedBorder: contour(t.brand, focused: true),
    errorBorder: contour(t.error),
    focusedErrorBorder: contour(t.error, focused: true),
    disabledBorder: contour(t.border.withValues(alpha: 0.38)),
  );
}

/// Gives the multi-line fields in [child] the rounded contour instead of the
/// theme's hex.
class const RoundedFields({required final Widget child, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => InputDecorationTheme(
    data: fieldTheme(
      HummlistColors.of(Theme.of(context).brightness),
      FieldShape.rounded,
    ),
    child: child,
  );
}
