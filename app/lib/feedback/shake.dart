import 'dart:async';
import 'dart:collection';
import 'dart:math' as math;

import 'package:family_groceries/app/notices.dart';
import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:family_groceries/feedback/feedback_sheet.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// Phones shake; a browser or a desktop window can't (job 138).
bool shakeSupported({required bool web, required TargetPlatform platform}) =>
    !web &&
    (platform == TargetPlatform.android || platform == TargetPlatform.iOS);

/// Tells a shake from walking, a bump or putting the phone down: at least
/// [peaks] swings over [threshold] g within [window], then nothing for
/// [cooldown].
class ShakeDetector() {
  /// In g, gravity included: a phone at rest reads 1.
  static const threshold = 2.7;
  static const peaks = 3;
  static const window = Duration(milliseconds: 800);
  static const cooldown = Duration(milliseconds: 1500);
  static const _gravity = 9.81;

  final _peaks = Queue<DateTime>();
  var _above = false;
  DateTime? _quietUntil;

  /// Takes one sample; true when it completes a shake.
  bool add(AccelerometerEvent sample) {
    final g =
        math.sqrt(
          sample.x * sample.x + sample.y * sample.y + sample.z * sample.z,
        ) /
        _gravity;
    final above = g > threshold;
    // A swing is one peak however many samples it spans.
    final rising = above && !_above;
    _above = above;
    final at = sample.timestamp;
    if (!rising || (_quietUntil?.isAfter(at) ?? false)) {
      return false;
    }
    _peaks.add(at);
    while (at.difference(_peaks.first) > window) {
      _peaks.removeFirst();
    }
    if (_peaks.length < peaks) {
      return false;
    }
    _peaks.clear();
    _quietUntil = at.add(cooldown);
    return true;
  }
}

/// A shake on a signed-in screen opens the feedback form about that
/// screen (job 138). Listens only on iOS and Android, and only while the
/// app is in front.
class const ShakeToFeedback({
  required final Widget child,
  super.key,

  /// The accelerometer; fake samples in tests. A broadcast stream: a
  /// household switch builds this widget again, which listens again.
  final Stream<AccelerometerEvent>? samples,
}) extends StatefulWidget {
  @override
  State<ShakeToFeedback> createState() => _ShakeToFeedbackState();
}

class _ShakeToFeedbackState() extends State<ShakeToFeedback> {
  final _detector = ShakeDetector();
  AppLifecycleListener? _lifecycle;
  StreamSubscription<AccelerometerEvent>? _subscription;

  @override
  void initState() {
    super.initState();
    if (!shakeSupported(web: kIsWeb, platform: defaultTargetPlatform)) {
      return;
    }
    _lifecycle = AppLifecycleListener(
      onResume: _listen,
      onInactive: _stop,
      onHide: _stop,
    );
    _listen();
  }

  void _listen() => _subscription ??=
      (widget.samples ??
              accelerometerEventStream(
                samplingPeriod: SensorInterval.gameInterval,
              ))
          .listen(
            _onSample,
            // A phone without an accelerometer: no shake, nothing else.
            onError: (Object _) => _stop(),
            cancelOnError: true,
          );

  void _stop() {
    unawaited(_subscription?.cancel());
    _subscription = null;
  }

  void _onSample(AccelerometerEvent sample) {
    if (_detector.add(sample) && mounted && !Popups.openAbove(context)) {
      unawaited(showFeedbackSheet(context, entry: FeedbackEntryPoint.shake));
    }
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    _stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
