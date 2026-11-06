import 'dart:async';
import 'dart:convert';

import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/item_icons.g.dart';
import 'package:http/http.dart' as http;

/// The remote item icon table (`site/public/data/item-icons.v1.json`, job
/// 147) once it passed [parseItemIconsFile]: entries in the generated
/// table's form, `''` for a stop.
final class const ItemIconsFile({
  required final int revision,
  required final Map<String, String> entries,
});

/// Larger bodies are not read: the generated file is about a tenth of it.
const itemIconsMaxBytes = 256 * 1024;

const _maxEntries = 10000;
const _maxEmojiUnits = 16;
final _key = RegExp(r'^=?[a-z]+( [a-z]+){0,2}$');
final _letterOrDigit = RegExp(r'[\p{L}\p{N}]', unicode: true);

/// Spaces and invisible format characters (bidi overrides and the like),
/// but the zero-width joiner emoji are built with (the emoji variation
/// selector is a mark, not a format character).
final _invisible = RegExp(r'[\p{Z}\p{Cc}]|(?!\u200D)\p{Cf}', unicode: true);

/// [body] as schema 1 of the table, or null when anything about it is off:
/// one bad entry rejects the file, the app then keeps what it has.
ItemIconsFile? parseItemIconsFile(String body) {
  if (body.length > itemIconsMaxBytes ||
      utf8.encode(body).length > itemIconsMaxBytes) {
    return null;
  }
  final Object? json;
  try {
    json = jsonDecode(body);
  } on FormatException {
    return null;
  }
  if (json
      case {
        'schema': 1,
        'revision': final int revision,
        'entries': final Map<String, Object?> raw,
      }
      when revision > 0 && raw.length <= _maxEntries) {
    final entries = <String, String>{};
    for (final MapEntry(:key, :value) in raw.entries) {
      if (value is! String || !_validKey(key) || !_validEmoji(value)) {
        return null;
      }
      entries[key] = value;
    }
    return ItemIconsFile(revision: revision, entries: entries);
  }
  return null;
}

bool _validKey(String key) =>
    _key.hasMatch(key) && key.replaceAll(RegExp('[= ]'), '').length >= 2;

/// `''` (a stop) or a short emoji: no ASCII, no letters or digits.
bool _validEmoji(String value) =>
    value.isEmpty ||
    (value.length <= _maxEmojiUnits &&
        value.codeUnits.every((unit) => unit > 0x7f) &&
        !_letterOrDigit.hasMatch(value) &&
        !_invisible.hasMatch(value));

/// What the device keeps of the last check: the body and ETag of the last
/// 200 (none before the first good one) and when the server last answered.
final class const CachedItemIcons({
  required final DateTime checkedAt,
  final String? body,
  final String? etag,
});

/// The cached table on this device: `DeviceCache` in the app.
abstract interface class ItemIconsStore() {
  Future<CachedItemIcons?> cachedItemIcons();

  Future<void> saveCachedItemIcons(CachedItemIcons cached);
}

/// Applies the remote item icon table over the bundled one: the cached copy
/// at start, then at most once a day a fresh one from [url] (null: never).
///
/// The request is a plain GET; its only header is `If-None-Match` with the
/// cached ETag. On the web the ETag is not exposed cross-origin, so none is
/// cached and the GET stays a simple CORS request; the browser's HTTP cache
/// revalidates on its own there.
final class ItemIconsLoader({
  required final ItemIconsStore store,
  required final ItemIconsCubit cubit,
  required final http.Client client,
  required final Uri? url,
  final DateTime Function() now = DateTime.now,
  final int bundledRevision = itemIconsRevision,
}) {
  static const checkEvery = Duration(hours: 24);
  static const timeout = Duration(seconds: 10);

  late int _applied = bundledRevision;

  Future<void> start() async {
    final cached = await store.cachedItemIcons();
    if (cached?.body case final body?) {
      _apply(parseItemIconsFile(body));
    }
    final source = url;
    // A check time ahead of the clock (the clock was set back) is due too.
    final age = switch (cached) {
      final cached? => now().difference(cached.checkedAt),
      null => null,
    };
    if (source == null ||
        (age != null && !age.isNegative && age < checkEvery)) {
      return;
    }
    final answer = await _fetch(source, cached?.etag);
    final kept = CachedItemIcons(
      checkedAt: now(),
      body: cached?.body,
      etag: cached?.etag,
    );
    switch (answer) {
      case _Unreachable():
        return;
      // A bad file or a 404 is not fetched again on every start either.
      case _NotModified() || _Rejected() || _NoFile():
        await store.saveCachedItemIcons(kept);
      case _Fetched(:final body, :final etag, :final file):
        await store.saveCachedItemIcons(
          CachedItemIcons(checkedAt: kept.checkedAt, body: body, etag: etag),
        );
        _apply(file);
    }
  }

  void _apply(ItemIconsFile? file) {
    if (file != null && file.revision > _applied) {
      _applied = file.revision;
      cubit.use(ItemIcons.bundled.over(file.entries));
    }
  }

  Future<_Answer> _fetch(Uri source, String? etag) async {
    final request = http.Request('GET', source);
    if (etag != null) {
      request.headers['If-None-Match'] = etag;
    }
    try {
      return await _send(request).timeout(timeout);
    } on Object {
      return const _Unreachable();
    }
  }

  Future<_Answer> _send(http.Request request) async {
    final response = await client.send(request);
    switch (response.statusCode) {
      case 304:
        return const _NotModified();
      case 200:
        if ((response.contentLength ?? 0) > itemIconsMaxBytes) {
          return const _Rejected();
        }
        final bytes = <int>[];
        await for (final chunk in response.stream) {
          bytes.addAll(chunk);
          if (bytes.length > itemIconsMaxBytes) {
            return const _Rejected();
          }
        }
        final String body;
        try {
          body = utf8.decode(bytes);
        } on FormatException {
          return const _Rejected();
        }
        return switch (parseItemIconsFile(body)) {
          final file? => _Fetched(body, response.headers['etag'], file),
          null => const _Rejected(),
        };
      default:
        return const _NoFile();
    }
  }
}

sealed class const _Answer();

/// No answer at all (offline, a timeout): asked again at the next start.
final class const _Unreachable() extends _Answer;

/// The server answered without a file (a 404, a 5xx): asked again a day
/// later, like any answer.
final class const _NoFile() extends _Answer;

final class const _NotModified() extends _Answer;

/// A 200 whose body is too large or not a valid table.
final class const _Rejected() extends _Answer;

final class const _Fetched(
  final String body,
  final String? etag,
  final ItemIconsFile file,
) extends _Answer;
