import 'package:flutter/widgets.dart';

/// [duration], or none when the platform asks for reduced motion
/// (`MediaQuery.disableAnimations`). Every design-system animation runs its
/// duration through this.
Duration hlMotion(BuildContext context, Duration duration) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false
    ? Duration.zero
    : duration;
