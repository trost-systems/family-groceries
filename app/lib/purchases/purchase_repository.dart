/// Snacklist Premium Lifetime, a non-consumable with the same id on both
/// stores (supabase/functions/purchases/types.ts).
const lifetimeProductId = 'com.snacklist.app.lifetime';

/// Snacklist Premium yearly, an auto-renewing subscription. Play names it
/// `<id>:<base plan>` in the SDK and in RevenueCat's events.
const yearlyProductId = 'com.snacklist.app.yearly';

/// The Play subscription's base plan (Snacklist Ops, 2026-10-31).
const playBasePlanId = 'yearly';

/// The two ways to buy Snacklist Premium, in the order the page offers them.
enum PremiumPlan(final String productId) {
  yearly(yearlyProductId),
  lifetime(lifetimeProductId);

  /// Whether a store product identifier is this plan's: Play's subscription
  /// ids carry the base plan.
  bool owns(String identifier) =>
      identifier == productId ||
      (this == yearly && identifier == '$productId:$playBasePlanId');
}

/// RevenueCat's App User ID: the signed-in Snacklist user's id
/// (`auth.users.id`), never a household id. The purchase, its restore on a
/// new device and its lapse follow the user into every household they are in
/// (job 185). Built only from the session's user, in PurchaseCubit (lint
/// `revenuecat-user-id-from-session`).
extension type const RevenueCatUserId(String value);

/// Why this build sells nothing, known without asking anyone.
sealed class const NoSale();

/// This build sells nothing: the web app, desktop builds.
final class const PurchasesUnsupported() extends NoSale;

/// The purchase is not offered yet in this build: the `REVENUECAT_PURCHASES`
/// define is off or the platform's SDK key is missing.
final class const PurchasesNotYet() extends NoSale;

/// How a purchase ended.
sealed class const BuyOutcome();

/// How a restore ended.
sealed class const RestoreOutcome();

/// Paid. The unlock arrives from Supabase once RevenueCat's webhook has
/// recorded it, for the user who bought it.
final class const Bought() extends BuyOutcome;

/// The user closed the store's sheet.
final class const Canceled() extends BuyOutcome;

/// The store answers but has no such product (e.g. the Paid Apps agreement
/// is not active yet).
final class const ProductMissing() extends BuyOutcome;

/// Ask to Buy or a Play payment that completes later. Once it does, the
/// unlock arrives from Supabase like any other.
final class const Pending() extends BuyOutcome;

/// Why a purchase or a restore did not go through.
sealed class const StoreProblem() implements BuyOutcome, RestoreOutcome;

/// The store purchase belongs to another Snacklist account, or to a household
/// from before job 185, and stays there (H-56). For the yearly plan also: the
/// store account already pays one for someone else (one subscription per
/// Apple ID and group).
final class const BelongsElsewhere() extends StoreProblem;

/// The store or RevenueCat failed; [code] names why.
final class const StoreFailed(final String code) extends StoreProblem;

/// The store or RevenueCat could not be reached (offline, no Play Store,
/// payments off).
final class const StoreOffline() extends StoreProblem;

/// The store has the user's purchase; the unlock arrives from Supabase.
final class const Restored() extends RestoreOutcome;

final class const NothingToRestore() extends RestoreOutcome;

/// The App Store or Play Store through RevenueCat, or a stand-in. No plugin
/// type leaves it. Every call names the user it is for, and only a tap
/// on Buy or Restore makes one: RevenueCat is not asked before (Legal Review
/// H-67). The price the page shows comes from the store itself
/// (store_prices.dart), never from here.
abstract interface class PurchaseRepository() {
  /// Why a build without a store sells nothing; null where a store is asked.
  NoSale? get withoutStore;

  /// Loads [plan]'s product and opens the store's sheet for it, for [user].
  Future<BuyOutcome> buy(RevenueCatUserId user, PremiumPlan plan);

  Future<RestoreOutcome> restore(RevenueCatUserId user);
}

/// A build that sells nothing: always [answer].
class const NoStoreRepository(final NoSale answer)
    implements PurchaseRepository {
  @override
  NoSale get withoutStore => answer;

  @override
  Future<BuyOutcome> buy(RevenueCatUserId user, PremiumPlan plan) async =>
      const StoreFailed('unsupported');

  @override
  Future<RestoreOutcome> restore(RevenueCatUserId user) async =>
      const StoreFailed('unsupported');
}
