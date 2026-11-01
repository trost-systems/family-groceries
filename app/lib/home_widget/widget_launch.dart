import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

/// What a tap on a Home Screen widget asks for (docs/HOME_WIDGETS.md,
/// "Taps").
enum WidgetLaunch() {
  list,
  add,
}

/// `hummlist-widget://open/?homeWidget` is the list,
/// `hummlist-widget://add/?homeWidget` the list with the add sheet open;
/// any other link is not a widget's.
WidgetLaunch? widgetLaunchOf(Uri? uri) => uri?.scheme == 'hummlist-widget'
    ? switch (uri?.host) {
        'open' => WidgetLaunch.list,
        'add' => WidgetLaunch.add,
        _ => null,
      }
    : null;

/// The links of widget taps: the one that started the app, then the ones
/// that bring it back.
abstract interface class WidgetLaunches() {
  Future<Uri?> initial();

  Stream<Uri?> get taps;
}

class const PluginWidgetLaunches() implements WidgetLaunches {
  @override
  Future<Uri?> initial() => HomeWidget.initiallyLaunchedFromHomeWidget();

  @override
  Stream<Uri?> get taps => HomeWidget.widgetClicked;
}

/// The plugin on iOS and Android; the web and Linux have no widgets.
WidgetLaunches? widgetLaunchesFor({
  required bool web,
  required TargetPlatform platform,
}) =>
    !web &&
        (platform == TargetPlatform.iOS || platform == TargetPlatform.android)
    ? const PluginWidgetLaunches()
    : null;

/// Calls [onLaunch] for the tap that started the app and every later one.
/// A plugin that is missing or fails launches nothing.
StreamSubscription<Uri?> followWidgetLaunches(
  WidgetLaunches launches,
  void Function(WidgetLaunch launch) onLaunch,
) {
  void handle(Uri? uri) {
    if (widgetLaunchOf(uri) case final launch?) {
      onLaunch(launch);
    }
  }

  unawaited(launches.initial().then(handle, onError: (Object _) {}));
  return launches.taps.listen(handle, onError: (Object _) {});
}

/// An add sheet a widget asked for, until the List tab opens it. The List
/// tab may not be built yet (a cold start), so the request waits.
class AddSheetRequest() {
  var _pending = false;

  /// Opens the sheet while the List tab is built; it takes the request.
  void Function()? listTab;

  void request() {
    _pending = true;
    listTab?.call();
  }

  /// Whether a request was waiting; it is used up.
  bool take() {
    final pending = _pending;
    _pending = false;
    return pending;
  }
}
