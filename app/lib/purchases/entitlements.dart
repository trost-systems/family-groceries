import 'dart:async';

import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

/// What a household can have unlocked (`entitlements.kind`). Lifetime now;
/// a later subscription adds its own kind, which never unlocks Lifetime's
/// features (docs/PURCHASES.md, "A second entitlement").
enum Entitlement(final String wire) {
  lifetime('lifetime');

  /// Null for a kind this build does not know.
  static Entitlement? parse(Object? wire) =>
      values.where((v) => v.wire == wire).firstOrNull;
}

/// What the household has unlocked: its rows in `entitlements`. Nothing is
/// gated by it yet.
sealed class const EntitlementsState();

/// No household, or its rows could not be read yet (loading, offline).
final class const EntitlementsUnknown() extends EntitlementsState;

final class const EntitlementsKnown({
  required final String householdId,
  required final HouseholdUnlocks unlocks,
}) extends EntitlementsState;

/// A household's unlocks, as its rows say.
@immutable
class const HouseholdUnlocks({
  final Set<Entitlement> kinds = const {},

  /// One of them is a tester's grant (job 43): the household's events are
  /// internal.
  final bool tester = false,

  /// How many store purchases unlock Lifetime; two or more and the household
  /// paid twice, which only Apple or Google can refund.
  final int lifetimePurchases = 0,
});

/// The household's `entitlements` rows. Only the server writes them.
abstract interface class EntitlementsSource() {
  Future<HouseholdUnlocks> unlocks(String householdId);

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

  /// The household has [entitlement]; false while unknown.
  bool has(Entitlement entitlement) => switch (state) {
    EntitlementsKnown(:final unlocks) => unlocks.kinds.contains(entitlement),
    EntitlementsUnknown() => false,
  };

  /// The household bought Lifetime more than once; false while unknown.
  bool get boughtLifetimeTwice => switch (state) {
    EntitlementsKnown(:final unlocks) => unlocks.lifetimePurchases >= 2,
    EntitlementsUnknown() => false,
  };

  /// Whether to offer [entitlement] for sale: only when the household is
  /// known not to have it. While unknown (loading, offline) the answer is
  /// no, so no member of an unlocked household pays twice. Every paywall
  /// entry point asks this, never [has].
  bool canOffer(Entitlement entitlement) => switch (state) {
    EntitlementsKnown(:final unlocks) => !unlocks.kinds.contains(entitlement),
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
      final unlocks = await _source.unlocks(householdId);
      if (!isClosed && householdId == _householdId) {
        emit(EntitlementsKnown(householdId: householdId, unlocks: unlocks));
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

/// The rows' kinds this build knows, whether one is a tester's, and how many
/// are Lifetime purchases.
HouseholdUnlocks unlocksOf(List<Map<String, dynamic>> rows) => HouseholdUnlocks(
  kinds: {for (final row in rows) ?Entitlement.parse(row['kind'])},
  tester: rows.any((row) => row['source'] == 'tester'),
  lifetimePurchases: rows
      .where(
        (row) =>
            row['source'] == 'purchase' &&
            Entitlement.parse(row['kind']) == Entitlement.lifetime,
      )
      .length,
);

class const SupabaseEntitlementsSource(final SupabaseClient _client)
    implements EntitlementsSource {
  @override
  Future<HouseholdUnlocks> unlocks(String householdId) async {
    final rows = await _client.rest
        .from('entitlements')
        .select('kind, source')
        .eq('household_id', householdId);
    return unlocksOf(rows);
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
