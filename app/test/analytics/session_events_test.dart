import 'dart:convert';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import '../session/fake_auth.dart';
import 'fakes.dart';

const _home = '0b6f7a52-6c1e-4f4e-9d55-3f1f0c2a9e01';
const _other = '7d0c1c55-1111-4a2b-8c3d-2e9f6a1b0c02';

/// A database whose `household_members` row is [household] and whose
/// household RPCs answer with [joins] (the household joined).
class _Db(final FakeAuth fakeAuth) extends Fake implements SupabaseClient {
  String? household;
  String joins = _other;

  /// Reads fail: the reload after an RPC.
  var failReads = false;
  final calls = <String>[];

  late final _rest = PostgrestClient(
    'http://db.invalid/rest/v1',
    httpClient: MockClient((request) async {
      calls.add(request.url.path);
      if (request.url.path.endsWith('join_household') && joins == 'invalid') {
        return http.Response(
          jsonEncode({'message': 'invalid_invite', 'code': 'P0001'}),
          400,
          headers: {'content-type': 'application/json'},
          request: request,
        );
      }
      if (failReads && request.method == 'GET') {
        return http.Response(
          jsonEncode({'message': 'timeout'}),
          503,
          headers: {'content-type': 'application/json'},
          request: request,
        );
      }
      final body = switch (request.url.path) {
        '/rest/v1/rpc/join_household' => (household = joins),
        '/rest/v1/rpc/create_household' => {
          'id': household = _home,
          'name': 'Zuhause',
        },
        _ =>
          household == null
              ? null
              : {
                  'households': {'id': household, 'name': 'Zuhause'},
                },
      };
      return http.Response(
        jsonEncode(body),
        200,
        headers: {'content-type': 'application/json'},
        request: request,
      );
    }),
  );

  @override
  GoTrueClient get auth => fakeAuth;

  @override
  PostgrestClient get rest => _rest;

  @override
  PostgrestFilterBuilder<T> rpc<T>(
    String fn, {
    Map<String, dynamic>? params,
    Object? get,
  }) => _rest.rpc<T>(fn, params: params);
}

void main() {
  late FakeAuth auth;
  late _Db db;
  late RecordingSink sink;
  late Analytics analytics;
  late SessionCubit cubit;

  setUp(() async {
    auth = FakeAuth()
      ..user = const User(
        id: 'peter',
        appMetadata: {},
        userMetadata: {},
        aud: 'authenticated',
        createdAt: '2026-10-22T12:00:00Z',
        email: 'kunde@gmail.com',
      );
    db = _Db(auth);
    sink = RecordingSink();
    analytics = await loadedAnalytics(sink, MemoryAnalyticsStore());
    cubit = SessionCubit(db, MemorySessionCache(), analytics: analytics);
    await cubit.refresh();
    await analytics.decide(granted: true);
  });

  tearDown(() async {
    await cubit.close();
    await analytics.close();
    await auth.close();
  });

  Future<List<Map<String, Object?>>> sent() async {
    await analytics.flush();
    return [
      for (final e in sink.events)
        if (e['event'] != 'first_open') e,
    ];
  }

  Map<String, Object?> props(Map<String, Object?> e) =>
      e['properties']! as Map<String, Object?>;

  test('first_open before a household has no household_id', () async {
    await analytics.flush();
    expect(sink.names, ['first_open']);
    expect(props(sink.events.single)['household_id'], isNull);
  });

  test('creating a household sends household_created with its id', () async {
    await cubit.createHousehold('Zuhause');
    final events = await sent();
    expect(events.map((e) => e['event']), ['household_created']);
    expect(props(events.single)['household_id'], _home);
  });

  test('a join by link sends invite_accepted, method link', () async {
    await cubit.join('ABCD2345', method: JoinMethod.link);
    final events = await sent();
    expect(events.map((e) => e['event']), ['invite_accepted']);
    expect(props(events.single)['method'], 'link');
    expect(props(events.single)['household_id'], _other);
    expect(jsonEncode(events), isNot(contains('ABCD2345')));
  });

  test('a typed code is method code', () async {
    await cubit.join('ABCD2345');
    expect(props((await sent()).single)['method'], 'code');
  });

  test('switching households by invite is a join too', () async {
    await cubit.createHousehold('Zuhause');
    await cubit.join('ABCD2345', method: JoinMethod.link);
    expect((await sent()).map((e) => e['event']), [
      'household_created',
      'invite_accepted',
    ]);
  });

  test('joining the household one is in already sends nothing', () async {
    await cubit.createHousehold('Zuhause');
    db.joins = _home;
    await cubit.join('ABCD2345', method: JoinMethod.link);
    expect((await sent()).map((e) => e['event']), ['household_created']);
  });

  test('a refused invite sends nothing', () async {
    db.joins = 'invalid';
    await expectLater(cubit.join('XXXX'), throwsA(isA<HouseholdError>()));
    expect(await sent(), isEmpty);
  });

  test('signing out sends what waits first, then nothing', () async {
    await cubit.createHousehold('Zuhause');
    await cubit.signOut();
    await pumpEventQueue();
    analytics.track('store_reordered');
    expect((await sent()).map((e) => e['event']), ['household_created']);
  });

  test('a household created whose reload fails still counts, in it', () async {
    db.failReads = true;
    await expectLater(cubit.createHousehold('Zuhause'), throwsA(anything));
    final events = await sent();
    expect(events.map((e) => e['event']), ['household_created']);
    expect(props(events.single)['household_id'], _home);
  });
}
