import 'dart:convert';

import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  /// A repository whose PostgREST answers every write with [status] and [body].
  SupabaseListRepository answering(int status, Map<String, Object?> body) =>
      SupabaseListRepository(
        SupabaseClient(
          'http://127.0.0.1:1',
          'sb_publishable_test',
          httpClient: MockClient(
            (request) async => http.Response(
              jsonEncode(body),
              status,
              headers: {'content-type': 'application/json'},
              request: request,
            ),
          ),
        ),
        'household',
      );

  final add = AddItem(
    Item(
      id: 'item-1',
      name: 'Brot',
      status: ItemStatus.active,
      createdAt: DateTime.utc(2026, 10, 28),
      updatedAt: DateTime.utc(2026, 10, 28),
    ),
  );

  test('a write refused by the database is a rejection', () async {
    final repo = answering(409, {
      'code': '23505',
      'message': 'duplicate key value violates unique constraint',
    });
    await expectLater(
      repo.send(add),
      throwsA(isA<RejectedOp>().having((e) => e.nameTaken, 'nameTaken', true)),
    );
  });

  test('a JWT error is not a rejection, so the op stays queued', () async {
    for (final code in ['PGRST301', 'PGRST303']) {
      final repo = answering(401, {'code': code, 'message': 'JWT expired'});
      await expectLater(
        repo.send(add),
        throwsA(isA<PostgrestException>().having((e) => e.code, 'code', code)),
        reason: code,
      );
    }
  });
}
