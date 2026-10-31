import 'dart:async';

import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';

const lifetime = Product(id: lifetimeProductId, price: '9,99 €');

/// A store that answers what the test set, or holds a purchase in [held]
/// while [hold] is set. [product] null: loaded for the household asked.
class FakePurchaseRepository({
  @override final ProductLoad? withoutStore,
  var ProductLoad? product,
  var BuyOutcome bought = const Bought(
    StoreTransactionRef(AppStore.apple, 'tx-1'),
  ),
  var RestoreOutcome restored = const NothingToRestore(),
}) implements PurchaseRepository {
  /// Households [loadProduct] was asked for.
  final loads = <String>[];
  final buys = <String>[];
  final restores = <String>[];
  var hold = false;
  final held = <Completer<BuyOutcome>>[];

  @override
  Future<ProductLoad> loadProduct(String householdId) async {
    loads.add(householdId);
    return product ?? ProductLoaded(householdId, lifetime);
  }

  @override
  Future<BuyOutcome> buy(String householdId, Product product) async {
    buys.add(householdId);
    if (!hold) {
      return bought;
    }
    final answer = Completer<BuyOutcome>();
    held.add(answer);
    return await answer.future;
  }

  @override
  Future<RestoreOutcome> restore(String householdId) async {
    restores.add(householdId);
    return restored;
  }
}

/// A purchases function whose claim answers [answers] in turn, the last one
/// for good.
class FakeClaimApi({
  var List<ClaimResult> answers = const [Claimed(ClaimStatus.recorded)],
}) implements ClaimApi {
  final calls = <StoreTransactionRef>[];

  @override
  Future<ClaimResult> claim(StoreTransactionRef transaction) async {
    calls.add(transaction);
    return answers[(calls.length - 1).clamp(0, answers.length - 1)];
  }
}

class FakeEntitlementsSource({var bool unlockedNow = false})
    implements EntitlementsSource {
  /// The household's rows as the server has them; null: one purchase's
  /// Lifetime row while [unlockedNow].
  List<Map<String, dynamic>>? rowsNow;

  /// Reads fail (offline) while set.
  var offline = false;
  final watching = <String>{};
  void Function()? _onChange;

  /// A realtime event or a reconnect.
  void change() => _onChange?.call();

  @override
  Future<HouseholdUnlocks> unlocks(String householdId) async {
    if (offline) {
      throw Exception('offline');
    }
    return unlocksOf(
      rowsNow ??
          [
            if (unlockedNow) {'kind': 'lifetime', 'source': 'purchase'},
          ],
    );
  }

  @override
  Future<void> Function() watch(String householdId, void Function() onChange) {
    watching.add(householdId);
    _onChange = onChange;
    return () async {
      watching.remove(householdId);
      _onChange = null;
    };
  }
}

/// Entitlements and the purchase cubit over fakes, for screens and
/// harnesses; closed by [close].
class TestPurchases({
  required final SessionCubit session,
  final FakePurchaseRepository? store,
  final FakeClaimApi? api,
  final FakeEntitlementsSource? source,
}) {
  late final FakePurchaseRepository repository =
      store ?? FakePurchaseRepository();
  late final FakeClaimApi server = api ?? FakeClaimApi();
  late final FakeEntitlementsSource rows = source ?? FakeEntitlementsSource();
  late final entitlements = Entitlements(rows, session);
  late final purchases = PurchaseCubit(
    repository,
    server,
    entitlements,
    session,
  );

  /// The partner's purchase, or the webhook after this one: the row
  /// arrives over Realtime.
  void unlock() {
    rows
      ..unlockedNow = true
      ..change();
  }

  Future<void> close() async {
    await purchases.close();
    await entitlements.close();
  }
}

/// The fake store's ledger, in memory.
class MemoryLedger() implements FakeLedgerStore {
  String? contents;

  @override
  Future<String?> read() async => contents;

  @override
  Future<void> write(String contents) async => this.contents = contents;
}
