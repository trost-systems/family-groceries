import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('webOsVersion', () {
    const cases = {
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36':
          'Chrome on Android',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1':
          'Safari on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1':
          'Chrome on iOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15':
          'Safari on macOS',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0':
          'Edge on Windows',
      'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0':
          'Firefox on Linux',
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36':
          'Samsung Internet on Android',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36':
          'Chrome on ChromeOS',
      '': 'Browser on unknown OS',
    };
    for (final MapEntry(key: ua, value: expected) in cases.entries) {
      test(expected, () {
        final got = webOsVersion(ua);
        expect(got, expected);
        // Family and OS only: no version, model or anything else.
        expect(got, isNot(matches(RegExp('[0-9]'))));
        expect(got.length, lessThanOrEqualTo(64));
      });
    }
  });

  group('fitField', () {
    test('trims and drops control characters', () {
      expect(fitField('  iOS\n18.1\t', 64), 'iOS 18.1');
    });

    test('empty is unknown, or what the caller says', () {
      expect(fitField('  ', 64), 'unknown');
      expect(fitField('', 16, empty: 'none'), 'none');
    });

    test('cuts at the limit in characters, not UTF-16 units', () {
      expect(fitField('🛒' * 70, 64).runes.length, 64);
      expect(fitField('a' * 40, 32), 'a' * 32);
    });
  });
}
