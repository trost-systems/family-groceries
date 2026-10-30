import 'dart:convert';

import 'package:bloc_test/bloc_test.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:family_groceries/feedback/feedback_cubit.dart';
import 'package:family_groceries/feedback/screen_tracker.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/invite_share.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_scope.dart';
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

import '../feedback/fakes.dart';
import '../household/harness.dart'
    show FakeInvites, FakeSharer, MemoryPendingStore;
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
  ThemeCubit theme,
  GoRouter router,
  Analytics analytics,
  FakeFeedbackRepository feedback,
  ScreenTracker screens,
});

/// More's routes as `buildRouter` has them, without the shell (whose list
/// scope needs the real backend), wired to the language and theme like
/// `App`.
Future<More> pumpMore(
  WidgetTester tester, {
  String location = morePath,
  Size size = const Size(390, 844),
  AppLanguage? language,
  ThemeMode theme = ThemeMode.system,

  /// The device's light or dark setting.
  Brightness deviceBrightness = Brightness.light,

  /// The device's preferred languages.
  List<Locale> device = const [Locale('de', 'DE')],

  /// Analytics as the app has it; a build without a key by default.
  Analytics? analytics,

  /// Instead of `moreTabRoutes()`, e.g. a More built like a release build.
  List<RouteBase>? routes,
}) async {
  tester.view
    ..devicePixelRatio = 1
    ..physicalSize = size;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.localesTestValue = device;
  addTearDown(tester.platformDispatcher.clearLocalesTestValue);
  tester.platformDispatcher.platformBrightnessTestValue = deviceBrightness;
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  SharedPreferencesAsyncPlatform.instance =
      InMemorySharedPreferencesAsync.empty();
  final cache = DeviceCache(SharedPreferencesAsync());
  final languageCubit = LanguageCubit(cache, language);
  addTearDown(languageCubit.close);
  final themeCubit = ThemeCubit(cache, theme);
  addTearDown(themeCubit.close);
  final shownAnalytics = analytics ?? Analytics.off(cache);
  addTearDown(shownAnalytics.close);
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
  final feedback = FakeFeedbackRepository();
  final feedbackCubit = FeedbackCubit(feedback, analytics: shownAnalytics);
  addTearDown(feedbackCubit.close);
  final screens = ScreenTracker();
  final router = GoRouter(
    initialLocation: location,
    routes: [
      // As in the app, the list sits above the tabs (AppShell's ListScope).
      ShellRoute(
        builder: (_, _, child) => ListScope(repository: repo, child: child),
        routes: routes ?? [...moreTabRoutes()],
      ),
    ],
  );
  addTearDown(router.dispose);
  // As App does: the tracker follows the router.
  void visit() => screens.visit(router.routerDelegate.currentConfiguration.uri);
  router.routerDelegate.addListener(visit);
  addTearDown(() => router.routerDelegate.removeListener(visit));
  await tester.pumpWidget(
    MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: cache),
        RepositoryProvider<AccountRepository>.value(
          value: FakeAccountRepository(),
        ),
        RepositoryProvider.value(value: screens),
        RepositoryProvider<FeedbackDevice>.value(value: FakeFeedbackDevice()),
        RepositoryProvider<InviteRepository>.value(value: FakeInvites()),
        RepositoryProvider<InviteSharer>.value(value: FakeSharer()),
        RepositoryProvider.value(value: PendingInvite(MemoryPendingStore())),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider.value(value: languageCubit),
          BlocProvider.value(value: themeCubit),
          BlocProvider.value(value: shownAnalytics),
          BlocProvider.value(value: feedbackCubit),
        ],
        child: Builder(
          builder: (context) => MaterialApp.router(
            theme: appTheme(Brightness.light),
            darkTheme: appTheme(Brightness.dark),
            themeMode: context.watch<ThemeCubit>().state,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: switch (context.watch<LanguageCubit>().state) {
              final picked? => Locale(picked.code),
              null => null,
            },
            localeListResolutionCallback: (preferred, _) =>
                resolveLocale(preferred, null),
            routerConfig: router,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (
    repo: repo,
    cache: cache,
    language: languageCubit,
    theme: themeCubit,
    router: router,
    analytics: shownAnalytics,
    feedback: feedback,
    screens: screens,
  );
}
