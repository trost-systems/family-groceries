import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/exceptions.dart';
import 'package:family_groceries/analytics/setup.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'fakes.dart';

class _AppError() implements Exception {
  @override
  String toString() => 'could not tick Hafermilch for peter@example.com';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('scrubMessage', () {
    test('a server error keeps only its code', () {
      expect(
        scrubMessage(
          const PostgrestException(
            message: 'duplicate key value (name)=(Hafermilch)',
            code: '23505',
          ),
        ),
        '23505',
      );
      expect(
        scrubMessage(const AuthException('Invalid login for peter@x.de')),
        '<redacted>',
      );
      expect(
        scrubMessage(const HouseholdError(HouseholdProblem.invalidInvite)),
        'invalidInvite',
      );
    });

    test("the app's own and format errors say nothing", () {
      expect(scrubMessage(_AppError()), '<redacted>');
      expect(
        scrubMessage(const FormatException('bad', 'Milch, 2 Gurken')),
        '<redacted>',
      );
      expect(scrubMessage(Exception('Klopapier')), '<redacted>');
      expect(scrubMessage('Hafermilch'), '<redacted>');
    });

    test('runtime errors keep the shape of their text, nothing else', () {
      expect(scrubMessage(StateError('No element')), 'Bad state: No element');
      expect(
        scrubMessage(StateError('item "Hafermilch" from peter@example.com')),
        'Bad state: <w> <redacted> from <email>',
      );
      expect(
        scrubMessage(RangeError.index(5, [1, 2], 'items')),
        'RangeError (<w>): Index out of range: index should be less than <n>: '
        '<n>',
      );
      expect(
        scrubMessage(RangeError.range(5, 0, 1)),
        'RangeError: Invalid value: Not in inclusive range <n>..<n>: <n>',
      );
      expect(
        scrubMessage(
          FlutterError('A RenderFlex overflowed by 42.0 pixels on the right.'),
        ),
        'A RenderFlex overflowed by <n> pixels on the right.',
      );
      expect(
        scrubMessage(
          StateError(
            'at https://x.supabase.co/rest/v1/items?name=eq.Milch '
            'id 0f8fad5b-d9cb-469f-a165-70867728950e 1234567',
          ),
        ),
        'Bad state: at <url> <w> <uuid> <n>',
      );
      expect(
        scrubMessage(FlutterError('A RenderFlex overflowed.\nText("Milch")')),
        'A RenderFlex overflowed.',
      );
      expect(
        scrubMessage(StateError("‘Brot’ „Käse“ «Wurst» 'Ei'")),
        'Bad state: <redacted> <redacted> <redacted> <redacted>',
      );
    });

    test('errors the runtime raises stay readable', () {
      Object caught(void Function() body) {
        try {
          body();
        } on Object catch (e) {
          return e;
        }
        return fail('no error');
      }

      const String? missing = null;
      const Object? notAString = null;
      expect(
        scrubMessage(caught(() => missing!.length)),
        'Null check operator used on a null value',
      );
      expect(
        scrubMessage(caught(() => (notAString as dynamic) as String)),
        'type <redacted> is not a subtype of type <redacted> in type cast',
      );
      expect(
        scrubMessage(caught(() => <int>[].first)),
        'Bad state: No element',
      );
    });

    test('a long message is cut', () {
      expect(scrubMessage(StateError('x' * 1000)), 'Bad state: <w>');
      expect(scrubMessage(StateError('cannot set ' * 40)).length, 120);
    });
  });

  group('error reports', () {
    late NativePostHog native;
    late Analytics analytics;

    setUp(() async {
      native = NativePostHog()..install();
      analytics = await loadedAnalytics(MemoryAnalyticsStore())
        ..setUser(customer);
      await analytics.decide(granted: true);
    });

    tearDown(() => analytics.close());

    Future<Map<String, Object?>> reportOf(Object error, [StackTrace? s]) async {
      analytics.captureException(error, s);
      await analytics.flush();
      final event = native.events.last;
      expect(event['event'], r'$exception');
      return propsOf(event);
    }

    Map<Object?, Object?> itemOf(Map<String, Object?> report) =>
        (report[r'$exception_list']! as List).first as Map;

    List<Map<Object?, Object?>> framesOf(Map<String, Object?> report) =>
        ((itemOf(report)['stacktrace']! as Map)['frames']! as List).cast();

    test('the scrubbed type and message, uncaught, raw dart frames', () async {
      final report = await reportOf(StateError('forced'), StackTrace.current);
      final item = itemOf(report);
      expect(item['type'], 'StateError');
      expect(item['value'], 'Bad state: <w>');
      expect(item['mechanism'], containsPair('handled', false));
      expect((item['stacktrace']! as Map)['type'], 'raw');
      final here = framesOf(report)
          .where((f) => f['filename'] == 'exceptions_test.dart');
      expect(here, isNotEmpty);
      expect(here.first['platform'], 'dart');
      expect(here.first['lineno'], isA<int>());
      expect(report[r'$exception_level'], 'error');
    });

    test(
      'carries the context and nothing of the error but its report',
      () async {
        final report = await reportOf(
          StateError('cannot parse Hafermilch 2 Liter for peter@example.com'),
        );
        expect(report.keys.toSet(), {
          r'$exception_list',
          r'$exception_level',
          'install_id',
          'household_id',
          'platform',
          'app_version',
          'is_internal',
          r'$geoip_disable',
          r'$process_person_profile',
        });
        expect(
          itemOf(report)['value'],
          'Bad state: cannot <w> <n> <w> for <email>',
        );
        final text = '$report';
        for (final secret in ['Hafermilch', 'Liter', 'peter', 'example.com']) {
          expect(text, isNot(contains(secret)));
        }
      },
    );

    test(
      'common types are named, whatever the build did to type names',
      () async {
        Future<Object?> typeOf(Object e) async =>
            itemOf(await reportOf(e))['type'];
        expect(await typeOf(RangeError.index(3, [1], 'l')), 'IndexError');
        expect(await typeOf(const FormatException('x')), 'FormatException');
        expect(
          await typeOf(const HouseholdError(HouseholdProblem.other)),
          'HouseholdError',
        );
        expect(await typeOf(_AppError()), '_AppError');
      },
    );

    test('an async error is unwrapped', () async {
      final item = itemOf(
        await reportOf(
          AsyncError(const FormatException('Milch'), StackTrace.empty),
        ),
      );
      expect(item['type'], 'FormatException');
      expect(item['value'], '<redacted>');
    });

    test('no frame carries a device path', () async {
      final frames = framesOf(
        await reportOf(
          StateError('x'),
          StackTrace.fromString(
            '#0      main (file:///Users/peter/app/lib/main.dart:3:5)\n'
            '#1      f (package:family_groceries/list/x.dart:9:1)',
          ),
        ),
      );
      expect(
        frames.map((f) => f['abs_path']),
        containsAll(['package:family_groceries/list/x.dart', 'main.dart']),
      );
      expect('$frames', isNot(contains('peter')));
    });

    test('uncaught framework and platform errors are reported', () async {
      final presented = <FlutterErrorDetails>[];
      final (framework, platform) = (
        FlutterError.onError,
        PlatformDispatcher.instance.onError,
      );
      addTearDown(() {
        FlutterError.onError = framework;
        PlatformDispatcher.instance.onError = platform;
      });
      FlutterError.onError = presented.add;
      reportUncaughtErrors(analytics);

      FlutterError.onError!(
        FlutterErrorDetails(exception: StateError('build Hafermilch')),
      );
      PlatformDispatcher.instance.onError!(TypeError(), StackTrace.current);
      await analytics.flush();

      expect(presented, hasLength(1), reason: 'still presented as before');
      expect(native.names, ['first_open', r'$exception', r'$exception']);
      expect('${native.events}', isNot(contains('Hafermilch')));
    });
  });
}
