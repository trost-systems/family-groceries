import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:family_groceries/main.dart' as app;
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Profile entrypoint for the cold start measurement
/// (`tool/hillclimb/hc-size-start/measure.sh`): the real app, which prints
/// one JSON line of wall-clock microseconds and exits. `first_frame` is the
/// first rasterized frame; `list_shown` the frame in which the row keyed
/// [_firstItem] is laid out and a hit test at its centre reaches it;
/// `interactive` the frame after a tap there in which that row shows ticked.
Future<void> main() async {
  if (kReleaseMode) {
    throw StateError('startup_probe.dart is for profile builds.');
  }
  final marks = <String, int>{};
  void mark(String name) =>
      marks[name] ??= DateTime.now().microsecondsSinceEpoch;
  Timer(const Duration(seconds: 60), () {
    stderr.writeln('startup_probe: timed out with $marks');
    exit(2);
  });

  await app.bootstrap(() {
    final binding = WidgetsFlutterBinding.ensureInitialized();
    unawaited(
      binding.waitUntilFirstFrameRasterized.then((_) => mark('first_frame')),
    );
    void watch(Duration _) {
      if (!marks.containsKey('list_shown')) {
        if (_hitRow() case final centre?) {
          mark('list_shown');
          _tap(centre);
        }
      } else if (_rowTicked()) {
        binding.addPostFrameCallback((_) async {
          mark('interactive');
          stdout.writeln(jsonEncode(marks));
          await stdout.flush();
          exit(0);
        });
        return;
      }
      binding
        ..addPostFrameCallback(watch)
        ..scheduleFrame();
    }

    binding.addPostFrameCallback(watch);
    return binding;
  });
}

const _firstItem = ValueKey('00000000-0000-4000-8000-000000010000');

Element? _find(bool Function(Element) test, [Element? from]) {
  Element? found;
  void visit(Element e) {
    if (found != null) {
      return;
    }
    if (test(e)) {
      found = e;
      return;
    }
    e.visitChildren(visit);
  }

  final root = from ?? WidgetsBinding.instance.rootElement;
  if (root != null) {
    from == null ? visit(root) : root.visitChildren(visit);
  }
  return found;
}

Offset? _hitRow() {
  final row = _find((e) => e.widget.key == _firstItem);
  final box = row?.renderObject;
  if (box is! RenderBox || !box.hasSize || !box.attached) {
    return null;
  }
  final centre = box.localToGlobal(box.size.center(Offset.zero));
  final result = HitTestResult();
  WidgetsBinding.instance.hitTestInView(
    result,
    centre,
    WidgetsBinding.instance.platformDispatcher.implicitView!.viewId,
  );
  return result.path.any((entry) => entry.target == box) ? centre : null;
}

void _tap(Offset at) {
  final view = WidgetsBinding.instance.platformDispatcher.implicitView!;
  GestureBinding.instance
    ..handlePointerEvent(
      PointerDownEvent(position: at, viewId: view.viewId, pointer: 7),
    )
    ..handlePointerEvent(
      PointerUpEvent(position: at, viewId: view.viewId, pointer: 7),
    );
}

bool _rowTicked() {
  final row = _find((e) => e.widget.key == _firstItem);
  return row != null &&
      _find(
            (e) => switch (e.widget) {
              final Semantics s => s.properties.checked ?? false,
              _ => false,
            },
            row,
          ) !=
          null;
}
