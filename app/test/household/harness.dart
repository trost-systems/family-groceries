import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/household/create_household_screen.dart';
import 'package:family_groceries/household/invite_partner_screen.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/invite_share.dart';
import 'package:family_groceries/household/invites_page.dart';
import 'package:family_groceries/household/join_screen.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/household/welcome_screen.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/settings/account_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../analytics/fakes.dart';
import '../settings/fake_account.dart';

const home = Household(id: 'home', name: 'Zuhause');

/// The server's invites, answered without a network. [next] makes the next
/// call fail with that problem (once).
class FakeInvites() implements InviteRepository {
  /// Code to the household it leads to.
  final households = <String, String>{'ABCD2345': 'Familie Trost'};

  /// Codes of the household the user is in.
  final own = <String>{};

  /// What `preview_invite` says about Hummlist Lifetime, by code.
  final lifetime = <String, JoinLifetime>{};
  final created = <Invite>[];
  final revoked = <String>[];
  final previews = <String>[];
  var members = 1;
  HouseholdProblem? next;
  var _n = 0;

  /// Calls wait for this, so a test can tap twice while one is out.
  Completer<void>? hold;

  Future<void> _answer() async {
    await hold?.future;
    if (next case final problem?) {
      next = null;
      throw HouseholdError(problem);
    }
  }

  @override
  Future<Invite> create(String householdId) async {
    await _answer();
    final invite = Invite(
      id: 'invite-${++_n}',
      code: 'NEWCODE${'XYZ'[_n % 3]}',
      expiresAt: DateTime.utc(2026, 11, 6, 9, 30),
    );
    created.add(invite);
    return invite;
  }

  @override
  Future<List<Invite>> open(String householdId) async {
    await _answer();
    return [
      for (final i in created.reversed)
        if (!revoked.contains(i.id)) i,
    ];
  }

  @override
  Future<void> revoke(String inviteId) async {
    await _answer();
    revoked.add(inviteId);
  }

  @override
  Future<InvitePreview> preview(String code) async {
    previews.add(code);
    await _answer();
    final name = households[code];
    if (name == null) {
      throw const HouseholdError(HouseholdProblem.invalidInvite);
    }
    return own.contains(code)
        ? InviteMember(name)
        : InviteOpen(name, lifetime: lifetime[code] ?? const JoinLifetime());
  }

  @override
  Future<int> memberCount(String householdId) async => members;

  /// The user's archived households (job 43).
  final archivedNow = <ArchivedHousehold>[];

  @override
  Future<List<ArchivedHousehold>> archived() async {
    await _answer();
    return [...archivedNow];
  }
}

/// Records what would go to the share sheet and the clipboard.
class FakeSharer({final bool available = true}) implements InviteSharer {
  @override
  bool get canShare => available;
  final shared = <String>[];
  final copied = <String>[];

  @override
  Future<void> share(String text, {Rect? origin}) async => shared.add(text);

  @override
  Future<void> copy(String text) async => copied.add(text);
}

/// A session the test drives: [join] and [createHousehold] record the call
/// and move on as the server would, or fail with [fail].
class TestSession(super.initialState)
    extends Cubit<Session>
    implements SessionCubit {
  final joins = <(String, JoinMethod)>[];

  /// The joins that asked to archive the household left behind (job 43).
  final archivingJoins = <String>[];
  final unarchived = <String>[];
  final creates = <(String, bool)>[];
  HouseholdProblem? fail;
  var refreshes = 0;
  Completer<void>? hold;

  @override
  PendingInvite? get pendingInvite => null;

  @override
  Analytics? get analytics => null;

  Future<void> _answer() async {
    await hold?.future;
    if (fail case final problem?) {
      fail = null;
      throw HouseholdError(problem);
    }
  }

  @override
  Future<void> join(
    String code, {
    JoinMethod method = JoinMethod.code,
    bool archive = false,
  }) async {
    joins.add((code, method));
    if (archive) {
      archivingJoins.add(code);
    }
    await _answer();
    emit(const InHousehold('peter', Household(id: 'other', name: 'Trost')));
  }

  @override
  Future<void> unarchive(String householdId) async {
    unarchived.add(householdId);
    await _answer();
    emit(InHousehold('peter', Household(id: householdId, name: 'Archiviert')));
  }

  @override
  Future<void> createHousehold(String name, {bool defaultStores = true}) async {
    creates.add((name, defaultStores));
    await _answer();
    emit(InHousehold('peter', Household(id: 'home', name: name)));
  }

  @override
  Future<void> refresh() async => refreshes++;

  @override
  Future<void> signOut() async => emit(const SignedOut());

  @override
  Future<void> accountDeleted(AccountDeletedNotice notice) async =>
      emit(SignedOut(deleted: notice));
}

class MemoryPendingStore() implements PendingInviteStore {
  ({String code, DateTime at})? saved;

  @override
  Future<({String code, DateTime at})?> pendingInvite() async => saved;

  @override
  Future<void> savePendingInvite(({String code, DateTime at})? invite) async =>
      saved = invite;
}

typedef Onboarding = ({
  TestSession session,
  FakeInvites invites,
  FakeSharer sharer,
  PendingInvite pending,
  GoRouter router,
  NativePostHog sink,
  Analytics analytics,
});

/// The onboarding routes as `buildRouter` has them, the list a stub, with
/// the app's redirect.
Future<Onboarding> pumpOnboarding(
  WidgetTester tester, {
  required String location,
  Session session = const NeedsHousehold('peter'),
  String? pendingCode,
  Locale locale = const Locale('de'),
  FakeSharer? sharer,
  FakeInvites? invites,
  bool archiveOffered = false,
}) async {
  tester.view
    ..devicePixelRatio = 1
    ..physicalSize = const Size(390, 844);
  addTearDown(tester.view.reset);
  final testSession = TestSession(session);
  addTearDown(testSession.close);
  final fakeInvites = invites ?? FakeInvites();
  final fakeSharer = sharer ?? FakeSharer();
  final store = MemoryPendingStore();
  final pending = PendingInvite(store);
  if (pendingCode != null) {
    pending.remember(pendingCode);
  }
  final sink = NativePostHog()..install();
  final analytics = await tester.runAsync(
    () => loadedAnalytics(MemoryAnalyticsStore()),
  );
  await tester.runAsync(() => analytics!.decide(granted: true));
  analytics!.setUser(const AnalyticsUser(email: 'neu@gmail.com'));
  addTearDown(analytics.close);
  final router = GoRouter(
    initialLocation: location,
    refreshListenable: _SessionListenable(testSession),
    redirect: (_, state) {
      if (inviteIn(state.uri) case final code?) {
        pending.remember(code);
      }
      return authRedirect(
        testSession.state,
        state.uri,
        pendingInvite: pending.code,
      );
    },
    routes: [
      GoRoute(path: listPath, builder: (_, _) => const Text('LIST')),
      GoRoute(path: loginPath, builder: (_, _) => const Text('LOGIN')),
      GoRoute(path: consentPath, builder: (_, _) => const Text('CONSENT')),
      GoRoute(
        path: invitesPath,
        builder: (_, _) => const Scaffold(body: InvitesPage()),
      ),
      GoRoute(
        path: welcomePath,
        builder: (_, _) => const WelcomeScreen(),
        routes: [
          GoRoute(
            path: 'create',
            builder: (_, _) => const CreateHouseholdScreen(),
          ),
          GoRoute(
            path: 'invite',
            builder: (_, _) => const InvitePartnerScreen(),
          ),
        ],
      ),
      GoRoute(
        path: joinCodePath,
        builder: (_, _) => JoinScreen(archiveOffered: archiveOffered),
      ),
      GoRoute(
        path: '/join/:code',
        builder: (_, state) => JoinScreen(
          link: state.pathParameters['code'],
          archiveOffered: archiveOffered,
        ),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    MultiRepositoryProvider(
      providers: [
        RepositoryProvider<InviteRepository>.value(value: fakeInvites),
        RepositoryProvider<InviteSharer>.value(value: fakeSharer),
        RepositoryProvider.value(value: pending),
        RepositoryProvider<AccountRepository>.value(
          value: FakeAccountRepository(),
        ),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: testSession),
          BlocProvider.value(value: analytics),
        ],
        child: MaterialApp.router(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: locale,
          routerConfig: router,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (
    session: testSession,
    invites: fakeInvites,
    sharer: fakeSharer,
    pending: pending,
    router: router,
    sink: sink,
    analytics: analytics,
  );
}

/// What analytics sent, first_open aside.
Future<List<Map<String, Object?>>> sentEvents(
  WidgetTester tester,
  Onboarding o,
) async {
  await tester.runAsync(o.analytics.flush);
  return [
    for (final e in o.sink.events)
      if (e['event'] != 'first_open') e,
  ];
}

class _SessionListenable(Cubit<Session> session) extends ChangeNotifier {
  this {
    _subscription = session.stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<Session> _subscription;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }
}

Future<void> tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(ValueKey(key));
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
