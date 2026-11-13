import 'package:device_info_plus/device_info_plus.dart';
import 'package:family_groceries/analytics/setup.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show Orientation;
import 'package:package_info_plus/package_info_plus.dart';

/// What a note carries besides the text (docs/FEEDBACK.md): enough to
/// reproduce a problem, nothing from the list. Each field fits the
/// database's check on `public.feedback`.
@immutable
class const FeedbackContext({
  /// `0.1.0`, from package_info_plus like More's version line.
  required final String appVersion,

  /// The build number, `1023`; `none` when the platform has none.
  required final String build,

  /// ios, android, web, linux, macos, windows.
  required final String platform,

  /// `Android 14 (SDK 34)`, `iOS 18.1`; on the web the browser family and
  /// OS, `Chrome on Android`, never the user agent.
  required final String osVersion,

  /// The app's language: `de` or `en`.
  required final String locale,

  /// `iPhone 15 Pro`, `Google Pixel 8`; `web` in a browser, `unknown`
  /// where the platform has no model. Never a serial or device id.
  required final String deviceModel,

  /// The analytics rules (internal.dart); the database adds test accounts.
  required final bool isInternal,

  /// Where and how the form was opened.
  required final FeedbackScene scene,

  /// The household shown when the note was written (job 169b); the server
  /// keeps it if the sender is a member, else files the note under their
  /// default household.
  final String? householdId,
});

/// Where the form was opened from: More's row, or a shake on a screen.
enum FeedbackEntryPoint() {
  more,
  shake,
}

/// Whether the list reached the server when the form opened.
enum FeedbackOnline() {
  yes,
  no,

  /// Still connecting, or no list (not in a household).
  unknown;

  /// From the household list's [ConnectionStatus]; null without a list.
  factory of(ConnectionStatus? connection) => switch (connection) {
    ConnectionStatus.online => yes,
    ConnectionStatus.offline => no,
    ConnectionStatus.connecting || null => unknown,
  };
}

/// Premium in the household when the form opened, from its rows or the
/// sender's own ([Unlocks], job 185), without any store or subscriber id.
enum FeedbackEntitlement() {
  free,
  lifetime,
  yearly,
  promotional,

  /// The household's rows were not read yet (loading, offline).
  unknown;

  factory of(EntitlementsState state, DateTime now) => switch (state) {
    EntitlementsUnknown() => unknown,
    EntitlementsKnown(:final unlocks) => switch (unlocks.premiumAt(now)) {
      NoPremium() => free,
      ActivePremium(source: PremiumSource.lifetime) => lifetime,
      ActivePremium(source: PremiumSource.yearly) => yearly,
      ActivePremium(source: PremiumSource.promotional) => promotional,
    },
  };
}

/// What [textScaleBucket] reports; `public.feedback` checks the same list.
const textScaleBuckets = [
  '0.8-',
  '0.9',
  '1.0',
  '1.1',
  '1.2',
  '1.3',
  '1.4',
  '1.5+',
];

/// The text size [factor] as one of [textScaleBuckets]: the nearest tenth
/// between 0.9 and 1.4, below and above that the ends.
String textScaleBucket(double factor) {
  if (!factor.isFinite) {
    return '1.0';
  }
  if (factor < 0.85) {
    return textScaleBuckets.first;
  }
  if (factor >= 1.45) {
    return textScaleBuckets.last;
  }
  return ((factor * 10).round() / 10).toStringAsFixed(1);
}

/// The screen the form was opened on and how it looked then: taken when
/// it opens, so a note written for a while still describes where the bug
/// was.
@immutable
class const FeedbackScene({
  required final FeedbackEntryPoint entryPoint,

  /// A name from `screenNames`.
  required final String screen,
  required final Brightness theme,
  required final Orientation orientation,

  /// One of [textScaleBuckets].
  required final String textScale,
  required final FeedbackOnline online,
  required final FeedbackEntitlement entitlement,
});

/// The build and device facts of [FeedbackContext], read once.
@immutable
class const DeviceFacts({
  required final String appVersion,
  required final String build,
  required final String platform,
  required final String osVersion,
  required final String deviceModel,
});

/// Where [DeviceFacts] come from; a fake in tests.
abstract interface class FeedbackDevice() {
  Future<DeviceFacts> read();
}

/// package_info_plus and device_info_plus, cached after the first read;
/// never throws (what can't be read is `unknown`).
class PluginFeedbackDevice() implements FeedbackDevice {
  Future<DeviceFacts>? _facts;

  @override
  Future<DeviceFacts> read() => _facts ??= _read();

  static Future<DeviceFacts> _read() async {
    final (info, (os, model)) = await (_packageInfo(), _device()).wait;
    return DeviceFacts(
      appVersion: fitField(info?.version ?? '', 32),
      build: fitField(info?.buildNumber ?? '', 16, empty: 'none'),
      platform: platformName(web: kIsWeb, platform: defaultTargetPlatform),
      osVersion: fitField(os, 64),
      deviceModel: fitField(model, 48),
    );
  }

  static Future<PackageInfo?> _packageInfo() async {
    try {
      return await PackageInfo.fromPlatform();
    } on Object {
      return null;
    }
  }

  /// The OS version and the device model.
  static Future<(String, String)> _device() async {
    try {
      return switch (await DeviceInfoPlugin().deviceInfo) {
        WebBrowserInfo(:final userAgent) => (
          webOsVersion(userAgent ?? ''),
          'web',
        ),
        AndroidDeviceInfo(:final version, :final manufacturer, :final model) =>
          (
            'Android ${version.release} (SDK ${version.sdkInt})',
            androidModel(manufacturer, model),
          ),
        IosDeviceInfo(
          :final systemName,
          :final systemVersion,
          :final modelName,
        ) =>
          ('$systemName $systemVersion', modelName),
        MacOsDeviceInfo(
          :final majorVersion,
          :final minorVersion,
          :final modelName,
          :final model,
        ) =>
          (
            'macOS $majorVersion.$minorVersion',
            modelName.trim().isEmpty ? model : modelName,
          ),
        LinuxDeviceInfo(:final prettyName) => (prettyName, 'unknown'),
        WindowsDeviceInfo(:final productName, :final displayVersion) => (
          '$productName $displayVersion',
          'unknown',
        ),
        _ => ('unknown', 'unknown'),
      };
    } on Object {
      return ('unknown', 'unknown');
    }
  }
}

/// The maker and the model, `Google Pixel 8`; the model alone when it
/// already names the maker (`Xiaomi 14`, not `Xiaomi Xiaomi 14`).
String androidModel(String manufacturer, String model) {
  final maker = manufacturer.trim();
  final name = model.trim();
  if (maker.isEmpty || name.toLowerCase().startsWith(maker.toLowerCase())) {
    return name;
  }
  return '$maker $name';
}

/// [text] without control characters (C0, C1 and the line and
/// paragraph separators, which the database's `[[:cntrl:]]` checks
/// refuse), trimmed, at most [max] characters;
/// [empty] when nothing is left.
String fitField(String text, int max, {String empty = 'unknown'}) {
  final clean = text
      .replaceAll(RegExp(r'[\x00-\x1f\x7f-\x9f\u2028\u2029]'), ' ')
      .trim();
  if (clean.isEmpty) {
    return empty;
  }
  final runes = clean.runes;
  return runes.length <= max
      ? clean
      : String.fromCharCodes(runes.take(max)).trim();
}

/// The browser family and OS of a user agent, `Safari on iOS`; nothing
/// else of it (versions, device, extensions) is kept.
String webOsVersion(String userAgent) {
  bool has(String part) => userAgent.contains(part);
  final browser = has('Edg/') || has('EdgA/') || has('EdgiOS/')
      ? 'Edge'
      : has('SamsungBrowser/')
      ? 'Samsung Internet'
      : has('OPR/') || has('OPiOS/')
      ? 'Opera'
      : has('Firefox/') || has('FxiOS/')
      ? 'Firefox'
      : has('Chrome/') || has('CriOS/') || has('Chromium/')
      ? 'Chrome'
      : has('Safari/')
      ? 'Safari'
      : 'Browser';
  final os = has('Android')
      ? 'Android'
      : has('iPhone') || has('iPad') || has('iPod')
      ? 'iOS'
      : has('CrOS')
      ? 'ChromeOS'
      : has('Mac OS X') || has('Macintosh')
      ? 'macOS'
      : has('Windows')
      ? 'Windows'
      : has('Linux')
      ? 'Linux'
      : 'unknown OS';
  return '$browser on $os';
}
