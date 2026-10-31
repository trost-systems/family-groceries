import 'dart:async';
import 'dart:convert';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

String location(Onboarding o) =>
    o.router.routerDelegate.currentConfiguration.uri.toString();

Finder key(String k) => find.byKey(ValueKey(k));

const offline =
    'Keine Internetverbindung. Versuche es erneut, sobald du online bist.';

void main() {
  group('Step 1', () {
    testWidgets('offers create and join; create opens Step 2a', (tester) async {
      final o = await pumpOnboarding(tester, location: '/');
      expect(location(o), '/welcome');
      expect(find.text('Willkommen bei Hummlist'), findsOneWidget);
      expect(find.text('Haushalt erstellen'), findsOneWidget);
      expect(find.text('Einladung annehmen'), findsOneWidget);
      await tapKey(tester, 'onboarding-create');
      expect(location(o), '/welcome/create');
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tapKey(tester, 'onboarding-join');
      expect(location(o), '/join');
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(tester, location: '/', locale: const Locale('en'));
      expect(find.text('Welcome to Hummlist'), findsOneWidget);
      expect(find.text('Create a household'), findsOneWidget);
      expect(find.text('Join with an invite'), findsOneWidget);
    });

    testWidgets('a pending invite skips it and opens the join screen', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/',
        pendingCode: 'ABCD2345',
      );
      expect(location(o), '/join/ABCD2345');
      expect(find.text('Familie Trost'), findsOneWidget);
    });
  });

  group('Step 2a: create', () {
    testWidgets('the name is prefilled, the default stores are on', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      expect(find.widgetWithText(TextField, 'Unser Haushalt'), findsOneWidget);
      expect(find.text('Deutsche Standard-Läden hinzufügen'), findsOneWidget);
      expect(find.text('Überspringen'), findsOneWidget);
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [('Unser Haushalt', true)]);
      // Created: Step 3.
      expect(location(o), '/welcome/invite');
    });

    testWidgets('Skip creates without stores, under the typed name', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tester.enterText(key('household-name'), '  WG Sonnenallee ');
      await tapKey(tester, 'skip-stores');
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [('WG Sonnenallee', false)]);
    });

    testWidgets('an empty name is refused before any call', (tester) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tester.enterText(key('household-name'), '   ');
      await tapKey(tester, 'create-household');
      expect(
        find.text('Gib einen Namen mit 1 bis 80 Zeichen ein.'),
        findsOneWidget,
      );
      expect(o.session.creates, isEmpty);
    });

    testWidgets('a double tap creates once', (tester) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      o.session.hold = Completer();
      await tester.tap(key('create-household'));
      await tester.pump();
      await tester.tap(key('create-household'), warnIfMissed: false);
      await tester.pump();
      o.session.hold!.complete();
      await tester.pumpAndSettle();
      expect(o.session.creates, hasLength(1));
    });

    testWidgets('offline keeps the name and the choice; the retry creates', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tester.enterText(key('household-name'), 'Familie Trost');
      await tapKey(tester, 'skip-stores');
      o.session.fail = HouseholdProblem.offline;
      await tapKey(tester, 'create-household');
      expect(find.text(offline), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Familie Trost'), findsOneWidget);
      expect(location(o), '/welcome/create');
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [
        ('Familie Trost', false),
        ('Familie Trost', false),
      ]);
      expect(location(o), '/welcome/invite');
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/welcome/create',
        locale: const Locale('en'),
      );
      expect(find.widgetWithText(TextField, 'Our household'), findsOneWidget);
      expect(find.text('Add default German stores'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
    });
  });

  group('Step 2b: join', () {
    testWidgets('a link shows the household; Join joins by link', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      expect(o.pending.code, 'ABCD2345');
      expect(find.text('Einladung in den Haushalt'), findsOneWidget);
      expect(find.text('Familie Trost'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'ABCD2345'), findsOneWidget);
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(location(o), '/');
    });

    testWidgets('a typed code is checked, then joined by code', (tester) async {
      final o = await pumpOnboarding(tester, location: '/join');
      await tester.enterText(key('invite-code'), 'abcd-2345');
      await tapKey(tester, 'invite-check');
      expect(o.invites.previews, ['ABCD2345']);
      expect(find.text('Familie Trost'), findsOneWidget);
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.code)]);
      expect(location(o), '/');
    });

    testWidgets('an edited link code is a typed code', (tester) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      o.invites.households['WXYZ6789'] = 'Nachbarn';
      await tester.enterText(key('invite-code'), 'WXYZ6789');
      await tester.pump();
      // The preview went with the old code.
      expect(key('invite-household'), findsNothing);
      await tapKey(tester, 'invite-check');
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('WXYZ6789', JoinMethod.code)]);
    });

    testWidgets('an invalid code: one message, the code stays, the link '
        'is forgotten', (tester) async {
      final o = await pumpOnboarding(tester, location: '/join/ZZZZ2345');
      expect(
        find.text('Dieser Code ist ungültig oder abgelaufen.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(TextField, 'ZZZZ2345'), findsOneWidget);
      expect(o.pending.code, isNull);
      expect(o.session.joins, isEmpty);
      // Retry with a good one.
      await tester.enterText(key('invite-code'), 'ABCD2345');
      await tapKey(tester, 'invite-check');
      expect(find.text('Familie Trost'), findsOneWidget);
    });

    testWidgets('the rate limit says so and keeps the code', (tester) async {
      final invites = FakeInvites()..next = HouseholdProblem.tooManyAttempts;
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        invites: invites,
      );
      expect(
        find.text('Zu viele Versuche. Bitte später noch einmal.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(TextField, 'ABCD2345'), findsOneWidget);
    });

    testWidgets('offline at the preview, then back: the retry works', (
      tester,
    ) async {
      final invites = FakeInvites()..next = HouseholdProblem.offline;
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        invites: invites,
      );
      expect(find.text(offline), findsOneWidget);
      expect(o.pending.code, 'ABCD2345', reason: 'offline is no answer');
      await tapKey(tester, 'invite-check');
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
    });

    testWidgets('offline at the join keeps the preview; the retry joins once', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      o.session.fail = HouseholdProblem.offline;
      await tapKey(tester, 'join-confirm');
      expect(find.text(offline), findsOneWidget);
      expect(find.text('Familie Trost'), findsOneWidget);
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, hasLength(2));
      expect(location(o), '/');
    });

    testWidgets('a double tap on Join joins once', (tester) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      o.session.hold = Completer();
      await tester.tap(key('join-confirm'));
      await tester.pump();
      await tester.tap(key('join-confirm'), warnIfMissed: false);
      await tester.pump();
      o.session.hold!.complete();
      await tester.pumpAndSettle();
      expect(o.session.joins, hasLength(1));
    });

    testWidgets('an MCP authorization on the way survives the join', (
      tester,
    ) async {
      const next = '/oauth/consent?authorization_id=abc';
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345?next=${Uri.encodeComponent(next)}',
      );
      await tapKey(tester, 'join-confirm');
      expect(location(o), next);
    });

    testWidgets('a typo after a link keeps the link pending', (tester) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      await tester.enterText(key('invite-code'), 'ZZZZ2345');
      await tester.pump();
      await tapKey(tester, 'invite-check');
      expect(
        find.text('Dieser Code ist ungültig oder abgelaufen.'),
        findsOneWidget,
      );
      expect(o.pending.code, 'ABCD2345');
    });

    testWidgets('Cancel forgets the link and goes back to Step 1', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/join/ABCD2345');
      await tapKey(tester, 'join-cancel');
      expect(o.pending.code, isNull);
      expect(location(o), '/welcome');
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ZZZZ2345',
        locale: const Locale('en'),
      );
      expect(find.text('This code is invalid or has expired.'), findsOneWidget);
      expect(find.text('Join with an invite'), findsOneWidget);
    });
  });

  group('already in a household', () {
    const inHome = InHousehold('peter', home);

    testWidgets('a link warns; Cancel is the prominent answer and moves '
        'nobody', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
      );
      expect(find.text('Du bist schon in einem Haushalt'), findsOneWidget);
      expect(
        find.text(
          'Du bist das einzige Mitglied von „Zuhause“. Trittst du bei, wird '
          '„Zuhause“ mit seiner Liste gelöscht.',
        ),
        findsOneWidget,
      );
      expect(find.widgetWithText(FilledButton, 'Abbrechen'), findsOneWidget);
      expect(
        find.widgetWithText(OutlinedButton, 'Haushalt beitreten'),
        findsOneWidget,
      );
      await tapKey(tester, 'join-cancel');
      expect(o.session.joins, isEmpty);
      expect(o.pending.code, isNull);
      expect(location(o), '/');
    });

    testWidgets('with others in it, the warning says they keep the list', (
      tester,
    ) async {
      final invites = FakeInvites()..members = 2;
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: invites,
      );
      expect(
        find.text(
          'Trittst du bei, verlässt du „Zuhause“. Die anderen Mitglieder '
          'behalten die Liste.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('switching takes the explicit Join', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
      );
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(location(o), '/');
    });

    testWidgets("a link of one's own household lands on the list", (
      tester,
    ) async {
      final invites = FakeInvites()..own.add('ABCD2345');
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: invites,
      );
      expect(location(o), '/');
      expect(o.session.joins, isEmpty);
      expect(o.pending.code, isNull);
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        locale: const Locale('en'),
      );
      expect(find.text("You're already in a household"), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });
  });

  group('Hummlist Lifetime at the join (job 43)', () {
    const inHome = InHousehold('peter', home);
    Future<void> showJoinButtons(
      WidgetTester tester, [
      String last = 'join-confirm',
    ]) => tester.scrollUntilVisible(
      key(last),
      200,
      scrollable: find
          .descendant(of: key('join-screen'), matching: find.byType(Scrollable))
          .first,
    );
    FakeInvites says(JoinLifetime lifetime) =>
        FakeInvites()..lifetime['ABCD2345'] = lifetime;

    testWidgets('(a) the household has it: nothing to buy', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        invites: says(const JoinLifetime(targetUnlocked: true)),
      );
      expect(
        find.text(
          'Dieser Haushalt hat Hummlist Lifetime. Du musst nichts kaufen.',
        ),
        findsOneWidget,
      );
      expect(
        key('join-refund-help'),
        findsNothing,
        reason: 'no recent purchase',
      );
      expect(key('join-lifetime-ends'), findsNothing);
    });

    testWidgets('(c) paid recently and it has it: the refund help', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: says(
          const JoinLifetime(targetUnlocked: true, recentPurchase: true),
        ),
      );
      expect(key('join-target-unlocked'), findsOneWidget);
      await tapKey(tester, 'join-refund-help');
      expect(key('refund-help'), findsOneWidget);
      expect(find.text('Kauf zurückfordern'), findsOneWidget);
      // Closing the help (back, or a drag on its handle) keeps the join where
      // it was.
      Navigator.of(tester.element(key('refund-help'))).pop();
      await tester.pumpAndSettle();
      expect(key('refund-help'), findsNothing);
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
    });

    testWidgets('a recent purchase alone links nothing', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: says(const JoinLifetime(recentPurchase: true)),
      );
      expect(key('join-refund-help'), findsNothing);
      expect(key('join-target-unlocked'), findsNothing);
    });

    testWidgets('(b) the last member of an unlocked household is warned: '
        'deleted, not refunded; never stopped', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: says(const JoinLifetime(leavesUnlocked: true)),
      );
      expect(
        find.text(
          '„Zuhause“ hat Hummlist Lifetime. Du bist das letzte Mitglied: '
          'Trittst du bei, wird der Haushalt gelöscht. Hummlist Lifetime '
          'endet mit ihm, denn ein Kauf gehört zu seinem Haushalt und zieht '
          'nicht mit um.',
        ),
        findsOneWidget,
      );
      expect(key('join-archive-offer'), findsNothing, reason: 'flag off');
      await showJoinButtons(tester);
      await tapKey(tester, 'join-lifetime-refund-help');
      expect(key('refund-help'), findsOneWidget);
      Navigator.of(tester.element(key('refund-help'))).pop();
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Abbrechen'), findsOneWidget);
      expect(
        find.widgetWithText(OutlinedButton, 'Trotzdem beitreten'),
        findsOneWidget,
      );
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(o.session.archivingJoins, isEmpty);
    });

    testWidgets('(b) with archiving: archive and join keeps the household', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: says(const JoinLifetime(leavesUnlocked: true)),
        archiveOffered: true,
      );
      expect(
        find.textContaining('Archiviere den Haushalt, statt ihn zu löschen'),
        findsOneWidget,
      );
      expect(
        find.textContaining(
          'Aktivierst du ihn nicht innerhalb von 24 Monaten wieder, wird er '
          'gelöscht.',
        ),
        findsOneWidget,
      );
      expect(key('join-lifetime-ends'), findsNothing);
      expect(
        find.textContaining('mit seiner Liste gelöscht'),
        findsNothing,
        reason: 'no contradicting "deleted" line above the archive offer',
      );
      await showJoinButtons(tester, 'join-delete');
      expect(find.widgetWithText(FilledButton, 'Abbrechen'), findsOneWidget);
      await tapKey(tester, 'join-archive');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(o.session.archivingJoins, ['ABCD2345']);
    });

    testWidgets('(b) declining the archive asks once more, then deletes', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: says(const JoinLifetime(leavesUnlocked: true)),
        archiveOffered: true,
      );
      await showJoinButtons(tester, 'join-delete');
      await tapKey(tester, 'join-delete');
      expect(key('join-delete-dialog'), findsOneWidget);
      expect(find.text('„Zuhause“ löschen?'), findsOneWidget);
      expect(
        find.textContaining('Hummlist Lifetime endet mit ihm, denn'),
        findsOneWidget,
      );
      expect(find.textContaining('nicht erstattet'), findsNothing);
      expect(key('join-delete-refund-help'), findsOneWidget);
      await tester.tap(find.text('Abbrechen').last);
      await tester.pumpAndSettle();
      expect(o.session.joins, isEmpty, reason: 'cancelled');
      await tapKey(tester, 'join-delete');
      await tapKey(tester, 'join-delete-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(o.session.archivingJoins, isEmpty);
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        locale: const Locale('en'),
        invites: says(
          const JoinLifetime(
            targetUnlocked: true,
            leavesUnlocked: true,
            recentPurchase: true,
          ),
        ),
      );
      expect(
        find.text(
          'This household has Hummlist Lifetime. '
          "You don't need to buy anything.",
        ),
        findsOneWidget,
      );
      expect(find.textContaining("You're its last member"), findsOneWidget);
      await tester.scrollUntilVisible(
        key('join-confirm'),
        200,
        scrollable: find
            .descendant(
              of: key('join-screen'),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.text('Join anyway'), findsOneWidget);
      expect(
        find.text('Bought Hummlist Lifetime recently? How to request a refund'),
        findsOneWidget,
      );
    });
  });

  group('Step 3: invite the partner', () {
    const inHome = InHousehold('peter', home);

    testWidgets('makes one invite, opens the share sheet with link and code', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/welcome/invite',
        session: inHome,
      );
      expect(find.text('Später'), findsOneWidget);
      o.invites.hold = Completer();
      await tester.tap(key('invite-partner'));
      await tester.pump();
      await tester.tap(key('invite-partner'), warnIfMissed: false);
      o.invites.hold!.complete();
      await tester.pumpAndSettle();
      expect(o.invites.created, hasLength(1));
      final code = o.invites.created.single.code;
      expect(o.sharer.shared, [
        // No APP_URL in tests: the code alone.
        'Komm in unseren Hummlist-Haushalt. Code: $code',
      ]);
      expect(find.bySemanticsLabel('Code $code'), findsOneWidget);
      expect(
        find.textContaining('gültig bis 6. November 2026'),
        findsOneWidget,
      );
      final events = await sentEvents(tester, o);
      expect(events.map((e) => e['event']), ['invite_sent']);
      final properties = events.single['properties']! as Map;
      expect(properties['channel'], 'share_sheet');
      expect(properties['context'], 'onboarding');
      expect(jsonEncode(events), isNot(contains(code)));
      await tapKey(tester, 'invite-later');
      expect(location(o), '/');
    });

    testWidgets('without a share sheet: copy the code, counted once', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/welcome/invite',
        session: inHome,
        sharer: FakeSharer(available: false),
      );
      await tapKey(tester, 'invite-partner');
      expect(o.sharer.shared, isEmpty);
      expect(key('invite-share'), findsNothing);
      await tapKey(tester, 'invite-copy-code');
      expect(o.sharer.copied, [o.invites.created.single.code]);
      expect(find.text('Code kopiert'), findsOneWidget);
      final events = await sentEvents(tester, o);
      expect(events.map((e) => (e['properties']! as Map)['channel']), [
        'copy_code',
      ]);
    });

    testWidgets('offline says so; the retry makes the invite', (tester) async {
      final invites = FakeInvites()..next = HouseholdProblem.offline;
      final o = await pumpOnboarding(
        tester,
        location: '/welcome/invite',
        session: inHome,
        invites: invites,
      );
      await tapKey(tester, 'invite-partner');
      expect(find.text(offline), findsOneWidget);
      expect(o.invites.created, isEmpty);
      await tapKey(tester, 'invite-partner');
      expect(o.invites.created, hasLength(1));
      // Analytics sends what the share queued.
      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('in English', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/welcome/invite',
        session: inHome,
        locale: const Locale('en'),
      );
      expect(find.text('Invite your partner'), findsWidgets);
      expect(find.text('Later'), findsOneWidget);
      await tapKey(tester, 'invite-partner');
      expect(
        o.sharer.shared.single,
        startsWith('Join our Hummlist household.'),
      );
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group("More's Einladungen", () {
    const inHome = InHousehold('peter', home);

    testWidgets('lists open invites; revoking one removes it', (tester) async {
      final invites = FakeInvites();
      await invites.create('home');
      await invites.create('home');
      final o = await pumpOnboarding(
        tester,
        location: '/more/invites',
        session: inHome,
        invites: invites,
      );
      final [first, second] = invites.created;
      expect(find.bySemanticsLabel('Code ${first.code}'), findsOneWidget);
      expect(find.bySemanticsLabel('Code ${second.code}'), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: key('invite-${first.code}'),
          matching: key('invite-revoke'),
        ),
      );
      await tester.pumpAndSettle();
      expect(o.invites.revoked, [first.id]);
      expect(find.bySemanticsLabel('Code ${first.code}'), findsNothing);
      expect(
        find.text('Einladung widerrufen. Link und Code gelten nicht mehr.'),
        findsOneWidget,
      );
    });

    testWidgets('a new invite is shared from the settings', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/more/invites',
        session: inHome,
      );
      expect(find.text('Keine offenen Einladungen.'), findsOneWidget);
      await tapKey(tester, 'invite-new');
      expect(o.invites.created, hasLength(1));
      final events = await sentEvents(tester, o);
      expect((events.single['properties']! as Map)['context'], 'settings');
    });
  });
}
