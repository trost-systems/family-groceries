import 'package:flutter/foundation.dart' show immutable;

/// Hummlist Lifetime, a non-consumable with the same id on both stores
/// (supabase/functions/purchases/types.ts).
const lifetimeProductId = 'com.hummlist.app.lifetime';

/// The store a transaction comes from, as the purchases function names it.
enum AppStore(final String wire) {
  apple('apple'),
  google('google'),
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

/// Loaded for [householdId]: RevenueCat's customer is the household, so a
/// purchase is for the household it was loaded for, and only that one.
final class const ProductLoaded(final String householdId, final Product product)
    extends ProductLoad;

/// The store answers but has no such product (e.g. the Paid Apps agreement
/// is not active yet).
final class const ProductNotFound() extends ProductLoad;

/// The store cannot be reached (offline, no Play Store, payments off).
final class const StoreUnavailable() extends ProductLoad;

/// This build sells nothing: the web app, desktop builds.
final class const PurchasesUnsupported() extends ProductLoad;

/// The purchase is not offered yet in this build: the `REVENUECAT_PURCHASES`
/// define is off or the platform's SDK key is missing.
final class const PurchasesNotYet() extends ProductLoad;

/// A store transaction as the purchases function's claim names it: the
/// same id RevenueCat's webhook sends as `transaction_id`.
@immutable
class const StoreTransactionRef(final AppStore store, final String id);

/// How a purchase ended.
sealed class const BuyOutcome();

/// How a restore ended.
sealed class const RestoreOutcome();

/// Paid. The unlock arrives from Supabase once RevenueCat's webhook has
/// recorded it; [transaction] is what the app claims as the buyer. Null when
/// the store named no transaction: the unlock still comes, the buyer stays
/// unknown.
final class const Bought(final StoreTransactionRef? transaction)
    extends BuyOutcome;

/// The user closed the store's sheet.
final class const Canceled() extends BuyOutcome;

/// Ask to Buy or a Play payment that completes later. Once it does, the
/// unlock arrives from Supabase like any other.
final class const Pending() extends BuyOutcome;

/// Why a purchase or a restore did not go through.
sealed class const StoreProblem() implements BuyOutcome, RestoreOutcome;

/// The store purchase belongs to another household and stays there (H-56).
final class const BelongsElsewhere() extends StoreProblem;

/// The store or RevenueCat failed; [code] names why.
final class const StoreFailed(final String code) extends StoreProblem;

/// The store or RevenueCat could not be reached.
final class const StoreOffline() extends StoreProblem;

/// The store has the household's purchase; the unlock arrives from Supabase.
final class const Restored() extends RestoreOutcome;

final class const NothingToRestore() extends RestoreOutcome;

/// The App Store or Play Store through RevenueCat, or a stand-in. No plugin
/// type leaves it. Every call names the household it is for.
abstract interface class PurchaseRepository() {
  /// The answer of a build without a store, known without asking anyone;
  /// null where a store is asked.
  ProductLoad? get withoutStore;

  Future<ProductLoad> loadProduct(String householdId);

  Future<BuyOutcome> buy(String householdId, Product product);

  /// Only when the user asks.
  Future<RestoreOutcome> restore(String householdId);
}

/// A build that sells nothing: always [answer].
class const NoStoreRepository(final ProductLoad answer)
    implements PurchaseRepository {
  @override
  ProductLoad get withoutStore => answer;

  @override
  Future<ProductLoad> loadProduct(String householdId) async => answer;

  @override
  Future<BuyOutcome> buy(String householdId, Product product) async =>
      const StoreFailed('unsupported');

  @override
  Future<RestoreOutcome> restore(String householdId) async =>
      const StoreFailed('unsupported');
}
