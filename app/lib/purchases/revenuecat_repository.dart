import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart';

/// The App Store and Play Store through RevenueCat (`purchases_flutter`),
/// the only file that may use it (ast-grep rule
/// `purchases-flutter-only-in-revenuecat-repository`). RevenueCat's customer
/// is the household. Nothing here runs before the user taps Buy or Restore
/// (Legal Review H-67): not at app start, not when the Premium page opens.
/// The tap configures the SDK with the household id, or switches to it with
/// `logIn` when it was configured for another one. It never learns a user
/// id, an e-mail or a device identifier (Legal Review K.9.9 C3, rule
/// `no-revenuecat-customer-data`).
class RevenueCatRepository(final AppStore _store, final String _apiKey)
    implements PurchaseRepository {
  /// The one configure call; two taps at once share it.
  Future<void>? _configuring;

  @override
  NoSale? get withoutStore => null;

  Future<void> _as(String householdId) async {
    final first = _configuring == null;
    final configuring = _configuring ??= Purchases.configure(
      PurchasesConfiguration(_apiKey)
        ..appUserID = householdId
        ..automaticDeviceIdentifierCollectionEnabled = false
        ..shouldShowInAppMessagesAutomatically = false,
    );
    try {
      await configuring;
    } on Object {
      _configuring = null;
      rethrow;
    }
    if (!first && await Purchases.appUserID != householdId) {
      await Purchases.logIn(householdId);
    }
  }

  /// Loads [plan]'s product by its id, not from the offering: what the page
  /// offers is decided before the tap (store prices, Supabase), and a
  /// storefront without Lifetime simply returns nothing for it.
  @override
  Future<BuyOutcome> buy(String householdId, PremiumPlan plan) async {
    final StoreProduct? product;
    try {
      await _as(householdId);
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
      final result = await Purchases.purchase(_paramsFor(product));
      final id = result.storeTransaction.transactionIdentifier;
      return Bought(id.isEmpty ? null : StoreTransactionRef(_store, id));
    } on PlatformException catch (e) {
      return switch (_codeOf(e)) {
        PurchasesErrorCode.purchaseCancelledError => const Canceled(),
        PurchasesErrorCode.paymentPendingError => const Pending(),
        final code => _failure(code),
      };
    }
  }

  @override
  Future<RestoreOutcome> restore(String householdId) async {
    try {
      await _as(householdId);
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
  /// refuse a store purchase that another household has.
  static StoreProblem _failure(PurchasesErrorCode code) => switch (code) {
    PurchasesErrorCode.receiptAlreadyInUseError ||
    PurchasesErrorCode.receiptInUseByOtherSubscriberError =>
      const BelongsElsewhere(),
    PurchasesErrorCode.networkError ||
    PurchasesErrorCode.offlineConnectionError => const StoreOffline(),
    _ => StoreFailed(code.name),
  };
}
