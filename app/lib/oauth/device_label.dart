import 'package:flutter/foundation.dart';

/// A short name for the device a connected app was approved on, like
/// `Chrome · macOS`, shown under Mehr › Zugänge. Only this label is stored
/// (job 80), never the user agent it was read from. Outside a browser it is
/// the system alone.
String deviceLabel({required TargetPlatform platform, String? userAgent}) {
  final system = switch (platform) {
    TargetPlatform.iOS => 'iOS',
    TargetPlatform.android => 'Android',
    TargetPlatform.macOS => 'macOS',
    TargetPlatform.windows => 'Windows',
    TargetPlatform.linux => 'Linux',
    TargetPlatform.fuchsia => 'Fuchsia',
  };
  return switch (_browser(userAgent ?? '')) {
    final browser? => '$browser · $system',
    null => system,
  };
}

/// The browser's brand, most specific first: Edge and Opera also say
/// Chrome, Chrome also says Safari.
String? _browser(String userAgent) => switch (userAgent) {
  _ when userAgent.contains(RegExp('Edg(e|A|iOS)?/')) => 'Edge',
  _ when userAgent.contains(RegExp('OPR/|Opera')) => 'Opera',
  _ when userAgent.contains(RegExp('Firefox/|FxiOS/')) => 'Firefox',
  _ when userAgent.contains(RegExp('Chrome/|CriOS/')) => 'Chrome',
  _ when userAgent.contains('Safari/') => 'Safari',
  _ => null,
};
