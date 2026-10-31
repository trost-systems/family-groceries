import 'dart:io';

import 'package:family_groceries/analytics/posthog_platform_io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// What an off deletes of the SDK's own files (job 44): the More switch says
/// it deletes the install id on the device.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory support;

  Future<void> forget() => forgetPostHogState(
    'phc_unit_test',
    supportDirectory: () async => support,
    bundleId: () async => 'com.hummlist.app',
  );

  setUp(() {
    support = Directory.systemTemp.createTempSync('posthog-state');
  });

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    support.deleteSync(recursive: true);
  });

  test('iOS: the posthog files in Application Support/<bundle id>, and '
      'nothing else', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    final folder = Directory('${support.path}/com.hummlist.app')..createSync();
    for (final name in ['posthog.anonymousId', 'posthog.deviceId']) {
      File('${folder.path}/$name').writeAsStringSync('0198-…');
    }
    Directory('${folder.path}/posthog.queueFolder.uuid').createSync();
    File('${folder.path}/other.json').writeAsStringSync('{}');

    await forget();

    expect(
      folder.listSync().map(
        (e) => e.uri.pathSegments.lastWhere((s) => s != ''),
      ),
      ['other.json'],
    );
    await forget();
  });

  test('Linux: the SDK folder of this project', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    final folder = Directory('${support.path}/posthog/phc_unit_test')
      ..createSync(recursive: true);
    File('${folder.path}/state.json').writeAsStringSync('{}');
    final other = Directory('${support.path}/posthog/phc_other')..createSync();

    await forget();

    expect(folder.existsSync(), isFalse);
    expect(other.existsSync(), isTrue);
  });
}
