import 'dart:async';

import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/session/session_cubit.dart';

const lifetime = Product(id: lifetimeProductId, price: '9,99 €');

/// A store whose updates the test sends.
class FakePurchaseRepository({
  var ProductLoad product = const ProductLoaded(lifetime),
}) implements PurchaseRepository {
  final _updates = StreamController<StoreUpdate>.broadcast(sync: true);
  var buys = 0;
  var restores = 0;
  var recoveries = 0;
  var loads = 0;
  final finished = <StoreProof>[];

  /// Thrown by [buy] and [restore] when set.
  StoreError? refuse;

  /// Thrown by [finish] when set (the plugin channel failing).
  Exception? failFinish;

  /// Sent on [restore], as the store does.
  List<StoreUpdate> owned = [];

  void send(StoreUpdate update) => _updates.add(update);

  @override
  Stream<StoreUpdate> get updates => _updates.stream;

  @override
  Future<ProductLoad> loadProduct() async {
    loads++;
    return product;
  }

  @override
  Future<void> buy(Product product) async {
    buys++;
    if (refuse case final error?) {
      throw error;
    }
  }

  @override
  Future<void> restore() async {
    restores++;
    if (refuse case final error?) {
      throw error;
    }
    owned.forEach(send);
  }

  @override
  Future<void> recoverUnfinished() async => recoveries++;

  @override
  Future<void> finish(StorePurchased purchase) async {
    if (failFinish case final error?) {
      throw error;
    }
    finished.add(purchase.proof);
  }
}

StorePurchased paid(
  String data, {
  PurchaseSource source = PurchaseSource.purchase,
  bool alreadyFinished = false,
}) => StorePurchased(
  proof: StoreProof(
    store: AppStore.apple,
    data: data,
    productId: lifetimeProductId,
  ),
  source: source,
  alreadyFinished: alreadyFinished,
);

/// A purchases function that answers [answer], or holds every answer in
/// [pending] while [hold] is set.
class FakePurchaseApi({
  var Verification answer = const Verified(VerifyOutcome.granted),
}) implements PurchaseApi {
  /// Answers held back until the test completes them.
  final pending = <Completer<Verification>>[];
  var hold = false;
  final calls = <(StoreProof, PurchaseSource)>[];

  /// Called when the server grants: the entitlement row appears.
  void Function()? onGrant;

  @override
  Future<Verification> verify(StoreProof proof, PurchaseSource source) async {
    calls.add((proof, source));
    final Verification result;
    if (hold) {
      final completer = Completer<Verification>();
      pending.add(completer);
      result = await completer.future;
    } else {
      result = answer;
    }
    if (result case Verified(
      outcome: VerifyOutcome.granted || VerifyOutcome.restored,
    )) {
      onGrant?.call();
    }
    return result;
  }
}

class FakeEntitlementsSource({var bool unlockedNow = false})
    implements EntitlementsSource {
  /// Reads fail (offline) while set.
  var offline = false;
  final watching = <String>{};
  void Function()? _onChange;

  /// A realtime event or a reconnect.
  void change() => _onChange?.call();

  @override
  Future<bool> unlocked(String householdId) async {
    if (offline) {
      throw Exception('offline');
    }
    return unlockedNow;
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
  final FakePurchaseApi? api,
  final FakeEntitlementsSource? source,
}) {
  late final FakePurchaseRepository repository =
      store ?? FakePurchaseRepository();
  late final FakePurchaseApi server = api ?? FakePurchaseApi();
  late final FakeEntitlementsSource rows = source ?? FakeEntitlementsSource();
  late final entitlements = Entitlements(rows, session);
  late final purchases = PurchaseCubit(
    repository,
    server,
    entitlements,
    session,
  );

  Future<void> close() async {
    await purchases.close();
    await entitlements.close();
  }
}
