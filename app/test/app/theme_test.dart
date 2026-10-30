import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  group('ThemeCubit', () {
    late DeviceCache cache;

    setUp(() {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.empty();
      cache = DeviceCache(SharedPreferencesAsync());
    });

    test(
      'a pick is kept on the device; the device setting forgets it',
      () async {
        final cubit = ThemeCubit(cache, themeModeOf(await cache.theme()));
        addTearDown(cubit.close);
        expect(cubit.state, ThemeMode.system, reason: 'the default');

        cubit.pick(ThemeMode.dark);
        await pumpEventQueue();
        expect(await cache.theme(), 'dark');
        expect(themeModeOf(await cache.theme()), ThemeMode.dark);

        cubit.pick(ThemeMode.light);
        await pumpEventQueue();
        expect(themeModeOf(await cache.theme()), ThemeMode.light);

        cubit.pick(ThemeMode.system);
        await pumpEventQueue();
        expect(await cache.theme(), isNull);
      },
    );

    test('an unknown stored value follows the device', () async {
      await cache.saveTheme('sepia');
      expect(themeModeOf(await cache.theme()), ThemeMode.system);
    });

    test('a sign-out keeps the pick: it belongs to the device', () async {
      await cache.saveTheme('dark');
      await cache.forget();
      expect(await cache.theme(), 'dark');
    });
  });

  for (final brightness in Brightness.values) {
    group('the ${brightness.name} theme meets WCAG AA', () {
      final theme = appTheme(brightness);
      final scheme = theme.colorScheme;

      test('is ${brightness.name}', () {
        expect(scheme.brightness, brightness);
        expect(theme.brightness, brightness);
      });

      // Text on the surfaces the app puts it on: screens, sheets and
      // dialogs (surfaceContainer*), snackbars (inverseSurface), filled
      // buttons, chips and the selected add-sheet suggestion.
      final text = <String, (Color, Color)>{
        'onSurface on surface': (scheme.onSurface, scheme.surface),
        'onSurfaceVariant on surface': (
          scheme.onSurfaceVariant,
          scheme.surface,
        ),
        'onSurfaceVariant on surfaceContainerLow (sheets)': (
          scheme.onSurfaceVariant,
          scheme.surfaceContainerLow,
        ),
        'onSurface on surfaceContainerHigh (dialogs)': (
          scheme.onSurface,
          scheme.surfaceContainerHigh,
        ),
        'onSurfaceVariant on surfaceContainerHighest': (
          scheme.onSurfaceVariant,
          scheme.surfaceContainerHighest,
        ),
        'primary on surface (headers, section titles)': (
          scheme.primary,
          scheme.surface,
        ),
        'onPrimary on primary': (scheme.onPrimary, scheme.primary),
        'onPrimaryContainer on primaryContainer': (
          scheme.onPrimaryContainer,
          scheme.primaryContainer,
        ),
        'onSecondaryContainer on secondaryContainer': (
          scheme.onSecondaryContainer,
          scheme.secondaryContainer,
        ),
        'onTertiaryContainer on tertiaryContainer': (
          scheme.onTertiaryContainer,
          scheme.tertiaryContainer,
        ),
        'onInverseSurface on inverseSurface (snackbars)': (
          scheme.onInverseSurface,
          scheme.inverseSurface,
        ),
        'inversePrimary on inverseSurface (snackbar actions)': (
          scheme.inversePrimary,
          scheme.inverseSurface,
        ),
        'error on surface': (scheme.error, scheme.surface),
        'onErrorContainer on errorContainer': (
          scheme.onErrorContainer,
          scheme.errorContainer,
        ),
      };
      for (final MapEntry(key: name, value: (fg, bg)) in text.entries) {
        test('text: $name ≥ 4.5', () {
          expect(contrastRatio(fg, bg), greaterThanOrEqualTo(4.5));
        });
      }

      test('outline (field borders) on surface ≥ 3', () {
        expect(contrastRatio(scheme.outline, scheme.surface), greaterThan(3));
      });

      // The store divider's rule is the store's only line between sections.
      final stores = [
        for (final key in ['dm', 'edeka', 'lidl', 'rewe', 'aldi'])
          Store(id: key, name: key, sortOrder: 0, seedKey: key),
        // Own stores, one per palette colour (picked by the name's sum).
        for (final name in ['A', 'B', 'C', 'D', 'E', 'F'])
          Store(id: name, name: name, sortOrder: 0),
      ];
      for (final store in stores) {
        test('store rule: ${store.name} on surface ≥ 3', () {
          expect(
            contrastRatio(storeTint(store, scheme.surface), scheme.surface),
            greaterThanOrEqualTo(3),
          );
        });
      }
    });
  }

  test('a tint that already reads keeps its brand colour', () {
    const lidl = Store(id: 'lidl', name: 'Lidl', sortOrder: 0, seedKey: 'lidl');
    const dm = Store(id: 'dm', name: 'dm', sortOrder: 0, seedKey: 'dm');
    final light = appTheme(Brightness.light).colorScheme.surface;
    expect(storeTint(lidl, light), const Color(0xFF0050AA));
    expect(storeTint(dm, light), const Color(0xFFD6001C), reason: 'its red');
  });

  test('on dark, Aldi navy is lightened but stays blue', () {
    const aldi = Store(id: 'aldi', name: 'Aldi', sortOrder: 0, seedKey: 'aldi');
    final tint = storeTint(aldi, appTheme(Brightness.dark).colorScheme.surface);
    expect(tint, isNot(const Color(0xFF00005F)));
    expect(tint.b, greaterThan(tint.r), reason: 'still a blue');
  });
}
