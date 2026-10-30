import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' show ClientException;
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  group('the request', () {
    test('Apple sends the transaction JWS', () {
      expect(
        verifyBody(
          const StoreProof(
            store: AppStore.apple,
            data: 'eyJ.jws',
            productId: lifetimeProductId,
          ),
          PurchaseSource.purchase,
        ),
        {'store': 'apple', 'source': 'purchase', 'jws': 'eyJ.jws'},
      );
    });

    test('Google sends the product and the purchase token', () {
      expect(
        verifyBody(
          const StoreProof(
            store: AppStore.google,
            data: 'token',
            productId: lifetimeProductId,
          ),
          PurchaseSource.restore,
        ),
        {
          'store': 'google',
          'source': 'restore',
          'productId': 'com.hummlist.app.lifetime',
          'purchaseToken': 'token',
        },
      );
    });
  });

  group('the answer', () {
    for (final outcome in VerifyOutcome.values) {
      test('200 ${outcome.wire} is final', () {
        expect(
          verificationOf(200, {'status': outcome.wire, 'unlocked': true}),
          isA<Verified>().having((v) => v.outcome, 'outcome', outcome),
        );
      });
    }

    test('202 is pending', () {
      expect(
        verificationOf(202, {'status': 'pending', 'unlocked': false}),
        isA<VerificationPending>(),
      );
    });

    test('an unknown status is no final word', () {
      expect(
        verificationOf(200, {'status': 'maybe'}),
        isA<VerificationFailed>(),
      );
    });

    const refusals = <(int, Object?, String)>[
      (400, {'error': 'bad_request'}, 'bad_request'),
      (422, {'error': 'refused', 'reason': 'bad_signature'}, 'bad_signature'),
      (422, '', '422'),
    ];
    for (final (status, details, code) in refusals) {
      test('$status is refused for good ($code)', () {
        expect(
          verificationOfError(
            FunctionsHttpException(status: status, details: details),
          ),
          isA<VerificationRefused>().having((f) => f.code, 'code', code),
        );
      });
    }

    const errors = <(int, Object?, VerifyProblem, String)>[
      (401, {'error': 'invalid_token'}, VerifyProblem.session, 'invalid_token'),
      (403, {'error': 'no_household'}, VerifyProblem.session, 'no_household'),
      (
        429,
        {'error': 'rate_limited'},
        VerifyProblem.rateLimited,
        'rate_limited',
      ),
      (
        502,
        {'error': 'store_unavailable'},
        VerifyProblem.server,
        'store_unavailable',
      ),
      (
        503,
        {'error': 'not_configured'},
        VerifyProblem.server,
        'not_configured',
      ),
      (504, '', VerifyProblem.server, '504'),
    ];
    for (final (status, details, problem, code) in errors) {
      test('$status is $problem ($code)', () {
        expect(
          verificationOfError(
            FunctionsHttpException(status: status, details: details),
          ),
          isA<VerificationFailed>()
              .having((f) => f.problem, 'problem', problem)
              .having((f) => f.code, 'code', code),
        );
      });
    }

    test('no answer at all is offline', () {
      for (final error in [
        const FunctionsFetchException(details: 'socket'),
        ClientException('down'),
      ]) {
        expect(
          verificationOfError(error),
          isA<VerificationFailed>().having(
            (f) => f.problem,
            'problem',
            VerifyProblem.offline,
          ),
        );
      }
    });
  });
}
