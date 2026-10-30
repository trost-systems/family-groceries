import 'dart:async';

import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:http/http.dart' show ClientException;
import 'package:supabase_flutter/supabase_flutter.dart';

/// The server's final word on a store transaction: finish it.
enum VerifyOutcome(final String wire) {
  granted('granted'),
  restored('restored'),
  usedElsewhere('used_elsewhere'),
  revoked('revoked'),
  refunded('refunded');

  static VerifyOutcome? parse(Object? wire) =>
      values.where((v) => v.wire == wire).firstOrNull;
}

/// Why a verification gave no final word. The transaction stays unfinished
/// and is verified again.
enum VerifyProblem() {
  /// No answer: offline, a timeout.
  offline,

  /// 429: too many verifications.
  rateLimited,

  /// 400, 422: the server refused the proof.
  refused,

  /// 401, 403: the session or household the server saw.
  session,

  /// 5xx (store unavailable, not configured) or an answer it can't read.
  server,
}

/// What the purchases function answered.
sealed class const Verification();

final class const Verified(final VerifyOutcome outcome) extends Verification;

/// A Play payment not completed yet (202).
final class const VerificationPending() extends Verification;

final class const VerificationFailed(
  final VerifyProblem problem,

  /// The function's `error` (or `reason`) or the HTTP status.
  final String code,
) extends Verification;

/// The purchases function (`POST /purchases/verify`).
abstract interface class PurchaseApi() {
  Future<Verification> verify(StoreProof proof, PurchaseSource source);
}

class const SupabasePurchaseApi(final SupabaseClient _client)
    implements PurchaseApi {
  @override
  Future<Verification> verify(StoreProof proof, PurchaseSource source) async {
    try {
      final response = await _client.functions.invoke(
        'purchases/verify',
        body: verifyBody(proof, source),
      );
      return verificationOf(response.status, response.data);
    } on Object catch (e) {
      return verificationOfError(e);
    }
  }
}

Map<String, String> verifyBody(StoreProof proof, PurchaseSource source) => {
  'store': proof.store.wire,
  'source': source.wire,
  ...switch (proof.store) {
    AppStore.apple => {'jws': proof.data},
    AppStore.google => {
      'productId': proof.productId,
      'purchaseToken': proof.data,
    },
  },
};

/// A 2xx answer.
Verification verificationOf(int status, Object? data) => switch ((
  status,
  data,
)) {
  (202, _) => const VerificationPending(),
  (200, {'status': final Object? wire}) => switch (VerifyOutcome.parse(wire)) {
    final outcome? => Verified(outcome),
    null => VerificationFailed(VerifyProblem.server, '$wire'),
  },
  _ => VerificationFailed(VerifyProblem.server, '$status'),
};

/// What the Supabase client threw.
Verification verificationOfError(Object error) => switch (error) {
  // Thrown when the request never got an answer.
  FunctionsFetchException() || ClientException() || TimeoutException() =>
    const VerificationFailed(VerifyProblem.offline, 'offline'),
  FunctionException(:final status, :final details) => VerificationFailed(
    switch (status) {
      429 => VerifyProblem.rateLimited,
      400 || 422 => VerifyProblem.refused,
      401 || 403 => VerifyProblem.session,
      _ => VerifyProblem.server,
    },
    switch (details) {
      {'error': 'refused', 'reason': final String reason} => reason,
      {'error': final String code} => code,
      _ => '$status',
    },
  ),
  _ => VerificationFailed(VerifyProblem.server, '${error.runtimeType}'),
};
