import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'sim.dart';

/// Seeds as `1-1000` or `3,17,40`.
List<int> _seeds(String spec) => [
  for (final part in spec.split(','))
    if (part.contains('-'))
      for (
        var s = int.parse(part.split('-').first);
        s <= int.parse(part.split('-').last);
        s++
      )
        s
    else
      int.parse(part),
];

void main() {
  final env = Platform.environment;

  // tool/hillclimb/hc-sync/measure.sh: every seed, a JSON report, never red.
  final spec = env['FUZZ_SEEDS'];
  test('sync fuzz over FUZZ_SEEDS', skip: spec == null, () {
    final watch = Stopwatch()..start();
    final failed = <Map<String, Object?>>[];
    final seeds = _seeds(spec!);
    final steps = int.parse(env['FUZZ_STEPS'] ?? '60');
    for (final seed in seeds) {
      final result = runScenario(
        seed,
        scenario(seed, steps: steps),
        strict: env['FUZZ_STRICT'] == '1',
        deleteWins: env['FUZZ_PROPOSAL'] == 'delete-wins',
        joinGap: env['FUZZ_MODEL'] == 'join-gap',
      );
      if (result.failed) {
        failed.add({
          'seed': seed,
          'failures': result.failures.take(5).toList(),
        });
      }
    }
    watch.stop();
    final report = {
      'seeds': seeds.length,
      'first_seed': seeds.first,
      'last_seed': seeds.last,
      'failed': failed.length,
      'runtime_ms': watch.elapsedMilliseconds,
      'failures': failed,
    };
    File(env['FUZZ_REPORT'] ?? 'fuzz_report.json')
        .writeAsStringSync(const JsonEncoder.withIndent(' ').convert(report));
  });

  // FUZZ_REPRO=<seed>: the shrunk steps and trace of one failing seed.
  final repro = env['FUZZ_REPRO'];
  test('sync fuzz repro of FUZZ_REPRO', skip: repro == null, () {
    final seed = int.parse(repro!);
    final strict = env['FUZZ_STRICT'] == '1';
    final deleteWins = env['FUZZ_PROPOSAL'] == 'delete-wins';
    final joinGap = env['FUZZ_MODEL'] == 'join-gap';
    final steps = shrink(
      seed,
      scenario(seed, steps: int.parse(env['FUZZ_STEPS'] ?? '60')),
      strict: strict,
      deleteWins: deleteWins,
      joinGap: joinGap,
    );
    final result = runScenario(
      seed,
      steps,
      strict: strict,
      deleteWins: deleteWins,
      joinGap: joinGap,
    );
    File(env['FUZZ_REPORT'] ?? 'fuzz_repro.txt').writeAsStringSync(
      [
        'seed $seed, ${steps.length} steps:',
        ...steps.map((s) => '  $s'),
        'failures:',
        ...result.failures.map((f) => '  $f'),
        'trace:',
        ...result.trace,
      ].join('\n'),
    );
  });

  test('seeds 1 to 100 converge and lose no op', () {
    final failed = [
      for (var seed = 1; seed <= 100; seed++)
        if (runScenario(seed, scenario(seed)) case RunResult(:final failures)
            when failures.isNotEmpty)
          'seed $seed: ${failures.first} (FUZZ_REPRO=$seed shrinks it)',
    ];
    expect(failed, isEmpty);
  });

  test('a seed runs the same way twice', () {
    final a = runScenario(7, scenario(7));
    final b = runScenario(7, scenario(7));
    expect(b.trace, a.trace);
    expect(b.failures, a.failures);
  });

  test('the oracle catches a device that misses realtime deletes', () {
    final caught = [
      for (var seed = 1; seed <= 30; seed++)
        if (runScenario(
          seed,
          scenario(seed),
          plant: Plant.dropRealtimeDeletes,
        ).failed)
          seed,
    ];
    expect(caught, isNotEmpty);
  });
}
