import 'dart:async';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/analytics/exceptions.dart';
import 'package:family_groceries/analytics/flags.dart';
import 'package:family_groceries/analytics/internal.dart';
import 'package:family_groceries/analytics/posthog_client.dart';
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
});

/// Product analytics, error tracking and feature flags for PostHog EU, on
/// the posthog_flutter SDK (docs/ANALYTICS.md).
///
/// The SDK is set up only after a yes on this install and stopped by a no,
/// so before the yes nothing at all goes to PostHog, flag requests
/// included. Events and errors also need someone signed in. Every Dart-side
/// event passes [checkEvent] and [checkContext] twice: here, and in the
/// SDK's `beforeSend` ([_admit]), which also scrubs error reports.
class Analytics(
  final PostHogClient? _posthog,
  final AnalyticsStore _store,
  final AnalyticsConfig _config,
) extends Cubit<AnalyticsState> {
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

  /// The runtime toggles PostHog serves this install, all off until then.
  final flags = Flags();

  String? _installId;
  AnalyticsUser? _user;

  /// The SDK is set up and not stopped.
  var _running = false;

  /// SDK set-ups and stops, one after the other.
  Future<void> _lifecycle = Future.value();

  /// Set by the session: where this install's answer goes for the signed-in
  /// user.
  ConsentRecorder? recordConsent;

  /// The answer last recorded, so a token refresh does not record it again.
  String? _recorded;

  /// The install id `first_open` went out for, claimed before the write so
  /// two quick yeses send one.
  String? _firstOpenFor;

  /// Whether this build can send at all.
  bool get enabled => _posthog != null;

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
    testerHousehold: testerHousehold,
  );

  /// Set by the household's entitlements: the household a tester's grant
  /// unlocks, if any.
  String? get testerHousehold => _testerHousehold;
  set testerHousehold(String? household) {
    _testerHousehold = household;
    _registerContext();
  }

  String? _testerHousehold;

  /// Whether the consent screen is due: the build can send and this
  /// install has not decided yet.
  bool get asksConsent => enabled && state.loaded && state.consent == null;

  /// Reads the decision; after a yes it starts the SDK with the install id
  /// in the background. Without a yes no install id is kept, and one stored
  /// by an older build is deleted. Call once before the first frame.
  Future<void> load() async {
    final (stored, consent, internal, firstOpen) = await (
      _store.installId(),
      _store.consent(),
      _store.internalInstall(),
      _store.firstOpenSentFor(),
    ).wait;
    if (consent == true) {
      _firstOpenFor = firstOpen;
      _installId = stored != null && anyUuidPattern.hasMatch(stored)
          ? stored
          : null;
    } else if (stored != null || firstOpen != null) {
      await _store.forgetInstallId();
    }
    if (consent == false) {
      // An off whose clean-up did not finish (the app was closed) ends here.
      unawaited(_serially(_forgetSdkState));
    }
    emit(
      AnalyticsState(loaded: true, consent: consent, internalInstall: internal),
    );
    if (consent == true) {
      unawaited(_serially(() => _start(fresh: false)));
    }
  }

  /// Signed in as [user], or signed out (null). Events need a user.
  void setUser(AnalyticsUser? user) {
    _user = user;
    if (user == null) {
      _recorded = null;
    }
    _syncConsent();
    _registerContext();
  }

  /// The user's answer on the consent screen or the More toggle. Yes starts
  /// the SDK with a new install id (unless it runs already) and sends
  /// `first_open` once per install id; no stops the SDK and deletes the
  /// install id, so a later yes starts with a new one.
  Future<void> decide({required bool granted}) async {
    emit(_with(consent: granted));
    if (!granted) {
      // The server learns the no under the id it had (job 31) before it goes.
      _syncConsent(answered: true, installId: _installId);
      _installId = null;
      _firstOpenFor = null;
      flags.clear();
      await _store.saveConsent(granted: false);
      await _store.forgetInstallId();
      await _serially(_stop);
      return;
    }
    // Queued before the first await, so an event tracked right after the
    // yes waits for the start.
    final starting = _serially(() => _start(fresh: true));
    await _store.saveConsent(granted: true);
    await starting;
    final id = _installId;
    if (id == null) {
      return;
    }
    _syncConsent(answered: true);
    if (_firstOpenFor != id && _live) {
      _firstOpenFor = id;
      track('first_open');
      await _store.saveFirstOpenSentFor(id);
    }
  }

  Future<void> _serially(Future<void> Function() step) =>
      _lifecycle = _lifecycle.then((_) => step());

  /// Sets the SDK up. A [fresh] yes gets a new install id: the SDK seeds a
  /// new one, or, if it kept an id from an earlier yes on this device,
  /// replaces it.
  Future<void> _start({required bool fresh}) async {
    final posthog = _posthog;
    if (posthog == null || _running || state.consent != true || isClosed) {
      return;
    }
    final seed = fresh ? const Uuid().v4() : _installId;
    try {
      var id = await posthog.start(
        installId: seed,
        admit: _admit,
        onFlags: () => unawaited(_refreshFlags()),
      );
      if (fresh && id != seed) {
        id = await posthog.newDistinctId();
      }
      if (state.consent != true) {
        // A no came while the SDK started.
        await posthog.stop();
        return;
      }
      _running = true;
      if (id != _installId) {
        _installId = id;
        await _store.saveInstallId(id);
        if (!fresh) {
          _syncConsent();
        }
      }
      _registerContext();
      unawaited(_refreshFlags());
    } on Object catch (e) {
      debugPrint('analytics: PostHog did not start: ${e.runtimeType}');
    }
  }

  Future<void> _stop() async {
    if (!_running) {
      return;
    }
    _running = false;
    flags.clear();
    try {
      await _posthog?.stop();
    } on Object catch (e) {
      debugPrint('analytics: PostHog did not stop: ${e.runtimeType}');
    }
  }

  Future<void> _forgetSdkState() async {
    try {
      await _posthog?.forget();
    } on Object catch (e) {
      debugPrint('analytics: PostHog state not deleted: ${e.runtimeType}');
    }
  }

  Future<void> _refreshFlags() async {
    final posthog = _posthog;
    if (posthog == null || !_running) {
      return;
    }
    try {
      final values = await posthog.flags();
      if (_running) {
        flags.replace(values);
      }
    } on Object catch (e) {
      debugPrint('analytics: flags not read: ${e.runtimeType}');
    }
  }

  /// More's switch for test devices: every event then says internal.
  Future<void> markInternalInstall({required bool internal}) async {
    emit(_with(internalInstall: internal));
    _syncConsent();
    _registerContext();
    await _store.saveInternalInstall(internal: internal);
  }

  /// Hands [event] to PostHog if analytics is live; refuses (and drops)
  /// anything [checkEvent] does not allow.
  void track(String event, [Map<String, Object> properties = const {}]) {
    if (!_willSend) {
      return;
    }
    try {
      checkEvent(event, properties);
    } on RefusedEvent catch (e) {
      debugPrint('analytics: $e');
      return;
    }
    _whenRunning(
      (posthog, context) => posthog.capture(event, {...properties, ...context}),
    );
  }

  /// Reports an error to PostHog error tracking, scrubbed
  /// ([scrubMessage]); same rules as events.
  void captureException(
    Object error,
    StackTrace? stack, {
    bool handled = false,
  }) {
    if (!_willSend) {
      return;
    }
    final (inner, trace) = switch (error) {
      AsyncError(:final error, :final stackTrace) => (
        error,
        stack ?? stackTrace,
      ),
      _ => (error, stack),
    };
    final Map<String, Object> report;
    try {
      report = {
        'type': errorType(inner),
        'value': scrubMessage(inner),
        'handled': handled,
      };
    } on Object catch (e) {
      // Reporting an error must never raise one.
      debugPrint('analytics: exception not captured: ${e.runtimeType}');
      return;
    }
    _whenRunning(
      (posthog, context) => posthog.captureException(inner, trace, {
        ...context,
        _reportKey: report,
      }),
    );
  }

  /// Hands an event to the SDK once it runs, so one captured while it starts
  /// (right after the yes, or at app start) is not lost, with the context of
  /// that moment; dropped if analytics is no longer live by then.
  void _whenRunning(
    Future<void> Function(PostHogClient posthog, Map<String, Object> context)
    send,
  ) {
    void now() {
      if (!_live) {
        return;
      }
      try {
        final context = _context();
        checkContext(context);
        unawaited(send(_posthog!, context));
      } on Object catch (e) {
        debugPrint('analytics: not sent: $e');
      }
    }

    if (_live) {
      now();
    } else {
      unawaited(_lifecycle.then((_) => now()));
    }
  }

  /// Keeps the context as the SDK's super properties, so an event the SDK
  /// builds itself, a native crash report, carries it too: above all
  /// `$geoip_disable` and `is_internal`.
  void _registerContext() {
    final posthog = _posthog;
    final id = _installId;
    if (posthog == null || !_running || id == null) {
      return;
    }
    unawaited(
      posthog
          .register({
            'install_id': id,
            'household_id': _user?.householdId,
            'platform': _config.platform,
            'app_version': _config.appVersion,
            'is_internal': internalNow,
            r'$geoip_disable': true,
          })
          .catchError((Object e) {
            debugPrint('analytics: context not registered: ${e.runtimeType}');
          }),
    );
  }

  /// Hands what the SDK holds to PostHog now.
  Future<void> flush() async {
    await _lifecycle;
    if (_running) {
      await _posthog?.flush();
    }
  }

  /// Events are taken: the build can send, the answer is yes, someone is
  /// signed in.
  bool get _willSend =>
      _posthog != null && state.consent == true && _user != null && !isClosed;

  /// And the SDK runs with the install id.
  bool get _live => _willSend && _running && _installId != null;

  Map<String, Object> _context() {
    final user = _user!;
    final household = user.householdId;
    return {
      'install_id': _installId!,
      'household_id': ?household,
      'platform': _config.platform,
      'app_version': _config.appVersion,
      'is_internal': internalNow,
      r'$geoip_disable': true,
      r'$process_person_profile': false,
      if (_config.householdGroups && household != null)
        r'$groups': {'household': household},
    };
  }

  /// The SDK's `beforeSend`: what of [event] may leave the app, or null.
  /// Events are checked again, since consent or the user may have changed
  /// since [track]; an error report keeps its context and the scrubbed
  /// `$exception_list` only, and comes only from [captureException].
  Map<String, Object>? _admit(String event, Map<String, Object> captured) {
    if (!_live) {
      return null;
    }
    // The SDK adds the last screen it was told of; a route can carry an
    // invite code.
    final properties = {...captured}..remove(r'$screen_name');
    final context = {
      for (final MapEntry(:key, :value) in properties.entries)
        if (contextKeys.contains(key)) key: value,
    };
    try {
      checkContext(context);
      if (event != r'$exception') {
        checkEvent(event, {
          for (final MapEntry(:key, :value) in properties.entries)
            if (!contextKeys.contains(key)) key: value,
        });
        return properties;
      }
    } on RefusedEvent catch (e) {
      debugPrint('analytics: $e');
      return null;
    }
    final report = properties[_reportKey];
    final list = properties[r'$exception_list'];
    if (report is! Map<String, Object> || list is! List || list.isEmpty) {
      return null;
    }
    return {
      ...context,
      r'$exception_level': 'error',
      r'$exception_list': [
        for (final (index, item) in list.indexed)
          if (item is Map) scrubException(item, index == 0 ? report : null),
      ],
    };
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
  Future<void> close() async {
    await flags.close();
    await super.close();
  }
}

/// Where [Analytics.captureException] hands the scrubbed type and message
/// to [Analytics._admit]; never sent.
const _reportKey = 'hummlist_report';

/// The properties every event carries ([contextKeys]), and only those.
/// Throws [RefusedEvent] for an unknown key, a value of the wrong shape or
/// a missing install id.
void checkContext(Map<String, Object?> context) {
  bool ok(String key, Object? value) => switch (key) {
    'install_id' => value is String && anyUuidPattern.hasMatch(value),
    'household_id' => value is String && anyUuidPattern.hasMatch(value),
    'platform' => value is String && platforms.contains(value),
    'app_version' => value is String && versionPattern.hasMatch(value),
    'is_internal' => value is bool,
    r'$geoip_disable' => value == true,
    r'$process_person_profile' => value == false,
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
  if (!context.containsKey('install_id')) {
    throw const RefusedEvent('context without install_id');
  }
}
