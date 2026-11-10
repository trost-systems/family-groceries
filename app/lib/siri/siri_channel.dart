import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// What the iPhone's keychain says about its Siri credential. The token
/// stays in the keychain: the channel never hands it back.
@immutable
class const SiriKeychainEntry({
  /// The `personal_access_tokens` row.
  required final String id,
  required final String userId,

  /// The Supabase session that created it.
  required final String sessionId,
}) {
  @override
  bool operator ==(Object other) =>
      other is SiriKeychainEntry &&
      other.id == id &&
      other.userId == userId &&
      other.sessionId == sessionId;

  @override
  int get hashCode => Object.hash(id, userId, sessionId);
}

/// The app's door to native Siri (`hummlist/siri` in AppDelegate.swift):
/// the credential the intents send to `voice`, and the item names Siri
/// offers for "Add `<item>` to Snacklist". Only iOS has it; elsewhere a call
/// throws [MissingPluginException].
abstract interface class SiriChannel() {
  Future<SiriKeychainEntry?> read();

  /// Overwrites the keychain item. [token] goes nowhere else.
  Future<void> store({
    required String token,
    required SiriKeychainEntry entry,
    required String voiceUrl,
  });

  Future<void> clear();

  /// At most [maxSiriSuggestions] items, names and their synonyms only.
  Future<void> suggestions(List<SiriSuggestion> items);
}

/// One item Siri offers for "Add `<item>` to Snacklist", with the household's
/// other names for it: names on its items that share the `canonical_key`
/// ("Möhren" for "Karotten"), at most [maxSiriSynonyms].
@immutable
class const SiriSuggestion(
  final String name, {
  final List<String> synonyms = const [],
}) {
  Map<String, Object> toJson() => {'name': name, 'synonyms': synonyms};

  @override
  bool operator ==(Object other) =>
      other is SiriSuggestion &&
      other.name == name &&
      listEquals(other.synonyms, synonyms);

  @override
  int get hashCode => Object.hash(name, Object.hashAll(synonyms));

  @override
  String toString() => 'SiriSuggestion($name, $synonyms)';
}

/// How many other names one suggestion carries.
const maxSiriSynonyms = 2;

/// How many items Siri keeps for its parameter phrase.
const maxSiriSuggestions = 50;

/// The channel on iOS, null on the web, Android and Linux.
SiriChannel? siriChannelFor({
  required bool web,
  required TargetPlatform platform,
}) => !web && platform == TargetPlatform.iOS ? const MethodSiriChannel() : null;

class const MethodSiriChannel() implements SiriChannel {
  static const _channel = MethodChannel('hummlist/siri');

  @override
  Future<SiriKeychainEntry?> read() async =>
      switch (await _channel.invokeMethod<Object?>('read')) {
        {
          'id': final String id,
          'userId': final String userId,
          'sessionId': final String sessionId,
        } =>
          SiriKeychainEntry(id: id, userId: userId, sessionId: sessionId),
        _ => null,
      };

  @override
  Future<void> store({
    required String token,
    required SiriKeychainEntry entry,
    required String voiceUrl,
  }) => _channel.invokeMethod<void>('store', {
    'token': token,
    'id': entry.id,
    'userId': entry.userId,
    'sessionId': entry.sessionId,
    'url': voiceUrl,
  });

  @override
  Future<void> clear() => _channel.invokeMethod<void>('clear');

  @override
  Future<void> suggestions(List<SiriSuggestion> items) =>
      _channel.invokeMethod<void>('suggestions', {
        'items': [
          for (final item in items.take(maxSiriSuggestions)) item.toJson(),
        ],
      });
}
