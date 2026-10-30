import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

/// The real router and screens: sign-in, then the analytics consent, then
/// onboarding (Peter, 2026-10-27).
void main() {
  setUpAll(fakeSupabase);

  late RecordingSink sink;
  late Analytics analytics;
  late DeviceCache cache;

  Future<void> pumpApp(WidgetTester tester, Session state) async {
    tester.view
      ..devicePixelRatio = 1
      ..physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    cache = DeviceCache(SharedPreferencesAsync());
    sink = RecordingSink();
    analytics = Analytics(sink, cache, releaseConfig);
    await analytics.load();
    analytics.setUser(const AnalyticsUser(email: 'neu@gmail.com'));
    final session = FakeSession();
    whenListen(session, const Stream<Session>.empty(), initialState: state);
    final router = buildRouter(session, analytics, PendingInvite(cache));
    addTearDown(router.dispose);
    addTearDown(analytics.close);
    await tester.pumpWidget(
      RepositoryProvider.value(
        value: cache,
        child: MultiBlocProvider(
          providers: [
            BlocProvider<SessionCubit>.value(value: session),
            BlocProvider.value(value: analytics),
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

  final consent = find.byKey(const ValueKey('analytics-consent'));
  final accept = find.byKey(const ValueKey('analytics-consent-accept'));
  final decline = find.byKey(const ValueKey('analytics-consent-decline'));
  final welcome = find.byKey(const ValueKey('welcome'));

  testWidgets('a first sign-in asks before onboarding; yes sends first_open', (
    tester,
  ) async {
    await pumpApp(tester, const NeedsHousehold('u'));
    expect(consent, findsOneWidget);
    expect(welcome, findsNothing);
    expect(find.text('ENTWURF: Freigabe durch Peter'), findsOneWidget);
    // A titled page: screen readers start on its heading.
    expect(find.widgetWithText(AppBar, 'Nutzungsdaten'), findsOneWidget);
    await analytics.flush();
    expect(sink.batches, isEmpty);

    await tester.tap(accept);
    await tester.pumpAndSettle();
    expect(welcome, findsOneWidget);
    await analytics.flush();
    expect(sink.names, ['first_open']);
  });

  testWidgets('no goes on to onboarding and sends nothing', (tester) async {
    await pumpApp(tester, const NeedsHousehold('u'));
    await tester.tap(decline);
    await tester.pumpAndSettle();
    expect(welcome, findsOneWidget);
    expect(analytics.state.consent, isFalse);
    analytics.track('household_created');
    await analytics.flush();
    expect(sink.batches, isEmpty);
  });

  testWidgets('both answers are the same size: declining is as easy', (
    tester,
  ) async {
    await pumpApp(tester, const NeedsHousehold('u'));
    expect(tester.getSize(accept), tester.getSize(decline));
  });

  testWidgets('a decided install is not asked again', (tester) async {
    await pumpApp(tester, const NeedsHousehold('u'));
    await tester.tap(decline);
    await tester.pumpAndSettle();
    final again = Analytics(sink, cache, releaseConfig);
    await again.load();
    expect(again.asksConsent, isFalse);
    unawaited(again.close());
  });
}
