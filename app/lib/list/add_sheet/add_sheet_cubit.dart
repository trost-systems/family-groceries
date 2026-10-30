import 'dart:async';

import 'package:family_groceries/analytics/events.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

@immutable
class const AddSheetState({
  final bool open = false,
  final String text = '',

  /// The store chip's pick. Null: each row keeps its own store;
  /// `SetTo(null)`: Ohne Laden.
  final SetTo<String?>? store,

  /// The category chip's pick. Null: each row keeps its own category.
  final String? category,

  /// The rows for [answered], which lags [text] while the next ones load.
  final List<Suggestion> suggestions = const [],
  final String answered = '',

  /// The last add, shown with Undo until the next keystroke.
  final AddResult? added,

  /// Job 32b: an open item that is another spelling of [added] ("Möhren"
  /// for "Karotten"), offered for a merge in the note while the sheet is
  /// open; and the merge once taken, with its undo.
  final DedupeHint? hint,
  final Merge? merge,
}) {
  /// Whether [suggestions] answer what is typed now.
  bool get fresh => answered.isNotEmpty && answered == text.trim();
}

/// The add sheet: what is typed, the rows the server suggests for it, the
/// chip picks, and the add itself. Rows are fetched while typing (after a
/// short pause) and kept per text until the next add or opening. Without
/// the server they are made up from the parse on the device and the
/// household's usuals.
class AddSheetCubit(
  final ListCubit _list, {
  Duration debounce = const Duration(milliseconds: 120),
}) extends Cubit<AddSheetState> {
  this : super(const AddSheetState());

  final _debounce = debounce;
  final _cache = <String, List<Suggestion>>{};
  Timer? _typing;
  (String, Future<List<Suggestion>>)? _loading;

  /// Bumped by [_forget]: an answer asked for before it is not cached.
  var _epoch = 0;

  /// Opening again starts blank, also when the last close has not
  /// settled yet.
  void show() {
    if (!state.open) {
      _forget();
      emit(const AddSheetState(open: true));
    }
  }

  /// The content stays until [settled], so it is there while the sheet
  /// shrinks away.
  void dismiss() {
    if (state.open) {
      emit(_with(open: false));
    }
  }

  /// The sheet finished closing: start blank next time.
  void settled() {
    if (!state.open) {
      _typing?.cancel();
      emit(const AddSheetState());
    }
  }

  void type(String text) {
    _typing?.cancel();
    final key = text.trim();
    if (key.isEmpty) {
      emit(_with(text: text, added: () => null, suggestions: const []));
      return;
    }
    final known = _cache[key];
    emit(
      _with(
        open: true,
        text: text,
        added: () => null,
        suggestions:
            known ?? (state.suggestions.isEmpty ? _offline(key) : null),
        answered: known == null ? null : key,
      ),
    );
    if (known == null) {
      _typing = Timer(_debounce, () => unawaited(_fetch(key)));
    }
  }

  void pickStore(String? id) => emit(_with(store: () => SetTo(id)));

  void pickCategory(String id) => emit(_with(category: () => id));

  /// Adds [suggestion] with the chips' picks, then clears the input for the
  /// next item. The picks start over with it.
  AddResult take(Suggestion suggestion) {
    final entry = suggestion.entry;
    final store = state.store;
    final result = _list.addParsed(
      ParsedEntry(
        name: entry.name,
        brand: entry.brand,
        properties: entry.properties,
        quantity: entry.quantity,
        storeId: store == null ? entry.storeId : store.value,
        categoryId: state.category ?? entry.categoryId,
      ),
      noStore: store != null && store.value == null,
      source: suggestion.source == SuggestionSource.typed
          ? AddSource.typed
          : AddSource.suggestion,
    );
    if (result is! NothingToAdd) {
      // An add can change what the server suggests next (store memory,
      // history), so answers from before it are not reused.
      _forget();
      emit(AddSheetState(open: state.open, added: result));
    }
    return result;
  }

  /// Enter: the first row for what is typed now, waiting for it if it is
  /// still loading. Null when nothing is typed or the text changed while
  /// waiting.
  Future<AddResult?> takeFirst() async {
    final key = state.text.trim();
    if (key.isEmpty) {
      return null;
    }
    if (state.fresh && state.suggestions.isNotEmpty) {
      return take(state.suggestions.first);
    }
    _typing?.cancel();
    final rows = await _fetch(key)
        .timeout(const Duration(seconds: 3), onTimeout: () => _offline(key));
    if (isClosed || state.text.trim() != key || rows.isEmpty) {
      return null;
    }
    return take(rows.first);
  }

  /// Removes what was just added.
  void undo() {
    if (state.added case Added(:final item)) {
      _list.delete(item.id);
      emit(_with(added: () => null));
    }
  }

  /// Shows [hint] in the note, if the note is about its new item and the
  /// sheet is open. Whether it took it; otherwise the list shows it.
  bool offer(DedupeHint hint) {
    if (state.open && state.merge == null) {
      if (state.added case Added(:final item) when item.id == hint.added.id) {
        _list.hintShown();
        emit(_with(hint: () => hint));
        return true;
      }
    }
    return false;
  }

  /// Takes [hint] out of the note: its items are no longer both open.
  void drop(DedupeHint hint) {
    if (state.hint == hint && state.merge == null) {
      emit(_with(hint: () => null));
    }
  }

  /// Zusammenführen in the note.
  void mergeHint() {
    if (state.hint case final hint?) {
      final merge = _list.merge(hint);
      emit(merge == null ? _with(hint: () => null) : _with(merge: () => merge));
    }
  }

  /// Rückgängig after a merge: both items come back, the note says what was
  /// added again.
  void undoMerge() {
    if (state.merge case final merge?) {
      _list.unmerge(merge);
      emit(_with(hint: () => null, merge: () => null));
    }
  }

  /// The sheet closes with a hint or a merge in its note: the list takes
  /// them over (as snackbars), so they are not lost or counted as ignored.
  (DedupeHint?, Merge?) handOver() {
    final open = (state.merge == null ? state.hint : null, state.merge);
    if (open != (null, null)) {
      _handingOver = true;
      emit(_with(hint: () => null, merge: () => null));
      _handingOver = false;
    }
    return open;
  }

  var _handingOver = false;

  /// A hint that leaves the note without a merge (typing on, the add's
  /// undo, a new add) was ignored.
  @override
  void onChange(Change<AddSheetState> change) {
    super.onChange(change);
    final before = change.currentState;
    if (before.hint != null &&
        before.merge == null &&
        change.nextState.hint != before.hint &&
        change.nextState.merge == null &&
        !_handingOver) {
      _list.hintIgnored();
    }
  }

  Future<List<Suggestion>> _fetch(String key) {
    if (_loading case (final text, final future) when text == key) {
      return future;
    }
    final future = _load(key);
    _loading = (key, future);
    return future;
  }

  /// Drops every answer from before now, also those still on the way.
  void _forget() {
    _typing?.cancel();
    _cache.clear();
    _loading = null;
    _epoch++;
  }

  Future<List<Suggestion>> _load(String key) async {
    final epoch = _epoch;
    List<Suggestion> rows;
    try {
      rows = await _list.suggest(key);
      if (epoch == _epoch) {
        _cache[key] = rows;
      }
    } on Object {
      rows = _offline(key);
    }
    if (_loading?.$1 == key) {
      _loading = null;
    }
    if (!isClosed && state.text.trim() == key) {
      emit(_with(suggestions: rows, answered: key));
    }
    return rows;
  }

  /// Without the server: the typed line split into name and quantity on
  /// the device, then the usuals that start like it.
  List<Suggestion> _offline(String key) {
    final typed = parseEntry(key);
    final seen = <String>{};
    return [
      for (final suggestion in [
        Suggestion(
          SuggestionSource.typed,
          ParsedEntry(name: typed.name, quantity: typed.quantity),
        ),
        for (final usual in _list.suggestionsFor(typed.name))
          Suggestion(
            SuggestionSource.history,
            ParsedEntry(
              name: usual.name,
              quantity: typed.quantity ?? usual.quantity,
            ),
          ),
      ])
        if (suggestion.entry.name.isNotEmpty && seen.add(suggestion.key))
          suggestion,
    ];
  }

  AddSheetState _with({
    bool? open,
    String? text,
    SetTo<String?>? Function()? store,
    String? Function()? category,
    List<Suggestion>? suggestions,
    String? answered,
    AddResult? Function()? added,
    DedupeHint? Function()? hint,
    Merge? Function()? merge,
  }) => AddSheetState(
    open: open ?? state.open,
    text: text ?? state.text,
    store: store == null ? state.store : store(),
    category: category == null ? state.category : category(),
    suggestions: suggestions ?? state.suggestions,
    answered: answered ?? state.answered,
    added: added == null ? state.added : added(),
    hint: hint == null ? (added == null ? state.hint : null) : hint(),
    merge: merge == null ? (added == null ? state.merge : null) : merge(),
  );

  @override
  Future<void> close() {
    _typing?.cancel();
    return super.close();
  }
}
