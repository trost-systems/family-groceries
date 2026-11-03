import 'package:web/web.dart' as web;

/// The browser's `navigator.userAgent`.
String? browserUserAgent() => web.window.navigator.userAgent;
