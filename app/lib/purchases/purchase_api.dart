import 'dart:async';

import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:http/http.dart' show ClientException;
import 'package:supabase_flutter/supabase_flutter.dart';

/// What the server did with a claim (`purchase_claim`).
enum ClaimStatus(final String wire) {
  /// This member is recorded as the buyer.
  recorded('recorded'),

  /// Another member claimed it first.
  taken('taken'),

  /// The store transaction belongs to another household.
  elsewhere('elsewhere'),

  /// Recorded; RevenueCat's webhook has not arrived yet.
  waiting('waiting');

  static ClaimStatus? parse(Object? wire) =>
      values.where((v) => v.wire == wire).firstOrNull;
}

/// Why a claim got no answer.
enum ClaimProblem() {
  /// No answer: offline, a timeout. Worth another try.
  offline,

  /// 429. Worth another try, later.
  rateLimited,

  /// 5xx or an answer it can't read. Worth another try.
  server,

  /// 400, 401, 403: the same request fails again.
  refused;

  bool get transient => this != refused;
}

sealed class const ClaimResult();

final class const Claimed(final ClaimStatus status) extends ClaimResult;

final class const ClaimFailed(
  final ClaimProblem problem,

  /// The function's `error` or the HTTP status.
  final String code,
) extends ClaimResult;

/// Where the purchases function runs: the project's region (Frankfurt),
/// next to its database, not the edge region nearest the phone (Legal
/// Review H-54, docs/PURCHASES.md).
const purchasesRegion = 'eu-central-1';

/// The purchases function's claim (`POST /purchases/claim`): records the
/// signed-in member as the buyer of a store transaction of their household
/// (H-55). The unlock does not wait for it; RevenueCat's webhook grants.
abstract interface class ClaimApi() {
  Future<ClaimResult> claim(StoreTransactionRef transaction);
}

class const SupabaseClaimApi(final SupabaseClient _client) implements ClaimApi {
  @override
  Future<ClaimResult> claim(StoreTransactionRef transaction) async {
    try {
      final response = await _client.functions.invoke(
        'purchases/claim',
        body: claimBody(transaction),
        region: purchasesRegion,
      );
      return claimOf(response.data);
    } on Object catch (e) {
      return claimOfError(e);
    }
  }
}

Map<String, String> claimBody(StoreTransactionRef transaction) => {
  'store': transaction.store.wire,
  'transactionId': transaction.id,
};

/// A 2xx answer.
ClaimResult claimOf(Object? data) => switch (data) {
  {'status': final Object? wire} => switch (ClaimStatus.parse(wire)) {
    final status? => Claimed(status),
    null => ClaimFailed(ClaimProblem.server, '$wire'),
  },
  _ => const ClaimFailed(ClaimProblem.server, 'unreadable'),
};

/// What the Supabase client threw.
ClaimResult claimOfError(Object error) => switch (error) {
  // Thrown when the request never got an answer.
  FunctionsFetchException() ||
  ClientException() ||
  TimeoutException() => const ClaimFailed(ClaimProblem.offline, 'offline'),
  FunctionException(:final status, :final details) => ClaimFailed(
    switch (status) {
      429 => ClaimProblem.rateLimited,
      400 || 401 || 403 => ClaimProblem.refused,
      _ => ClaimProblem.server,
    },
    switch (details) {
      {'error': final String code} => code,
      _ => '$status',
    },
  ),
  _ => ClaimFailed(ClaimProblem.server, '${error.runtimeType}'),
};
