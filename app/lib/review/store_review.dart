import 'package:flutter/foundation.dart';
import 'package:in_app_review/in_app_review.dart';

/// The store's own rating: its prompt, which the store may or may not show
/// and never says whether it did, and the app's listing.
abstract interface class StoreReview() {
  Future<bool> isAvailable();

  /// Only `ReviewPrompt` asks, never a button (the
  /// `request-review-only-in-review-prompt` lint): the stores throttle the
  /// prompt and Apple refuses apps that ask on a tap.
  Future<void> requestReview();

  Future<void> openStoreListing();
}

/// The `in_app_review` plugin; the only file that imports it.
final class InAppStoreReview() implements StoreReview {
  /// Also `appAppleId` in scripts/iap/apple_product.ts and docs/RELEASE.md.
  static const appStoreId = '6832756448';

  @override
  Future<bool> isAvailable() => InAppReview.instance.isAvailable();

  @override
  Future<void> requestReview() => InAppReview.instance.requestReview();

  @override
  Future<void> openStoreListing() =>
      InAppReview.instance.openStoreListing(appStoreId: appStoreId);
}

/// Whether this platform has a store listing to open: the iPhone and
/// Android apps, not the web or desktop.
bool storeListingShown({required bool web, required TargetPlatform platform}) =>
    !web &&
    (platform == TargetPlatform.iOS || platform == TargetPlatform.android);
