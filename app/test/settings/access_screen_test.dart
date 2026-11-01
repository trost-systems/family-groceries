import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/settings/access_repository.dart';
import 'package:family_groceries/settings/access_screen.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../siri/fake_siri_channel.dart';

class FakeAccessRepository() implements AccessRepository {
  final tokens = <AccessToken>[];
  final revoked = <String>[];
  final apps = <ConnectedApp>[];
  final disconnected = <String>[];
  var limitReached = false;

  @override
  Future<List<AccessToken>> fetchTokens() async => [
    for (final t in tokens.reversed)
      if (!revoked.contains(t.id)) t,
  ];

  @override
  Future<NewToken> createToken(String name) async {
    if (limitReached) {
      throw const AccessError('too_many_tokens');
    }
    const token = 'fgp_secretsecretsecretsecretsecretsecret1234';
    tokens.add(
      AccessToken(
        id: 't${tokens.length}',
        name: name,
        hint: '1234',
        createdAt: DateTime(2026, 10, 22),
      ),
    );
    return NewToken(name: name, token: token);
  }

  @override
  Future<void> revokeToken(String id) async => revoked.add(id);

  @override
  Future<List<ConnectedApp>> fetchApps() async => [
    for (final a in apps)
      if (!disconnected.contains(a.clientId)) a,
  ];

  @override
  Future<void> disconnect(String clientId) async => disconnected.add(clientId);
}

void main() {
  late FakeAccessRepository repo;

  Future<void> pumpAccess(
    WidgetTester tester, {
    void Function(FakeAccessRepository repo)? seed,
    SiriChannel? siri,
    String language = 'de',
  }) async {
    repo = FakeAccessRepository();
    seed?.call(repo);
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: Locale(language),
        home: Scaffold(
          body: AccessScreen(repository: repo, siri: siri),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.tap(find.text(text));
    await tester.pumpAndSettle();
  }

  const secret = 'fgp_secretsecretsecretsecretsecretsecret1234';

  testWidgets('shows the MCP endpoint and empty sections', (tester) async {
    await pumpAccess(tester);
    expect(find.text('MCP-Server'), findsOneWidget);
    // Tests build for the production project, whose MCP URL is the proxy.
    expect(find.text('https://mcp.hummlist.com'), findsOneWidget);
    expect(find.text('Kein aktiver Token.'), findsOneWidget);
    expect(find.text('Noch keine App verbunden.'), findsOneWidget);
  });

  testWidgets('a new token is shown once, then only its hint', (tester) async {
    await pumpAccess(tester);
    await tapText(tester, 'Token erstellen');
    await tester.enterText(find.widgetWithText(TextField, 'Name'), 'Claude');
    await tapText(tester, 'Erstellen');

    expect(find.text(secret), findsOneWidget);
    expect(
      find.text(
        'Kopiere den Token jetzt. Er wird nicht noch einmal angezeigt.',
      ),
      findsOneWidget,
    );
    await tapText(tester, 'Fertig');

    expect(find.text(secret), findsNothing);
    expect(find.text('Claude'), findsOneWidget);
    expect(
      find.text('…1234 · Erstellt am 22.10.2026 · Noch nie benutzt'),
      findsOneWidget,
    );
  });

  testWidgets('the token limit is explained', (tester) async {
    await pumpAccess(tester, seed: (r) => r.limitReached = true);
    await tapText(tester, 'Token erstellen');
    await tester.enterText(find.widgetWithText(TextField, 'Name'), 'Siri');
    await tapText(tester, 'Erstellen');
    expect(find.text('Höchstens 20 aktive Tokens.'), findsOneWidget);
    expect(find.textContaining('fgp_'), findsNothing);
  });

  testWidgets('revoking asks first, then removes the token', (tester) async {
    await pumpAccess(
      tester,
      seed: (r) => r.tokens.add(
        AccessToken(
          id: 'siri',
          name: 'Siri',
          hint: 'abcd',
          createdAt: DateTime(2026, 10, 2),
          lastUsedAt: DateTime(2026, 10, 20),
        ),
      ),
    );
    expect(
      find.text('…abcd · Erstellt am 2.10.2026 · Zuletzt benutzt 20.10.2026'),
      findsOneWidget,
    );

    await tester.tap(find.byTooltip('Siri widerrufen'));
    await tester.pumpAndSettle();
    expect(find.text('Token widerrufen?'), findsOneWidget);
    await tapText(tester, 'Abbrechen');
    expect(repo.revoked, isEmpty);

    await tester.tap(find.byTooltip('Siri widerrufen'));
    await tester.pumpAndSettle();
    await tapText(tester, 'Widerrufen');
    expect(repo.revoked, ['siri']);
    expect(find.text('Siri'), findsNothing);
    expect(find.text('Kein aktiver Token.'), findsOneWidget);
  });

  testWidgets('connected apps can be disconnected', (tester) async {
    await pumpAccess(
      tester,
      seed: (r) => r.apps.add(
        ConnectedApp(
          clientId: 'client-1',
          name: 'Claude',
          grantedAt: DateTime(2026, 10, 21),
          scopes: const ['openid', 'email'],
        ),
      ),
    );
    expect(find.text('Claude'), findsOneWidget);
    expect(
      find.text(
        'Verbunden am 21.10.2026 · Deine Anmeldung bestätigen · '
        'Deine E-Mail-Adresse',
      ),
      findsOneWidget,
    );

    await tester.tap(find.byTooltip('Claude trennen'));
    await tester.pumpAndSettle();
    expect(find.text('Claude trennen?'), findsOneWidget);
    await tapText(tester, 'Trennen');
    expect(repo.disconnected, ['client-1']);
    expect(find.text('Claude'), findsNothing);
    expect(find.text('Noch keine App verbunden.'), findsOneWidget);
  });

  group('Siri', () {
    AccessToken token(String id, String name, {AccessKind kind = .pat}) =>
        AccessToken(
          id: id,
          name: name,
          kind: kind,
          hint: id.substring(0, 4),
          createdAt: DateTime(2026, 10, 31),
        );

    FakeSiriChannel thisIphone(String id) =>
        FakeSiriChannel()
          ..entry = SiriKeychainEntry(id: id, userId: 'u1', sessionId: 's1');

    void twoIphones(FakeAccessRepository r) => r.tokens.addAll([
      token('here-id', 'Siri', kind: .siri),
      token('else-id', 'Siri', kind: .siri),
    ]);

    testWidgets('the card and rows on this iPhone, in German', (tester) async {
      await pumpAccess(tester, siri: thisIphone('here-id'), seed: twoIphones);

      expect(
        find.text(
          'Siri funktioniert jetzt ohne Einrichtung. '
          'Sag: „Füge etwas zu Hummlist hinzu“.',
        ),
        findsOneWidget,
      );
      expect(find.text('Siri (dieses iPhone)'), findsOneWidget);
      expect(find.text('Siri (anderes iPhone)'), findsOneWidget);
      expect(find.text('Kein aktiver Token.'), findsOneWidget);
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsNothing);

      await tapText(tester, 'Siri-Sätze anzeigen');
      expect(find.text('„Füge etwas zu Hummlist hinzu“'), findsOneWidget);
      expect(find.text('„Was steht auf meiner Hummlist?“'), findsOneWidget);
      expect(find.text('„Add to Hummlist“'), findsOneWidget);
      expect(find.text('Auf Englisch'), findsOneWidget);
      await tapText(tester, 'Schließen');
      expect(find.text('Siri-Sätze'), findsNothing);
    });

    testWidgets('the card and rows on this iPhone, in English', (tester) async {
      await pumpAccess(
        tester,
        siri: thisIphone('else-id'),
        seed: twoIphones,
        language: 'en',
      );

      expect(
        find.text('Siri now works without setup: say “Add to Hummlist”.'),
        findsOneWidget,
      );
      expect(find.text('Siri (this iPhone)'), findsOneWidget);
      expect(find.text('Siri (other iPhone)'), findsOneWidget);

      await tapText(tester, 'Show Siri phrases');
      expect(find.text('“Add something to my Hummlist”'), findsOneWidget);
      expect(find.text('“Add <item> to Hummlist”'), findsOneWidget);
      expect(find.text("“What's on my Hummlist?”"), findsOneWidget);
      expect(find.text('“Füge <Eintrag> zu Hummlist hinzu”'), findsOneWidget);
    });

    testWidgets('a Siri credential is revoked like a token', (tester) async {
      await pumpAccess(tester, siri: thisIphone('here-id'), seed: twoIphones);

      await tester.tap(find.byTooltip('Siri (anderes iPhone) widerrufen'));
      await tester.pumpAndSettle();
      expect(find.text('Siri-Zugang widerrufen?'), findsOneWidget);
      await tapText(tester, 'Widerrufen');

      expect(repo.revoked, ['else-id']);
      expect(find.text('Siri (anderes iPhone)'), findsNothing);
      expect(find.text('Siri (dieses iPhone)'), findsOneWidget);
    });

    testWidgets('elsewhere no card, but the rows to revoke', (tester) async {
      await pumpAccess(tester, seed: twoIphones);

      expect(find.byKey(const ValueKey('siri-card')), findsNothing);
      expect(find.text('Siri (anderes iPhone)'), findsNWidgets(2));
    });

    testWidgets('no Siri section elsewhere without Siri rows', (tester) async {
      await pumpAccess(
        tester,
        seed: (r) => r.tokens.add(token('pat-id', 'Siri')),
      );
      expect(find.byKey(const ValueKey('siri-card')), findsNothing);
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsNothing);
      expect(find.text('Siri'), findsOneWidget, reason: 'the token only');
    });

    testWidgets('the old shortcut token gets a hint', (tester) async {
      await pumpAccess(
        tester,
        siri: FakeSiriChannel(),
        seed: (r) => r.tokens.addAll([
          token('pat1', 'Claude'),
          token('pat2', 'Mein Kurzbefehl'),
          token('siri', 'Siri', kind: .siri),
        ]),
      );
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsOneWidget);
      expect(
        find.text(
          'Den alten Kurzbefehl brauchst du nicht mehr. '
          'Seinen Token „Mein Kurzbefehl“ kannst du unten löschen.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('no hint without a shortcut token', (tester) async {
      await pumpAccess(
        tester,
        siri: FakeSiriChannel(),
        seed: (r) => r.tokens.addAll([
          token('pat1', 'Claude'),
          token('siri', 'Siri', kind: .siri),
        ]),
        language: 'en',
      );
      expect(find.byKey(const ValueKey('siri-card')), findsOneWidget);
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsNothing);
    });

    testWidgets('a revoked shortcut token loses its hint', (tester) async {
      await pumpAccess(
        tester,
        siri: FakeSiriChannel(),
        seed: (r) => r.tokens.add(token('pat-id', 'Siri Shortcut')),
      );
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsOneWidget);
      await tester.tap(find.byTooltip('Siri Shortcut widerrufen'));
      await tester.pumpAndSettle();
      await tapText(tester, 'Widerrufen');
      expect(find.byKey(const ValueKey('siri-legacy-hint')), findsNothing);
    });
  });
}
