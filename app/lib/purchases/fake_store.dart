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

  /// The product cannot be loaded (no Paid Apps agreement yet).
  unavailable,

  /// The store cannot be reached.
  offline,
}

/// Signs a StoreKit 2 transaction the way the App Store does; the local
/// stack's `/purchases/test/sign` route.
typedef SignTransaction = Future<String> Function(String transactionId);

/// Where the fake store keeps its purchases across starts.
abstract interface class FakeLedgerStore() {
  Future<String?> read();
  Future<void> write(String contents);
}

/// A file in the app's support directory.
FakeLedgerStore fileLedger() => platform.fileLedger();

/// The App Store as debug builds and fg play it, where no store exists
/// (Linux desktop): purchases are StoreKit 2 transactions signed by the
/// local stack's test CA, so the server verifies them like Apple's. It keeps
/// what it sold and what is unfinished across starts and hands the
/// unfinished ones over again at the next start, as StoreKit 2 does.
class FakeStore(
  final FakeStoreMode _mode, {
  required final SignTransaction sign,
  required final FakeLedgerStore ledger,
  final Duration approval = const Duration(seconds: 8),
}) implements PurchaseRepository {
  static const price = '9,99 €';

  late final _updates = StreamController<StoreUpdate>(
    onListen: () => unawaited(_redeliver()),
  );
  Future<_Ledger>? _loaded;

  Future<_Ledger> get _book => _loaded ??= _Ledger.read(ledger);

  @override
  Stream<StoreUpdate> get updates => _updates.stream;

  @override
  Future<ProductLoad> loadProduct() async => switch (_mode) {
    FakeStoreMode.offline => const StoreUnavailable(),
    FakeStoreMode.unavailable => const ProductNotFound(),
    _ => const ProductLoaded(Product(id: lifetimeProductId, price: price)),
  };

  @override
  Future<void> buy(Product product) async {
    switch (_mode) {
      case FakeStoreMode.cancel:
        _updates.add(const StoreCanceled());
      case FakeStoreMode.error:
        _updates.add(const StoreFailed('fake_error'));
      case FakeStoreMode.pending:
        _updates.add(const StorePending());
        Timer(approval, () => unawaited(_sell()));
      case FakeStoreMode.ok ||
          FakeStoreMode.unavailable ||
          FakeStoreMode.offline:
        await _sell();
    }
  }

  Future<void> _sell() async {
    final id = 'fake-${const Uuid().v4()}';
    final book = await _book;
    book.owned.add(id);
    book.unfinished.add(id);
    await book.save(ledger);
    await _hand(id, PurchaseSource.purchase, alreadyFinished: false);
  }

  @override
  Future<void> restore() async {
    final book = await _book;
    for (final id in [...book.owned]) {
      await _hand(
        id,
        PurchaseSource.restore,
        alreadyFinished: !book.unfinished.contains(id),
      );
    }
  }

  @override
  Future<void> recoverUnfinished() async {}

  @override
  Future<void> finish(StorePurchased purchase) async {
    final book = await _book;
    if (book.unfinished.remove(purchase.handle)) {
      await book.save(ledger);
    }
  }

  Future<void> _redeliver() async {
    final book = await _book;
    for (final id in [...book.unfinished]) {
      await _hand(id, PurchaseSource.purchase, alreadyFinished: false);
    }
  }

  Future<void> _hand(
    String id,
    PurchaseSource source, {
    required bool alreadyFinished,
  }) async {
    final String jws;
    try {
      jws = await sign(id);
    } on Object {
      _updates.add(const StoreFailed('fake_sign_failed'));
      return;
    }
    _updates.add(
      StorePurchased(
        proof: StoreProof(
          store: AppStore.apple,
          data: jws,
          productId: lifetimeProductId,
        ),
        source: source,
        alreadyFinished: alreadyFinished,
        handle: id,
      ),
    );
  }
}

class _Ledger(final Set<String> owned, final Set<String> unfinished) {
  static Future<_Ledger> read(FakeLedgerStore store) async {
    final Object? json;
    try {
      json = jsonDecode(await store.read() ?? '{}');
    } on FormatException {
      return _Ledger({}, {});
    }
    Set<String> ids(Object? list) => {
      if (list is List<Object?>) ...list.whereType<String>(),
    };
    return switch (json) {
      {'owned': final owned, 'unfinished': final unfinished} => _Ledger(
        ids(owned),
        ids(unfinished),
      ),
      _ => _Ledger({}, {}),
    };
  }

  Future<void> save(FakeLedgerStore store) => store.write(
    jsonEncode({
      'owned': [...owned],
      'unfinished': [...unfinished],
    }),
  );
}

/// The local stack's test signer (404 on a hosted project).
SignTransaction localTestSigner(SupabaseClient client) => (id) async {
  final response = await client.functions.invoke(
    'purchases/test/sign',
    body: {'transactionId': id},
  );
  return switch (response.data) {
    {'jws': final String jws} => jws,
    _ => throw StateError('no jws'),
  };
};
