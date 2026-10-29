import 'dart:convert';

import 'package:bloc_test/bloc_test.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_scope.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/settings/account_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import '../list/fake_repository.dart';
import '../settings/fake_account.dart';

class FakeSession() extends MockCubit<Session> implements SessionCubit;

/// Rows the fake server answers for `personal_access_tokens`.
final serverTokens = <Map<String, Object?>>[];

/// Supabase against a server that answers every request with `[]`, or
/// [serverTokens]: More's access page builds its repository from the
/// global client. Once per test file, in `setUpAll`.
Future<void> fakeSupabase() async {
  SharedPreferences.setMockInitialValues({});
  PackageInfo.setMockInitialValues(
    appName: 'Hummlist',
    packageName: 'com.hummlist.app',
    version: '1.2.3',
    buildNumber: '45',
    buildSignature: '',
  );
  await Supabase.initialize(
    url: 'http://localhost:54321',
    publishableKey: 'test',
    httpClient: MockClient(
      (request) async => http.Response(
        jsonEncode(
          request.url.path.endsWith('personal_access_tokens')
              ? serverTokens
              : const <Object>[],
        ),
        200,
        headers: {'content-type': 'application/json'},
      ),
    ),
    authOptions: const FlutterAuthClientOptions(
      localStorage: EmptyLocalStorage(),
      autoRefreshToken: false,
    ),
  );
}

typedef More = ({
  FakeRepository repo,
  DeviceCache cache,
  LanguageCubit language,
  GoRouter router,
});

/// More's routes as `buildRouter` has them, without the shell (whose list
/// scope needs the real backend), wired to the language like `App`.
Future<More> pumpMore(
  WidgetTester tester, {
  String location = morePath,
  Size size = const Size(390, 844),
  AppLanguage? language,

  /// The device's preferred languages.
  List<Locale> device = const [Locale('de', 'DE')],
}) async {
  tester.view
    ..devicePixelRatio = 1
    ..physicalSize = size;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.localesTestValue = device;
  addTearDown(tester.platformDispatcher.clearLocalesTestValue);
  SharedPreferencesAsyncPlatform.instance =
      InMemorySharedPreferencesAsync.empty();
  final cache = DeviceCache(SharedPreferencesAsync());
  final languageCubit = LanguageCubit(cache, language);
  addTearDown(languageCubit.close);
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
    initialLocation: location,
    routes: [
      // As in the app, the list sits above the tabs (AppShell's ListScope).
      ShellRoute(
        builder: (_, _, child) => ListScope(repository: repo, child: child),
        routes: [
          GoRoute(
            path: morePath,
            builder: (_, _) => const MoreScreen(),
            routes: [
              GoRoute(
                path: 'privacy',
                builder: (_, _) => const MoreScreen(page: MorePage.privacy),
              ),
            ],
          ),
          GoRoute(
            path: settingsPath,
            builder: (_, state) => MoreScreen(
              page: state.uri.queryParameters['section'] == 'account'
                  ? MorePage.account
                  : MorePage.access,
            ),
          ),
        ],
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: cache),
        RepositoryProvider<AccountRepository>.value(
          value: FakeAccountRepository(),
        ),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider.value(value: languageCubit),
        ],
        child: BlocBuilder<LanguageCubit, AppLanguage?>(
          builder: (context, picked) => MaterialApp.router(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: picked == null ? null : Locale(picked.code),
            localeListResolutionCallback: (preferred, _) =>
                resolveLocale(preferred, null),
            routerConfig: router,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (repo: repo, cache: cache, language: languageCubit, router: router);
}
