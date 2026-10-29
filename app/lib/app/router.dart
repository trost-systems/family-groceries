import 'dart:async';

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
const consentPath = '/oauth/consent';
const settingsPath = '/settings';
const morePath = '/more';
const privacyPath = '/more/privacy';
String joinPath(String code) => '/join/$code';

/// The only auth gate. An invite code from a `/join/<code>` link survives
/// sign-in and onboarding as the `invite` query parameter, an OAuth consent
/// URL as the `next` query parameter.
String? authRedirect(Session session, Uri uri) {
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
    NeedsHousehold() => carry(welcomePath),
    InHousehold() when next != null => next,
    InHousehold() when invite == null && _inShell(uri.path) => uri.toString(),
    // Onboarding is done once in a household; only a link or a fresh
    // sign-in from a link still asks to switch households.
    InHousehold() when invite == null || uri.path == welcomePath => listPath,
    InHousehold() => joinPath(invite!),
  };
  return target == null || target == uri.toString() ? null : target;
}

/// The More tab's pages; the list is `/` itself. Any other path goes to
/// the list.
bool _inShell(String path) =>
    path == settingsPath || path == morePath || path == privacyPath;

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

GoRouter buildRouter(SessionCubit session) => GoRouter(
  refreshListenable: _StreamListenable(session.stream),
  redirect: (context, state) => authRedirect(session.state, state.uri),
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => AppShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(path: listPath, builder: (_, _) => const ListScreen()),
          ],
        ),
        StatefulShellBranch(
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
    ),
    GoRoute(
      path: loginPath,
      builder: (_, state) => LoginScreen(
        invite: state.uri.queryParameters['invite'],
        next: state.uri.queryParameters['next'],
      ),
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
      builder: (_, state) => JoinScreen(code: state.pathParameters['code']!),
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
