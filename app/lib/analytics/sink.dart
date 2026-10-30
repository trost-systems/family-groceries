import 'dart:convert';

import 'package:family_groceries/analytics/post.dart';
import 'package:http/http.dart' as http;

/// Where captured events go. The app has one real sink, [PostHogSink];
/// tests record what would be sent instead.
abstract interface class AnalyticsSink() {
  /// Sends one batch of PostHog events (`event`, `properties`, `timestamp`,
  /// `uuid`). Throws when the batch did not arrive, so it is sent again.
  Future<void> send(List<Map<String, Object?>> batch);
}

/// PostHog's capture API (`POST <host>/batch/`, public project key), the
/// endpoint the SDKs use. Only hosts [allowedHost] admits are ever called.
class PostHogSink(
  final http.Client _http, {
  required final String host,
  required final String projectKey,
}) implements AnalyticsSink {
  @override
  Future<void> send(List<Map<String, Object?>> batch) async {
    final status = await postJson(
      _http,
      Uri.parse('$host/batch/'),
      jsonEncode({'api_key': projectKey, 'batch': batch}),
    );
    if (status >= 300) {
      throw http.ClientException('capture answered $status');
    }
  }
}

/// The one PostHog host Einkauf data may go to: EU Cloud ingestion.
const posthogEuHost = 'https://eu.i.posthog.com';

/// Whether [host] may receive events: PostHog EU, or a stand-in that can
/// never reach PostHog (a `.invalid` host, or this machine) for e2e runs.
/// Any other host, the US cloud included, leaves analytics off.
bool allowedHost(String host) {
  if (host == posthogEuHost) {
    return true;
  }
  final uri = Uri.tryParse(host);
  if (uri == null || uri.path.isNotEmpty && uri.path != '/') {
    return false;
  }
  return (uri.scheme == 'https' || uri.scheme == 'http') &&
      (uri.host.endsWith('.invalid') ||
          uri.host == 'localhost' ||
          uri.host == '127.0.0.1');
}

/// A project API key as PostHog issues them (`phc_` and letters, digits,
/// `_` or `-`). A personal key (`phx_`) is never accepted.
bool projectKeyLike(String key) =>
    RegExp(r'^phc_[A-Za-z0-9_-]{8,64}$').hasMatch(key);
