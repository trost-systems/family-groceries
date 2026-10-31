import 'dart:async';

import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_bloc/flutter_bloc.dart';

/// Where a purchase or restore stands.
sealed class const PurchaseFlow();

final class const FlowIdle() extends PurchaseFlow;

/// The store's sheet is open.
final class const FlowBuying() extends PurchaseFlow;

/// The store is looking for earlier purchases.
final class const FlowRestoring() extends PurchaseFlow;

/// Ask to Buy or a Play payment that completes later.
final class const FlowAwaitingApproval() extends PurchaseFlow;

/// Bought or restored: waiting for the unlock from Supabase, which arrives
/// once RevenueCat's webhook has recorded it.
final class const FlowUnlocking() extends PurchaseFlow;

/// The unlock takes longer than [unlockWait] (RevenueCat's webhook is late
/// or retrying). Buy stays off for this visit: the purchase is done and
/// another one would be paid twice.
final class const FlowUnlockDelayed() extends PurchaseFlow;

final class const FlowCanceled() extends PurchaseFlow;

/// The store has no Hummlist Lifetime yet.
final class const FlowNotAvailable() extends PurchaseFlow;

final class const FlowFailed(final FailureKind kind, final String code)
    extends PurchaseFlow;

/// The store purchase belongs to another household, for good (H-56).
final class const FlowUsedElsewhere() extends PurchaseFlow;

/// A restore found no purchase.
final class const FlowNothingRestored() extends PurchaseFlow;

enum FailureKind() {
  /// The store or RevenueCat refused or failed.
  store,

  /// The store or RevenueCat could not be reached.
  offline,
}

@immutable
class const PurchaseState({
  /// Why this build sells nothing; null where Buy and Restore ask a store.
  final NoSale? noSale,
  final PurchaseFlow flow = const FlowIdle(),
}) {
  /// A purchase or restore is under way: Buy does nothing. Awaiting approval
  /// is not: iOS never reports a declined Ask to Buy, so Buy asks again.
  bool get busy => switch (flow) {
    FlowBuying() ||
    FlowRestoring() ||
    FlowUnlocking() ||
    FlowUnlockDelayed() => true,
    _ => false,
  };
}

/// How long "unlocking" waits for Supabase's unlock after a purchase.
const unlockWait = Duration(seconds: 60);

/// The claim's waits between tries when it got no answer.
const claimBackoff = [
  Duration(seconds: 2),
  Duration(seconds: 5),
  Duration(seconds: 15),
];

/// Hummlist Lifetime's purchase and restore. It talks to the store only
/// when the user taps Buy or Restore ([buy], [restore]) in a household the
/// server confirmed has no Lifetime ([Entitlements.canOffer]): building it,
/// app start and opening the Lifetime page reach no store and not RevenueCat
/// (Legal Review H-67, K.9.9). The unlock it shows comes only from Supabase
/// ([Entitlements]).
class PurchaseCubit(
  final PurchaseRepository _store,
  final ClaimApi _claims,
  final Entitlements _entitlements,
  final SessionCubit _session,
) extends Cubit<PurchaseState> {
  this : super(PurchaseState(noSale: _store.withoutStore)) {
    _household = _householdOf(_session.state);
    _sessions = _session.stream.listen(_onSession);
    _unlocks = _entitlements.stream.listen((_) => _onEntitlements());
  }

  late final StreamSubscription<Session> _sessions;
  late final StreamSubscription<EntitlementsState> _unlocks;
  String? _household;
  Timer? _unlockTimeout;

  static String? _householdOf(Session session) => switch (session) {
    InHousehold(:final household) => household.id,
    _ => null,
  };

  bool get _offer => _entitlements.canOffer(Entitlement.lifetime);

  void _onSession(Session session) {
    final household = _householdOf(session);
    if (household == _household) {
      return;
    }
    _household = household;
    _unlockTimeout?.cancel();
    emit(PurchaseState(noSale: _store.withoutStore));
  }

  void _onEntitlements() {
    if ((state.flow is FlowUnlocking || state.flow is FlowUnlockDelayed) &&
        _entitlements.has(Entitlement.lifetime)) {
      _unlockTimeout?.cancel();
      _emit(flow: const FlowIdle());
    }
  }

  /// Buy, for the session's household at the time of the tap, and only
  /// while Lifetime may be offered there. The store's sheet shows the price.
  Future<void> buy() async {
    final household = _household;
    if (state.busy || state.noSale != null || !_offer || household == null) {
      return;
    }
    _emit(flow: const FlowBuying());
    final outcome = await _store.buy(household);
    if (isClosed) {
      return;
    }
    switch (outcome) {
      case Bought(:final transaction):
        _unlocking();
        if (transaction != null) {
          unawaited(_claim(household, transaction));
        }
      case Canceled():
        _emit(flow: const FlowCanceled());
      case Pending():
        _emit(flow: const FlowAwaitingApproval());
      case ProductMissing():
        _emit(flow: const FlowNotAvailable());
      case StoreProblem():
        _failed(outcome);
    }
  }

  Future<void> restore() async {
    final household = _household;
    if (state.busy || state.noSale != null || !_offer || household == null) {
      return;
    }
    _emit(flow: const FlowRestoring());
    final outcome = await _store.restore(household);
    if (isClosed) {
      return;
    }
    switch (outcome) {
      case Restored():
        _unlocking();
      case NothingToRestore():
        _emit(flow: const FlowNothingRestored());
      case StoreProblem():
        _failed(outcome);
    }
  }

  void _failed(StoreProblem problem) => _emit(
    flow: switch (problem) {
      BelongsElsewhere() => const FlowUsedElsewhere(),
      StoreFailed(:final code) => FlowFailed(FailureKind.store, code),
      StoreOffline() => const FlowFailed(FailureKind.offline, 'offline'),
    },
  );

  void _unlocking() {
    if (_entitlements.has(Entitlement.lifetime)) {
      _emit(flow: const FlowIdle());
      return;
    }
    _emit(flow: const FlowUnlocking());
    _unlockTimeout?.cancel();
    _unlockTimeout = Timer(unlockWait, () {
      if (state.flow is FlowUnlocking) {
        _emit(flow: const FlowUnlockDelayed());
      }
    });
  }

  /// Records this member as the buyer (H-55) of [transaction], bought for
  /// [household], once, trying again while there is no answer. Without a
  /// claim the unlock still comes; only the buyer stays unknown.
  Future<void> _claim(String household, StoreTransactionRef transaction) async {
    for (var attempt = 0; ; attempt++) {
      final result = await _claims.claim(household, transaction);
      if (isClosed) {
        return;
      }
      switch (result) {
        case Claimed(status: ClaimStatus.elsewhere):
          if (state.flow is FlowUnlocking || state.flow is FlowUnlockDelayed) {
            _unlockTimeout?.cancel();
            _emit(flow: const FlowUsedElsewhere());
          }
          return;
        case Claimed():
          return;
        case ClaimFailed(:final problem):
          if (!problem.transient || attempt >= claimBackoff.length) {
            return;
          }
          await Future<void>.delayed(claimBackoff[attempt]);
      }
    }
  }

  void _emit({required PurchaseFlow flow}) {
    if (!isClosed) {
      emit(PurchaseState(noSale: state.noSale, flow: flow));
    }
  }

  @override
  Future<void> close() async {
    _unlockTimeout?.cancel();
    await _sessions.cancel();
    await _unlocks.cancel();
    await super.close();
  }
}
