import 'dart:async';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/analytics/exceptions.dart';
import 'package:family_groceries/analytics/internal.dart';
import 'package:family_groceries/analytics/sink.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

/// The analytics consent on this install, as the router and More see it.
@immutable
class const AnalyticsState({
  /// False until the stored decision was read.
  final bool loaded = false,

  /// Null: not asked yet. True: events and errors are sent while signed
  /// in. False: nothing is sent.
  final bool? consent,

  /// Marked internal under More: every event says `is_internal`.
  final bool internalInstall = false,
});

/// What analytics keeps on the device, per install (not per account): the
/// pseudonymous install id, the consent decision and whether `first_open`
/// went out for this install id. The install id and the `first_open` mark
/// exist only while the consent is yes (TDDDG §25).
abstract interface class AnalyticsStore() {
  Future<String?> installId();

  Future<void> saveInstallId(String id);

  /// Deletes the install id and the `first_open` mark.
  Future<void> forgetInstallId();

  Future<bool?> consent();

  Future<void> saveConsent({required bool granted});

  /// The install id `first_open` was sent for, if any.
  Future<String?> firstOpenSentFor();

  Future<void> saveFirstOpenSentFor(String installId);

  Future<bool> internalInstall();

  Future<void> saveInternalInstall({required bool internal});
}

/// Who is signed in, as analytics needs it. The e-mail only decides
/// `is_internal` and is never sent.
@immutable
class const AnalyticsUser({final String? email, final String? householdId});

/// Records this install's answer for the signed-in user on the server
/// (`record_analytics_consent`, job 31), so server events such as an add over
/// Alexa follow the same consent. [installId] is null for an install that
/// said no and so has none; [answered] is true when the user just answered,
/// which makes it the user's newest answer.
typedef ConsentRecorder = Future<void> Function({
  required String? installId,
  required bool consent,
  required bool internal,
  required bool answered,
});

/// Build facts every event carries.
@immutable
class const AnalyticsConfig({
  required final bool releaseBuild,

  /// ios, android, web, …
  required final String platform,

  /// `0.1.0+1023`.
  required final String appVersion,

  /// Also sends the `household` group (`$groups`). Group analytics is a
  /// paid PostHog add-on, so this stays off until Peter decides.
  required final bool householdGroups,
  final Set<String> internalHouseholds = const {},
  final Set<String> internalEmailDomains = const {},

  final Duration flushEvery = const Duration(seconds: 5),
  final int flushAt = 20,
  final int maxQueue = 500,
});

/// Product analytics and error tracking for PostHog EU (docs/ANALYTICS.md).
///
/// Nothing is captured, queued or sent unless all of these hold: a sink
/// exists (a project key was built in), the user said yes on this install,
/// and someone is signed in. Saying no, or turning it off under More,
/// drops whatever still waits in the queue. Every event passes
/// [checkEvent] and [checkContext] before it is queued.
class Analytics(
  final AnalyticsSink? _sink,
  final AnalyticsStore _store,
  final AnalyticsConfig _config, {
  DateTime Function()? clock,
}) extends Cubit<AnalyticsState> {
  this : super(const AnalyticsState());

  /// A build without a project key: nothing can be sent and no one is
  /// asked.
  factory off(AnalyticsStore store) => Analytics(
    null,
    store,
    const AnalyticsConfig(
      releaseBuild: false,
      platform: 'web',
      appVersion: '0',
      householdGroups: false,
    ),
  );

  final DateTime Function() _clock = clock ?? DateTime.now;
  final _queue = <Map<String, Object?>>[];
  String? _installId;
  AnalyticsUser? _user;
  Timer? _flushTimer;
  Future<void>? _inFlight;
  var _failures = 0;

  /// Set by the session: where this install's answer goes for the signed-in
  /// user.
  ConsentRecorder? recordConsent;

  /// The answer last recorded, so a token refresh does not record it again.
  String? _recorded;

  /// The install id `first_open` went out for, claimed before the write so
  /// two quick yeses send one.
  String? _firstOpenFor;

  /// Whether this build can send at all.
  bool get enabled => _sink != null;

  /// Whether this install, the signed-in user and their household are
  /// internal now ([isInternal]); also for feedback (job 21), which is
  /// stored with or without consent and with or without a project key.
  bool get internalNow => isInternal(
    releaseBuild: _config.releaseBuild,
    internalInstall: state.internalInstall,
    householdId: _user?.householdId,
    email: _user?.email,
    internalHouseholds: _config.internalHouseholds,
    internalEmailDomains: _config.internalEmailDomains,
  );

  /// Whether the consent screen is due: the build can send and this
  /// install has not decided yet.
  bool get asksConsent => enabled && state.loaded && state.consent == null;

  /// Events waiting to be sent, oldest first; for tests.
  @visibleForTesting
  List<Map<String, Object?>> get queued => List.unmodifiable(_queue);

  /// Reads the decision and, after a yes, the install id. Without a yes
  /// no install id is made, and one stored by an older build is deleted.
  /// Call once before the first frame.
  Future<void> load() async {
    final (stored, consent, internal, firstOpen) = await (
      _store.installId(),
      _store.consent(),
      _store.internalInstall(),
      _store.firstOpenSentFor(),
    ).wait;
    if (consent == true) {
      _firstOpenFor = firstOpen;
      if (stored != null && uuidPattern.hasMatch(stored)) {
        _installId = stored;
      } else {
        await _ownInstallId();
      }
    } else if (stored != null || firstOpen != null) {
      await _store.forgetInstallId();
    }
    emit(
      AnalyticsState(loaded: true, consent: consent, internalInstall: internal),
    );
  }

  /// Signed in as [user], or signed out (null). Events need a user.
  void setUser(AnalyticsUser? user) {
    _user = user;
    if (user == null) {
      // Nothing from one account is sent under the next.
      _dropQueue();
      _recorded = null;
    }
    _syncConsent();
  }

  /// The user's answer on the consent screen or the More toggle. Yes makes
  /// an install id if there is none and sends `first_open` once per install
  /// id; no drops the queue at once and deletes the install id, so a later
  /// yes starts with a new one.
  Future<void> decide({required bool granted}) async {
    emit(_with(consent: granted));
    if (!granted) {
      // The server learns the no under the id it had (job 31) before it goes.
      _syncConsent(answered: true, installId: _installId);
      _dropQueue();
      _installId = null;
      _firstOpenFor = null;
      await _store.saveConsent(granted: false);
      await _store.forgetInstallId();
      return;
    }
    await _store.saveConsent(granted: true);
    final id = _installId ?? await _ownInstallId();
    _syncConsent(answered: true);
    if (_firstOpenFor != id && _live) {
      _firstOpenFor = id;
      track('first_open');
      await _store.saveFirstOpenSentFor(id);
    }
  }

  Future<String> _ownInstallId() async {
    final id = _installId = const Uuid().v4();
    await _store.saveInstallId(id);
    return id;
  }

  /// More's switch for test devices: every event then says internal.
  Future<void> markInternalInstall({required bool internal}) async {
    emit(_with(internalInstall: internal));
    _syncConsent();
    await _store.saveInternalInstall(internal: internal);
  }

  /// Queues [event] if analytics is live; refuses (and drops) anything
  /// [checkEvent] does not allow.
  void track(String event, [Map<String, Object> properties = const {}]) {
    if (!_live) {
      return;
    }
    try {
      checkEvent(event, properties);
    } on RefusedEvent catch (e) {
      debugPrint('analytics: $e');
      return;
    }
    _enqueue(event, properties);
  }

  /// Queues an error for PostHog error tracking, scrubbed
  /// ([exceptionList]); same rules as events.
  void captureException(
    Object error,
    StackTrace? stack, {
    bool handled = false,
  }) {
    if (!_live) {
      return;
    }
    try {
      _enqueue(r'$exception', {
        r'$exception_level': 'error',
        r'$exception_list': exceptionList(
          error,
          stack,
          handled: handled,
          chunkIds: currentChunkIds(),
        ),
      });
    } on Object catch (e) {
      // Reporting an error must never raise one.
      debugPrint('analytics: exception not captured: ${e.runtimeType}');
    }
  }

  /// Sends what is queued, after a send already on its way. A failed batch
  /// goes back to the front and is tried again later; PostHog drops repeats
  /// by `uuid`.
  Future<void> flush() async {
    _flushTimer?.cancel();
    _flushTimer = null;
    for (var pending = _inFlight; pending != null; pending = _inFlight) {
      await pending;
    }
    final sink = _sink;
    if (sink == null || _queue.isEmpty || !_live) {
      return;
    }
    final batch = [..._queue];
    _queue.clear();
    final sending = _send(sink, batch);
    _inFlight = sending;
    try {
      await sending;
    } finally {
      _inFlight = null;
    }
    _schedule();
  }

  Future<void> _send(
    AnalyticsSink sink,
    List<Map<String, Object?>> batch,
  ) async {
    try {
      await sink.send(batch);
      _failures = 0;
    } on Object {
      _failures++;
      // Only if still allowed: a "no" during the request drops it.
      if (_live) {
        _queue.insertAll(0, batch);
        _trim();
      }
    }
  }

  bool get _live =>
      _sink != null &&
      state.consent == true &&
      _user != null &&
      _installId != null &&
      !isClosed;

  void _enqueue(String event, Map<String, Object> properties) {
    final id = const Uuid().v4();
    final user = _user!;
    final context = <String, Object?>{
      'distinct_id': _installId,
      'event_id': id,
      'install_id': _installId,
      'household_id': user.householdId,
      'platform': _config.platform,
      'app_version': _config.appVersion,
      'is_internal': internalNow,
      r'$geoip_disable': true,
      r'$process_person_profile': false,
      r'$lib': 'hummlist-app',
      r'$lib_version': _config.appVersion,
      if (_config.householdGroups && user.householdId != null)
        r'$groups': {'household': user.householdId},
    };
    try {
      checkContext(context);
    } on RefusedEvent catch (e) {
      debugPrint('analytics: $e');
      return;
    }
    _queue.add({
      'event': event,
      'uuid': id,
      'timestamp': _clock().toUtc().toIso8601String(),
      'properties': {...properties, ...context},
    });
    _trim();
    if (_queue.length >= _config.flushAt) {
      unawaited(flush());
    } else {
      _schedule();
    }
  }

  void _schedule() {
    if (_queue.isEmpty || _flushTimer != null || isClosed) {
      return;
    }
    // Backs off to a minute while the host can't be reached.
    final factor = 1 << (_failures < 4 ? _failures : 4);
    final delay = _config.flushEvery * factor;
    _flushTimer = Timer(
      delay < const Duration(minutes: 1) ? delay : const Duration(minutes: 1),
      () => unawaited(flush()),
    );
  }

  void _trim() {
    if (_queue.length > _config.maxQueue) {
      _queue.removeRange(0, _queue.length - _config.maxQueue);
    }
  }

  void _dropQueue() {
    _queue.clear();
    _flushTimer?.cancel();
    _flushTimer = null;
  }

  /// Records the answer of this install for the signed-in user: always when
  /// the user just [answered], otherwise (sign-in, start) once per change. A
  /// failure is retried on the next sign-in or app start.
  void _syncConsent({bool answered = false, String? installId}) {
    final record = recordConsent;
    final consent = state.consent;
    final user = _user;
    if (!enabled || record == null || consent == null || user == null) {
      return;
    }
    // A yes always has an install id; a no keeps the one it had, if any.
    final id = answered ? installId ?? _installId : _installId;
    if (consent && id == null) {
      return;
    }
    final internal = internalNow;
    final key = '${user.email}|$consent|$internal|$id';
    if (!answered && key == _recorded) {
      return;
    }
    _recorded = key;
    unawaited(
      Future.sync(
        () => record(
          installId: id,
          consent: consent,
          internal: internal,
          answered: answered,
        ),
      ).catchError((Object e) {
        if (_recorded == key) {
          _recorded = null;
        }
        debugPrint('analytics: consent not recorded: ${e.runtimeType}');
      }),
    );
  }

  AnalyticsState _with({bool? consent, bool? internalInstall}) =>
      AnalyticsState(
        loaded: state.loaded,
        consent: consent ?? state.consent,
        internalInstall: internalInstall ?? state.internalInstall,
      );

  @override
  Future<void> close() {
    _flushTimer?.cancel();
    return super.close();
  }
}

/// The properties every event carries, and only those. Throws
/// [RefusedEvent] for an unknown key or a value of the wrong shape.
void checkContext(Map<String, Object?> context) {
  bool ok(String key, Object? value) => switch (key) {
    'distinct_id' ||
    'install_id' ||
    'event_id' => value is String && uuidPattern.hasMatch(value),
    'household_id' =>
      value == null || value is String && anyUuidPattern.hasMatch(value),
    'platform' => value is String && platforms.contains(value),
    'app_version' ||
    r'$lib_version' => value is String && versionPattern.hasMatch(value),
    'is_internal' => value is bool,
    r'$geoip_disable' => value == true,
    r'$process_person_profile' => value == false,
    r'$lib' => value == 'hummlist-app',
    r'$groups' =>
      value is Map &&
          value.length == 1 &&
          value['household'] is String &&
          anyUuidPattern.hasMatch(value['household'] as String),
    _ => false,
  };
  for (final MapEntry(:key, :value) in context.entries) {
    if (!ok(key, value)) {
      throw RefusedEvent('context property $key refused');
    }
  }
}
