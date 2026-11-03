/// An update More's top card offers.
sealed class const AppUpdate();

/// An over-the-air patch is downloaded and takes effect after a restart.
final class const PatchReady() extends AppUpdate;

/// The store has a newer version than this install.
final class const StoreVersion(final String version) extends AppUpdate;

/// Where More learns about updates and applies one.
abstract interface class AppUpdates() {
  /// The update to offer now, or null.
  Future<AppUpdate?> available();

  /// Restarts into the patch or opens the store.
  Future<void> apply(AppUpdate update);
}

/// The app has no update check yet (no code push, no store lookup), so the
/// card never shows (job 85).
final class const NoAppUpdates() implements AppUpdates {
  @override
  Future<AppUpdate?> available() async => null;

  @override
  Future<void> apply(AppUpdate update) async {}
}
