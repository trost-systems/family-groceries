import 'dart:convert';
import 'dart:io';

import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import 'snapshot_generator.dart';

/// The hc-cache-codec harness (tool/hillclimb/hc-cache-codec/measure.sh):
/// saves and loads seeded snapshots through [DeviceCache.list], the path
/// the list cubit uses, and writes p50 timings, the stored size and the
/// round-trip check to HC_CODEC_REPORT. Without it, one quick round trip
/// keeps the generator honest in the normal suite.
void main() {
  final report = Platform.environment['HC_CODEC_REPORT'];
  final iterations =
      int.tryParse(Platform.environment['HC_CODEC_ITERATIONS'] ?? '') ?? 30;
  const warmup = 10;
  const seed = 132;
  const user = 'peter';
  const home = Household(
    id: 'c0f1e5d2-0b7a-4e59-9a35-6d2f0e7c1a11',
    name: 'Zuhause',
  );

  late DeviceCache device;
  late SharedPreferencesAsync prefs;

  setUp(() async {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    prefs = SharedPreferencesAsync();
    device = DeviceCache(prefs);
    await device.remember(user, home);
  });

  Future<int> storedBytes() async {
    final keys = await prefs.getKeys();
    final key = keys.singleWhere((k) => k.startsWith('list.'));
    return utf8.encode((await prefs.getString(key))!).length;
  }

  String canonical(ListSnapshot s) => jsonEncode(s.toJson());

  Future<Map<String, Object?>> bench(ListSnapshot snapshot, int n) async {
    final cache = device.list(user, home.id);
    final expected = canonical(snapshot);
    final encodeUs = <int>[];
    final decodeUs = <int>[];
    var roundTrip = true;
    for (var i = 0; i < warmup + n; i++) {
      final w = Stopwatch()..start();
      await cache.save(snapshot);
      w.stop();
      final r = Stopwatch()..start();
      final back = await cache.load();
      r.stop();
      roundTrip = roundTrip && back != null && canonical(back) == expected;
      if (i >= warmup) {
        encodeUs.add(w.elapsedMicroseconds);
        decodeUs.add(r.elapsedMicroseconds);
      }
    }
    return {
      'encode_ms': _p50(encodeUs) / 1000,
      'decode_ms': _p50(decodeUs) / 1000,
      'bytes': await storedBytes(),
      'server_items': snapshot.server.length,
      'pending_ops': snapshot.pending.length,
      'usuals': snapshot.usuals.length,
      'round_trip': roundTrip,
    };
  }

  test(
    'cache codec bench',
    () async {
      final full = generateSnapshot(seed: seed, items: 5000, openShare: 0.06);
      final open = generateSnapshot(seed: seed + 1, items: 300, openShare: 1);
      final results = {
        'full': await bench(full, iterations),
        'open': await bench(open, iterations),
      };
      File(report!).writeAsStringSync(
        jsonEncode({
          'seed': seed,
          'open_seed': seed + 1,
          'iterations': iterations,
          ...results,
        }),
      );
      for (final r in results.values) {
        expect(r['round_trip'], isTrue);
      }
    },
    skip: report == null,
    timeout: const Timeout(Duration(minutes: 10)),
  );

  test('a generated snapshot round-trips through the device cache', () async {
    final snapshot = generateSnapshot(seed: seed, items: 200, openShare: 0.5);
    final cache = device.list(user, home.id);
    await cache.save(snapshot);
    final back = await cache.load();
    expect(back, isNotNull);
    expect(canonical(back!), canonical(snapshot));
    expect(
      {for (final op in back.pending) op.runtimeType},
      hasLength(8),
      reason: 'every op kind is in the generated queue',
    );
  });
}

double _p50(List<int> us) {
  final sorted = [...us]..sort();
  final mid = sorted.length ~/ 2;
  return sorted.length.isOdd
      ? sorted[mid].toDouble()
      : (sorted[mid - 1] + sorted[mid]) / 2;
}
