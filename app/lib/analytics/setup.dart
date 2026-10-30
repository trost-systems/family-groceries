import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/analytics/internal.dart';
import 'package:family_groceries/analytics/sink.dart';
import 'package:family_groceries/app/environment.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

/// Analytics for this build, loaded: on only with a PostHog project key
/// and an allowed host built in (docs/ANALYTICS.md), off otherwise.
Future<Analytics> startAnalytics(AnalyticsStore store) async {
  const key = Environment.posthogProjectKey;
  const host = Environment.posthogHost;
  final on = projectKeyLike(key) && allowedHost(host);
  if (key.isNotEmpty && !on) {
    debugPrint('analytics: off, the key or host $host is not accepted');
  }
  final analytics = Analytics(
    on ? PostHogSink(http.Client(), host: host, projectKey: key) : null,
    store,
    AnalyticsConfig(
      // A preview deployment counts like a debug build: internal.
      releaseBuild: kReleaseMode && !Environment.analyticsInternalBuild,
      platform: platformName(web: kIsWeb, platform: defaultTargetPlatform),
      appVersion: await _appVersion(),
      internalHouseholds: csvSet(Environment.analyticsInternalHouseholds),
      internalEmailDomains: csvSet(Environment.analyticsInternalEmailDomains),
      householdGroups: Environment.analyticsHouseholdGroups,
    ),
  );
  await analytics.load();
  return analytics;
}

/// `web`, `ios`, `android`, … as events name it.
String platformName({required bool web, required TargetPlatform platform}) =>
    web ? 'web' : platform.name.toLowerCase();

Future<String> _appVersion() async {
  try {
    final info = await PackageInfo.fromPlatform();
    final version = info.buildNumber.isEmpty
        ? info.version
        : '${info.version}+${info.buildNumber}';
    return versionPattern.hasMatch(version) ? version : '0';
  } on Object {
    return '0';
  }
}
