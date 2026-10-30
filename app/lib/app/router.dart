import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/consent_screen.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/household/join_screen.dart';
import 'package:family_groceries/household/welcome_screen.dart';
import 'package:family_groceries/list/list_screen.dart';
import 'package:family_groceries/more/more_screen.dart';
import 'package:family_groceries/oauth/consent_screen.dart';
import 'package:family_groceries/session/login_screen.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

const listPath = '/';
const loginPath = '/login';
const welcomePath = '/welcome';

/// The analytics consent (job 19), asked once per install right after the
/// first sign-in. Not [consentPath], which is MCP's OAuth consent.
const analyticsConsentPath = '/analytics-consent';
const consentPath = '/oauth/consent';
const morePath = '/more';
const privacyPath = '/more/privacy';

/// More's Zugänge: the MCP server, tokens and connected apps.
const accessPath = '/more/access';

/// More's Konto: export and account deletion.
const accountPath = '/more/account';

/// Before job 29d both were one page here (Konto at `?section=account`);
/// old links redirect ([legacySettingsRedirect]).
const settingsPath = '/settings';
String joinPath(String code) => '/join/$code';

/// The fixed screen names feedback and analytics report (job 21): a
/// route's name, never its path, so an invite code or anything typed can't
/// get in. Pages pushed on top of a route (categories, stores) and sheets
/// (add, edit) report the route under them.
const screenNames = {
  'list',
  'more',
  'privacy',
  'access',
  'account',
  'login',
  'welcome',
  'analytics_consent',
  'oauth_consent',
  'join',
  'other',
};

/// The screen name of a router [location]: `/join/<code>` is `join`, an
/// unknown path `other`. Query parameters are ignored, except an old
/// `/settings` link's section (it redirects to Zugänge or Konto).
String screenNameOf(Uri location) => switch (location.path) {
  listPath || '' => 'list',
  morePath => 'more',
  privacyPath => 'privacy',
  accessPath => 'access',
  accountPath => 'account',
  settingsPath when location.queryParameters['section'] == 'account' =>
    'account',
  settingsPath => 'access',
  loginPath => 'login',
  welcomePath => 'welcome',
  analyticsConsentPath => 'analytics_consent',
  consentPath => 'oauth_consent',
  _ when location.pathSegments.firstOrNull == 'join' => 'join',
  _ => 'other',
};

/// Whether [location] is in the More tab (More itself or one of its
/// pages); the list is `/` itself. Signed in, any other shell path goes to
/// the list.
bool inMoreTab(Uri location) => const {
  settingsPath,
  morePath,
  privacyPath,
  accessPath,
  accountPath,
}.contains(location.path);

/// The only auth gate. An invite code from a `/join/<code>` link survives
/// sign-in, the analytics consent and onboarding as the `invite` query
/// parameter, an OAuth consent URL as the `next` query parameter.
///
/// [askConsent]: this install has not decided on analytics yet. Signed in,
/// it goes to the analytics consent first, before onboarding and before the
/// list; a browser tab authorizing an MCP client (`next`) is not
/// interrupted and the app asks the next time it is opened.
String? authRedirect(Session session, Uri uri, {bool askConsent = false}) {
  final segments = uri.pathSegments;
  final invite = segments.length == 2 && segments.first == 'join'
      ? segments[1]
      : uri.queryParameters['invite'];
  final next = uri.path == consentPath
      ? uri.toString()
      : _consentOnly(uri.queryParameters['next']);
  String carry(String path) => next != null
      ? Uri(path: path, queryParameters: {'next': next}).toString()
      : invite != null
      ? '$path?invite=$invite'
      : path;
  final target = switch (session) {
    SessionLoading() => null,
    SignedOut() => carry(loginPath),
    NeedsHousehold() || InHousehold() when askConsent && next == null => carry(
      analyticsConsentPath,
    ),
    NeedsHousehold() => carry(welcomePath),
    InHousehold() when next != null => next,
    InHousehold() when invite == null && inMoreTab(uri) => uri.toString(),
    // Onboarding is done once in a household; only a link or a fresh
    // sign-in from a link still asks to switch households.
    InHousehold() when invite == null || uri.path == welcomePath => listPath,
    InHousehold() => joinPath(invite!),
  };
  return target == null || target == uri.toString() ? null : target;
}

/// Where an old `/settings` link goes now: Konto for `?section=account`,
/// Zugänge otherwise.
String legacySettingsRedirect(Uri uri) =>
    uri.queryParameters['section'] == 'account' ? accountPath : accessPath;

/// A same-origin consent URL, or null: `next` must not become an open
/// redirect.
String? _consentOnly(String? next) {
  final uri = next == null ? null : Uri.tryParse(next);
  return uri != null &&
          !uri.hasScheme &&
          !uri.hasAuthority &&
          uri.path == consentPath
      ? next
      : null;
}

/// The More tab's routes: the list at `/more` with its pages below it, so
/// back pops to the list, and the redirect for old `/settings` links.
List<RouteBase> moreTabRoutes() => [
  GoRoute(
    path: morePath,
    builder: (_, _) => const MoreScreen(),
    routes: [
      for (final (path, page) in const [
        ('privacy', MorePage.privacy),
        ('access', MorePage.access),
        ('account', MorePage.account),
      ])
        GoRoute(
          path: path,
          builder: (_, _) => MoreScreen(page: page),
        ),
    ],
  ),
  GoRoute(
    path: settingsPath,
    redirect: (_, state) => legacySettingsRedirect(state.uri),
  ),
];

GoRouter buildRouter(SessionCubit session, Analytics analytics) => GoRouter(
  refreshListenable: Listenable.merge([
    _StreamListenable(session.stream),
    _StreamListenable(analytics.stream),
  ]),
  redirect: (context, state) =>
      authRedirect(session.state, state.uri, askConsent: analytics.asksConsent),
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => AppShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(path: listPath, builder: (_, _) => const ListScreen()),
          ],
        ),
        StatefulShellBranch(routes: moreTabRoutes()),
      ],
    ),
    GoRoute(
      path: loginPath,
      builder: (_, state) => LoginScreen(
        invite: state.uri.queryParameters['invite'],
        next: state.uri.queryParameters['next'],
      ),
    ),
    GoRoute(
      path: analyticsConsentPath,
      builder: (_, _) => const AnalyticsConsentScreen(),
    ),
    GoRoute(
      path: welcomePath,
      builder: (_, state) =>
          WelcomeScreen(invite: state.uri.queryParameters['invite']),
    ),
    GoRoute(
      path: consentPath,
      builder: (_, state) => ConsentScreen(
        authorizationId: state.uri.queryParameters['authorization_id'],
      ),
    ),
    GoRoute(
      path: '/join/:code',
      builder: (_, state) => JoinScreen(
        code: state.pathParameters['code']!,
        method: state.extra == JoinMethod.code
            ? JoinMethod.code
            : JoinMethod.link,
      ),
    ),
  ],
);

class _StreamListenable(Stream<Object?> stream) extends ChangeNotifier {
  this {
    _subscription = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<Object?> _subscription;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }
}
