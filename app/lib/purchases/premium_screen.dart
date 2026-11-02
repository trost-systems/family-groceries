import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/legal_links.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/premium_dialogs.dart';
import 'package:family_groceries/purchases/premium_features_card.dart';
import 'package:family_groceries/purchases/premium_page_cubit.dart';
import 'package:family_groceries/purchases/premium_server.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/refund_help.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Hummlist Premium for the whole household (`/more/lifetime`): the
/// status, the yearly plan and Lifetime with the store's own prices, restore,
/// and the plan's management. A page of the More tab, which gives it its
/// frame. Opening it reads the server switch and the store's prices
/// (StoreKit or Play Billing, A2-5); only Buy and Restore start RevenueCat
/// (Legal Review H-67).
class const PremiumScreen({
  super.key,

  /// Where it was opened from, for paywall_viewed.
  final PaywallEntry entry = PaywallEntry.more,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (context) {
      final purchases = context.read<PurchaseCubit>()..pageOpened();
      return PremiumPageCubit(
        context.read<PremiumServer>(),
        context.read<StorePriceReader>(),
        context.read<Entitlements>(),
        sells: purchases.state.noSale == null,
        analytics: context.read<Analytics?>(),
        entry: entry,
      );
    },
    child: const _PremiumView(),
  );
}

class const _PremiumView() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final language = Localizations.localeOf(context).languageCode;
    final entitlements = context.watch<Entitlements>();
    final premium = entitlements.premium;
    bool offers(PremiumPlan plan) =>
        entitlements.canOffer(Entitlement.premium, plan);
    final inHousehold = context.select<SessionCubit, bool>(
      (s) => s.state is InHousehold,
    );
    final page = context.watch<PremiumPageCubit>().state;
    final mine = page.mine;
    final cubit = context.read<PurchaseCubit>();
    final state = context.watch<PurchaseCubit>().state;
    final noSale = state.noSale;
    final sells = noSale == null;
    final prices = switch (page.offer) {
      OfferPrices(:final prices) => prices,
      _ => const <PremiumPlan, StorePrice>{},
    };
    // A plan is offered only with its store price, the server switch on and
    // the household known not to have it (A2-5, H-84).
    final cards = [
      if (sells && inHousehold)
        for (final plan in PremiumPlan.values)
          if (offers(plan) && prices[plan] != null) plan,
    ];
    final yearlyRuns =
        premium is ActivePremium && premium.source == PremiumSource.yearly ||
        entitlements.yearlyBilled;
    final manage = !kIsWeb && yearlyRuns;
    void buy(PremiumPlan plan) => unawaited(() async {
      if (plan == PremiumPlan.lifetime &&
          entitlements.yearlyBilled &&
          !await confirmLifetimeWhileYearly(
            context,
            subscriber: mine?.subscriber ?? false,
          )) {
        return;
      }
      await cubit.buy(plan);
    }());
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: ListView(
          key: const ValueKey('lifetime-screen'),
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            // Each block is its own semantics node: one line for a screen
            // reader (and the web's DOM) instead of the page run together.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: PremiumFeaturesCard(
                title: l10n.premiumTitle,
                titleStyle: theme.textTheme.titleLarge,
                body: l10n.premiumBody,
                later: false,
              ),
            ),
            if (premium case ActivePremium(
              :final source,
              :final expiresAt,
              :final renews,
            ))
              Semantics(
                container: true,
                child: ListTile(
                  key: const ValueKey('lifetime-unlocked'),
                  leading: Icon(
                    Icons.check_circle,
                    color: theme.colorScheme.primary,
                  ),
                  title: Text(switch (source) {
                    PremiumSource.yearly when renews =>
                      l10n.premiumStatusRenews(expiresAt!.toLocal()),
                    PremiumSource.yearly => l10n.premiumStatusEnds(
                      expiresAt!.toLocal(),
                    ),
                    PremiumSource.lifetime => l10n.premiumStatusLifetime,
                    PremiumSource.promotional when expiresAt != null =>
                      l10n.premiumStatusGrantedUntil(expiresAt.toLocal()),
                    PremiumSource.promotional => l10n.premiumStatusGranted,
                  }),
                  subtitle: Text(l10n.premiumUnlockedBody),
                ),
              ),
            if (mine case MyYearlyPlan(billingIssue: true, :final until?))
              _Note(
                'premium-billing-issue',
                Icons.credit_card_off_outlined,
                l10n.premiumBillingIssue(until.toLocal()),
                error: true,
              ),
            if (premium case ActivePremium(source: PremiumSource.lifetime)
                when entitlements.yearlyBilled)
              Semantics(
                container: true,
                child: ListTile(
                  key: const ValueKey('premium-lifetime-while-yearly'),
                  leading: const Icon(Icons.info_outline),
                  title: LinkedText(
                    mine?.subscriber ?? false
                        ? l10n.premiumLifetimeWhileYearlySubscriber
                        : l10n.premiumLifetimeWhileYearly,
                    key: const ValueKey('premium-lifetime-while-yearly-manage'),
                    onTap: () => unawaited(openManageSubscriptions(context)),
                  ),
                ),
              ),
            if (entitlements.twoYearlyPlans)
              _Note(
                'premium-two-yearly',
                Icons.info_outline,
                l10n.premiumTwoYearly,
              ),
            if (manage)
              ListTile(
                key: const ValueKey('premium-manage'),
                leading: const Icon(Icons.manage_accounts_outlined),
                title: Text(l10n.premiumManage),
                trailing: const Icon(Icons.open_in_new),
                onTap: () => unawaited(openManageSubscriptions(context)),
              ),
            if (kIsWeb && yearlyRuns) _ManageOnWeb(language: language),
            if (entitlements.boughtLifetimeTwice)
              _Note(
                'lifetime-bought-twice',
                Icons.info_outline,
                l10n.lifetimeBoughtTwice,
              ),
            ?_flow(context, state.flow),
            if (premium == null && sells)
              _Note('lifetime-checking', Icons.sync, l10n.premiumChecking),
            ?switch (noSale) {
              PurchasesNotYet() => _Note(
                'lifetime-unavailable',
                Icons.schedule,
                l10n.premiumComingSoon,
              ),
              PurchasesUnsupported() => _Note(
                'lifetime-web',
                Icons.phone_iphone,
                l10n.premiumWeb,
              ),
              null => null,
            },
            if (sells &&
                inHousehold &&
                PremiumPlan.values.any(offers) &&
                cards.isEmpty)
              ?switch (page.offer) {
                OfferLoading() => null,
                OfferClosed() => _Note(
                  'lifetime-unavailable',
                  Icons.schedule,
                  l10n.premiumComingSoon,
                ),
                OfferUnavailable() || OfferPrices() => _Note(
                  'premium-unavailable',
                  Icons.cloud_off,
                  l10n.premiumUnavailable,
                ),
              },
            for (final plan in cards)
              _PlanCard(
                plan: plan,
                price: prices[plan]!,
                busy: state.busy,
                buying: state.flow is FlowBuying,
                onBuy: () => buy(plan),
              ),
            if (cards.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: OutlinedButton.icon(
                    key: const ValueKey('lifetime-restore'),
                    icon: state.flow is FlowRestoring
                        ? const _Spinner()
                        : const Icon(Icons.restore),
                    label: Text(l10n.lifetimeRestore),
                    onPressed: state.busy
                        ? null
                        : () => unawaited(cubit.restore()),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                child: Wrap(
                  children: [
                    _Link(
                      'premium-terms',
                      l10n.premiumTermsLink,
                      termsUrl(defaultTargetPlatform, language),
                    ),
                    _Link(
                      'premium-privacy',
                      l10n.premiumPrivacyLink,
                      privacyPolicyUrl(language),
                    ),
                  ],
                ),
              ),
            ],
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 16, 16, 0),
              child: RefundHelpLink(
                key: const ValueKey('lifetime-refund-help'),
                label: l10n.lifetimeRefundLink,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget? _flow(BuildContext context, PurchaseFlow flow) {
    final l10n = AppLocalizations.of(context);
    return switch (flow) {
      FlowIdle() || FlowBuying() || FlowRestoring() => null,
      FlowAwaitingApproval() => Semantics(
        container: true,
        child: ListTile(
          key: const ValueKey('lifetime-pending'),
          leading: const Icon(Icons.hourglass_top),
          title: Text(l10n.lifetimePending),
          subtitle: Text(l10n.lifetimePendingBody),
        ),
      ),
      FlowUnlocking() => Semantics(
        container: true,
        child: ListTile(
          key: const ValueKey('lifetime-unlocking'),
          leading: const _Spinner(),
          title: Text(l10n.lifetimeUnlocking),
        ),
      ),
      FlowUnlockDelayed() => _Note(
        'lifetime-unlock-delayed',
        Icons.schedule,
        l10n.lifetimeUnlockDelayed,
      ),
      FlowCanceled() => _Note(
        'lifetime-canceled',
        Icons.close,
        l10n.lifetimeCanceled,
      ),
      FlowNotAvailable() => _Note(
        'lifetime-unavailable',
        Icons.schedule,
        l10n.premiumUnavailable,
      ),
      FlowUsedElsewhere() => Semantics(
        container: true,
        child: ListTile(
          key: const ValueKey('lifetime-used-elsewhere'),
          leading: const Icon(Icons.home_outlined),
          title: Text(l10n.lifetimeUsedElsewhere),
          subtitle: Text(l10n.premiumUsedElsewhereYearly),
        ),
      ),
      FlowNothingRestored() => _Note(
        'lifetime-nothing-restored',
        Icons.search_off,
        l10n.lifetimeNothingRestored,
      ),
      FlowFailed(kind: FailureKind.offline) => _Note(
        'lifetime-offline',
        Icons.cloud_off,
        l10n.lifetimeStoreOffline,
      ),
      FlowFailed(:final kind, :final code) => _Note(
        'lifetime-error',
        Icons.error_outline,
        switch (kind) {
          FailureKind.store => l10n.lifetimeStoreFailed(code),
          FailureKind.offline => l10n.lifetimeStoreOffline,
        },
        error: true,
      ),
    };
  }
}

/// One line of state with its icon.
class const _Note(
  final String id,
  final IconData icon,
  final String text, {
  final bool error = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      container: true,
      child: ListTile(
        key: ValueKey(id),
        leading: Icon(icon),
        iconColor: error ? scheme.error : null,
        title: Text(text),
      ),
    );
  }
}

class const _Spinner() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 18,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}

/// One plan with the store's price: the yearly plan with the subscription
/// disclosures (App Store Review Guidelines 3.1.2), Lifetime as three
/// years' worth. "inkl. MwSt." only for a price in euros (K.13.P.3).
class const _PlanCard({
  required final PremiumPlan plan,
  required final StorePrice price,
  required final bool busy,
  required final bool buying,
  required final VoidCallback onBuy,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final amount = switch (plan) {
      PremiumPlan.yearly => l10n.premiumYearlyPrice(price.formatted),
      PremiumPlan.lifetime => l10n.premiumLifetimePrice(price.formatted),
    };
    return Card(
      key: ValueKey('premium-card-${plan.name}'),
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(switch (plan) {
                PremiumPlan.yearly => l10n.premiumYearlyTitle,
                PremiumPlan.lifetime => l10n.premiumLifetimeTitle,
              }, style: theme.textTheme.titleMedium),
            ),
            const SizedBox(height: 4),
            Text(
              price.euro ? '$amount ${l10n.premiumVat}' : amount,
              key: ValueKey('premium-price-${plan.name}'),
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              switch (plan) {
                PremiumPlan.yearly => l10n.premiumYearlyTerms,
                PremiumPlan.lifetime => l10n.premiumLifetimeValue,
              },
              key: ValueKey('premium-terms-${plan.name}'),
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              key: ValueKey('premium-buy-${plan.name}'),
              icon: buying
                  ? const _Spinner()
                  : const Icon(Icons.shopping_bag_outlined),
              label: Text(switch (plan) {
                PremiumPlan.yearly => l10n.premiumBuyYearly,
                PremiumPlan.lifetime => l10n.premiumBuyLifetime,
              }),
              onPressed: busy ? null : onBuy,
            ),
          ],
        ),
      ),
    );
  }
}

class const _Link(final String id, final String label, final Uri url)
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => LegalLink(
    key: ValueKey(id),
    url: url,
    builder: (context, open) => TextButton(onPressed: open, child: Text(label)),
  );
}

/// The web sells nothing and can't open a store's sheet: the two pages
/// where a yearly plan is managed.
class const _ManageOnWeb({required final String language})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      key: const ValueKey('premium-manage-web'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.premiumManageWeb),
          Wrap(
            children: [
              _Link(
                'premium-manage-apple',
                l10n.premiumManageApple,
                appleSubscriptionsUrl,
              ),
              _Link(
                'premium-manage-google',
                l10n.premiumManageGoogle,
                googleSubscriptionsUrl,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
