import 'dart:convert';

import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  /// A repository whose PostgREST answers every write with [status] and [body].
  SupabaseListRepository answering(int status, Object body) =>
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

  group('an add answers with the row it is (put_item, job 64b)', () {
    Map<String, Object?> row(String id) => {
      'id': id,
      'name': 'Brot',
      'quantity': '1',
      'category_id': 'bakery',
      'store_id': 'bakery-store',
      'status': 'active',
      'created_at': '2026-10-28T00:00:00Z',
      'updated_at': '2026-10-28T00:00:00Z',
    };

    test('its own row', () async {
      final rows = await answering(200, [row('item-1')]).send(add);
      expect(rows.keys, ['item-1']);
      expect(rows['item-1']!.categoryId, 'bakery');
    });

    test(
      'the open item it already is: this id is gone, that row is there',
      () async {
        final rows = await answering(200, [row('leas-brot')]).send(add);
        expect(rows['item-1'], isNull);
        expect(rows.containsKey('item-1'), isTrue);
        expect(rows['leas-brot']!.storeId, 'bakery-store');
      },
    );

    test('no row: the item is gone', () async {
      expect(await answering(200, <Object>[]).send(add), {'item-1': null});
    });
  });
}
