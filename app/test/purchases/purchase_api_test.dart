import 'dart:convert';

import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' show ClientException, Request, Response;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const household = '3f2a6c1e-0b7d-4c5e-9a8f-1d2e3c4b5a69';

void main() {
  group('the claim', () {
    Future<(ClaimResult, List<Request>)> send(
      StoreTransactionRef transaction, {
      Response? answer,
    }) async {
      final sent = <Request>[];
      final client = SupabaseClient(
        'http://localhost:54321',
        'sb_publishable_test',
        httpClient: MockClient((request) async {
          sent.add(request);
          return answer ??
              Response(
                jsonEncode({'status': 'recorded'}),
                200,
                headers: {'content-type': 'application/json'},
              );
        }),
      );
      addTearDown(client.dispose);
      return (
        await SupabaseClaimApi(client).claim(household, transaction),
        sent,
      );
    }

    test("runs in the project's region, Frankfurt (H-54)", () async {
      final (answer, sent) = await send(
        const StoreTransactionRef(AppStore.apple, '2000000123'),
      );
      expect(
        answer,
        isA<Claimed>().having((c) => c.status, 'status', ClaimStatus.recorded),
      );
      final request = sent.single;
      expect(request.url.path, '/functions/v1/purchases/claim');
      expect(
        request.url.queryParameters['forceFunctionRegion'],
        'eu-central-1',
      );
      expect(request.headers['x-region'], 'eu-central-1');
    });

    test('sends the household bought for, the store and the transaction id, '
        'nothing else', () async {
      final (_, sent) = await send(
        const StoreTransactionRef(AppStore.google, 'GPA.3312-5'),
      );
      expect(jsonDecode(sent.single.body), {
        'householdId': household,
        'store': 'google',
        'transactionId': 'GPA.3312-5',
      });
    });

    test('a 429 is rate limited', () async {
      final (answer, _) = await send(
        const StoreTransactionRef(AppStore.apple, '1'),
        answer: Response(
          jsonEncode({'error': 'rate_limited'}),
          429,
          headers: {'content-type': 'application/json'},
        ),
      );
      expect(
        answer,
        isA<ClaimFailed>()
            .having((f) => f.problem, 'problem', ClaimProblem.rateLimited)
            .having((f) => f.code, 'code', 'rate_limited'),
      );
    });
  });

  group('the answer', () {
    for (final status in ClaimStatus.values) {
      test('200 ${status.wire}', () {
        expect(
          claimOf({'status': status.wire}),
          isA<Claimed>().having((c) => c.status, 'status', status),
        );
      });
    }

    test('an unknown status is no answer', () {
      expect(
        claimOf({'status': 'maybe'}),
        isA<ClaimFailed>().having(
          (f) => f.problem,
          'problem',
          ClaimProblem.server,
        ),
      );
    });

    const errors = <(int, Object?, ClaimProblem, String)>[
      (400, {'error': 'bad_request'}, ClaimProblem.refused, 'bad_request'),
      (401, {'error': 'invalid_token'}, ClaimProblem.refused, 'invalid_token'),
      (403, {'error': 'not_a_member'}, ClaimProblem.refused, 'not_a_member'),
      (
        429,
        {'error': 'rate_limited'},
        ClaimProblem.rateLimited,
        'rate_limited',
      ),
      (500, {'error': 'internal'}, ClaimProblem.server, 'internal'),
      (504, '', ClaimProblem.server, '504'),
    ];
    for (final (status, details, problem, code) in errors) {
      test('$status is $problem ($code)', () {
        expect(
          claimOfError(
            FunctionsHttpException(status: status, details: details),
          ),
          isA<ClaimFailed>()
              .having((f) => f.problem, 'problem', problem)
              .having((f) => f.code, 'code', code),
        );
      });
    }

    test('only a refusal is not worth another try', () {
      expect(
        [
          for (final p in ClaimProblem.values)
            if (!p.transient) p,
        ],
        [ClaimProblem.refused],
      );
    });

    test('no answer at all is offline', () {
      for (final error in [
        const FunctionsFetchException(details: 'socket'),
        ClientException('down'),
      ]) {
        expect(
          claimOfError(error),
          isA<ClaimFailed>().having(
            (f) => f.problem,
            'problem',
            ClaimProblem.offline,
          ),
        );
      }
    });
  });
}
