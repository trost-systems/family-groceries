import 'dart:async';
import 'dart:math';
import 'dart:ui' show SemanticsHitTestBehavior;

import 'package:family_groceries/design/hex_border.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tactile.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_view/shopping_list_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter/semantics.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Where the indicator is: nothing, the card, the pill in the top bar, or
/// a retry in flight (in the form it was tapped in).
enum SyncPhase() {
  hidden,
  open,
  collapsed,
  busy,
}

sealed class const SyncEvent();

/// The list's [ListState.trouble] changed; null: it syncs again.
final class const TroubleChanged(final SyncTrouble? kind) extends SyncEvent;

/// The card's 3 s are up.
final class const TimerFired() extends SyncEvent;

/// The user scrolled the list.
final class const Scrolled() extends SyncEvent;

/// The user swiped the card up.
final class const SwipedUp() extends SyncEvent;

/// A tap on the card or the pill.
final class const Tapped() extends SyncEvent;

/// The retry a failing tap started is over; [ok]: the list syncs again.
final class const RetryDone({required final bool ok}) extends SyncEvent;

@immutable
final class const SyncView({
  final SyncPhase phase = SyncPhase.hidden,

  /// The trouble shown; kept while hidden, so the leaving form keeps its
  /// face as it fades.
  final SyncTrouble? kind,

  /// While [SyncPhase.busy]: the form the retry was tapped in.
  final SyncPhase from = SyncPhase.collapsed,
}) {
  bool get showsCard =>
      phase == SyncPhase.open ||
      (phase == SyncPhase.busy && from == SyncPhase.open);

  bool get showsPill => phase != SyncPhase.hidden && !showsCard;

  @override
  bool operator ==(Object other) =>
      other is SyncView &&
      other.phase == phase &&
      other.kind == kind &&
      other.from == from;

  @override
  int get hashCode => Object.hash(phase, kind, from);
}

/// Design S2-C3F2 (job 157): the card opens for a new kind of trouble and
/// collapses into the pill after 3 s, on a scroll or on a swipe up. A tap
/// retries a failing sync, and toggles the offline card. The same kind
/// again never reopens it: the list retries every 3 s.
SyncView reduceSync(SyncView view, SyncEvent event) => switch (event) {
  TroubleChanged(kind: null) => SyncView(kind: view.kind),
  TroubleChanged(:final kind)
      when kind == view.kind && view.phase != SyncPhase.hidden =>
    view,
  TroubleChanged(:final kind) => SyncView(phase: SyncPhase.open, kind: kind),
  TimerFired() || Scrolled() || SwipedUp() =>
    view.phase == SyncPhase.open
        ? SyncView(phase: SyncPhase.collapsed, kind: view.kind)
        : view,
  Tapped() => switch (view.phase) {
    SyncPhase.hidden || SyncPhase.busy => view,
    final from when view.kind == SyncTrouble.failing => SyncView(
      phase: SyncPhase.busy,
      kind: view.kind,
      from: from,
    ),
    SyncPhase.open => SyncView(phase: SyncPhase.collapsed, kind: view.kind),
    SyncPhase.collapsed => SyncView(phase: SyncPhase.open, kind: view.kind),
  },
  RetryDone(:final ok) when view.phase == SyncPhase.busy => SyncView(
    phase: ok ? SyncPhase.hidden : SyncPhase.collapsed,
    kind: view.kind,
  ),
  RetryDone() => view,
};

/// The list's sync trouble over [child], the list: a floating hex card
/// below the top bar, collapsing into a pill in the bar's empty left slot.
/// Nothing while the list syncs, pending changes included; no word when it
/// syncs again (screen readers hear one after a retry). One layer for both
/// forms, so they share one state and the list never moves.
class const SyncIndicator({
  required final Widget child,

  /// The top bar's row, below the top safe area: the pill centres on it.
  required final double rowTop,
  required final double rowHeight,

  /// Where the card starts, below the top safe area.
  required final double cardTop,
  super.key,
}) extends StatefulWidget {
  /// How long the card stays open on its own.
  static const peek = Duration(seconds: 3);

  @override
  State<SyncIndicator> createState() => _SyncIndicatorState();
}

class _SyncIndicatorState()
    extends State<SyncIndicator>
    with TickerProviderStateMixin {
  late var _view = reduceSync(
    const SyncView(),
    TroubleChanged(context.read<ListCubit>().state.trouble),
  );
  Timer? _collapse;
  late final _card = AnimationController(
    vsync: this,
    value: _view.showsCard ? 1 : 0,
  );
  late final _pill = AnimationController(
    vsync: this,
    value: _view.showsPill ? 1 : 0,
  );

  /// The busy arrows: a turn, or with reduced motion a pulse.
  late final _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late final _nudge = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 360),
  );
  var _swipe = 0.0;

  bool get _reduced => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  @override
  void initState() {
    super.initState();
    _restartTimer(const SyncView(), _view);
  }

  @override
  void dispose() {
    _collapse?.cancel();
    _card.dispose();
    _pill.dispose();
    _spin.dispose();
    _nudge.dispose();
    super.dispose();
  }

  void _dispatch(SyncEvent event) {
    final before = _view;
    final after = reduceSync(before, event);
    if (after == before || !mounted) {
      return;
    }
    setState(() => _view = after);
    _restartTimer(before, after);
    final reduced = _reduced;
    // Reduced motion: every change is the same short crossfade.
    final fade = reduced
        ? const Duration(milliseconds: 200)
        : HlDuration.medium;
    _show(_card, shown: after.showsCard, duration: fade);
    _show(_pill, shown: after.showsPill, duration: fade);
    if (after.phase == SyncPhase.busy) {
      _spin.repeat(reverse: reduced);
    } else {
      _spin.reset();
    }
  }

  /// Backwards when leaving: an [AnimationController.animateTo] 0 ends
  /// completed, not dismissed, and the form would stay.
  static void _show(
    AnimationController form, {
    required bool shown,
    required Duration duration,
  }) => shown
      ? form.animateTo(1, duration: duration)
      : form.animateBack(0, duration: duration);

  void _restartTimer(SyncView before, SyncView after) {
    final opened =
        after.phase == SyncPhase.open &&
        (before.phase != SyncPhase.open || before.kind != after.kind);
    if (opened) {
      _collapse?.cancel();
      _collapse = Timer(
        SyncIndicator.peek,
        () => _dispatch(const TimerFired()),
      );
    } else if (after.phase != SyncPhase.open) {
      _collapse?.cancel();
      _collapse = null;
    }
  }

  Future<void> _tap() async {
    final before = _view;
    _dispatch(const Tapped());
    if (before.phase == SyncPhase.busy || _view.phase != SyncPhase.busy) {
      return;
    }
    final ok = await context.read<ListCubit>().retry();
    if (!mounted) {
      return;
    }
    final settled = _view.phase == SyncPhase.busy && !ok;
    _dispatch(RetryDone(ok: ok));
    if (settled && !_reduced) {
      _nudge.forward(from: 0);
    }
    if (ok || settled) {
      final l10n = AppLocalizations.of(context);
      unawaited(
        SemanticsService.sendAnnouncement(
          View.of(context),
          ok ? l10n.syncSynced : l10n.syncStillFailing,
          Directionality.of(context),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<ListCubit>().state;
    final top = MediaQuery.paddingOf(context).top;
    return BlocListener<ListCubit, ListState>(
      listenWhen: (a, b) => a.trouble != b.trouble,
      listener: (_, state) => _dispatch(TroubleChanged(state.trouble)),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final side =
              ShoppingListView.frameFor(constraints.maxWidth, state).side +
              HlSpace.s4;
          final row = constraints.maxWidth - 2 * side;
          return Stack(
            fit: StackFit.expand,
            children: [
              NotificationListener<UserScrollNotification>(
                // The user's own scrolls only, by drag, wheel or trackpad:
                // a list that moves for a new row is no reason.
                onNotification: (n) {
                  if (n.direction != ScrollDirection.idle &&
                      n.metrics.axis == Axis.vertical) {
                    _dispatch(const Scrolled());
                  }
                  return false;
                },
                child: widget.child,
              ),
              if (_view.kind case final kind?) ...[
                Positioned(
                  left: side,
                  top: top + widget.rowTop + (widget.rowHeight - _Pill.box) / 2,
                  child: _Presence(
                    animation: _pill,
                    shown: _view.showsPill,
                    reduced: _reduced,
                    alignment: Alignment.center,
                    from: 0.5,
                    grow: HlEasing.bounce,
                    child: _Nudge(
                      animation: _nudge,
                      child: MediaQuery.withClampedTextScaling(
                        maxScaleFactor: SyncPillSpace.maxTextScale,
                        child: _Pill(
                          kind: kind,
                          view: _view,
                          spin: _spin,
                          row: row,
                          onTap: () => unawaited(_tap()),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: side,
                  right: side,
                  top: top + widget.cardTop,
                  child: _Presence(
                    animation: _card,
                    shown: _view.showsCard,
                    reduced: _reduced,
                    // It shrinks towards the pill and grows out of it.
                    alignment: Alignment.topLeft,
                    from: 0.2,
                    grow: HlEasing.standard,
                    child: GestureDetector(
                      onVerticalDragStart: (_) => _swipe = 0,
                      onVerticalDragUpdate: (d) {
                        _swipe += d.delta.dy;
                        if (_swipe <= -20) {
                          _dispatch(const SwipedUp());
                        }
                      },
                      child: _Card(
                        kind: kind,
                        view: _view,
                        spin: _spin,
                        onTap: () => unawaited(_tap()),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// One form fading and scaling in or out. A leaving form is out of the
/// semantics tree and takes no taps at once: one indicator node at a time.
/// Reduced motion fades only.
class const _Presence({
  required final Animation<double> animation,
  required final bool shown,
  required final bool reduced,
  required final Alignment alignment,

  /// The scale it grows from.
  required final double from,
  required final Curve grow,
  required final Widget child,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: animation,
    builder: (context, child) =>
        animation.isDismissed ? const SizedBox.shrink() : child!,
    child: IgnorePointer(
      ignoring: !shown,
      child: ExcludeSemantics(
        excluding: !shown,
        child: FadeTransition(
          opacity: reduced
              ? animation
              : CurvedAnimation(
                  parent: animation,
                  curve: HlEasing.standard,
                  reverseCurve: HlEasing.exit,
                ),
          child: reduced
              ? child
              : ScaleTransition(
                  alignment: alignment,
                  scale: Tween<double>(begin: from, end: 1).animate(
                    CurvedAnimation(
                      parent: animation,
                      curve: grow,
                      reverseCurve: HlEasing.standard,
                    ),
                  ),
                  child: child,
                ),
        ),
      ),
    ),
  );
}

/// A short shake of the pill after a retry that failed again.
class const _Nudge({
  required final Animation<double> animation,
  required final Widget child,
}) extends StatelessWidget {
  static final _offset = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0, end: -4), weight: 25),
    TweenSequenceItem(tween: Tween(begin: -4, end: 4), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 4, end: -2), weight: 25),
    TweenSequenceItem(tween: Tween(begin: -2, end: 0), weight: 25),
  ]);

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: animation,
    builder: (context, child) => animation.isAnimating
        ? Transform.translate(
            offset: Offset(_offset.evaluate(animation), 0),
            child: child,
          )
        : child!,
    child: child,
  );
}

/// The face colours of a trouble: offline navy with light text, failing
/// honey with navy text (job 157's tone 1).
({Color face, Color text, Color edge}) _tone(
  SyncTrouble kind,
  Brightness brightness,
) {
  final t = HummlistColors.of(brightness);
  return switch (kind) {
    SyncTrouble.offline => (
      // Dark mode's inverse is the page itself; the lighter navy stands off.
      face: brightness == Brightness.light ? t.inverse : t.surfaceEdge,
      text: t.onInverse,
      edge: t.edge,
    ),
    SyncTrouble.failing => (face: t.honey, text: t.onHoney, edge: t.honeyEdge),
  };
}

/// The one semantics node of either form: the full sentence, so the pill
/// says as much as the card. Offline toggles the card; failing retries.
Widget _node(
  BuildContext context, {
  required SyncTrouble kind,
  required SyncView view,
  required VoidCallback onTap,
  required Widget child,
}) {
  final l10n = AppLocalizations.of(context);
  final busy = view.phase == SyncPhase.busy;
  return Semantics(
    container: true,
    button: true,
    // The rows under it keep their tappable web elements otherwise.
    hitTestBehavior: SemanticsHitTestBehavior.opaque,
    label: busy
        ? l10n.syncRetrying
        : switch (kind) {
            SyncTrouble.offline => l10n.syncOfflineLabel,
            SyncTrouble.failing => l10n.syncFailingLabel,
          },
    hint: switch (kind) {
      _ when busy => null,
      SyncTrouble.failing => l10n.retry,
      SyncTrouble.offline when !view.showsCard => l10n.syncDetails,
      SyncTrouble.offline => null,
    },
    expanded: kind == SyncTrouble.offline ? view.showsCard : null,
    onTap: busy ? null : onTap,
    excludeSemantics: true,
    child: child,
  );
}

/// The state icon; spinning sync arrows while a retry is in flight.
class const _StateIcon({
  required final SyncTrouble kind,
  required final bool busy,
  required final Animation<double> spin,
  required final Color color,
  required final double size,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    if (!busy) {
      return Icon(
        switch (kind) {
          SyncTrouble.offline => Icons.cloud_off,
          SyncTrouble.failing => Icons.sync_problem,
        },
        color: color,
        size: size,
      );
    }
    final arrows = Icon(Icons.sync, color: color, size: size);
    return MediaQuery.maybeDisableAnimationsOf(context) ?? false
        ? FadeTransition(
            opacity: Tween<double>(begin: 1, end: 0.35).animate(spin),
            child: arrows,
          )
        // Material's sync arrows turn anticlockwise.
        : RotationTransition(
            turns: Tween<double>(begin: 0, end: -1).animate(spin),
            child: arrows,
          );
  }
}

/// The collapsed form: a raised hex with the state icon and one word, in the
/// top bar's empty left slot. 36 px to see, 48 px to tap.
class const _Pill({
  required final SyncTrouble kind,
  required final SyncView view,
  required final Animation<double> spin,

  /// The top bar's row: the pill leaves Anpassen its room.
  required final double row,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  /// The tap area's height.
  static const box = HlSize.target;

  /// The face and its edge.
  static const _height = 36.0;

  static const _pad = HlHex.tip * _height + HlSpace.s2;
  static const _icon = 18.0;
  static const _gap = HlSpace.s1 + 2;

  /// Anpassen at its widest and the bar's gaps before it, the partner's
  /// capsule's included (it shrinks to fit).
  static const _anpassen = 160.0 + 2 * HlSpace.s2;

  static TextStyle _wordStyle(BuildContext context) =>
      (Theme.of(context).textTheme.labelLarge ?? const TextStyle()).copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w700,
      );

  static String _word(AppLocalizations l10n, SyncTrouble kind) =>
      switch (kind) {
        SyncTrouble.offline => l10n.syncOffline,
        SyncTrouble.failing => l10n.syncFailingWord,
      };

  /// As wide as the word sets, but never into Anpassen's room: there the
  /// word shrinks (320 px at large text).
  static double width(BuildContext context, SyncTrouble kind, double row) {
    final word = TextPainter(
      text: TextSpan(
        text: _word(AppLocalizations.of(context), kind),
        style: _wordStyle(context),
      ),
      textScaler: MediaQuery.textScalerOf(context),
      textDirection: Directionality.of(context),
      maxLines: 1,
    )..layout();
    final natural = 2 * _pad + _icon + _gap + word.width.ceilToDouble();
    word.dispose();
    return min(natural, max(box, row - _anpassen));
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final t = HummlistColors.of(brightness);
    final tone = _tone(kind, brightness);
    return _node(
      context,
      kind: kind,
      view: view,
      onTap: onTap,
      child: TextButton(
        key: const ValueKey('sync-pill'),
        onPressed: onTap,
        style:
            tactileButtonStyle(
              colors: (_) => TactileColors(
                face: tone.face,
                contour: t.border,
                edge: tone.edge,
                focus: t.accent,
              ),
              foreground: WidgetStatePropertyAll(tone.text),
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ).copyWith(
              minimumSize: const WidgetStatePropertyAll(Size(box, _height)),
              fixedSize: WidgetStatePropertyAll(
                Size(width(context, kind, row), _height),
              ),
              tapTargetSize: MaterialTapTargetSize.padded,
              visualDensity: VisualDensity.standard,
              padding: const WidgetStatePropertyAll(
                EdgeInsets.symmetric(horizontal: _pad),
              ),
            ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: _gap,
          children: [
            _StateIcon(
              kind: kind,
              busy: view.phase == SyncPhase.busy,
              spin: spin,
              color: tone.text,
              size: _icon,
            ),
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  _word(AppLocalizations.of(context), kind),
                  maxLines: 1,
                  style: _wordStyle(context).copyWith(color: tone.text),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Holds the pill's width in the top bar while there is trouble, so the
/// partner's "neu von" capsule never runs under it.
class const SyncPillSpace({
  /// The top bar's row width.
  required final double row,
  super.key,
}) extends StatelessWidget {
  /// The bar's and the pill's: large text still fits the 52 high bar.
  static const maxTextScale = 1.5;

  @override
  Widget build(BuildContext context) {
    final kind = context.select<ListCubit, SyncTrouble?>(
      (c) => c.state.trouble,
    );
    return kind == null
        ? const SizedBox.shrink()
        : SizedBox(width: _Pill.width(context, kind, row));
  }
}

/// The expanded form: a floating hex card under the top bar with the state
/// icon, a bold title and one line; failing adds a retry button.
class const _Card({
  required final SyncTrouble kind,
  required final SyncView view,
  required final Animation<double> spin,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final brightness = Theme.of(context).brightness;
    final t = HummlistColors.of(brightness);
    final tone = _tone(kind, brightness);
    final busy = view.phase == SyncPhase.busy;
    final failing = kind == SyncTrouble.failing;
    return _node(
      context,
      kind: kind,
      view: view,
      onTap: onTap,
      child: DecoratedBox(
        key: const ValueKey('sync-indicator'),
        decoration: ShapeDecoration(
          shape: const HexBorder(),
          shadows: HlSticker.shadow(brightness, StickerDepth.s),
        ),
        child: Material(
          color: tone.face,
          shape: HexBorder(
            side: BorderSide(color: t.border, width: HlBorder.width),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            customBorder: const HexBorder(),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Padding(
                // The tips grow with the card's height: the text keeps clear
                // of them at large text sizes, the icon and the button sit
                // where the card is widest.
                padding: EdgeInsets.fromLTRB(
                  HlSpace.s5 + 2,
                  HlSpace.s2 + 2,
                  failing ? HlSpace.s5 - 2 : HlSpace.s6 + HlSpace.s2,
                  HlSpace.s2 + 2,
                ),
                child: Row(
                  spacing: HlSpace.s3,
                  children: [
                    _StateIcon(
                      kind: kind,
                      busy: busy,
                      spin: spin,
                      color: tone.text,
                      size: 24,
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            failing ? l10n.syncFailing : l10n.syncOffline,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: tone.text,
                            ),
                          ),
                          Text(
                            failing
                                ? l10n.syncFailingLine
                                : l10n.syncOfflineLine,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.3,
                              color: tone.text,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (failing)
                      // The card is the button for screen readers and the
                      // keyboard; this is its visible cue.
                      ExcludeFocus(
                        child: AnimatedOpacity(
                          opacity: busy ? 0.45 : 1,
                          duration: HlDuration.short,
                          child: OutlinedButton(
                            key: const ValueKey('sync-retry'),
                            onPressed: onTap,
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(52, 40),
                              fixedSize: const Size(52, 40),
                              padding: EdgeInsets.zero,
                              tapTargetSize: MaterialTapTargetSize.padded,
                              visualDensity: VisualDensity.standard,
                            ),
                            child: const Icon(Icons.refresh, size: 20),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
