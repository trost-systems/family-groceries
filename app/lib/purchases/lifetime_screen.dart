import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Hummlist Lifetime: buy it or restore it, for the whole household
/// (`/more/lifetime`). A page of the More tab, which gives it its frame.
/// Nothing in the app depends on it yet.
class const LifetimeScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final unlocked = context.select<Entitlements, bool>((e) => e.isUnlocked);
    final state = context.watch<PurchaseCubit>().state;
    final cubit = context.read<PurchaseCubit>();
    final product = state.product;
    final sells = product is! PurchasesUnsupported;
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
            ?_flow(context, state.flow),
            ?switch (product) {
              null when !unlocked => const Padding(
                key: ValueKey('lifetime-loading'),
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
              ProductNotFound() => _Note(
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
                  if (product case ProductLoaded(:final product) when !unlocked)
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
                  if (sells)
                    OutlinedButton.icon(
                      key: const ValueKey('lifetime-restore'),
                      icon: state.flow is FlowRestoring
                          ? const _Spinner()
                          : const Icon(Icons.restore),
                      label: Text(l10n.lifetimeRestore),
                      onPressed: state.canRestore
                          ? () => unawaited(cubit.restore())
                          : null,
                    ),
                  if (retry)
                    TextButton.icon(
                      key: const ValueKey('lifetime-retry'),
                      icon: const Icon(Icons.refresh),
                      label: Text(l10n.retry),
                      onPressed: () => unawaited(cubit.retry()),
                    ),
                ],
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
      FlowVerifying() => Semantics(
        container: true,
        child: ListTile(
          key: const ValueKey('lifetime-verifying'),
          leading: const _Spinner(),
          title: Text(l10n.lifetimeVerifying),
        ),
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
      FlowRefunded() => _Note(
        'lifetime-refunded',
        Icons.money_off,
        l10n.lifetimeRefunded,
      ),
      FlowFailed(:final kind, :final code) => _Note(
        'lifetime-error',
        Icons.error_outline,
        switch (kind) {
          FailureKind.store => l10n.lifetimeStoreFailed(code),
          FailureKind.offline => l10n.lifetimeVerifyOffline,
          FailureKind.rateLimited => l10n.lifetimeRateLimited,
          FailureKind.refused => l10n.lifetimeRefused(code),
          FailureKind.server => l10n.lifetimeServerFailed(code),
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
