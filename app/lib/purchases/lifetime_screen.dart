import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/refund_help.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Hummlist Lifetime: buy it or restore it, for the whole household
/// (`/more/lifetime`). A page of the More tab, which gives it its frame.
/// While it is open the purchase cubit may ask the store
/// ([PurchaseCubit.pageOpened]).
class const LifetimeScreen({super.key}) extends StatefulWidget {
  @override
  State<LifetimeScreen> createState() => _LifetimeScreenState();
}

class _LifetimeScreenState() extends State<LifetimeScreen> {
  late final PurchaseCubit _cubit = context.read<PurchaseCubit>();

  @override
  void initState() {
    super.initState();
    _cubit.pageOpened();
  }

  @override
  void dispose() {
    _cubit.pageClosed();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final unlocked = context.select<Entitlements, bool>(
      (e) => e.has(Entitlement.lifetime),
    );
    // Buy shows only when the household is known to have no Lifetime: not
    // while that is loading or offline (no member pays twice).
    final offer = context.select<Entitlements, bool>(
      (e) => e.canOffer(Entitlement.lifetime),
    );
    final boughtTwice = context.select<Entitlements, bool>(
      (e) => e.boughtLifetimeTwice,
    );
    final household = context.select<SessionCubit, String?>(
      (s) => switch (s.state) {
        InHousehold(:final household) => household.id,
        _ => null,
      },
    );
    final state = context.watch<PurchaseCubit>().state;
    final cubit = _cubit;
    final product = state.product;
    final sells =
        product is! PurchasesUnsupported && product is! PurchasesNotYet;
    final restorable = switch (product) {
      ProductLoaded() || ProductNotFound() || StoreUnavailable() => offer,
      _ => false,
    };
    final retry = switch ((product, state.flow)) {
      (ProductNotFound() || StoreUnavailable(), _) || (_, FlowFailed()) => true,
      _ => false,
    };
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
            Semantics(
              container: true,
              child: ListTile(
                leading: const Icon(Icons.favorite_outline),
                title: Text(l10n.lifetimeBody),
              ),
            ),
            if (unlocked)
              Semantics(
                container: true,
                child: ListTile(
                  key: const ValueKey('lifetime-unlocked'),
                  leading: Icon(
                    Icons.check_circle,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  title: Text(l10n.lifetimeUnlocked),
                  subtitle: Text(l10n.lifetimeUnlockedBody),
                ),
              ),
            if (boughtTwice)
              _Note(
                'lifetime-bought-twice',
                Icons.info_outline,
                l10n.lifetimeBoughtTwice,
              ),
            ?_flow(context, state.flow),
            if (!unlocked && !offer && sells)
              _Note('lifetime-checking', Icons.sync, l10n.lifetimeChecking),
            ?switch (product) {
              null when offer => const Padding(
                key: ValueKey('lifetime-loading'),
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
              ProductNotFound() || PurchasesNotYet() => _Note(
                'lifetime-unavailable',
                Icons.schedule,
                l10n.lifetimeComingSoon,
              ),
              StoreUnavailable() => _Note(
                'lifetime-offline',
                Icons.cloud_off,
                l10n.lifetimeStoreOffline,
              ),
              PurchasesUnsupported() => _Note(
                'lifetime-web',
                Icons.phone_iphone,
                l10n.lifetimeWeb,
              ),
              _ => null,
            },
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (product
                      case ProductLoaded(:final householdId, :final product)
                      when offer && householdId == household)
                    FilledButton.icon(
                      key: const ValueKey('lifetime-buy'),
                      icon: state.flow is FlowBuying
                          ? const _Spinner()
                          : const Icon(Icons.shopping_bag_outlined),
                      label: Text(
                        l10n.lifetimeBuy(product.price),
                        key: const ValueKey('lifetime-price'),
                      ),
                      onPressed: state.busy
                          ? null
                          : () => unawaited(cubit.buy()),
                    ),
                  if (restorable)
                    OutlinedButton.icon(
                      key: const ValueKey('lifetime-restore'),
                      icon: state.flow is FlowRestoring
                          ? const _Spinner()
                          : const Icon(Icons.restore),
                      label: Text(l10n.lifetimeRestore),
                      onPressed: state.busy
                          ? null
                          : () => unawaited(cubit.restore()),
                    ),
                  if (retry)
                    TextButton.icon(
                      key: const ValueKey('lifetime-retry'),
                      icon: const Icon(Icons.refresh),
                      label: Text(l10n.retry),
                      onPressed: cubit.retry,
                    ),
                ],
              ),
            ),
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
      FlowUsedElsewhere() => _Note(
        'lifetime-used-elsewhere',
        Icons.home_outlined,
        l10n.lifetimeUsedElsewhere,
      ),
      FlowNothingRestored() => _Note(
        'lifetime-nothing-restored',
        Icons.search_off,
        l10n.lifetimeNothingRestored,
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
