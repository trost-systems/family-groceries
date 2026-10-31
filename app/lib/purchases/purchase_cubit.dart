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
  /// Null until loaded for the household, which happens only on the
  /// Lifetime page of a household known to lack Lifetime.
  final ProductLoad? product,
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
/// while the Lifetime page is open ([pageOpened]) in a household the server
/// confirmed has no Lifetime ([Entitlements.canOffer]): no other member and
/// no unlocked household ever reaches RevenueCat (Legal Review K.9.9). The
/// unlock it shows comes only from Supabase ([Entitlements]).
class PurchaseCubit(
  final PurchaseRepository _store,
  final ClaimApi _claims,
  final Entitlements _entitlements,
  final SessionCubit _session,
) extends Cubit<PurchaseState> {
  this : super(PurchaseState(product: _store.withoutStore)) {
    _household = _householdOf(_session.state);
    _sessions = _session.stream.listen(_onSession);
    _unlocks = _entitlements.stream.listen((_) => _onEntitlements());
  }

  late final StreamSubscription<Session> _sessions;
  late final StreamSubscription<EntitlementsState> _unlocks;
  String? _household;
  var _pages = 0;

  /// The household the product was asked for.
  String? _loadedFor;
  Timer? _unlockTimeout;

  static String? _householdOf(Session session) => switch (session) {
    InHousehold(:final household) => household.id,
    _ => null,
  };

  bool get _offer => _entitlements.canOffer(Entitlement.lifetime);

  /// The Lifetime page is shown; [pageClosed] when it goes.
  void pageOpened() {
    _pages++;
    _ask();
  }

  void pageClosed() => _pages--;

  /// Loads the product for the session's household once the page is open
  /// and Lifetime may be offered there.
  void _ask() {
    final household = _household;
    if (isClosed ||
        _pages <= 0 ||
        _store.withoutStore != null ||
        household == null ||
        !_offer ||
        _loadedFor == household) {
      return;
    }
    _loadedFor = household;
    _emitProduct(null);
    unawaited(_load(household));
  }

  Future<void> _load(String household) async {
    final load = await _store.loadProduct(household);
    if (!isClosed && _loadedFor == household) {
      _emitProduct(load);
    }
  }

  void _onSession(Session session) {
    final household = _householdOf(session);
    if (household == _household) {
      return;
    }
    _household = household;
    _loadedFor = null;
    _unlockTimeout?.cancel();
    emit(PurchaseState(product: _store.withoutStore));
    _ask();
  }

  void _onEntitlements() {
    if ((state.flow is FlowUnlocking || state.flow is FlowUnlockDelayed) &&
        _entitlements.has(Entitlement.lifetime)) {
      _unlockTimeout?.cancel();
      _emit(flow: const FlowIdle());
    }
    _ask();
  }

  /// Only for the household the product was loaded for, and only while
  /// Lifetime may be offered there.
  Future<void> buy() async {
    final household = _household;
    final load = state.product;
    if (state.busy ||
        !_offer ||
        load is! ProductLoaded ||
        load.householdId != household) {
      return;
    }
    _emit(flow: const FlowBuying());
    final outcome = await _store.buy(load.householdId, load.product);
    if (isClosed) {
      return;
    }
    switch (outcome) {
      case Bought(:final transaction):
        _unlocking();
        if (transaction != null) {
          unawaited(_claim(transaction));
        }
      case Canceled():
        _emit(flow: const FlowCanceled());
      case Pending():
        _emit(flow: const FlowAwaitingApproval());
      case StoreProblem():
        _failed(outcome);
    }
  }

  Future<void> restore() async {
    final household = _household;
    if (state.busy || !_offer || household == null) {
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

  /// Records this member as the buyer (H-55), once, trying again while there
  /// is no answer. Without a claim the unlock still comes; only the buyer
  /// stays unknown.
  Future<void> _claim(StoreTransactionRef transaction) async {
    for (var attempt = 0; ; attempt++) {
      final result = await _claims.claim(transaction);
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

  /// Loads the product again if it failed to load; clears a failure.
  void retry() {
    if (state.product case ProductNotFound() || StoreUnavailable()) {
      _loadedFor = null;
      _ask();
    }
    if (state.flow is FlowFailed) {
      _emit(flow: const FlowIdle());
    }
  }

  void _emit({required PurchaseFlow flow}) {
    if (!isClosed) {
      emit(PurchaseState(product: state.product, flow: flow));
    }
  }

  void _emitProduct(ProductLoad? product) {
    if (!isClosed) {
      emit(PurchaseState(product: product, flow: state.flow));
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
