import 'dart:convert';

import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/snapshot_codec.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'snapshot_generator.dart';

/// The web side of hc-cache-codec (tool/hillclimb/hc-cache-codec/web.sh
/// builds this as a release web app): saves and loads the bench snapshots
/// through shared preferences (localStorage), once as main stored them
/// (`jsonEncode(toJson())`) and once as v4, and prints one `HC_WEB` line.
Future<void> main() async {
  final prefs = SharedPreferencesAsync();
  const key = 'list.probe';
  final paths =
      <String, (String Function(ListSnapshot), ListSnapshot Function(String))>{
        'main': (
          (s) => jsonEncode(s.toJson()),
          (s) => ListSnapshot.fromJson(jsonDecode(s) as Map<String, Object?>),
        ),
        'v4': (encodeSnapshot, decodeSnapshot),
      };
  final result = <String, Object?>{};
  for (final (name, snapshot) in [
    ('full', generateSnapshot(seed: 132, items: 5000, openShare: 0.06)),
    ('open', generateSnapshot(seed: 133, items: 300, openShare: 1)),
  ]) {
    final expected = jsonEncode(snapshot.toJson());
    for (final MapEntry(key: format, value: (encode, decode))
        in paths.entries) {
      final save = <int>[];
      final load = <int>[];
      var roundTrip = true;
      var bytes = 0;
      String? error;
      for (var i = 0; i < 40; i++) {
        try {
          final w = Stopwatch()..start();
          final stored = encode(snapshot);
          await prefs.setString(key, stored);
          w.stop();
          final r = Stopwatch()..start();
          final back = decode((await prefs.getString(key))!);
          r.stop();
          roundTrip = roundTrip && jsonEncode(back.toJson()) == expected;
          bytes = utf8.encode(stored).length;
          if (i >= 10) {
            save.add(w.elapsedMicroseconds);
            load.add(r.elapsedMicroseconds);
          }
        } on Object catch (e) {
          error = '$e';
          roundTrip = false;
          break;
        }
      }
      await prefs.remove(key);
      result['${name}_$format'] = {
        'save_ms': ?_p50ms(save),
        'load_ms': ?_p50ms(load),
        'bytes': bytes,
        'round_trip': roundTrip,
        'error': ?error,
      };
    }
  }
  // ignore: avoid_print -- the probe's output is read from the console.
  print('HC_WEB ${jsonEncode(result)}');
}

double? _p50ms(List<int> us) {
  if (us.isEmpty) {
    return null;
  }
  final sorted = [...us]..sort();
  return sorted[sorted.length ~/ 2] / 1000;
}
