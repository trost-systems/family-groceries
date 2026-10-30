import 'dart:async';

import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:in_app_purchase/in_app_purchase.dart';

/// The App Store (StoreKit 2) and Play Store through `in_app_purchase`.
/// Build it only on iOS and Android: the plugin has no other platform.
class PluginPurchaseRepository(final AppStore _store)
    implements PurchaseRepository {
  final _plugin = InAppPurchase.instance;

  /// What [loadProduct] found, for [buy].
  final _details = <String, ProductDetails>{};

  @override
  late final Stream<StoreUpdate> updates = _plugin.purchaseStream
      .asyncExpand(
        (batch) => Stream.fromFutures([for (final p in batch) _update(p)]),
      )
      .where((update) => update != null)
      .cast<StoreUpdate>();

  Future<StoreUpdate?> _update(PurchaseDetails p) async {
    switch (p.status) {
      case PurchaseStatus.pending:
        return const StorePending();
      case PurchaseStatus.purchased || PurchaseStatus.restored:
        return StorePurchased(
          proof: StoreProof(
            store: _store,
            data: p.verificationData.serverVerificationData,
            productId: p.productID,
          ),
          source: p.status == PurchaseStatus.restored
              ? PurchaseSource.restore
              : PurchaseSource.purchase,
          alreadyFinished: !p.pendingCompletePurchase,
          handle: p,
        );
      case PurchaseStatus.canceled || PurchaseStatus.error:
        // Nothing to deliver; an open transaction would only come back.
        if (p.pendingCompletePurchase) {
          await _plugin.completePurchase(p).catchError((Object _) {});
        }
        return p.status == PurchaseStatus.canceled
            ? const StoreCanceled()
            : StoreFailed(p.error?.code ?? 'unknown');
    }
  }

  @override
  Future<ProductLoad> loadProduct() async {
    try {
      if (!await _plugin.isAvailable()) {
        return const StoreUnavailable();
      }
      final response = await _plugin.queryProductDetails({lifetimeProductId});
      final details = response.productDetails
          .where((d) => d.id == lifetimeProductId)
          .firstOrNull;
      if (details == null) {
        return response.error == null || response.notFoundIDs.isNotEmpty
            ? const ProductNotFound()
            : const StoreUnavailable();
      }
      _details[details.id] = details;
      return ProductLoaded(Product(id: details.id, price: details.price));
    } on PlatformException {
      return const StoreUnavailable();
    }
  }

  @override
  Future<void> buy(Product product) async {
    final details = _details[product.id];
    if (details == null) {
      throw const StoreError('not_loaded');
    }
    final bool started;
    try {
      started = await _plugin.buyNonConsumable(
        purchaseParam: PurchaseParam(productDetails: details),
      );
    } on PlatformException catch (e) {
      throw StoreError(e.code);
    }
    if (!started) {
      throw const StoreError('not_started');
    }
  }

  @override
  Future<void> restore() async {
    try {
      await _plugin.restorePurchases();
    } on PlatformException catch (e) {
      throw StoreError(e.code);
    } on InAppPurchaseException catch (e) {
      throw StoreError(e.code);
    }
  }

  /// StoreKit 2 hands unfinished transactions to the listener at launch.
  /// Play does not: a purchase whose app was killed before it was verified
  /// stays unacknowledged (and is refunded after three days), so Android
  /// asks for owned purchases; the cubit verifies only the unacknowledged
  /// ones ([StorePurchased.alreadyFinished]).
  @override
  Future<void> recoverUnfinished() async {
    if (_store == AppStore.google) {
      await restore().catchError((Object _) {});
    }
  }

  @override
  Future<void> finish(StorePurchased purchase) async {
    if (purchase.handle case final PurchaseDetails details) {
      await _plugin.completePurchase(details);
    }
  }
}

/// The store of this device, or null where there is none.
AppStore? deviceStore({required bool web, required TargetPlatform platform}) =>
    web
    ? null
    : switch (platform) {
        TargetPlatform.iOS => AppStore.apple,
        TargetPlatform.android => AppStore.google,
        _ => null,
      };
