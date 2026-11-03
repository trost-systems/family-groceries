import 'package:family_groceries/oauth/device_label.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const mac = TargetPlatform.macOS;
  for (final (userAgent, platform, label) in [
    (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      mac,
      'Chrome · macOS',
    ),
    (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
          '(KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      mac,
      'Safari · macOS',
    ),
    (
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      TargetPlatform.windows,
      'Edge · Windows',
    ),
    (
      'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0',
      TargetPlatform.linux,
      'Firefox · Linux',
    ),
    (
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) '
          'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 '
          'Mobile/15E148 Safari/604.1',
      TargetPlatform.iOS,
      'Chrome · iOS',
    ),
    (
      'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) '
          'Chrome/141.0.0.0 Mobile Safari/537.36 OPR/90.0',
      TargetPlatform.android,
      'Opera · Android',
    ),
    (null, TargetPlatform.iOS, 'iOS'),
    ('undici', TargetPlatform.android, 'Android'),
  ]) {
    test('$label from ${userAgent ?? 'no browser'}', () {
      expect(deviceLabel(platform: platform, userAgent: userAgent), label);
    });
  }

  test('every label passes the server check', () {
    final allowed = RegExp(r'^[A-Za-z0-9 .()·-]{1,40}$');
    for (final platform in TargetPlatform.values) {
      expect(
        deviceLabel(platform: platform, userAgent: 'Firefox/1 Edg/1'),
        matches(allowed),
      );
    }
  });
}
