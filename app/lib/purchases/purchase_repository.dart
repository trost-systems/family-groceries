import 'package:flutter/foundation.dart' show immutable;

/// Hummlist Lifetime, a non-consumable with the same id on both stores
/// (supabase/functions/purchases/types.ts).
const lifetimeProductId = 'com.hummlist.app.lifetime';

/// The store a proof comes from, as the purchases function names it.
enum AppStore(final String wire) {
  apple('apple'),
  google('google'),
}

/// Why the store hands over a transaction, as the purchases function names
/// it.
enum PurchaseSource(final String wire) {
  purchase('purchase'),
  restore('restore'),
}

/// The product as the store offers it.
@immutable
class const Product({
  required final String id,

  /// The store's localized price, e.g. "9,99 €"; never hard-coded.
  required final String price,
});

/// What loading the product found.
sealed class const ProductLoad();

final class const ProductLoaded(final Product product) extends ProductLoad;

/// The store answers but has no such product (e.g. the Paid Apps agreement
/// is not active yet).
final class const ProductNotFound() extends ProductLoad;

/// The store cannot be reached (offline, no Play Store, payments off).
final class const StoreUnavailable() extends ProductLoad;

/// This build sells nothing: the web app, desktop builds.
final class const PurchasesUnsupported() extends ProductLoad;

/// What the server checks: a StoreKit 2 transaction JWS (Apple) or a Play
/// purchase token (Google).
@immutable
class const StoreProof({
  required final AppStore store,
  required final String data,
  required final String productId,
});

/// What the store reports about a purchase, also for one started in an
/// earlier session.
sealed class const StoreUpdate();

/// Waiting for someone else: Ask to Buy, a Play payment that completes
/// later.
final class const StorePending() extends StoreUpdate;

/// A paid or restored transaction. Unverified until the server says so;
/// finish it only after a definitive answer.
final class const StorePurchased({
  required final StoreProof proof,
  required final PurchaseSource source,

  /// The store already completed it (an acknowledged Play purchase): a
  /// restore the user did not ask for can skip it.
  final bool alreadyFinished = false,

  /// The store's own transaction, handed back to
  /// [PurchaseRepository.finish].
  final Object? handle,
}) extends StoreUpdate;

final class const StoreCanceled() extends StoreUpdate;

final class const StoreFailed(final String code) extends StoreUpdate;

/// The store refused a request before any update (e.g. a purchase of the
/// same product still unfinished).
final class const StoreError(final String code) implements Exception;

/// The App Store or Play Store, or a stand-in. No plugin type leaves it.
abstract interface class PurchaseRepository() {
  /// Listened to once, from app start: unfinished transactions of earlier
  /// sessions arrive here too.
  Stream<StoreUpdate> get updates;

  Future<ProductLoad> loadProduct();

  /// Starts a purchase; its outcome arrives on [updates]. Throws
  /// [StoreError].
  Future<void> buy(Product product);

  /// Hands every owned purchase to [updates] as restored. Throws
  /// [StoreError].
  Future<void> restore();

  /// Hands transactions an earlier session left unfinished to [updates],
  /// where the store does not do so on its own.
  Future<void> recoverUnfinished();

  /// Tells the store the purchase is delivered.
  Future<void> finish(StorePurchased purchase);
}

/// The web app and desktop builds: no store.
class const UnsupportedPurchaseRepository() implements PurchaseRepository {
  @override
  Stream<StoreUpdate> get updates => const Stream.empty();

  @override
  Future<ProductLoad> loadProduct() async => const PurchasesUnsupported();

  @override
  Future<void> buy(Product product) async =>
      throw const StoreError('unsupported');

  @override
  Future<void> restore() async => throw const StoreError('unsupported');

  @override
  Future<void> recoverUnfinished() async {}

  @override
  Future<void> finish(StorePurchased purchase) async {}
}
