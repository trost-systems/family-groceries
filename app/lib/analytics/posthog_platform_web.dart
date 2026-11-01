import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/analytics/flags.dart';
import 'package:web/web.dart' as web;

/// Loads posthog-js from this app's origin (`web/posthog/array.js`, a pinned
/// build: `scripts/posthog-js.sh`) and initializes it, once per page: it
/// keeps nothing in cookies or storage, loads no further scripts, captures
/// nothing by itself, and [_keepAllowed] strips every event to the
/// allow-list as the last step before it is sent.
Future<void> loadPostHogJs({
  required String host,
  required String projectKey,
  required String? installId,
}) async {
  if (globalContext['posthog'] case final JSObject loaded
      when loaded['__loaded'].dartify() == true) {
    return;
  }
  final script = web.HTMLScriptElement()..src = 'posthog/array.js';
  final done = Completer<void>();
  script
    ..onload = ((web.Event _) => done.complete()).toJS
    ..onerror = ((web.Event _) => done.completeError(
      StateError('posthog-js did not load'),
    )).toJS;
  web.document.head!.append(script);
  await done.future;
  final options =
      <String, Object?>{
            'api_host': host,
            'persistence': 'memory',
            'person_profiles': 'never',
            'autocapture': false,
            'capture_pageview': false,
            'capture_pageleave': false,
            'capture_dead_clicks': false,
            'capture_heatmaps': false,
            'capture_performance': false,
            'capture_exceptions': false,
            'rageclick': false,
            'disable_session_recording': true,
            'disable_surveys': true,
            'disable_product_tours': true,
            'disable_conversations': true,
            'disable_web_experiments': true,
            'disable_external_dependency_loading': true,
            'advanced_disable_toolbar_metrics': true,
            // No `/flags` request at all while flag lookups are off (Flags).
            'advanced_disable_flags': !flagLookups,
            'save_referrer': false,
            'save_campaign_params': false,
            'disable_compression': true,
            // Only a signed-in user's yes loads posthog-js, so no crawler
            // gets here; the filter would drop real users with an unusual
            // browser.
            'opt_out_useragent_filter': true,
            if (installId != null) 'bootstrap': {'distinctID': installId},
          }.jsify()!
          as JSObject;
  options['before_send'] = _keepAllowed.toJS;
  (globalContext['posthog']! as JSObject).callMethod<JSAny?>(
    'init'.toJS,
    projectKey.toJS,
    options,
  );
}

/// posthog-js' `before_send`: drops any event the app does not send and
/// every property outside [webEventKeys], the browser's URL, referrer and
/// user agent among them, and `$set`.
JSObject? _keepAllowed(JSObject event) {
  final name = event['event'].dartify();
  if (name is! String || !sentEventNames.contains(name)) {
    return null;
  }
  final properties = event['properties'];
  if (properties != null && properties.isA<JSObject>()) {
    properties as JSObject;
    final keys = (globalContext['Object']! as JSObject).callMethod<JSArray>(
      'keys'.toJS,
      properties,
    );
    for (final key in keys.toDart) {
      final k = (key! as JSString).toDart;
      if (!webEventKeys.contains(k)) {
        properties.delete(key);
      }
    }
  }
  event
    ..delete(r'$set'.toJS)
    ..delete(r'$set_once'.toJS);
  return event;
}

/// posthog-js keeps nothing on the device (persistence `memory`).
Future<void> forgetPostHogState(String projectKey) async {}
