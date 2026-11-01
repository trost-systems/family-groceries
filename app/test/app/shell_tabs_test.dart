import 'package:bloc_test/bloc_test.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_screen.dart';
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

/// The shell as `buildRouter` builds it: List and More as tabs.
Future<void> pumpShell(
  WidgetTester tester, {
  Size size = const Size(390, 844),
}) async {
  tester.view
    ..devicePixelRatio = 1
    ..physicalSize = size;
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
  setUpAll(fakeSupabase);

  final tabs = find.byType(NavigationBar);
  final field = find.byKey(const ValueKey('add-item-field'));

  bool tabsReachable(WidgetTester tester) => tester
      .widgetList<IgnorePointer>(
        find.ancestor(of: tabs, matching: find.byType(IgnorePointer)),
      )
      .every((w) => !w.ignoring);

  testWidgets('the tabs slide away while the sheet is open and come back', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await pumpShell(tester);
    expect(tabsReachable(tester), isTrue);
    expect(find.semantics.byLabel(RegExp('^Liste')), findsOne);
    final tabsTop = tester.getTopLeft(tabs).dy;

    await tester.tap(field);
    await tester.enterText(field, 'Milch');
    await tester.pumpAndSettle();
    expect(tabsReachable(tester), isFalse, reason: 'not tappable');
    expect(
      tester.getTopLeft(tabs).dy,
      greaterThan(tabsTop),
      reason: 'slid down',
    );
    expect(
      find.semantics.byLabel(RegExp('^Liste')),
      findsNothing,
      reason: 'out of semantics',
    );

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(tabsReachable(tester), isTrue);
    expect(tester.getTopLeft(tabs).dy, tabsTop);
    semantics.dispose();
  });

  testWidgets('switching to More closes the sheet', (tester) async {
    await pumpShell(tester, size: const Size(1000, 800));
    await tester.tap(field);
    await tester.enterText(field, 'Milch');
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('add-sheet')), findsOneWidget);
    await tester.tap(find.text('Mehr'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Liste'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('add-sheet')), findsNothing);
    expect(find.byType(NavigationRail), findsOneWidget);
  });

  testWidgets('closing the sheet, then More and back to the list, leaves '
      'the sheet closed', (tester) async {
    await pumpShell(tester);
    await tester.tap(field);
    await tester.enterText(field, 'Milch');
    await tester.pumpAndSettle();
    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    final sheet = find.byKey(const ValueKey('add-sheet'));
    expect(sheet, findsNothing);

    await tester.tap(find.byKey(const ValueKey('tab-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('tab-list')));
    await tester.pumpAndSettle();
    expect(sheet, findsNothing);
  });
}
