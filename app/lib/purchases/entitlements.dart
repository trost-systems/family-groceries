import 'dart:async';

import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

/// Whether the household has Hummlist Lifetime: at least one row in
/// `entitlements`. Nothing is gated by it yet.
sealed class const EntitlementsState();

/// No household, or its rows could not be read yet (offline).
final class const EntitlementsUnknown() extends EntitlementsState;

final class const EntitlementsKnown({
  required final String householdId,
  required final bool unlocked,
}) extends EntitlementsState;

/// The household's `entitlements` rows. Only the server writes them.
abstract interface class EntitlementsSource() {
  Future<bool> unlocked(String householdId);

  /// Calls [onChange] when a row may have changed, also after every
  /// (re)connect; returns the cancel.
  Future<void> Function() watch(String householdId, void Function() onChange);
}

/// Follows the session's household, app-wide.
class Entitlements(
  final EntitlementsSource _source,
  final SessionCubit _session,
) extends Cubit<EntitlementsState> {
  this : super(const EntitlementsUnknown()) {
    _follow(_session.state);
    _sessions = _session.stream.listen(_follow);
  }

  late final StreamSubscription<Session> _sessions;
  String? _householdId;
  Future<void> Function()? _unwatch;

  bool get isUnlocked => switch (state) {
    EntitlementsKnown(:final unlocked) => unlocked,
    EntitlementsUnknown() => false,
  };

  void _follow(Session session) {
    final householdId = switch (session) {
      InHousehold(:final household) => household.id,
      _ => null,
    };
    if (householdId == _householdId) {
      return;
    }
    _householdId = householdId;
    unawaited(_unwatch?.call());
    _unwatch = null;
    emit(const EntitlementsUnknown());
    if (householdId != null) {
      _unwatch = _source.watch(householdId, () => unawaited(refresh()));
      unawaited(refresh());
    }
  }

  /// Reads the household's rows again; offline it keeps what it knew.
  Future<void> refresh() async {
    final householdId = _householdId;
    if (householdId == null) {
      return;
    }
    try {
      final unlocked = await _source.unlocked(householdId);
      if (!isClosed && householdId == _householdId) {
        emit(EntitlementsKnown(householdId: householdId, unlocked: unlocked));
      }
    } on Object {
      // The next (re)connect reads again.
    }
  }

  @override
  Future<void> close() async {
    await _sessions.cancel();
    await _unwatch?.call();
    await super.close();
  }
}

class const SupabaseEntitlementsSource(final SupabaseClient _client)
    implements EntitlementsSource {
  @override
  Future<bool> unlocked(String householdId) async {
    final rows = await _client.rest
        .from('entitlements')
        .select('purchase_id')
        .eq('household_id', householdId)
        .limit(1);
    return rows.isNotEmpty;
  }

  @override
  Future<void> Function() watch(String householdId, void Function() onChange) {
    final channel = _client.channel('entitlements:$householdId')
      ..onPostgresChanges(
        event: PostgresChangeEvent.insert,
        schema: 'public',
        table: 'entitlements',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'household_id',
          value: householdId,
        ),
        callback: (_) => onChange(),
      )
      // Delete events cannot be filtered; another household's costs a read.
      ..onPostgresChanges(
        event: PostgresChangeEvent.delete,
        schema: 'public',
        table: 'entitlements',
        callback: (_) => onChange(),
      )
      ..subscribe((status, _) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          onChange();
        }
      });
    return () async {
      await _client.removeChannel(channel);
    };
  }
}
