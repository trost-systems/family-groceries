import 'dart:async';

import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

/// The server side of the Siri credential: a `personal_access_tokens` row of
/// kind `siri`, bound to the Supabase session that created it.
abstract interface class SiriServer() {
  /// The `session_id` claim of the current access token; null signed out.
  String? get sessionId;

  /// Whether row [id] exists and is not revoked.
  Future<bool> isActive(String id);

  /// A new credential; revokes the caller's row [replace] in the same call.
  Future<({String id, String token})> create({String? replace});

  /// Revokes the caller's row [id].
  Future<void> revoke(String id);
}

class SupabaseSiriServer(final SupabaseClient _client) implements SiriServer {
  @override
  String? get sessionId {
    final token = _client.auth.currentSession?.accessToken;
    if (token == null) {
      return null;
    }
    try {
      return switch (decodeJwt(token).payload.claims['session_id']) {
        final String id => id,
        _ => null,
      };
    } on AuthException {
      return null;
    }
  }

  @override
  Future<bool> isActive(String id) async =>
      await _client.rest
          .from('personal_access_tokens')
          .select('id')
          .eq('id', id)
          .isFilter('revoked_at', null)
          .maybeSingle() !=
      null;

  @override
  Future<({String id, String token})> create({String? replace}) async {
    final row = await _client
        .rpc<List<Map<String, dynamic>>>(
          'create_siri_credential',
          params: {'p_replace': replace},
        )
        .single();
    return (id: row['id']! as String, token: row['token']! as String);
  }

  @override
  Future<void> revoke(String id) => _client.rest
      .from('personal_access_tokens')
      .update({'revoked_at': DateTime.now().toUtc().toIso8601String()})
      .eq('id', id);
}

/// Keeps this iPhone's Siri credential in step with the session: one for
/// each signed-in session in a household, none otherwise. Each session state
/// is worked off in order, so a sign-out right after a sign-in still ends
/// with an empty keychain.
class SiriCredentials(
  final SiriServer _server,
  final SiriChannel _channel, {

  /// `<supabaseUrl>/functions/v1/voice`, where the intents send their text.
  required final String voiceUrl,
}) {
  /// The session whose credential the keychain holds, once confirmed.
  ({String userId, String sessionId})? _settled;
  var _supported = true;
  Future<void> _work = Future.value();

  /// Follows [session] from its current state on.
  StreamSubscription<Session> follow(StateStreamable<Session> session) {
    _enqueue(session.state);
    return session.stream.listen(_enqueue);
  }

  /// Completes once every state seen so far is worked off.
  Future<void> get idle => _work;

  /// Before a sign-out: revokes this iPhone's row, so Zugänge doesn't list
  /// a credential whose session is about to end. Best effort and brief; the
  /// server refuses the credential without its session anyway.
  Future<void> signingOut() async {
    if (!_supported) {
      return;
    }
    try {
      if (await _channel.read() case final stored?) {
        await _server
            .revoke(stored.id)
            .timeout(const Duration(seconds: 2), onTimeout: () {});
      }
    } on MissingPluginException {
      _supported = false;
    } on Object {
      // Offline: the row stays listed until the cap of five drops it.
    }
  }

  void _enqueue(Session session) {
    _work = _work.then((_) => _apply(session));
  }

  Future<void> _apply(Session session) async {
    if (!_supported) {
      return;
    }
    try {
      switch (session) {
        case InHousehold(:final userId):
          await _ensure(userId);
        case SignedOut() || NeedsHousehold():
          // The server side ends with the session or the membership.
          _settled = null;
          await _channel.clear();
          await _channel.suggestions(const []);
        case SessionLoading():
          break;
      }
    } on MissingPluginException {
      _supported = false;
    } on Object {
      // Offline or refused: the next state in a household tries again.
    }
  }

  Future<void> _ensure(String userId) async {
    final sessionId = _server.sessionId;
    if (sessionId == null) {
      return;
    }
    final current = (userId: userId, sessionId: sessionId);
    if (_settled == current) {
      return;
    }
    final stored = await _channel.read();
    if (stored != null &&
        stored.userId == userId &&
        stored.sessionId == sessionId &&
        await _server.isActive(stored.id)) {
      _settled = current;
      return;
    }
    final created = await _server.create(
      replace: stored?.userId == userId ? stored?.id : null,
    );
    await _channel.store(
      token: created.token,
      entry: SiriKeychainEntry(
        id: created.id,
        userId: userId,
        sessionId: sessionId,
      ),
      voiceUrl: voiceUrl,
    );
    _settled = current;
  }
}
