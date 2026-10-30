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
/// ranges, null checks, bad states, layout) keep the shape of their first
/// line: anything quoted, any e-mail address, URL, UUID or number replaced,
/// and every word outside the runtime's own templates ([_templateWords])
/// reduced to `<w>`, so `cannot parse Hafermilch` reads `cannot <w>`.
/// Everything else (a server error echoing a value, a
/// format error quoting its input, an exception of the app's own) keeps
/// only a code that looks like one (`invalid_invite`, `23505`) or nothing.
String scrubMessage(Object error) {
  if (!_runtimeError(error)) {
    final code = _codeOf(error);
    return code != null && _codeLike.hasMatch(code) ? code : '<redacted>';
  }
  final text = error is FlutterError ? error.message : error.toString();
  final firstLine = text.split('\n').first;
  return _clip(_shape(_scrub(firstLine)), 120);
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

/// Words of the Dart runtime's and Flutter's own error templates, the same
/// list as the edge functions' `telemetry.ts` plus Dart's and Flutter's.
/// Any other word came from a value (an item, a name, a key).
final _templateWords = {
  ...'''
  a abort aborted access already an and argument arguments array assignment
  async at await been before between bigint body bounds buffer call called
  cannot character class code column constant constructor convert create date
  decode declared deep defined detached digits element empty encode end error
  exceeded expected explicit expression extensible failed fetch field flags
  fraction frozen function generator getter has in index initial
  initialization input instance invalid is iterable iterator json keyword left
  length line literal locked malformed maximum member method missing mix mode
  must network new non not null number object of offset on only or out
  position precision primitive private promise properties property radix range
  read reading recursion redefine reduce regular request reserved response
  right sealed set setter setting side size stack strict stream string super
  symbol the this time timed to token too type types undefined unexpected
  unterminated uri use used valid value variable with without writable
  '''
      .split(_space),
  // Dart and Flutter.
  ...'''
  after assertion bad be bottom by calling cast check completed concurrent
  during elements fixed for from future inclusive initialized iteration late
  less list many memory modification no operation operator overflow
  overflowed pixels rangeerror receiver renderflex should state subtype than
  top tried unmodifiable unsupported was
  '''
      .split(_space),
}..remove('');

final _space = RegExp(r'\s+');
final _word = RegExp(
  r'<[a-z]+>|[\p{L}\p{N}_$]+(?:\.[\p{L}\p{N}_$]+)*',
  unicode: true,
);
final _marker = RegExp(r'^<(?:url|email|redacted|uuid|n)>$');
final _numeric = RegExp(r'^\p{N}+(?:\.\p{N}+)*$', unicode: true);
final _wordRun = RegExp(r'<w>(?:\s*<w>)+');

/// [text] with numbers as `<n>` and words outside [_templateWords] as
/// `<w>`, a run of them collapsed into one.
String _shape(String text) => text
    .replaceAllMapped(
      _word,
      (match) => switch (match[0]!) {
        final marker when _marker.hasMatch(marker) => marker,
        final number when _numeric.hasMatch(number) => '<n>',
        final word when _templateWords.contains(word.toLowerCase()) => word,
        _ => '<w>',
      },
    )
    .replaceAll(_wordRun, '<w>');

String _clip(String text, int max) =>
    text.length <= max ? text : text.substring(0, max);

/// posthog-cli's chunk ids on web, none elsewhere.
Map<String, String> currentChunkIds() => chunkIds();
