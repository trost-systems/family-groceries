import 'package:family_groceries/review/review_counters.dart';
import 'package:family_groceries/review/store_review.dart';

/// The device's review counters for one test.
class MemoryReviewStore() implements ReviewStore {
  String? json;

  @override
  Future<String?> reviewState() async => json;

  @override
  Future<void> saveReviewState(String json) async => this.json = json;
}

/// The store's prompt and listing, counted.
class FakeStoreReview() implements StoreReview {
  var available = true;
  var requests = 0;
  var listings = 0;

  /// Thrown by [openStoreListing] when set (no store app, no connection).
  Exception? listingError;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<void> requestReview() async => requests++;

  @override
  Future<void> openStoreListing() async {
    listings++;
    if (listingError case final error?) {
      throw error;
    }
  }
}
