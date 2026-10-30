import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const household = InHousehold('u', Household(id: 'h', name: 'H'));
  const consent = '/oauth/consent?authorization_id=abc';
  const next = 'next=%2Foauth%2Fconsent%3Fauthorization_id%3Dabc';
  const cases = <(Session, String, String?)>[
    (SessionLoading(), '/', null),
    (SignedOut(), '/', '/login'),
    (SignedOut(), '/login', null),
    (SignedOut(), '/join/ABCD2345', '/login?invite=ABCD2345'),
    // Job 22: an invite skips Step 1 and opens the join screen.
    (NeedsHousehold('u'), '/login?invite=ABCD2345', '/join/ABCD2345'),
    (NeedsHousehold('u'), '/', '/welcome'),
    (NeedsHousehold('u'), '/join/ABCD2345', null),
    (NeedsHousehold('u'), '/welcome?invite=ABCD2345', '/join/ABCD2345'),
    (NeedsHousehold('u'), '/welcome', null),
    (NeedsHousehold('u'), '/welcome/create', null),
    (NeedsHousehold('u'), '/join', null),
    (NeedsHousehold('u'), '/welcome/invite', '/welcome'),
    (NeedsHousehold('u'), '/more/invites', '/welcome'),
    (household, '/welcome/create', '/welcome/invite'),
    (household, '/welcome/invite', null),
    (household, '/join', null),
    (household, '/more/invites', null),
    (SignedOut(), '/welcome/invite', '/login'),
    (SignedOut(), '/join', '/login'),
    (household, '/login', '/'),
    (household, '/welcome', '/'),
    // An invite in any location opens the join screen (which warns).
    (household, '/welcome?invite=ABCD2345', '/join/ABCD2345'),
    (household, '/login?invite=ABCD2345', '/join/ABCD2345'),
    (household, '/join/ABCD2345', null),
    (household, '/?code=pkce', '/'),
    (household, '/', null),
    (household, '/settings', null),
    (household, '/settings?section=account', null),
    // An invite link opens the join page wherever it points.
    (household, '/settings?invite=ABCD2345', '/join/ABCD2345'),
    (household, '/more', null),
    // The draft privacy page is gone; an old link lands on the list.
    (household, '/more/privacy', '/'),
    (household, '/more/access', null),
    (household, '/more/account', null),
    (household, '/more/account?invite=ABCD2345', '/join/ABCD2345'),
    (SignedOut(), '/more/account', '/login'),
    (household, '/more/settings', null),
    (household, '/more/settings/language', null),
    (SignedOut(), '/more/settings/language', '/login'),
    (NeedsHousehold('u'), '/more/access', '/welcome'),
    (household, '/more/nothing-here', '/'),
    (SignedOut(), '/more', '/login'),
    (SignedOut(), '/settings', '/login'),
    (SignedOut(), consent, '/login?$next'),
    (SignedOut(), '/login?$next', null),
    (NeedsHousehold('u'), '/login?$next', '/welcome?$next'),
    (NeedsHousehold('u'), consent, '/welcome?$next'),
    (NeedsHousehold('u'), '/welcome?$next', null),
    (NeedsHousehold('u'), '/welcome/create?$next', null),
    (NeedsHousehold('u'), '/join?$next', null),
    (NeedsHousehold('u'), '/join/ABCD2345?$next', null),
    (household, '/welcome/create?$next', consent),
    (household, '/join?$next', consent),
    (household, '/login?$next', consent),
    (household, '/welcome?$next', consent),
    (household, consent, null),
    (household, '/oauth/consent', null),
    (household, '$consent&code=pkce', null),
    (SignedOut(), '/login?next=https%3A%2F%2Fevil.example', '/login'),
    (SignedOut(), '/login?next=%2F%2Fevil.example%2Foauth%2Fconsent', '/login'),
    (household, '/login?next=https%3A%2F%2Fevil.example', '/'),
    (household, '/welcome?next=%2Fsettings', '/'),
    (NeedsHousehold('u'), '/welcome?next=%2Fsettings', '/welcome'),
  ];
  for (final (session, from, to) in cases) {
    test('${session.runtimeType} at $from goes to ${to ?? 'stays'}', () {
      expect(authRedirect(session, Uri.parse(from)), to);
    });
  }

  // Job 22: the invite kept on the device stands in for one in the
  // location, which the mobile apps lose: a magic link or Apple on Android
  // returns through com.hummlist.app://login-callback, and a cold start
  // opens at `/`.
  const pending = <(Session, String, String?)>[
    (SignedOut(), '/', '/login?invite=ABCD2345'),
    (SignedOut(), '/login', '/login?invite=ABCD2345'),
    (SignedOut(), '/login?invite=ABCD2345', null),
    (NeedsHousehold('u'), '/', '/join/ABCD2345'),
    (NeedsHousehold('u'), '/?code=pkce', '/join/ABCD2345'),
    (NeedsHousehold('u'), '/welcome', '/join/ABCD2345'),
    (NeedsHousehold('u'), '/join/ABCD2345', null),
    (household, '/', '/join/ABCD2345'),
    (household, '/more', '/join/ABCD2345'),
    (household, '/join/ABCD2345', null),
    // A link in the location wins over an older pending one.
    (NeedsHousehold('u'), '/join/WXYZ6789', null),
    (household, '/login?invite=WXYZ6789', '/join/WXYZ6789'),
  ];
  for (final (session, from, to) in pending) {
    test('pending invite: ${session.runtimeType} at $from goes to '
        '${to ?? 'stays'}', () {
      expect(
        authRedirect(session, Uri.parse(from), pendingInvite: 'ABCD2345'),
        to,
      );
    });
  }

  test('pending invite: asked for consent first, carried along', () {
    expect(
      authRedirect(
        const NeedsHousehold('u'),
        Uri.parse('/'),
        askConsent: true,
        pendingInvite: 'ABCD2345',
      ),
      '/analytics-consent?invite=ABCD2345',
    );
  });

  // The URIs the platforms hand go_router: a universal link / App Link
  // (the path of https://app.hummlist.com/join/<code>) and the auth
  // callback, whose path is empty.
  test('a universal link names its invite', () {
    expect(
      inviteIn(Uri.parse('https://app.hummlist.com/join/ABCD2345')),
      'ABCD2345',
    );
    expect(
      authRedirect(
        const SignedOut(),
        Uri.parse('https://app.hummlist.com/join/ABCD2345'),
      ),
      '/login?invite=ABCD2345',
    );
  });

  test(
    'the custom-scheme callback has no invite; the pending one leads on',
    () {
      final callback = Uri.parse('com.hummlist.app://login-callback?code=abc');
      expect(inviteIn(callback), isNull);
      expect(
        authRedirect(
          const NeedsHousehold('u'),
          callback,
          pendingInvite: 'ABCD2345',
        ),
        '/join/ABCD2345',
      );
      expect(authRedirect(const NeedsHousehold('u'), callback), '/welcome');
    },
  );

  // Job 29d: Zugänge and Konto are two pages; the links of the one page
  // they were before go to the right one.
  for (final (from, to) in const [
    ('/settings', '/more/access'),
    ('/settings?section=account', '/more/account'),
    ('/settings?section=access', '/more/access'),
    ('/settings?section=', '/more/access'),
  ]) {
    test('the old link $from goes to $to', () {
      expect(legacySettingsRedirect(Uri.parse(from)), to);
    });
  }

  // Job 19: an install that has not decided on analytics is asked right
  // after sign-in, before onboarding and before the list; an invite rides
  // along every hop, and MCP's OAuth tab is not interrupted.
  const ask = '/analytics-consent';
  const asking = <(Session, String, String?)>[
    (SessionLoading(), '/', null),
    (SignedOut(), '/', '/login'),
    (SignedOut(), ask, '/login'),
    (SignedOut(), '/login', null),
    (SignedOut(), '/join/ABCD2345', '/login?invite=ABCD2345'),
    (NeedsHousehold('u'), '/login', ask),
    (NeedsHousehold('u'), '/', ask),
    (NeedsHousehold('u'), '/welcome', ask),
    (NeedsHousehold('u'), '/welcome/create', ask),
    (NeedsHousehold('u'), ask, null),
    (NeedsHousehold('u'), '/login?invite=ABCD2345', '$ask?invite=ABCD2345'),
    (NeedsHousehold('u'), '/join/ABCD2345', '$ask?invite=ABCD2345'),
    (NeedsHousehold('u'), '$ask?invite=ABCD2345', null),
    (household, '/login', ask),
    (household, '/', ask),
    (household, '/more', ask),
    (household, ask, null),
    (household, '/login?invite=ABCD2345', '$ask?invite=ABCD2345'),
    (household, '/join/ABCD2345', '$ask?invite=ABCD2345'),
    (household, '$ask?invite=ABCD2345', null),
    // MCP's OAuth consent keeps its `next` and is not interrupted.
    (SignedOut(), consent, '/login?$next'),
    (NeedsHousehold('u'), '/login?$next', '/welcome?$next'),
    (NeedsHousehold('u'), consent, '/welcome?$next'),
    (household, '/login?$next', consent),
    (household, consent, null),
  ];
  for (final (session, from, to) in asking) {
    test('asking consent: ${session.runtimeType} at $from goes to '
        '${to ?? 'stays'}', () {
      expect(authRedirect(session, Uri.parse(from), askConsent: true), to);
    });
  }

  // Once decided, the consent page hands over: onboarding, the join page
  // of the invite, or the list.
  const decided = <(Session, String, String?)>[
    (NeedsHousehold('u'), ask, '/welcome'),
    (NeedsHousehold('u'), '$ask?invite=ABCD2345', '/join/ABCD2345'),
    (household, ask, '/'),
    (household, '$ask?invite=ABCD2345', '/join/ABCD2345'),
    (SignedOut(), ask, '/login'),
  ];
  for (final (session, from, to) in decided) {
    test('decided: ${session.runtimeType} at $from goes to $to', () {
      expect(authRedirect(session, Uri.parse(from)), to);
    });
  }
}
