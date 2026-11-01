import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/premium_server.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_bloc/flutter_bloc.dart';

/// Whether the page may offer anything for sale, and at which prices.
sealed class const Offer();

/// The switch and the prices are being read.
final class const OfferLoading() extends Offer;

/// Nothing is sold here: this build sells nothing, or the server switch
/// `premium_offer` is off or could not be read.
final class const OfferClosed() extends Offer;

/// The store did not answer: no purchase without a price (A2-5).
final class const OfferUnavailable() extends Offer;

/// The store's own prices, exactly as it formats them for the store
/// account's country. A plan missing here is not sold in this storefront.
final class const OfferPrices(final Map<PremiumPlan, StorePrice> prices)
    extends Offer;

/// Where the Premium page was opened from: More's row, or the integration
/// settings' card (job 50, `?from=integrations`).
enum PaywallEntry() {
  more,
  integrations;

  static PaywallEntry parse(String? from) =>
      from == integrations.name ? integrations : more;
}

@immutable
class const PremiumPage({
  final Offer offer = const OfferLoading(),

  /// Null while unknown: the subscriber-only notices stay hidden.
  final MyYearlyPlan? mine,
});

/// The Premium page's reads, made when it opens: the server switch, then
/// (only when it is on) one store price query, and the caller's own yearly
/// plan. None of them configures RevenueCat (H-67); the store price query is
/// StoreKit or Play Billing directly (A2-5).
class PremiumPageCubit(
  final PremiumServer _server,
  final StorePriceReader _prices,
  final Entitlements _entitlements, {

  /// Whether this build sells at all (a store and `REVENUECAT_PURCHASES`).
  required final bool sells,

  /// paywall_viewed goes here once the page offers a plan with its price.
  final Analytics? analytics,
  final PaywallEntry entry = PaywallEntry.more,
}) extends Cubit<PremiumPage> {
  this : super(const PremiumPage()) {
    _rows = _entitlements.stream.listen((_) {
      unawaited(_readMine());
      _viewed();
    });
    unawaited(_open());
  }

  late final StreamSubscription<EntitlementsState> _rows;

  Future<void> _open() async {
    unawaited(_readMine());
    if (!sells || !await _server.offerOpen()) {
      _emitOffer(const OfferClosed());
      return;
    }
    final offer = switch (await _prices.read()) {
      PricesRead(:final prices) when prices.isNotEmpty => OfferPrices(prices),
      PricesRead() => const OfferUnavailable(),
      PricesUnavailable() => const OfferUnavailable(),
    };
    _emitOffer(offer);
    _viewed();
  }

  var _viewedSent = false;

  /// Job 50 (Spec #4 AC7): paywall_viewed once per visit, as soon as the
  /// page shows a plan with its price to a household that can buy it
  /// (prices and the household's rows arrive in either order). Never a
  /// price or a product.
  void _viewed() {
    if (_viewedSent || isClosed || state.offer is! OfferPrices) {
      return;
    }
    if (PremiumPlan.values.any(
      (plan) => _entitlements.canOffer(Entitlement.premium, plan),
    )) {
      _viewedSent = true;
      analytics?.track('paywall_viewed', {'entry_point': entry.name});
    }
  }

  Future<void> _readMine() async {
    try {
      final mine = await _server.myYearlyPlan();
      if (!isClosed) {
        emit(PremiumPage(offer: state.offer, mine: mine));
      }
    } on Object {
      // Offline: the subscriber's notices wait for the next change.
    }
  }

  void _emitOffer(Offer offer) {
    if (!isClosed) {
      emit(PremiumPage(offer: offer, mine: state.mine));
    }
  }

  @override
  Future<void> close() async {
    await _rows.cancel();
    await super.close();
  }
}
