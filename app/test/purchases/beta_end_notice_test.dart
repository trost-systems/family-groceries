import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/purchases/beta_end_notice.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:url_launcher/link.dart';

import '../app/fake_launcher.dart';
import '../household/harness.dart' show TestSession;
import '../list/fake_repository.dart';
import '../list/memory_cache.dart';
import 'fakes.dart';

final _end = DateTime.utc(2026, 12, 1, 11);

Map<String, dynamic> _grant(DateTime? end) => {
  'kind': 'premium',
  'source': 'promotional',
  'premium_source': 'promotional',
  'expires_at': end?.toIso8601String(),
  'auto_renew': null,
};

const _lifetime = {
  'kind': 'premium',
  'source': 'purchase',
  'premium_source': 'lifetime',
};

class _MemoryStore() implements BetaEndNoticeStore {
  final saved = <String, DateTime>{};

  @override
  Future<DateTime?> dismissedBetaEnd(String householdId) async =>
      saved[householdId];

  @override
  Future<void> saveDismissedBetaEnd(String householdId, DateTime end) async =>
      saved[householdId] = end;
}

void main() {
  group('betaEndToAnnounce', () {
    DateTime? announce(
      List<Map<String, dynamic>> rows, {
      required DateTime now,
      DateTime? dismissed,
    }) => betaEndToAnnounce(unlocksOf(rows), now: now, dismissed: dismissed);

    test('shows from 28 days before the end until the end', () {
      final rows = [_grant(_end)];
      expect(
        announce(rows, now: _end.subtract(const Duration(days: 29))),
        isNull,
      );
      expect(
        announce(rows, now: _end.subtract(const Duration(days: 28))),
        _end,
      );
      expect(
        announce(rows, now: _end.subtract(const Duration(microseconds: 1))),
        _end,
      );
      expect(announce(rows, now: _end), isNull);
    });

    final inWindow = _end.subtract(const Duration(days: 3));

    test('never for tester and App Review grants', () {
      expect(announce([_grant(DateTime.utc(2100))], now: inWindow), isNull);
      expect(
        announce([_grant(_end), _grant(DateTime.utc(2100))], now: inWindow),
        isNull,
      );
      expect(announce([_grant(null)], now: inWindow), isNull);
      expect(
        announce([_grant(DateTime.utc(2100))], now: DateTime.utc(2099, 12, 20)),
        isNull,
      );
    });

    test('never next to a purchase', () {
      expect(announce([_grant(_end), _lifetime], now: inWindow), isNull);
      expect(
        announce([
          _grant(_end),
          yearlyRow(from: inWindow, days: 100),
        ], now: inWindow),
        isNull,
      );
      expect(
        announce([
          _grant(_end),
          yearlyRow(from: inWindow, days: -1, renews: false),
        ], now: inWindow),
        _end,
        reason: 'a yearly plan that ended is no premium source',
      );
    });

    test('nothing without a grant', () {
      expect(announce(const [], now: inWindow), isNull);
    });

    test('closed for this end it stays hidden, a new end shows it', () {
      expect(
        announce([_grant(_end)], now: inWindow, dismissed: _end.toLocal()),
        isNull,
      );
      final later = _end.add(const Duration(days: 7));
      expect(announce([_grant(later)], now: inWindow, dismissed: _end), later);
    });
  });

  test('NATIVE_SIRI_LIVE and iOS name Siri; anything else does not', () {
    expect(
      nativeSiriLive(define: true, web: false, platform: TargetPlatform.iOS),
      isTrue,
    );
    expect(
      nativeSiriLive(
        define: true,
        web: false,
        platform: TargetPlatform.android,
      ),
      isFalse,
    );
    expect(
      nativeSiriLive(define: true, web: true, platform: TargetPlatform.iOS),
      isFalse,
    );
    expect(
      nativeSiriLive(web: false, platform: TargetPlatform.iOS),
      isFalse,
      reason: 'off unless the build passes NATIVE_SIRI_LIVE',
    );
  });

  test('DeviceCache keeps the closed end per household', () async {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    final cache = DeviceCache(SharedPreferencesAsync());
    expect(await cache.dismissedBetaEnd('home'), isNull);
    await cache.saveDismissedBetaEnd('home', _end);
    expect(await cache.dismissedBetaEnd('home'), _end);
    expect(await cache.dismissedBetaEnd('other'), isNull);
  });

  group('the notice', () {
    late _MemoryStore store;
    late FakeEntitlementsSource rows;
    var clock = DateTime.utc(2026, 11, 20);

    setUp(() {
      store = _MemoryStore();
      rows = FakeEntitlementsSource()..rowsNow = [_grant(_end)];
      clock = DateTime.utc(2026, 11, 20);
    });

    Future<void> pump(
      WidgetTester tester, {
      Locale locale = const Locale('de'),
      bool siriLive = false,
      Widget? child,
    }) async {
      final session = TestSession(
        const InHousehold('peter', Household(id: 'home', name: 'Zuhause')),
      );
      final entitlements = Entitlements(rows, session, now: () => clock);
      addTearDown(() async {
        await entitlements.close();
        await session.close();
      });
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: locale,
          home: RepositoryProvider<BetaEndNoticeStore>.value(
            value: store,
            child: BlocProvider.value(
              value: entitlements,
              child: Scaffold(body: child ?? BetaEndNotice(siriLive: siriLive)),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    final notice = find.byKey(const ValueKey('beta-end-notice'));

    testWidgets('German, without native Siri: AI assistants only (5b)', (
      tester,
    ) async {
      await pump(tester);
      expect(notice, findsOneWidget);
      expect(
        find.text('Kostenlose Beta-Freischaltung endet am 1. Dezember 2026'),
        findsOneWidget,
      );
      expect(
        find.text(
          'Die kostenlose Beta-Freischaltung von Hummlist Premium endet am '
          '1. Dezember 2026. Ab dem 1. Dezember 2026 gehört die Verbindung '
          'mit KI-Assistenten zu Hummlist Premium. Die Einkaufsliste nutzt '
          'du weiter kostenlos. Es wird nichts automatisch berechnet. Für die '
          'kostenlose Freischaltung musst du also nichts tun und nichts '
          'kündigen.',
        ),
        findsOneWidget,
      );
      expect(
        find.text('Mehr dazu in der Datenschutzerklärung'),
        findsOneWidget,
      );
      expect(find.byType(ElevatedButton), findsNothing);
      expect(find.byType(FilledButton), findsNothing);
    });

    testWidgets('German, with native Siri: Siri and AI assistants (5a)', (
      tester,
    ) async {
      await pump(tester, siriLive: true);
      expect(
        find.text(
          'Die kostenlose Beta-Freischaltung von Hummlist Premium endet am '
          '1. Dezember 2026. Ab dem 1. Dezember 2026 gehören Einträge per '
          'Siri und die Verbindung mit KI-Assistenten zu Hummlist Premium. '
          'Die Einkaufsliste nutzt du weiter kostenlos. Es wird nichts '
          'automatisch berechnet. Für die kostenlose Freischaltung musst du '
          'also nichts tun und nichts kündigen.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('English, 5b and 5a', (tester) async {
      await pump(tester, locale: const Locale('en'));
      expect(
        find.text('Free beta unlock ends on December 1, 2026'),
        findsOneWidget,
      );
      expect(
        find.text(
          'The free beta unlock of Hummlist Premium ends on December 1, 2026. '
          'From December 1, 2026, connecting AI assistants is part of '
          'Hummlist Premium. You can keep using the grocery list for free. '
          "Nothing is charged automatically. So there's nothing you need to "
          'do or cancel for the free unlock.',
        ),
        findsOneWidget,
      );
      expect(find.text('More in the privacy policy'), findsOneWidget);

      await pump(tester, locale: const Locale('en'), siriLive: true);
      expect(
        find.text(
          'The free beta unlock of Hummlist Premium ends on December 1, 2026. '
          'From December 1, 2026, adding items with Siri and connecting AI '
          'assistants are part of Hummlist Premium. You can keep using the '
          'grocery list for free. Nothing is charged automatically. So '
          "there's nothing you need to do or cancel for the free unlock.",
        ),
        findsOneWidget,
      );
    });

    testWidgets('the link opens the privacy policy outside the app', (
      tester,
    ) async {
      final launcher = fakeLauncher();
      await pump(tester);
      final link = find.byKey(const ValueKey('beta-end-notice-privacy'));
      expect(
        tester
            .widget<Link>(
              find.descendant(of: link, matching: find.byType(Link)),
            )
            .uri,
        Uri.parse('https://hummlist.com/datenschutz#premium-beta'),
      );
      await tester.tap(link);
      await tester.pumpAndSettle();
      expect(
        launcher.opened.single.$1,
        'https://hummlist.com/datenschutz#premium-beta',
      );

      await pump(tester, locale: const Locale('en'));
      expect(
        tester
            .widget<Link>(
              find.descendant(of: link, matching: find.byType(Link)),
            )
            .uri,
        Uri.parse('https://hummlist.com/en/privacy#premium-beta'),
      );
    });

    testWidgets('closed, it stays closed for that end date', (tester) async {
      await pump(tester);
      await tester.tap(find.byKey(const ValueKey('beta-end-notice-close')));
      await tester.pumpAndSettle();
      expect(notice, findsNothing);
      expect(store.saved['home'], _end);

      await pump(tester, child: const SizedBox());
      await pump(tester);
      expect(notice, findsNothing, reason: 'the next start keeps it closed');

      rows.rowsNow = [_grant(_end.add(const Duration(days: 7)))];
      await pump(tester, child: const SizedBox());
      await pump(tester);
      expect(notice, findsOneWidget, reason: 'a new end date shows it again');
    });

    testWidgets('a tester household never sees it', (tester) async {
      rows.rowsNow = [_grant(DateTime.utc(2100))];
      await pump(tester);
      expect(notice, findsNothing);
    });

    testWidgets('a purchase hides it at once', (tester) async {
      await pump(tester);
      expect(notice, findsOneWidget);
      rows
        ..rowsNow = [_grant(_end), _lifetime]
        ..change();
      await tester.pumpAndSettle();
      expect(notice, findsNothing);
    });

    testWidgets('it sits at the top of the list', (tester) async {
      final repo = FakeRepository()..remoteAdd('Milch');
      await pump(
        tester,
        child: BlocProvider(
          create: (_) => ListCubit(
            repo,
            MemoryListCache()..prefs = const ListPrefs(hintDismissed: true),
            userId: 'peter',
          )..start(),
          child: const ShoppingList(),
        ),
      );
      expect(notice, findsOneWidget);
      expect(
        tester.getTopLeft(notice).dy,
        lessThan(tester.getTopLeft(find.text('Milch')).dy),
      );
    });
  });
}
