import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';

/// Lays [child] out as usual and covers the top safe area over it with the
/// page's surface, ending in a short fade: content scrolled up disappears
/// before the clock and battery instead of being cut by a hard line. Where
/// there is no top inset (desktop, web) nothing is drawn. Takes no taps.
class const StatusBarBackdrop({
  required final Widget child,

  /// The fade below the inset. The list's is its bar's gap above the
  /// buttons, so it never washes them out.
  final double fade = HlSpace.s2,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    if (top == 0) {
      return child;
    }
    final surface = Theme.of(context).scaffoldBackgroundColor;
    return Stack(
      fit: StackFit.passthrough,
      children: [
        child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: top + fade,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [surface, surface, surface.withValues(alpha: 0)],
                  stops: [0, top / (top + fade), 1],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
