import 'package:flutter/foundation.dart';

/// Ids of ticked items whose rows are closing, shared by every row and
/// divider of one list: a divider whose rows all close closes with them.
class LeavingRows() {
  final ids = ValueNotifier<Set<String>>(const {});
  var _disposed = false;

  void leave(String id) => ids.value = {...ids.value, id};

  /// Drops [id] once its row is gone; a list torn down with it has nothing
  /// left to tell.
  void left(String id) {
    if (!_disposed && ids.value.contains(id)) {
      ids.value = {...ids.value}..remove(id);
    }
  }

  void dispose() {
    _disposed = true;
    ids.dispose();
  }
}
