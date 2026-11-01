import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/posthog_client.dart';
import 'package:family_groceries/analytics/posthog_platform_io.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

/// The iOS and Android side of posthog_flutter: answers its method channel
/// as the native SDKs do and keeps every call Dart made. The real
/// `Posthog()` runs in front of it, `beforeSend` included, so [events] is
/// what the native SDK would send.
class NativePostHog() {
  final calls = <MethodCall>[];

  /// The distinct id the native SDK keeps on the device; it survives
  /// `close()`, and a bootstrap seeds it only while there is none.
  String? storedId;

  /// The flags PostHog would serve.
  var served = <String, bool>{};

  /// The project tokens MainActivity was asked to forget the SDK's state
  /// for (`familygroceries/posthog`).
  final forgotten = <String>[];

  void install() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      ..setMockMethodCallHandler(
        const MethodChannel('posthog_flutter'),
        _answer,
      )
      ..setMockMethodCallHandler(posthogStateChannel, (call) async {
        forgotten.add((call.arguments as Map)['projectToken'] as String);
        return null;
      });
  }

  Future<Object?> _answer(MethodCall call) async {
    calls.add(call);
    final arguments = call.arguments;
    switch (call.method) {
      case 'setup':
        final bootstrap = (arguments as Map)['bootstrap'];
        final seed = bootstrap is Map
            ? bootstrap['distinctId'] as String?
            : null;
        storedId ??= seed ?? const Uuid().v7();
      case 'reset':
        storedId = const Uuid().v7();
      case 'distinctId':
        return storedId;
      case 'getAllFeatureFlags':
        return [
          for (final MapEntry(:key, :value) in served.entries)
            {'key': key, 'enabled': value},
        ];
    }
    return null;
  }

  /// The names of the methods called, in order.
  List<String> get methods => [for (final c in calls) c.method];

  /// Every event handed to the native SDK: `event` and `properties`.
  List<Map<String, Object?>> get events => [
    for (final call in calls)
      if (call.method == 'capture' || call.method == 'captureException')
        {
          'event': call.method == 'capture'
              ? (call.arguments as Map)['eventName']
              : r'$exception',
          'properties': Map<String, Object?>.from(
            (call.arguments as Map)['properties'] as Map? ?? const {},
          ),
        },
  ];

  /// The names of [events].
  List<String> get names => [for (final e in events) e['event']! as String];

  /// The setup arguments of the last setup.
  Map<Object?, Object?> get setup =>
      calls.lastWhere((c) => c.method == 'setup').arguments as Map;
}

/// The properties of one of [NativePostHog.events].
Map<String, Object?> propsOf(Map<String, Object?> event) =>
    event['properties']! as Map<String, Object?>;

/// An install's analytics storage that lives as long as the test.
class MemoryAnalyticsStore() implements AnalyticsStore {
  String? id;
  bool? decided;

  /// The consent text version [decided] was given under.
  String? textVersion;
  String? firstOpen;
  var internal = false;

  @override
  Future<String?> installId() async => id;

  @override
  Future<void> saveInstallId(String id) async => this.id = id;

  @override
  Future<void> forgetInstallId() async {
    id = null;
    firstOpen = null;
  }

  @override
  Future<bool?> consent() async => decided;

  @override
  Future<String?> consentTextVersion() async => textVersion;

  @override
  Future<void> saveConsent({
    required bool granted,
    required String textVersion,
  }) async {
    decided = granted;
    this.textVersion = textVersion;
  }

  @override
  Future<void> forgetConsent() async {
    decided = null;
    textVersion = null;
  }

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

/// The SDK for a stand-in project on a host that can't be reached.
PostHogClient testClient() =>
    PostHogClient(host: 'https://posthog.invalid', projectKey: 'phc_unit_test');

/// A loaded [Analytics] on the SDK and [store], for a release build; its
/// SDK start (after a stored yes) has finished.
Future<Analytics> loadedAnalytics(
  MemoryAnalyticsStore store, {
  AnalyticsConfig config = releaseConfig,
}) async {
  final analytics = Analytics(testClient(), store, config);
  await analytics.load();
  await analytics.flush();
  return analytics;
}
