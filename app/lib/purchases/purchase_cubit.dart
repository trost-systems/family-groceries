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

/// The server checks the store's proof.
final class const FlowVerifying() extends PurchaseFlow;

final class const FlowCanceled() extends PurchaseFlow;

/// The store or the server failed for now; a store transaction, if any,
/// stays unfinished and is verified again on [PurchaseCubit.retry] and at the
/// next start.
final class const FlowFailed(final FailureKind kind, final String code)
    extends PurchaseFlow;

/// The server refused the store's proof for good. The store transaction is
/// finished; only a restore the user asks for sends it again.
final class const FlowNotAccepted(final String code) extends PurchaseFlow;

/// The purchase is already unlocked for another household.
final class const FlowUsedElsewhere() extends PurchaseFlow;

/// The store took the purchase back (refund, revoke).
final class const FlowRefunded() extends PurchaseFlow;

/// A restore found no purchase.
final class const FlowNothingRestored() extends PurchaseFlow;

enum FailureKind() {
  /// The store refused or failed.
  store,

  /// The server could not be reached.
  offline,

  /// Too many verifications; later.
  rateLimited,

  /// The server failed, or did not accept the session.
  server,
}

@immutable
class const PurchaseState({
  /// Null while loading.
  final ProductLoad? product,
  final PurchaseFlow flow = const FlowIdle(),
}) {
  /// A purchase or restore is under way: Buy does nothing. Awaiting approval
  /// is not: iOS never reports a declined Ask to Buy, so Buy asks again.
  bool get busy => switch (flow) {
    FlowBuying() || FlowRestoring() || FlowVerifying() => true,
    _ => false,
  };

  /// A restore may start: also while a purchase awaits approval.
  bool get canRestore => switch (flow) {
    FlowBuying() || FlowRestoring() || FlowVerifying() => false,
    _ => true,
  };
}

/// How long a restore waits for the store's transactions after it returns
/// before it says there were none.
const restoreGrace = Duration(seconds: 2);

/// Hummlist Lifetime's purchase, app-wide from start: a transaction an
/// earlier session left unfinished arrives as soon as the store is heard.
///
/// A store transaction is finished only after the server's final word
/// ([Verified], or [VerificationRefused] for a proof it never accepts);
/// without one it stays unfinished and is verified again on [retry], when the
/// session gets a household, and at the next start.
class PurchaseCubit(
  final PurchaseRepository _store,
  final PurchaseApi _api,
  final Entitlements _entitlements,
  final SessionCubit _session,
) extends Cubit<PurchaseState> {
  this : super(const PurchaseState()) {
    _updates = _store.updates.listen(_onUpdate);
    _sessions = _session.stream.listen((_) => _onSession());
    unawaited(_loadProduct());
    _onSession();
  }

  late final StreamSubscription<StoreUpdate> _updates;
  late final StreamSubscription<Session> _sessions;

  /// Store transactions without the server's final word, by proof.
  final _unverified = <String, StorePurchased>{};

  /// The verification running now; one at a time.
  Future<void>? _verifying;
  var _recovered = false;
  Timer? _restoreGrace;

  /// From a restore the user asked for until its grace is over.
  var _restoreAsked = false;

  bool get _inHousehold => _session.state is InHousehold;

  void _onSession() {
    if (!_inHousehold) {
      return;
    }
    if (!_recovered) {
      _recovered = true;
      unawaited(_store.recoverUnfinished());
    }
    unawaited(_verifyAll());
  }

  Future<void> _loadProduct() async {
    final product = await _store.loadProduct();
    if (!isClosed) {
      emit(PurchaseState(product: product, flow: state.flow));
    }
  }

  /// Ignored while a purchase or restore is under way.
  Future<void> buy() async {
    if (state.busy) {
      return;
    }
    final load = state.product;
    if (load is! ProductLoaded) {
      return;
    }
    _emit(flow: const FlowBuying());
    try {
      await _store.buy(load.product);
    } on StoreError catch (e) {
      if (state.flow is FlowBuying) {
        _emit(flow: FlowFailed(FailureKind.store, e.code));
      }
    }
  }

  Future<void> restore() async {
    if (!state.canRestore) {
      return;
    }
    _emit(flow: const FlowRestoring());
    _restoreAsked = true;
    try {
      await _store.restore();
    } on StoreError catch (e) {
      _restoreAsked = false;
      if (state.flow is FlowRestoring) {
        _emit(flow: FlowFailed(FailureKind.store, e.code));
      }
      return;
    }
    // Restored transactions arrive on the update stream; without any the
    // flow is still restoring after the grace.
    _restoreGrace?.cancel();
    _restoreGrace = Timer(restoreGrace, () {
      _restoreAsked = false;
      if (state.flow is FlowRestoring) {
        _emit(flow: const FlowNothingRestored());
      }
    });
  }

  /// Loads the product again if it failed to load, and verifies what is
  /// still unverified.
  Future<void> retry() async {
    if (state.product case ProductNotFound() || StoreUnavailable()) {
      emit(PurchaseState(flow: state.flow));
      await _loadProduct();
    }
    if (state.flow is FlowFailed) {
      _emit(flow: const FlowIdle());
    }
    await _verifyAll();
  }

  void _onUpdate(StoreUpdate update) {
    switch (update) {
      case StorePending():
        _emit(flow: const FlowAwaitingApproval());
      case StoreCanceled():
        _emit(flow: const FlowCanceled());
      case StoreFailed(:final code):
        _emit(flow: FlowFailed(FailureKind.store, code));
      case StorePurchased(:final source, :final alreadyFinished):
        // A start-up recovery also finds purchases the store already
        // completed; only a restore the user asked for verifies those.
        if (source == PurchaseSource.purchase ||
            !alreadyFinished ||
            _restoreAsked) {
          _unverified[update.proof.data] = update;
          unawaited(_verifyAll());
        }
    }
  }

  /// Verifies every unverified transaction, one at a time; a second call
  /// while one runs waits for it and goes again.
  Future<void> _verifyAll() async {
    for (var running = _verifying; running != null; running = _verifying) {
      await running;
    }
    final run = _verifyEach();
    _verifying = run;
    try {
      await run;
    } finally {
      _verifying = null;
    }
  }

  Future<void> _verifyEach() async {
    for (final purchase in [..._unverified.values]) {
      if (isClosed || !_inHousehold) {
        return;
      }
      _emit(flow: const FlowVerifying());
      final answer = await _api.verify(purchase.proof, purchase.source);
      if (isClosed) {
        return;
      }
      switch (answer) {
        case Verified(:final outcome):
          await _finish(purchase);
          if (outcome == VerifyOutcome.granted ||
              outcome == VerifyOutcome.restored) {
            await _entitlements.refresh();
          }
          _emit(
            flow: switch (outcome) {
              VerifyOutcome.granted ||
              VerifyOutcome.restored => const FlowIdle(),
              VerifyOutcome.usedElsewhere => const FlowUsedElsewhere(),
              VerifyOutcome.revoked ||
              VerifyOutcome.refunded => const FlowRefunded(),
            },
          );
        case VerificationPending():
          _emit(flow: const FlowAwaitingApproval());
        case VerificationRefused(:final code):
          await _finish(purchase);
          _emit(flow: FlowNotAccepted(code));
        case VerificationFailed(:final problem, :final code):
          _emit(
            flow: FlowFailed(switch (problem) {
              VerifyProblem.offline => FailureKind.offline,
              VerifyProblem.rateLimited => FailureKind.rateLimited,
              VerifyProblem.session ||
              VerifyProblem.server => FailureKind.server,
            }, code),
          );
      }
    }
  }

  /// After the server's final word: never sent again in this session.
  Future<void> _finish(StorePurchased purchase) async {
    _unverified.remove(purchase.proof.data);
    try {
      await _store.finish(purchase);
    } on Object {
      // The server's answer stands; the store hands the unfinished
      // transaction over again at the next start, which verifies it again
      // and finishes it then.
    }
  }

  void _emit({required PurchaseFlow flow}) {
    if (!isClosed) {
      emit(PurchaseState(product: state.product, flow: flow));
    }
  }

  @override
  Future<void> close() async {
    _restoreGrace?.cancel();
    await _updates.cancel();
    await _sessions.cancel();
    await super.close();
  }
}
