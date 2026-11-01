// Goldens of key screens in the Hummlist theme (design job 52), light and
// dark at a phone size, with the real fonts. After a deliberate look change:
//   flutter test --update-goldens test/design/screens_golden_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import '../list/fake_repository.dart';
import '../more/more_harness.dart';
import '../purchases/fakes.dart';
import 'fonts.dart';

const _phone = Size(390, 844);

Item _item(
  String id,
  String name,
  String store,
  String category, {
  String? quantity,
}) {
  final at = DateTime.utc(2026, 10, 31, 12);
  return Item(
    id: id,
    name: name,
    quantity: quantity,
    status: ItemStatus.active,
    createdAt: at,
    updatedAt: at,
    storeId: store,
    categoryId: category,
    sortKey: id.hashCode.toDouble(),
  );
}

/// The shell with List and More as the app builds it, a few items on the
/// list, in [brightness].
Future<void> _pumpShell(WidgetTester tester, Brightness brightness) async {
  tester.view
    ..devicePixelRatio = 1
    ..physicalSize = _phone;
  addTearDown(tester.view.reset);
  SharedPreferencesAsyncPlatform.instance =
      InMemorySharedPreferencesAsync.empty();
  final cache = DeviceCache(SharedPreferencesAsync());
  final language = LanguageCubit(cache, AppLanguage.de);
  addTearDown(language.close);
  final session = FakeSession();
  whenListen(
    session,
    const Stream<Session>.empty(),
    initialState: const InHousehold(
      'peter',
      Household(id: 'home', name: 'Zuhause'),
    ),
  );
  final repo = FakeRepository();
  for (final item in [
    _item('1', 'Zahnpasta', 'dm', 'other'),
    _item('2', 'Bananen', 'lidl', 'produce', quantity: '6×'),
    _item('3', 'Vollmilch', 'lidl', 'chilled', quantity: '2 l'),
    _item('4', 'Butter', 'lidl', 'chilled'),
  ]) {
    repo.rows[item.id] = item;
  }
  final router = GoRouter(
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell, repository: repo),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: listPath, builder: (_, _) => const ListScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: morePath, builder: (_, _) => const MoreScreen()),
            ],
          ),
        ],
      ),
    ],
  );
  addTearDown(router.dispose);
  final purchases = TestPurchases(session: session);
  addTearDown(purchases.close);
  await tester.pumpWidget(
    RepositoryProvider.value(
      value: cache,
      child: MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider.value(value: language),
          BlocProvider.value(value: Analytics.off(cache)),
          BlocProvider.value(value: purchases.entitlements),
          BlocProvider.value(value: purchases.purchases),
        ],
        child: MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: appTheme(brightness),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('de'),
          routerConfig: router,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    // Supabase listens for deep links; with no plugin the listen fails late,
    // inside whichever test runs then.
    TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
        .setMockStreamHandler(
          const EventChannel('com.llfbandit.app_links/events'),
          MockStreamHandler.inline(onListen: (_, _) {}),
        );
    await loadAppFonts();
    await fakeSupabase();
  });

  // Inter is wider than Roboto: at 15 px the two chips took two lines on a
  // 390 px phone, and the sheet grew past half the screen (e2e
  // add-sheet.spec.ts, "the sheet hugs its suggestions").
  testWidgets('the add sheet keeps its two chips on one line at 390 px', (
    tester,
  ) async {
    await _pumpShell(tester, Brightness.light);
    final field = find.byKey(const ValueKey('add-item-field'));
    await tester.tap(field);
    await tester.enterText(field, 'Spülmittel');
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('chip-category'))).dy,
      tester.getTopLeft(find.byKey(const ValueKey('chip-store'))).dy,
    );
  });

  for (final brightness in Brightness.values) {
    final mode = brightness.name;

    testWidgets('list, $mode', (tester) async {
      await _pumpShell(tester, brightness);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/list-$mode.png'),
      );
    });

    testWidgets('add sheet, $mode', (tester) async {
      await _pumpShell(tester, brightness);
      final field = find.byKey(const ValueKey('add-item-field'));
      await tester.tap(field);
      await tester.enterText(field, 'Milch');
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/add-sheet-$mode.png'),
      );
    });

    testWidgets('settings, $mode', (tester) async {
      await pumpMore(
        tester,
        location: appSettingsPath,
        theme: ThemeMode.values.byName(mode),
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/settings-$mode.png'),
      );
    });

    testWidgets('more, $mode', (tester) async {
      await pumpMore(tester, theme: ThemeMode.values.byName(mode));
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/more-$mode.png'),
      );
    });
  }
}
