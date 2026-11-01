import 'dart:async';
import 'dart:convert';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/popular_stores.dart';
import 'package:family_groceries/purchases/premium_server.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../purchases/fakes.dart';
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
    testWidgets('the name is prefilled, no store is picked, the stores '
        'and the disclaimer show', (tester) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      expect(find.widgetWithText(TextField, 'Unser Haushalt'), findsOneWidget);
      for (final store in popularStores) {
        final chip = tester.widget<FilterChip>(key('onboarding-store-$store'));
        expect(chip.selected, isFalse, reason: store);
      }
      expect(key('stores-disclaimer'), findsOneWidget);
      expect(
        find.textContaining('Ladennamen wie dm, Lidl oder EDEKA'),
        findsOneWidget,
      );
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [('Unser Haushalt', '')]);
      // Created: Step 3.
      expect(location(o), '/welcome/invite');
    });

    testWidgets('the picked stores and an own one are created in the order '
        'picked; unpicking takes one out', (tester) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tapKey(tester, 'onboarding-store-REWE');
      await tapKey(tester, 'onboarding-store-dm');
      await tapKey(tester, 'onboarding-store-EDEKA');
      await tapKey(tester, 'onboarding-store-dm');
      await tapKey(tester, 'onboarding-store-own');
      await tester.enterText(key('store-new-field'), '  Bäcker   Kühn ');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(
        tester.widget<FilterChip>(key('onboarding-store-Bäcker Kühn')).selected,
        isTrue,
      );
      await tapKey(tester, 'onboarding-store-own');
      await tester.enterText(key('store-new-field'), 'rewe');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [
        ('Unser Haushalt', 'REWE, EDEKA, Bäcker Kühn'),
      ]);
    });

    testWidgets('the own-store row reads as a button, not a check box', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await pumpOnboarding(tester, location: '/welcome/create');
      expect(
        tester.getSemantics(find.bySemanticsLabel('Eigenen Laden hinzufügen')),
        isSemantics(isButton: true, hasCheckedState: false, hasTapAction: true),
      );
      handle.dispose();
    });

    testWidgets('Skip creates without stores, under the typed name', (
      tester,
    ) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tester.enterText(key('household-name'), '  WG Sonnenallee ');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await tapKey(tester, 'onboarding-store-Lidl');
      await tapKey(tester, 'skip-stores');
      expect(o.session.creates, [('WG Sonnenallee', '')]);
      expect(
        find.text(
          'Ohne Läden starten. Du kannst sie später unter Mehr anlegen.',
        ),
        findsNothing,
        reason: 'created: Step 3',
      );
    });

    testWidgets('an empty name is refused before any call', (tester) async {
      final o = await pumpOnboarding(tester, location: '/welcome/create');
      await tester.enterText(key('household-name'), '   ');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await tapKey(tester, 'create-household');
      expect(
        find.descendant(
          of: key('create-name-problem'),
          matching: find.text('Gib einen Namen mit 1 bis 80 Zeichen ein.'),
        ),
        findsOneWidget,
        reason: 'beside the button, where the tap was',
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
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await tapKey(tester, 'onboarding-store-Penny');
      o.session.fail = HouseholdProblem.offline;
      await tapKey(tester, 'create-household');
      expect(find.text(offline), findsOneWidget);
      await tester.scrollUntilVisible(
        key('household-name'),
        -200,
        scrollable: find
            .descendant(
              of: key('create-household-screen'),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.widgetWithText(TextField, 'Familie Trost'), findsOneWidget);
      expect(location(o), '/welcome/create');
      await tester.scrollUntilVisible(
        key('create-household'),
        200,
        scrollable: find
            .descendant(
              of: key('create-household-screen'),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(
        tester.widget<FilterChip>(key('onboarding-store-Penny')).selected,
        isTrue,
      );
      await tapKey(tester, 'create-household');
      expect(o.session.creates, [
        ('Familie Trost', 'Penny'),
        ('Familie Trost', 'Penny'),
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
      expect(find.text('Add your own store'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      expect(
        find.textContaining("Hummlist is independent and isn't affiliated"),
        findsOneWidget,
      );
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

  group('a yearly plan keeps being billed when leaving (H-85)', () {
    const inHome = InHousehold('peter', home);
    Future<void> showJoinButtons(WidgetTester tester, String last) =>
        tester.scrollUntilVisible(
          key(last),
          200,
          scrollable: find
              .descendant(
                of: key('join-screen'),
                matching: find.byType(Scrollable),
              )
              .first,
        );
    const subscriber = MyYearlyPlan(subscriber: true, renewing: true);
    FakeInvites lastOfUnlocked() =>
        FakeInvites()
          ..lifetime['ABCD2345'] = const JoinLifetime(leavesUnlocked: true);

    testWidgets('leaving: the subscriber hears so, then joins', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        premium: FakePremiumServer(mine: subscriber),
      );
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      expect(key('premium-billing-continues'), findsOneWidget);
      expect(
        find.textContaining('Löschen oder Verlassen kündigt es nicht.'),
        findsOneWidget,
      );
      expect(o.session.joins, isEmpty);
      await tapKey(tester, 'premium-billing-continue');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
    });

    testWidgets('leaving: Abo verwalten stays', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        premium: FakePremiumServer(mine: subscriber),
      );
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      await tapKey(tester, 'premium-billing-manage');
      expect(o.session.joins, isEmpty);
    });

    testWidgets('archiving: the subscriber hears so first', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: lastOfUnlocked(),
        archiveOffered: true,
        premium: FakePremiumServer(mine: subscriber),
      );
      await showJoinButtons(tester, 'join-delete');
      await tapKey(tester, 'join-archive');
      expect(key('premium-billing-continues'), findsOneWidget);
      await tapKey(tester, 'premium-billing-continue');
      expect(o.session.archivingJoins, ['ABCD2345']);
    });

    testWidgets('deleting: after the delete question, the billing one', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        invites: lastOfUnlocked(),
        archiveOffered: true,
        premium: FakePremiumServer(mine: subscriber),
      );
      await showJoinButtons(tester, 'join-delete');
      await tapKey(tester, 'join-delete');
      await tapKey(tester, 'join-delete-confirm');
      expect(key('premium-billing-continues'), findsOneWidget);
      expect(o.session.joins, isEmpty);
      await tapKey(tester, 'premium-billing-continue');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      expect(o.session.archivingJoins, isEmpty);
    });

    testWidgets('another member of a billed household: the short line', (
      tester,
    ) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        premium: FakePremiumServer(
          mine: const MyYearlyPlan(householdBilled: true),
        ),
      );
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      expect(key('premium-billing-other'), findsOneWidget);
      expect(
        find.text(
          'Ein Jahresabo für diesen Haushalt läuft weiter, bis es gekündigt '
          'wird.',
        ),
        findsOneWidget,
      );
      await tapKey(tester, 'premium-billing-cancel');
      expect(o.session.joins, isEmpty);
    });

    testWidgets('in English', (tester) async {
      await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
        locale: const Locale('en'),
        premium: FakePremiumServer(mine: subscriber),
      );
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      expect(
        find.text(
          'Your Hummlist Premium yearly plan keeps running and is billed to '
          'your Apple or Google account until you cancel it. Deleting or '
          "leaving doesn't cancel it.",
        ),
        findsOneWidget,
      );
      expect(find.text('Manage subscription'), findsOneWidget);
      expect(find.text('Continue anyway'), findsOneWidget);
    });

    testWidgets('no yearly plan: joins at once; without a household nothing '
        'is asked', (tester) async {
      final o = await pumpOnboarding(
        tester,
        location: '/join/ABCD2345',
        session: inHome,
      );
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      expect(o.session.joins, [('ABCD2345', JoinMethod.link)]);
      final fresh = await pumpOnboarding(tester, location: '/join/ABCD2345');
      await showJoinButtons(tester, 'join-confirm');
      await tapKey(tester, 'join-confirm');
      expect(fresh.premium.calls, isEmpty);
    });
  });
}
