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
    (NeedsHousehold('u'), '/login?invite=ABCD2345', '/welcome?invite=ABCD2345'),
    (NeedsHousehold('u'), '/', '/welcome'),
    (NeedsHousehold('u'), '/join/ABCD2345', '/welcome?invite=ABCD2345'),
    (household, '/login', '/'),
    (household, '/welcome', '/'),
    (household, '/welcome?invite=ABCD2345', '/'),
    (household, '/login?invite=ABCD2345', '/join/ABCD2345'),
    (household, '/join/ABCD2345', null),
    (household, '/?code=pkce', '/'),
    (household, '/', null),
    (household, '/settings', null),
    (household, '/settings?section=account', null),
    // An invite link opens the join page wherever it points.
    (household, '/settings?invite=ABCD2345', '/join/ABCD2345'),
    (household, '/more', null),
    (household, '/more/privacy', null),
    (household, '/more/access', null),
    (household, '/more/account', null),
    (household, '/more/account?invite=ABCD2345', '/join/ABCD2345'),
    (SignedOut(), '/more/account', '/login'),
    (NeedsHousehold('u'), '/more/access', '/welcome'),
    (household, '/more/nothing-here', '/'),
    (SignedOut(), '/more', '/login'),
    (SignedOut(), '/settings', '/login'),
    (SignedOut(), consent, '/login?$next'),
    (SignedOut(), '/login?$next', null),
    (NeedsHousehold('u'), '/login?$next', '/welcome?$next'),
    (NeedsHousehold('u'), consent, '/welcome?$next'),
    (NeedsHousehold('u'), '/welcome?$next', null),
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
    (NeedsHousehold('u'), '$ask?invite=ABCD2345', '/welcome?invite=ABCD2345'),
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
