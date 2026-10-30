import 'dart:async';

import 'package:family_groceries/analytics/chunk_ids.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:stack_trace/stack_trace.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Builds PostHog's `$exception_list` for [error], the same shape
/// posthog_flutter sends (type, value, mechanism, raw frames), with the
/// message scrubbed by [scrubMessage]. Frames carry code locations only.
List<Map<String, Object?>> exceptionList(
  Object error,
  StackTrace? stack, {
  required bool handled,
  bool web = kIsWeb,
  Map<String, String> chunkIds = const {},
}) {
  final inner = error is AsyncError ? error.error : error;
  final trace = switch (stack) {
    final s? when s.toString().trim().isNotEmpty => s,
    _ =>
      error is AsyncError
          ? error.stackTrace
          : inner is Error
          ? inner.stackTrace
          : null,
  };
  final frames = trace == null || trace.toString().trim().isEmpty
      ? const <Map<String, Object?>>[]
      : _frames(trace, web: web, chunkIds: chunkIds);
  return [
    {
      'type': _typeOf(inner),
      'value': scrubMessage(inner),
      'mechanism': {
        'handled': handled,
        'synthetic': frames.isEmpty,
        'type': 'generic',
      },
      if (frames.isNotEmpty) 'stacktrace': {'type': 'raw', 'frames': frames},
    },
  ];
}

/// The error's type. Release web builds minify type names (`minified:hm`),
/// so the common ones are named here.
String _typeOf(Object error) => switch (error) {
  StateError() => 'StateError',
  IndexError() => 'IndexError',
  RangeError() => 'RangeError',
  ArgumentError() => 'ArgumentError',
  TypeError() => 'TypeError',
  NoSuchMethodError() => 'NoSuchMethodError',
  UnimplementedError() => 'UnimplementedError',
  UnsupportedError() => 'UnsupportedError',
  ConcurrentModificationError() => 'ConcurrentModificationError',
  StackOverflowError() => 'StackOverflowError',
  OutOfMemoryError() => 'OutOfMemoryError',
  FlutterError() => 'FlutterError',
  AssertionError() => 'AssertionError',
  FormatException() => 'FormatException',
  TimeoutException() => 'TimeoutException',
  PostgrestException() => 'PostgrestException',
  AuthException() => 'AuthException',
  FunctionException() => 'FunctionException',
  HouseholdError() => 'HouseholdError',
  _ => _runtimeName(error),
};

String _runtimeName(Object error) {
  final name = '${error.runtimeType}';
  return name.isEmpty ? 'Error' : name;
}

/// At most this many frames per exception, the crash site's end kept.
const maxFrames = 80;

/// The crash site last, as PostHog expects.
List<Map<String, Object?>> _frames(
  StackTrace stack, {
  required bool web,
  required Map<String, String> chunkIds,
}) {
  // Parsed from the text: forTrace would add the current zone's chain.
  final chain = Chain.parse(stack.toString());
  final frames = <Map<String, Object?>>[];
  for (final (index, trace) in chain.traces.indexed) {
    for (final frame in trace.frames) {
      frames.add(_frame(frame, web: web, chunkIds: chunkIds));
    }
    if (index < chain.traces.length - 1) {
      frames.add(const {
        'platform': 'dart',
        'abs_path': '<asynchronous suspension>',
        'in_app': false,
        'synthetic': true,
      });
    }
  }
  final innermost = frames.length > maxFrames
      ? frames.sublist(0, maxFrames)
      : frames;
  return innermost.reversed.toList();
}

Map<String, Object?> _frame(
  Frame frame, {
  required bool web,
  required Map<String, String> chunkIds,
}) {
  final uri = frame.uri;
  final segments = uri.pathSegments;
  final fileName = segments.isEmpty ? null : segments.last;
  // The file's own id: `main.dart.js` is not `main.dart.js_1.part.js`.
  final chunkId = fileName == null
      ? null
      : chunkIds.entries
            .where(
              (e) => Uri.tryParse(e.key)?.pathSegments.lastOrNull == fileName,
            )
            .firstOrNull;
  // A file on a device or a web URL keeps its name only: no user paths,
  // no query strings.
  final absPath = uri.scheme == 'dart' || uri.scheme == 'package'
      ? uri.toString()
      : (fileName ?? '');
  return {
    'platform': web ? 'web:javascript' : 'dart',
    'abs_path': absPath,
    'in_app': !frame.isCore && frame.package != 'flutter',
    if (frame.package case final package? when package.isNotEmpty)
      'package': package,
    if (frame.member case final member? when member.isNotEmpty)
      'function': _clip(member, 200),
    if (fileName != null && fileName.isNotEmpty) 'filename': fileName,
    'lineno': ?frame.line,
    'colno': ?frame.column,
    if (chunkId != null) 'chunk_id': chunkId.value,
  };
}

/// What may be said about [error] without personal data or list content.
///
/// Errors the Dart runtime and Flutter raise themselves (type errors,
/// ranges, null checks, bad states, layout) keep the first line of their
/// message, with anything quoted, any e-mail address, URL, UUID or long
/// number replaced. Everything else (a server error echoing a value, a
/// format error quoting its input, an exception of the app's own) keeps
/// only a code that looks like one (`invalid_invite`, `23505`) or nothing.
String scrubMessage(Object error) {
  if (!_runtimeError(error)) {
    final code = _codeOf(error);
    return code != null && _codeLike.hasMatch(code) ? code : '<redacted>';
  }
  final text = error is FlutterError ? error.message : error.toString();
  final firstLine = text.split('\n').first;
  return _clip(_scrub(firstLine), 300);
}

/// Errors whose message the runtime or the framework writes. App code can
/// raise a `StateError` with its own text too, so the text is scrubbed all
/// the same.
bool _runtimeError(Object error) =>
    error is TypeError ||
    error is RangeError ||
    error is NoSuchMethodError ||
    error is StateError ||
    error is UnsupportedError ||
    error is ConcurrentModificationError ||
    error is StackOverflowError ||
    error is OutOfMemoryError ||
    error is AssertionError ||
    error is FlutterError ||
    error is TimeoutException;

/// The code a server or library error carries beside its message.
String? _codeOf(Object error) => switch (error) {
  PostgrestException(:final code) => code,
  AuthException(:final code, :final statusCode) => code ?? statusCode,
  FunctionException(:final status) => '$status',
  HouseholdError(:final problem) => problem.name,
  _ => null,
};

final _codeLike = RegExp(r'^[A-Za-z0-9_.:-]{1,64}$');

final _quoted = RegExp(
  '''"[^"]*"|'[^']*'|„[^“”]*[“”]|“[^”]*”|‘[^’]*’|«[^»]*»|`[^`]*`''',
);
final _email = RegExp(r'[^\s@]+@[^\s@]+');
final _url = RegExp(r'[a-z][a-z0-9+.-]*://[^\s]+', caseSensitive: false);
final _uuid = RegExp(
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
  caseSensitive: false,
);
final _longNumber = RegExp('[0-9]{6,}');

String _scrub(String text) => text
    .replaceAll(_url, '<url>')
    .replaceAll(_email, '<email>')
    .replaceAll(_quoted, '<redacted>')
    .replaceAll(_uuid, '<uuid>')
    .replaceAll(_longNumber, '<n>');

String _clip(String text, int max) =>
    text.length <= max ? text : text.substring(0, max);

/// posthog-cli's chunk ids on web, none elsewhere.
Map<String, String> currentChunkIds() => chunkIds();
