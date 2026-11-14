import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/widgets.dart';

/// [duration], or none when the platform asks for reduced motion
/// (`MediaQuery.disableAnimations`). Every design-system animation runs its
/// duration through this.
Duration hlMotion(BuildContext context, Duration duration) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false
    ? Duration.zero
    : duration;

/// Scrolls [position] to [offset] in [HlDuration.short], or jumps there
/// with reduced motion: a scroll animation of zero length fails an assert,
/// and on the release web build throws before it ends (job 231).
Future<void> hlScrollTo(
  BuildContext context,
  ScrollPosition position,
  double offset,
) async {
  final duration = hlMotion(context, HlDuration.short);
  if (duration == Duration.zero) {
    position.jumpTo(offset);
  } else {
    await position.animateTo(
      offset,
      duration: duration,
      curve: HlEasing.standard,
    );
  }
}
