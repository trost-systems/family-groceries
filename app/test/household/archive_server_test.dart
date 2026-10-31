import 'dart:convert';

import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/onboarding_page.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' show Response;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Job 47: what the server says about archiving reaches the user.
void main() {
  final de = lookupAppLocalizations(const Locale('de'));
  final en = lookupAppLocalizations(const Locale('en'));

  SupabaseClient answering(int status, Object body) {
    final client = SupabaseClient(
      'http://localhost:54321',
      'sb_publishable_test',
      httpClient: MockClient(
        (request) async => Response(
          jsonEncode(body),
          status,
          headers: {'content-type': 'application/json'},
          request: request,
        ),
      ),
    );
    addTearDown(client.dispose);
    return client;
  }

  test('the switched-off archive is its own problem, in DE and EN', () async {
    final client = answering(400, {
      'code': 'P0001',
      'message': 'archive_disabled',
      'hint': 'Archiving households is switched off on this server.',
    });
    await expectLater(
      householdCall(() => client.rpc<Map<String, dynamic>>('accept_invite')),
      throwsA(
        isA<HouseholdError>().having(
          (e) => e.problem,
          'problem',
          HouseholdProblem.archiveDisabled,
        ),
      ),
    );
    expect(
      householdProblemText(de, HouseholdProblem.archiveDisabled),
      'Archivieren ist gerade nicht möglich. Dein Haushalt bleibt, wie er ist.',
    );
    expect(
      householdProblemText(en, HouseholdProblem.archiveDisabled),
      "Archiving isn't available right now. Your household stays as it is.",
    );
  });

  test('archived households carry the server deletion date', () async {
    final client = answering(200, [
      {
        'id': 'old',
        'name': 'Altbau',
        'archived_at': '2026-10-31T12:00:00+00:00',
        'deletes_at': '2028-10-31T12:00:00+00:00',
        'unlocked': true,
      },
      {
        'id': 'older',
        'name': 'Vorher',
        'archived_at': '2026-10-01T12:00:00+00:00',
        'unlocked': false,
      },
    ]);
    final archived = await SupabaseInviteRepository(client).archived();
    expect(archived.first.deletesAt, DateTime.utc(2028, 10, 31, 12));
    expect(archived.last.deletesAt, isNull, reason: 'a server before job 47');
  });

  test('the archive offer on joining names the 24 months', () {
    expect(
      de.joinArchiveOffer('Zuhause'),
      endsWith(
        'Aktivierst du ihn nicht innerhalb von 24 Monaten wieder, wird er '
        'gelöscht.',
      ),
    );
    expect(
      en.joinArchiveOffer('Home'),
      endsWith("If you don't bring it back within 24 months, it is deleted."),
    );
  });
}
