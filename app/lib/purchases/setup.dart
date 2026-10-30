import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/plugin_purchase_repository.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Which store this build sells through.
sealed class const StoreChoice();

final class const NoStore() extends StoreChoice;

final class const DeviceStore(final AppStore store) extends StoreChoice;

final class const FakeStoreChoice(final FakeStoreMode mode) extends StoreChoice;

/// The web app never sells, fake store or not. [fakeStore] (the
/// `FAKE_STORE` define) counts outside release builds only.
StoreChoice storeChoice({
  required bool web,
  required TargetPlatform platform,
  required String fakeStore,
  required bool release,
}) {
  if (web) {
    return const NoStore();
  }
  if (fakeStore.isNotEmpty && !release) {
    return FakeStoreChoice(FakeStoreMode.values.byName(fakeStore));
  }
  return switch (deviceStore(web: web, platform: platform)) {
    final store? => DeviceStore(store),
    null => const NoStore(),
  };
}

/// The store of this build; the plugin is built only on iOS and Android.
PurchaseRepository purchaseRepository(SupabaseClient client) =>
    switch (storeChoice(
      web: kIsWeb,
      platform: defaultTargetPlatform,
      fakeStore: Environment.fakeStore,
      release: kReleaseMode,
    )) {
      NoStore() => const UnsupportedPurchaseRepository(),
      DeviceStore(:final store) => PluginPurchaseRepository(store),
      FakeStoreChoice(:final mode) => FakeStore(
        mode,
        sign: localTestSigner(client),
        ledger: fileLedger(),
      ),
    };
