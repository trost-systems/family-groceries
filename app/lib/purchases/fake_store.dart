import 'dart:async';
import 'dart:convert';

import 'package:family_groceries/purchases/fake_ledger_io.dart'
    if (dart.library.js_interop) 'package:family_groceries/purchases/fake_ledger_web.dart'
    as platform;
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

/// How the fake store behaves (the `FAKE_STORE` define).
enum FakeStoreMode() {
  /// Every purchase goes through.
  ok,

  /// Ask to Buy: pending, approved after [FakeStore.approval].
  pending,

  /// The user closes the sheet.
  cancel,

  /// The store fails the purchase.
  error,

  /// The store has no product (no Paid Apps agreement yet).
  unavailable,

  /// The store cannot be reached.
  offline,
}

/// Plays RevenueCat's webhook for a purchase of the household
/// [appUserId]: the local stack's `/purchases/test/event` route.
typedef SendTestEvent = Future<void> Function({
  required String appUserId,
  required String transactionId,
  required PremiumPlan plan,
});

/// Where the fake store keeps its purchases across starts.
abstract interface class FakeLedgerStore() {
  Future<String?> read();
  Future<void> write(String contents);
}

/// A file in the app's support directory.
FakeLedgerStore fileLedger() => platform.fileLedger();

/// The App Store and RevenueCat as debug builds and fg play them, where no
/// store exists (Linux desktop). A purchase sends the webhook event
/// RevenueCat would send, through the local stack, so the server grants it
/// like a real one. Its ledger remembers which household each transaction
/// was bought for, as RevenueCat's "Keep with original App User ID" does.
class FakeStore(
  final FakeStoreMode _mode, {
  required final SendTestEvent send,
  required final FakeLedgerStore ledger,
  final Duration approval = const Duration(seconds: 8),
}) implements PurchaseRepository {
  Future<Map<String, String>>? _loaded;

  /// Transaction id to the household it was bought for.
  Future<Map<String, String>> get _owned => _loaded ??= _read(ledger);

  /// The plan of each transaction this run sold; restored ones count as
  /// Lifetime, as before job 49.
  final _plans = <String, PremiumPlan>{};

  @override
  NoSale? get withoutStore => null;

  @override
  Future<BuyOutcome> buy(String householdId, PremiumPlan plan) async {
    switch (_mode) {
      case FakeStoreMode.cancel:
        return const Canceled();
      case FakeStoreMode.error:
        return const StoreFailed('fake_error');
      case FakeStoreMode.offline:
        return const StoreOffline();
      case FakeStoreMode.unavailable:
        return const ProductMissing();
      case FakeStoreMode.pending:
        Timer(approval, () => unawaited(_sell(householdId, plan)));
        return const Pending();
      case FakeStoreMode.ok:
        return await _sell(householdId, plan);
    }
  }

  Future<BuyOutcome> _sell(String householdId, PremiumPlan plan) async {
    final id = 'fake-${const Uuid().v4()}';
    final owned = await _owned;
    owned[id] = householdId;
    _plans[id] = plan;
    await ledger.write(jsonEncode({'owned': owned}));
    try {
      await send(appUserId: householdId, transactionId: id, plan: plan);
    } on Object {
      // Sold; a restore sends the event again, as RevenueCat retries.
      return const StoreFailed('fake_event_failed');
    }
    return Bought(StoreTransactionRef(AppStore.apple, id));
  }

  @override
  Future<RestoreOutcome> restore(String householdId) async {
    if (_mode == FakeStoreMode.offline) {
      return const StoreOffline();
    }
    final owned = await _owned;
    final mine = [
      for (final MapEntry(:key, :value) in owned.entries)
        if (value == householdId) key,
    ];
    if (mine.isEmpty) {
      return owned.isEmpty
          ? const NothingToRestore()
          : const BelongsElsewhere();
    }
    try {
      for (final id in mine) {
        await send(
          appUserId: householdId,
          transactionId: id,
          plan: _plans[id] ?? PremiumPlan.lifetime,
        );
      }
    } on Object {
      return const StoreFailed('fake_event_failed');
    }
    return const Restored();
  }
}

Future<Map<String, String>> _read(FakeLedgerStore store) async {
  final Object? json;
  try {
    json = jsonDecode(await store.read() ?? '{}');
  } on FormatException {
    return {};
  }
  return switch (json) {
    {'owned': final Map<String, Object?> owned} => {
      for (final MapEntry(:key, :value) in owned.entries)
        if (value is String) key: value,
    },
    _ => {},
  };
}

/// The local stack's RevenueCat stand-in (404 on a hosted project).
SendTestEvent localTestEvent(SupabaseClient client) =>
    ({required appUserId, required transactionId, required plan}) async {
      await client.functions.invoke(
        'purchases/test/event',
        body: {
          'appUserId': appUserId,
          'transactionId': transactionId,
          'productId': plan.productId,
        },
      );
    };
