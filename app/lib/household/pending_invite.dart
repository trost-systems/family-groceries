import 'dart:async';

/// Where a pending invite is kept on the device: `DeviceCache` in the app.
abstract interface class PendingInviteStore() {
  Future<({String code, DateTime at})?> pendingInvite();

  /// Null drops it.
  Future<void> savePendingInvite(({String code, DateTime at})? invite);
}

/// An invite code as the server compares it: upper case, letters and
/// digits only.
String normalizeInviteCode(String code) =>
    code.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');

/// The codes the server makes: 8 of A-Z and 2-9 without I, O, 0 and 1.
final _codePattern = RegExp(r'^[A-HJ-NP-Z2-9]{8}$');

/// The invite of a `/join/<code>` link the user opened, kept on the device
/// so it survives sign-in (also the mobile apps' custom-scheme return,
/// which loses the location), an app kill, the analytics consent and the
/// onboarding steps. The router reads [code] synchronously; writes go to
/// the [PendingInviteStore] in the background. Like the link itself it
/// lasts 7 days. The code never leaves the device: it is not logged, not
/// sent to analytics and not part of a screen name.
class PendingInvite(
  final PendingInviteStore _store, {
  ({String code, DateTime at})? initial,

  /// The clock; tests pass their own.
  final DateTime Function() now = DateTime.now,
}) {
  /// Loads what the store holds, before the first frame.
  static Future<PendingInvite> load(
    PendingInviteStore store, {
    DateTime Function() now = DateTime.now,
  }) async =>
      PendingInvite(store, initial: await store.pendingInvite(), now: now);

  static const lifetime = Duration(days: 7);

  var _invite = initial;

  /// The pending code, or null when there is none or it is older than
  /// [lifetime].
  String? get code => switch (_invite) {
    (:final code, :final at) when now().difference(at) < lifetime => code,
    _ => null,
  };

  /// Codes answered since the app started (joined, cancelled, invalid):
  /// the router still sees them in the location for a moment (the join
  /// screen's `/join/<code>` while it hands over to the list) and must not
  /// keep them again.
  final _answered = <String>{};

  /// Keeps [code] from a link. A code the server could never have made is
  /// not kept (the join screen still says it is invalid), nor one answered
  /// already. The same code again keeps its first time.
  void remember(String code) {
    final normalized = normalizeInviteCode(code);
    if (!_codePattern.hasMatch(normalized) ||
        _answered.contains(normalized) ||
        this.code == normalized) {
      return;
    }
    _invite = (code: normalized, at: now());
    unawaited(_store.savePendingInvite(_invite));
  }

  /// After a join, a cancel or an invalid code: the invite is answered.
  void clear() {
    if (_invite case (:final code, at: _)) {
      _answered.add(code);
      _invite = null;
      unawaited(_store.savePendingInvite(null));
    }
  }

  /// After the server refused [code]: answered if it is the pending one. A
  /// typo in the field does not drop the link the user came with.
  void refused(String code) {
    if (this.code == normalizeInviteCode(code)) {
      clear();
    }
  }

  /// After a sign-out: nothing pending, and a link opened again is kept
  /// again (for the next sign-in).
  void signedOut() {
    _answered.clear();
    if (_invite != null) {
      _invite = null;
      unawaited(_store.savePendingInvite(null));
    }
  }
}
