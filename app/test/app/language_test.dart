import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import '../more/more_harness.dart';

void main() {
  group('resolveLocale', () {
    const cases = <(List<Locale>?, AppLanguage?, String)>[
      ([Locale('en', 'US')], null, 'en'),
      ([Locale('de', 'AT')], null, 'de'),
      ([Locale('fr')], null, 'de'),
      ([Locale('fr'), Locale('en')], null, 'en'),
      ([Locale('fr'), Locale('en'), Locale('de')], null, 'en'),
      ([Locale('de'), Locale('en')], null, 'de'),
      ([], null, 'de'),
      (null, null, 'de'),
      ([Locale('en')], AppLanguage.de, 'de'),
      ([Locale('de')], AppLanguage.en, 'en'),
      ([Locale('fr')], AppLanguage.en, 'en'),
    ];
    for (final (device, picked, expected) in cases) {
      test('device $device, picked ${picked?.code} speaks $expected', () {
        expect(resolveLocale(device, picked), Locale(expected));
      });
    }
  });

  group('LanguageCubit', () {
    late DeviceCache cache;

    setUp(() {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.empty();
      cache = DeviceCache(SharedPreferencesAsync());
    });

    test('a pick is kept on the device; System forgets it', () async {
      final cubit = LanguageCubit(cache, null);
      addTearDown(cubit.close);
      expect(await cache.language(), isNull);

      cubit.pick(AppLanguage.en);
      expect(cubit.state, AppLanguage.en);
      await pumpEventQueue();
      expect(AppLanguage.byCode(await cache.language()), AppLanguage.en);

      cubit.pick(null);
      expect(cubit.state, isNull);
      await pumpEventQueue();
      expect(await cache.language(), isNull);
    });

    test('an unknown stored code follows the device', () async {
      await cache.saveLanguage('fr');
      expect(AppLanguage.byCode(await cache.language()), isNull);
    });
  });

  group("More's language control", () {
    Finder segment(String code) => find.byKey(ValueKey('language-$code'));

    Future<void> pick(WidgetTester tester, String code) async {
      await tester.tap(segment(code));
      await tester.pumpAndSettle();
    }

    testWidgets('switches the strings at once and keeps the pick', (
      tester,
    ) async {
      final more = await pumpMore(tester, device: const [Locale('en', 'GB')]);
      expect(find.text('More'), findsOneWidget, reason: 'follows the device');
      await tester.ensureVisible(segment('de'));
      await pick(tester, 'de');
      expect(find.text('Mehr'), findsOneWidget);
      expect(find.text('Sprache'), findsOneWidget);
      expect(await more.cache.language(), 'de');

      await pick(tester, 'system');
      expect(find.text('More'), findsOneWidget);
      expect(await more.cache.language(), isNull);

      await pick(tester, 'en');
      expect(find.text('More'), findsOneWidget);
      expect(more.language.state, AppLanguage.en);
    });

    testWidgets('a device in neither language speaks German', (tester) async {
      await pumpMore(tester, device: const [Locale('fr', 'FR')]);
      expect(find.text('Mehr'), findsOneWidget);
    });

    testWidgets('a pick read at start overrides a German device', (
      tester,
    ) async {
      await pumpMore(tester, language: AppLanguage.en);
      expect(find.text('More'), findsOneWidget);
    });
  });
}
