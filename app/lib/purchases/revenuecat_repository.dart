import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart';

/// The App Store and Play Store through RevenueCat (`purchases_flutter`),
/// the only file that may use it (ast-grep rule
/// `purchases-flutter-only-in-revenuecat-repository`). RevenueCat's customer
/// is the household: the SDK is configured with the household id on the
/// first call, never at app start, and switched with `logIn` before any
/// call for another household. It never learns a user id, an e-mail or a
/// device identifier (Legal Review K.9.9 C3, rule
/// `no-revenuecat-customer-data`).
class RevenueCatRepository(final AppStore _store, final String _apiKey)
    implements PurchaseRepository {
  /// The one configure call; two loads at once share it.
  Future<void>? _configuring;

  /// What [loadProduct] found, for [buy].
  final _products = <String, StoreProduct>{};

  @override
  ProductLoad? get withoutStore => null;

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

  @override
  Future<ProductLoad> loadProduct(String householdId) async {
    try {
      await _as(householdId);
      final found = await Purchases.getProducts([
        lifetimeProductId,
      ], productCategory: ProductCategory.nonSubscription);
      final product = found
          .where((p) => p.identifier == lifetimeProductId)
          .firstOrNull;
      if (product == null) {
        return const ProductNotFound();
      }
      _products[product.identifier] = product;
      return ProductLoaded(
        householdId,
        Product(id: product.identifier, price: product.priceString),
      );
    } on PlatformException catch (e) {
      return switch (_codeOf(e)) {
        PurchasesErrorCode.networkError ||
        PurchasesErrorCode.offlineConnectionError ||
        PurchasesErrorCode.storeProblemError ||
        PurchasesErrorCode.purchaseNotAllowedError ||
        PurchasesErrorCode.apiEndpointBlocked => const StoreUnavailable(),
        _ => const ProductNotFound(),
      };
    }
  }

  @override
  Future<BuyOutcome> buy(String householdId, Product product) async {
    final storeProduct = _products[product.id];
    if (storeProduct == null) {
      return const StoreFailed('not_loaded');
    }
    try {
      await _as(householdId);
      final result = await Purchases.purchase(
        PurchaseParams.storeProduct(storeProduct),
      );
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
      return info.allPurchasedProductIdentifiers.contains(lifetimeProductId)
          ? const Restored()
          : const NothingToRestore();
    } on PlatformException catch (e) {
      return _failure(_codeOf(e));
    }
  }

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
