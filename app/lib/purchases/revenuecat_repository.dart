import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart';

/// The App Store and Play Store through RevenueCat (`purchases_flutter`),
/// the only file that may use it (ast-grep rule
/// `purchases-flutter-only-in-revenuecat-repository`). RevenueCat's customer
/// is the Snacklist user (job 185). Nothing here runs before the user taps
/// Buy or Restore (Legal Review H-67): not at app start, not when the Premium
/// page opens. The tap first stores, through [_noteCustomer], that this
/// account's id goes to RevenueCat, so deleting the account deletes its
/// customer there and no other account's id is ever sent. Then it configures
/// the SDK with the user's id, or switches to it with `logIn` when another
/// account signed in on this device since.
/// Switching households changes nothing here. It never learns an e-mail, a
/// name or a device identifier (Legal Review K.9.9 C3, rule
/// `no-revenuecat-customer-data`).
class RevenueCatRepository(
  final String _apiKey,
  final Future<void> Function() _noteCustomer,
) implements PurchaseRepository {
  /// The one configure call; two taps at once share it.
  Future<void>? _configuring;

  @override
  NoSale? get withoutStore => null;

  /// Whether the server noted the account; without it RevenueCat must not
  /// get its id.
  Future<bool> _noted() async {
    try {
      await _noteCustomer();
      return true;
    } on Exception {
      return false;
    }
  }

  Future<void> _as(RevenueCatUserId user) async {
    final first = _configuring == null;
    final configuring = _configuring ??= Purchases.configure(
      PurchasesConfiguration(_apiKey)
        ..appUserID = user.value
        ..automaticDeviceIdentifierCollectionEnabled = false
        ..shouldShowInAppMessagesAutomatically = false,
    );
    try {
      await configuring;
    } on Object {
      _configuring = null;
      rethrow;
    }
    if (!first && await Purchases.appUserID != user.value) {
      await Purchases.logIn(user.value);
    }
  }

  /// Loads [plan]'s product by its id, not from the offering: what the page
  /// offers is decided before the tap (store prices, Supabase), and a
  /// storefront without Lifetime simply returns nothing for it.
  @override
  Future<BuyOutcome> buy(RevenueCatUserId user, PremiumPlan plan) async {
    if (!await _noted()) {
      return const StoreOffline();
    }
    final StoreProduct? product;
    try {
      await _as(user);
      final found = await Purchases.getProducts(
        [plan.productId],
        productCategory: switch (plan) {
          PremiumPlan.yearly => ProductCategory.subscription,
          PremiumPlan.lifetime => ProductCategory.nonSubscription,
        },
      );
      product = found.where((p) => plan.owns(p.identifier)).firstOrNull;
    } on PlatformException catch (e) {
      return switch (_codeOf(e)) {
        PurchasesErrorCode.networkError ||
        PurchasesErrorCode.offlineConnectionError ||
        PurchasesErrorCode.storeProblemError ||
        PurchasesErrorCode.purchaseNotAllowedError ||
        PurchasesErrorCode.apiEndpointBlocked => const StoreOffline(),
        _ => const ProductMissing(),
      };
    }
    if (product == null) {
      return const ProductMissing();
    }
    try {
      await Purchases.purchase(_paramsFor(product));
      return const Bought();
    } on PlatformException catch (e) {
      return switch (_codeOf(e)) {
        PurchasesErrorCode.purchaseCancelledError => const Canceled(),
        PurchasesErrorCode.paymentPendingError => const Pending(),
        final code => _failure(code),
      };
    }
  }

  @override
  Future<RestoreOutcome> restore(RevenueCatUserId user) async {
    if (!await _noted()) {
      return const StoreOffline();
    }
    try {
      await _as(user);
      final info = await Purchases.restorePurchases();
      // Only what is active now: allPurchasedProductIdentifiers also lists
      // lapsed yearly plans, and their unlock would never come. By product,
      // as the server reads it, not by entitlement id; a promotional grant
      // is active too, and the server shows it as well.
      return info.entitlements.active.values.any(
            (e) => PremiumPlan.values.any(
              (plan) => plan.owns(e.productIdentifier),
            ),
          )
          ? const Restored()
          : const NothingToRestore();
    } on PlatformException catch (e) {
      return _failure(_codeOf(e));
    }
  }

  /// Play's base plan, never RevenueCat's default option: that picks a free
  /// trial or intro offer once Play has one, while the page shows the base
  /// plan's price. iOS products have no options.
  static PurchaseParams _paramsFor(StoreProduct product) => switch (product
      .subscriptionOptions
      ?.where((o) => o.isBasePlan)
      .firstOrNull) {
    final basePlan? => PurchaseParams.subscriptionOption(basePlan),
    null => PurchaseParams.storeProduct(product),
  };

  static PurchasesErrorCode _codeOf(PlatformException e) =>
      num.tryParse(e.code) == null
      ? PurchasesErrorCode.unknownError
      : PurchasesErrorHelper.getErrorCode(e);

  /// "Keep with original App User ID" (an Ops setting) makes RevenueCat
  /// refuse a store purchase that another account (or, from before job 185,
  /// a household) has.
  static StoreProblem _failure(PurchasesErrorCode code) => switch (code) {
    PurchasesErrorCode.receiptAlreadyInUseError ||
    PurchasesErrorCode.receiptInUseByOtherSubscriberError =>
      const BelongsElsewhere(),
    PurchasesErrorCode.networkError ||
    PurchasesErrorCode.offlineConnectionError => const StoreOffline(),
    _ => StoreFailed(code.name),
  };
}
