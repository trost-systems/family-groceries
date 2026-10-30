import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// An open invite of the user's household.
@immutable
class const Invite({
  required final String id,
  required final String code,
  required final DateTime expiresAt,
});

/// What a code leads to, before joining (`preview_invite`).
sealed class const InvitePreview();

/// An open invite of the household [name].
final class const InviteOpen(final String name) extends InvitePreview;

/// The user is in that household already: nothing to join.
final class const InviteMember(final String name) extends InvitePreview;

/// Why a household or invite call failed, as the screens tell the user.
enum HouseholdProblem() {
  /// Made up, expired, revoked or used: one answer for all.
  invalidInvite,

  /// 10 failed codes in the last hour.
  tooManyAttempts,

  /// No answer from the server.
  offline,

  /// Create found the user in a household already (a double tap, a retry).
  alreadyInHousehold,

  /// Anything else the server refused.
  other,
}

/// A household or invite call that failed; never carries the code.
final class const HouseholdError(final HouseholdProblem problem)
    implements Exception {
  /// The server's status or Postgres message, e.g. `invalid_invite`.
  factory fromStatus(String status) => HouseholdError(switch (status) {
    'invalid_invite' => HouseholdProblem.invalidInvite,
    'too_many_attempts' => HouseholdProblem.tooManyAttempts,
    'already_in_household' => HouseholdProblem.alreadyInHousehold,
    _ => HouseholdProblem.other,
  });

  @override
  String toString() => 'HouseholdError(${problem.name})';
}

/// How long a household call may take before it counts as offline.
const householdTimeout = Duration(seconds: 15);

/// Runs a household RPC: a Postgres error becomes its [HouseholdError], no
/// answer (a timeout, a failed fetch on the web, a socket error) is
/// [HouseholdProblem.offline].
Future<T> householdCall<T>(Future<T> Function() call) async {
  try {
    return await call().timeout(householdTimeout);
  } on PostgrestException catch (e) {
    throw HouseholdError.fromStatus(e.message);
  } on HouseholdError {
    rethrow;
  } on Object {
    throw const HouseholdError(HouseholdProblem.offline);
  }
}

/// Invites of the user's household: make one, list the open ones, revoke
/// one, and look at a code before joining.
abstract interface class InviteRepository() {
  Future<Invite> create(String householdId);

  /// Open invites (not used, revoked or expired), newest first.
  Future<List<Invite>> open(String householdId);

  Future<void> revoke(String inviteId);

  Future<InvitePreview> preview(String code);

  /// How many members [householdId] has, for the switch warning.
  Future<int> memberCount(String householdId);
}

class SupabaseInviteRepository(final SupabaseClient _client)
    implements InviteRepository {
  @override
  Future<Invite> create(String householdId) => householdCall(() async {
    final row = await _client.rpc<Map<String, dynamic>>(
      'create_invite',
      params: {'p_household': householdId},
    );
    return _invite(row);
  });

  @override
  Future<List<Invite>> open(String householdId) => householdCall(() async {
    final rows = await _client.rest
        .from('invites')
        .select('id, code, expires_at')
        .eq('household_id', householdId)
        .isFilter('used_at', null)
        .isFilter('revoked_at', null)
        .gt('expires_at', DateTime.now().toUtc().toIso8601String())
        .order('created_at', ascending: false);
    return [for (final row in rows) _invite(row)];
  });

  @override
  Future<void> revoke(String inviteId) => householdCall(
    () => _client.rpc<void>('revoke_invite', params: {'p_invite': inviteId}),
  );

  @override
  Future<InvitePreview> preview(String code) => householdCall(() async {
    final result = await _client.rpc<Map<String, dynamic>>(
      'preview_invite',
      params: {'p_code': code},
    );
    return switch (result) {
      {'status': 'ok', 'name': final String name} => InviteOpen(name),
      {'status': 'member', 'name': final String name} => InviteMember(name),
      {'status': final String status} => throw HouseholdError.fromStatus(
        status,
      ),
      _ => throw const HouseholdError(HouseholdProblem.other),
    };
  });

  @override
  Future<int> memberCount(String householdId) => householdCall(() async {
    final rows = await _client.rest
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId);
    return rows.length;
  });

  static Invite _invite(Map<String, dynamic> row) => Invite(
    id: row['id']! as String,
    code: row['code']! as String,
    expiresAt: DateTime.parse(row['expires_at']! as String),
  );
}
