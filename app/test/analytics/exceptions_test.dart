import 'dart:async';

import 'package:family_groceries/analytics/exceptions.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _AppError() implements Exception {
  @override
  String toString() => 'could not tick Hafermilch for peter@example.com';
}

List<Map<Object?, Object?>> framesOf(List<Map<String, Object?>> list) =>
    ((list.single['stacktrace']! as Map)['frames']! as List).cast();

void main() {
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

  group('exceptionList', () {
    test('has the PostHog shape with raw dart frames, crash site last', () {
      final stack = StackTrace.current;
      final list = exceptionList(
        StateError('forced'),
        stack,
        handled: false,
        web: false,
      );
      final item = list.single;
      expect(item['type'], 'StateError');
      expect(item['value'], 'Bad state: <w>');
      expect(item['mechanism'], {
        'handled': false,
        'synthetic': false,
        'type': 'generic',
      });
      final frames = framesOf(list);
      expect(frames, isNotEmpty);
      expect(frames.last['platform'], 'dart');
      expect(frames.last['filename'], 'exceptions_test.dart');
      expect(frames.last['lineno'], isA<int>());
      expect(frames.last['in_app'], isTrue);
      expect((item['stacktrace']! as Map)['type'], 'raw');
    });

    test('a report carries no item text or address, only the error type', () {
      for (final error in [
        StateError('cannot parse Hafermilch 2 Liter for peter@example.com'),
        TypeError(),
        FlutterError('Hafermilch 2 Liter for peter@example.com'),
      ]) {
        final item = exceptionList(error, null, handled: true).single;
        final value = item['value']! as String;
        expect(value, isNot(contains('Hafermilch')));
        expect(value, isNot(contains('Liter')));
        expect(value, isNot(contains('peter')));
        expect(value, isNot(contains('example.com')));
        expect(item['type'], anyOf('StateError', 'TypeError', 'FlutterError'));
      }
      expect(
        exceptionList(
          StateError('cannot parse Hafermilch 2 Liter for peter@example.com'),
          null,
          handled: true,
        ).single['value'],
        'Bad state: cannot <w> <n> <w> for <email>',
      );
    });

    test('common types are named, whatever the build did to type names', () {
      String typeOf(Object e) =>
          exceptionList(e, null, handled: true).single['type']! as String;
      expect(typeOf(StateError('x')), 'StateError');
      expect(typeOf(RangeError.index(3, [1], 'l')), 'IndexError');
      expect(typeOf(const FormatException('x')), 'FormatException');
      expect(
        typeOf(const HouseholdError(HouseholdProblem.other)),
        'HouseholdError',
      );
      expect(typeOf(_AppError()), '_AppError');
    });

    test('web frames are javascript frames with their chunk id', () {
      final stack = StackTrace.fromString(
        'Error\n    at Object.a (https://app.hummlist.com/main.dart.js?v=1:12:34)',
      );
      final frames = framesOf(
        exceptionList(
          StateError('x'),
          stack,
          handled: true,
          web: true,
          chunkIds: {
            'https://app.hummlist.com/main.dart.js_1.part.js': 'part',
            'https://app.hummlist.com/main.dart.js': 'c1',
          },
        ),
      );
      expect(frames.single['platform'], 'web:javascript');
      expect(frames.single['abs_path'], 'main.dart.js');
      expect(frames.single['lineno'], 12);
      expect(frames.single['colno'], 34);
      expect(frames.single['chunk_id'], 'c1');
    });

    test('an async error is unwrapped; no trace is marked synthetic', () {
      final list = exceptionList(
        AsyncError(const FormatException('Milch'), StackTrace.empty),
        null,
        handled: true,
      );
      expect(list.single['type'], 'FormatException');
      expect(list.single['value'], '<redacted>');
      expect((list.single['mechanism']! as Map)['synthetic'], isTrue);
      expect(list.single.containsKey('stacktrace'), isFalse);
    });

    test('no frame carries a device path or query', () {
      final stack = StackTrace.fromString(
        '#0      main (file:///Users/peter/app/lib/main.dart:3:5)\n'
        '#1      f (package:family_groceries/list/x.dart:9:1)',
      );
      final frames = framesOf(
        exceptionList(StateError('x'), stack, handled: true, web: false),
      );
      expect(frames.map((f) => f['abs_path']), [
        'package:family_groceries/list/x.dart',
        'main.dart',
      ]);
    });
  });
}
