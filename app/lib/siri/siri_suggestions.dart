import 'dart:async';

import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter_bloc/flutter_bloc.dart';

/// The names Siri offers for "Add `<item>` to Hummlist": the household's
/// usuals first, then what is on the list, then what was bought last; each
/// name once, at most [maxSiriSuggestions].
List<String> siriSuggestionNames(ListState state) {
  final items = state.items.values;
  final bought =
      [
        for (final item in items)
          if (item.status == ItemStatus.bought) item,
      ]..sort(
        (a, b) =>
            (b.boughtAt ?? b.updatedAt).compareTo(a.boughtAt ?? a.updatedAt),
      );
  final seen = <String>{};
  return [
    for (final name in [
      for (final usual in state.usuals) usual.name,
      for (final item in items)
        if (item.status == ItemStatus.active) item.name,
      for (final item in bought) item.name,
    ])
      if (seen.add(foldName(name))) name,
  ].take(maxSiriSuggestions).toList();
}

/// Sends the list's [siriSuggestionNames] to Siri when they change, at most
/// once per [debounce], and only once the list has loaded.
class SiriSuggestions(
  final SiriChannel _channel,
  StateStreamable<ListState> list, {
  final Duration debounce = const Duration(seconds: 2),
}) {
  this {
    _states = list.stream.listen(_changed);
    _changed(list.state);
  }

  late final StreamSubscription<ListState> _states;
  Timer? _timer;
  List<String>? _sent;
  ListState? _latest;

  void _changed(ListState state) {
    if (!state.loaded) {
      return;
    }
    _latest = state;
    _timer ??= Timer(debounce, _send);
  }

  void _send() {
    _timer = null;
    final latest = _latest;
    if (latest == null) {
      return;
    }
    final names = siriSuggestionNames(latest);
    if (listEquals(names, _sent)) {
      return;
    }
    _sent = names;
    unawaited(
      _channel.suggestions(names).catchError((Object _) {
        // No channel (MissingPluginException) or a failed save: Siri keeps
        // the names it had.
        _sent = null;
      }),
    );
  }

  Future<void> close() async {
    _timer?.cancel();
    await _states.cancel();
  }
}
