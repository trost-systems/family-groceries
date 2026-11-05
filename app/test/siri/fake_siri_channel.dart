import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/services.dart';

/// The iPhone's keychain and Siri's item names, in memory.
class FakeSiriChannel() implements SiriChannel {
  SiriKeychainEntry? entry;

  /// What the keychain item holds besides [entry].
  String? token;
  String? voiceUrl;
  final stores = <SiriKeychainEntry>[];
  var clears = 0;
  final sent = <List<SiriSuggestion>>[];

  List<List<String>> get sentNames => [
    for (final items in sent) [for (final item in items) item.name],
  ];

  /// Behaves like a build without the Swift side.
  var missing = false;

  void _check(String method) {
    if (missing) {
      throw MissingPluginException(method);
    }
  }

  @override
  Future<SiriKeychainEntry?> read() async {
    _check('read');
    return entry;
  }

  @override
  Future<void> store({
    required String token,
    required SiriKeychainEntry entry,
    required String voiceUrl,
  }) async {
    _check('store');
    this.entry = entry;
    this.token = token;
    this.voiceUrl = voiceUrl;
    stores.add(entry);
  }

  @override
  Future<void> clear() async {
    _check('clear');
    entry = null;
    token = null;
    clears++;
  }

  @override
  Future<void> suggestions(List<SiriSuggestion> items) async {
    _check('suggestions');
    sent.add(items);
  }
}
