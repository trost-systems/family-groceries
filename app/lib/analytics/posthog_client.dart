import 'package:family_groceries/analytics/flags.dart';
import 'package:family_groceries/analytics/posthog_platform.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// What may go to PostHog for [event] with [properties], or null to drop
/// it: `Analytics`' gate, run on every Dart-side event before the SDK adds
/// its own properties.
typedef Admit = Map<String, Object>? Function(
  String event,
  Map<String, Object> properties,
);

/// The posthog_flutter SDK (posthog-js under it on the web) for one project,
/// set up only once `Analytics` has a yes (docs/ANALYTICS.md, "How it is
/// built"). The only file that imports the SDK.
class PostHogClient({
  required final String host,
  required final String projectKey,
}) {
  /// Sets the SDK up, seeding [installId] as its distinct id when it has
  /// none stored, and returns the distinct id it uses. Every Dart-side event
  /// passes [admit] first; [onFlags] runs when flags arrive.
  Future<String> start({
    required String? installId,
    required Admit admit,
    required void Function() onFlags,
  }) async {
    await loadPostHogJs(
      host: host,
      projectKey: projectKey,
      installId: installId,
    );
    final config = PostHogConfig(projectKey)
      ..host = host
      ..personProfiles = PostHogPersonProfiles.never
      ..captureApplicationLifecycleEvents = false
      ..sendFeatureFlagEvent = false
      // No `/flags` request at start while flag lookups are off (Flags).
      ..preloadFeatureFlags = flagLookups
      ..sessionReplay = false
      ..surveys = false
      ..capturePushNotificationSubscriptions = false
      ..capturePushNotificationOpened = false
      ..beforeSend = [(event) => _admitted(event, admit)]
      ..onFeatureFlags = flagLookups ? onFlags : null
      ..bootstrap = installId == null
          ? null
          : PostHogBootstrapConfig(distinctId: installId);
    config.rageClickConfig.enabled = false;
    // Dart errors come through Analytics.captureException, which scrubs them
    // with the error at hand; the SDK's own Dart hooks would hand beforeSend
    // only strings. Native crashes never reach Dart (docs/ANALYTICS.md).
    config.errorTrackingConfig
      ..captureNativeExceptions = true
      ..captureNativeCrashes = true;
    await Posthog().setup(config);
    return await Posthog().getDistinctId();
  }

  static PostHogEvent? _admitted(PostHogEvent event, Admit admit) {
    final properties = admit(event.event, event.properties ?? const {});
    if (properties == null) {
      return null;
    }
    return event
      ..properties = properties
      ..userProperties = null
      ..userPropertiesSetOnce = null;
  }

  /// Drops the stored distinct id for a new one and returns it.
  Future<String> newDistinctId() async {
    await Posthog().reset();
    return await Posthog().getDistinctId();
  }

  /// Super properties, added by the SDK to every event it sends, the ones
  /// it builds natively (crash reports) included; null removes one.
  Future<void> register(Map<String, Object?> properties) => Future.wait([
    for (final MapEntry(:key, :value) in properties.entries)
      if (value == null)
        Posthog().unregister(key)
      else
        Posthog().register(key, value),
  ]);

  Future<void> capture(String event, Map<String, Object> properties) =>
      Posthog().capture(eventName: event, properties: properties);

  Future<void> captureException(
    Object error,
    StackTrace? stack,
    Map<String, Object> properties,
  ) => Posthog().captureException(
    error: error,
    stackTrace: stack,
    properties: properties,
  );

  /// The flags PostHog evaluated for this install, by key.
  Future<Map<String, bool>> flags() async {
    if (!flagLookups) {
      return const {};
    }
    final results = await Posthog().getAllFeatureFlags();
    return {
      for (final flag in results ?? const <PostHogFeatureFlagResult>[])
        flag.key: flag.enabled,
    };
  }

  Future<void> flush() => Posthog().flush();

  /// Stops the SDK and deletes what it keeps on the device, ids and queued
  /// events included; [start] sets it up again.
  Future<void> stop() async {
    await Posthog().close();
    await forget();
  }

  /// Deletes what a stopped SDK left on the device.
  Future<void> forget() => forgetPostHogState(projectKey);
}
