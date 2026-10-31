import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

/// posthog-js is the web's: native and desktop builds run the SDK itself.
Future<void> loadPostHogJs({
  required String host,
  required String projectKey,
  required String? installId,
}) async {}

/// Deletes what the native SDK keeps on the device (its anonymous and
/// device ids, queued events, flags, super properties), so an off deletes
/// the install id as the More switch says (docs/ANALYTICS.md, "Consent").
/// Call only while the SDK is stopped; doing it twice does no harm.
Future<void> forgetPostHogState(
  String projectKey, {
  Future<Directory> Function() supportDirectory =
      getApplicationSupportDirectory,
  Future<String> Function() bundleId = _bundleId,
}) async {
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      // posthog-android's preferences live in memory too; only Android's
      // own API clears both (MainActivity.kt).
      await posthogStateChannel.invokeMethod<void>('forget', {
        'projectToken': projectKey,
      });
    case TargetPlatform.iOS || TargetPlatform.macOS:
      // posthog-ios: `posthog.*` files in Application Support/<bundle id>.
      final folder = Directory(
        '${(await supportDirectory()).path}/${await bundleId()}',
      );
      if (folder.existsSync()) {
        for (final entry in folder.listSync()) {
          if (entry.uri.pathSegments
              .lastWhere((s) => s.isNotEmpty)
              .startsWith('posthog.')) {
            entry.deleteSync(recursive: true);
          }
        }
      }
    case TargetPlatform.linux || TargetPlatform.windows:
      final folder = Directory(
        '${(await supportDirectory()).path}/posthog/$projectKey',
      );
      if (folder.existsSync()) {
        folder.deleteSync(recursive: true);
      }
    case TargetPlatform.fuchsia:
      break;
  }
}

Future<String> _bundleId() async =>
    (await PackageInfo.fromPlatform()).packageName;

/// MainActivity's channel for posthog-android's state.
@visibleForTesting
const posthogStateChannel = MethodChannel('familygroceries/posthog');
