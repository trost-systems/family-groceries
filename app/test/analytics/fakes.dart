import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/sink.dart';

/// Keeps what would go to PostHog; [fail] makes the next sends throw.
class RecordingSink() implements AnalyticsSink {
  final batches = <List<Map<String, Object?>>>[];
  var fail = false;

  /// Every event sent, in order.
  List<Map<String, Object?>> get events => [for (final b in batches) ...b];

  /// The names of [events].
  List<String> get names => [for (final e in events) e['event']! as String];

  @override
  Future<void> send(List<Map<String, Object?>> batch) async {
    if (fail) {
      throw Exception('offline');
    }
    batches.add(batch);
  }
}

/// An install's analytics storage that lives as long as the test.
class MemoryAnalyticsStore() implements AnalyticsStore {
  String? id;
  bool? decided;
  String? firstOpen;
  var internal = false;

  @override
  Future<String?> installId() async => id;

  @override
  Future<void> saveInstallId(String id) async => this.id = id;

  @override
  Future<bool?> consent() async => decided;

  @override
  Future<void> saveConsent({required bool granted}) async => decided = granted;

  @override
  Future<String?> firstOpenSentFor() async => firstOpen;

  @override
  Future<void> saveFirstOpenSentFor(String installId) async =>
      firstOpen = installId;

  @override
  Future<bool> internalInstall() async => internal;

  @override
  Future<void> saveInternalInstall({required bool internal}) async =>
      this.internal = internal;
}

const releaseConfig = AnalyticsConfig(
  releaseBuild: true,
  householdGroups: false,
  platform: 'web',
  appVersion: '0.1.0+7',
);

const householdA = '11111111-2222-3333-4444-555555555555';

/// A signed-in customer in household A.
const customer = AnalyticsUser(
  email: 'kunde@gmail.com',
  householdId: householdA,
);

/// A loaded [Analytics] on [sink] and [store], for a release build.
Future<Analytics> loadedAnalytics(
  RecordingSink sink,
  MemoryAnalyticsStore store, {
  AnalyticsConfig config = releaseConfig,
}) async {
  final analytics = Analytics(sink, store, config);
  await analytics.load();
  return analytics;
}
