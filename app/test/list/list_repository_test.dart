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

  test('a dictated item keeps the brand and details the server split off '
      '(job 111)', () async {
    final repo = answering(200, {
      'speech': 'Verstanden: Windeln Pampers Größe 3, 2 l Milch.',
      'items': [
        {
          'name': 'Windeln',
          'brand': 'Pampers',
          'properties': 'Größe 3, Big Pack',
          'quantity': null,
          'storeId': 'dm',
        },
        {
          'name': 'Milch',
          'brand': null,
          'properties': null,
          'quantity': '2 l',
          'storeId': null,
        },
      ],
      'truncated': false,
    });
    final (:entries, :truncated) = await repo.splitSpoken(
      'Windeln Pampers Größe 3 Big Pack',
    );
    expect(truncated, isFalse);
    expect(
      entries.map(
        (e) => (e.name, e.brand, e.properties, e.quantity, e.storeId),
      ),
      [
        ('Windeln', 'Pampers', 'Größe 3, Big Pack', null, 'dm'),
        ('Milch', null, null, '2 l', null),
      ],
    );
  });

  test('dictation asks the voice function for the split', () async {
    Object? sent;
    final repo = SupabaseListRepository(
      SupabaseClient(
        'http://127.0.0.1:1',
        'sb_publishable_test',
        httpClient: MockClient((request) async {
          sent = jsonDecode(request.body);
          return http.Response(
            jsonEncode({'items': <Object>[], 'truncated': false}),
            200,
            headers: {'content-type': 'application/json'},
            request: request,
          );
        }),
      ),
      'household',
    );
    await repo.splitSpoken('Milch');
    expect(sent, {'text': 'Milch', 'mode': 'parse', 'split': true});
  });

  test('a dictated list cut at 30 items says so (job 111)', () async {
    final repo = answering(200, {
      'speech': 'Verstanden: …',
      'items': [
        for (var i = 0; i < 30; i++)
          {
            'name': 'Ding $i',
            'brand': null,
            'properties': null,
            'quantity': null,
          },
      ],
      'truncated': true,
    });
    final (:entries, :truncated) = await repo.splitSpoken('Ding 0, …');
    expect(entries, hasLength(30));
    expect(truncated, isTrue);
  });

  test('an add typed offline is split by parse_item when it syncs, as '
      'online (job 111)', () async {
    final calls = <String, Map<String, Object?>>{};
    final repo = SupabaseListRepository(
      SupabaseClient(
        'http://127.0.0.1:1',
        'sb_publishable_test',
        httpClient: MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, Object?>;
          final function = request.url.pathSegments.last;
          calls[function] = body;
          final answer = switch (function) {
            'parse_item' => [
              {
                'name': 'Windeln',
                'brand': 'Pampers',
                'properties': 'Größe 3',
                'quantity': null,
                'store_id': 'dm',
                'category_id': 'baby',
              },
            ],
            _ => [
              {
                'id': body['p_id'],
                'name': body['p_name'],
                'quantity': body['p_quantity'],
                'brand': body['p_brand'],
                'properties': body['p_properties'],
                'category_id': body['p_category'],
                'store_id': body['p_store'],
                'status': 'active',
                'created_at': '2026-11-05T00:00:00Z',
                'updated_at': '2026-11-05T00:00:00Z',
              },
            ],
          };
          return http.Response(
            jsonEncode(answer),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
            request: request,
          );
        }),
      ),
      'household',
    );
    final typed = Item(
      id: 'item-2',
      name: 'Windeln Pampers Größe 3',
      quantity: '2',
      status: ItemStatus.active,
      createdAt: DateTime.utc(2026, 11, 5),
      updatedAt: DateTime.utc(2026, 11, 5),
    );

    final rows = await repo.send(AddItem(typed, deviceParsed: true));

    expect(calls['parse_item'], {
      'p_household': 'household',
      'p_text': 'Windeln Pampers Größe 3',
    });
    final row = rows['item-2']!;
    expect(
      (row.name, row.brand, row.properties, row.quantity, row.storeId),
      ('Windeln', 'Pampers', 'Größe 3', '2', 'dm'),
    );
    expect(row.categoryId, 'baby');

    // „Ohne Laden“ picked offline: the parsed store is not taken.
    await repo.send(
      AddItem(typed.copyWith(), noStore: true, deviceParsed: true),
    );
    expect(calls['put_item']!['p_store'], isNull);
    expect(calls['put_item']!['p_no_store'], isTrue);
    expect(calls['put_item']!['p_brand'], 'Pampers');
  });

  test('an add the server parsed already goes to put_item as it is', () async {
    final paths = <String>[];
    final repo = SupabaseListRepository(
      SupabaseClient(
        'http://127.0.0.1:1',
        'sb_publishable_test',
        httpClient: MockClient((request) async {
          paths.add(request.url.pathSegments.last);
          return http.Response('[]', 200, request: request);
        }),
      ),
      'household',
    );
    await repo.send(add);
    expect(paths, ['put_item']);
  });

  test('a voice function without the split still adds the items', () async {
    final repo = answering(200, {
      'speech': 'Verstanden: Milch.',
      'items': [
        {'name': 'Milch', 'quantity': null},
      ],
      'truncated': false,
    });
    final (:entries, truncated: _) = await repo.splitSpoken('Milch');
    expect(entries.map((e) => (e.name, e.brand)), [('Milch', null)]);
  });

  test('a rename of an add typed offline is split by parse_item too '
      '(job 111)', () async {
    final calls = <String, Object?>{};
    final repo = SupabaseListRepository(
      SupabaseClient(
        'http://127.0.0.1:1',
        'sb_publishable_test',
        httpClient: MockClient((request) async {
          final body = jsonDecode(request.body);
          calls[request.url.pathSegments.last] = body;
          final answer = request.url.pathSegments.last == 'parse_item'
              ? [
                  {
                    'name': 'Windeln',
                    'brand': 'Pampers',
                    'properties': 'Größe 4',
                    'quantity': null,
                  },
                ]
              : [
                  {
                    'id': 'item-3',
                    'name': 'Windeln',
                    'brand': 'Pampers',
                    'properties': 'Größe 4',
                    'status': 'active',
                    'created_at': '2026-11-05T00:00:00Z',
                    'updated_at': '2026-11-05T00:00:00Z',
                  },
                ];
          return http.Response(
            jsonEncode(answer),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
            request: request,
          );
        }),
      ),
      'household',
    );

    await repo.send(
      const EditItem(
        'item-3',
        ItemChanges(name: 'Windeln Pampers Größe 4'),
        deviceParsed: true,
      ),
    );

    expect(calls['parse_item'], {
      'p_household': 'household',
      'p_text': 'Windeln Pampers Größe 4',
    });
    expect(calls['items'], {
      'name': 'Windeln',
      'brand': 'Pampers',
      'properties': 'Größe 4',
    });
  });
}
