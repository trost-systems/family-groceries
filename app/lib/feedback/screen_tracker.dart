import 'package:family_groceries/app/router.dart';

/// Follows the router's location so feedback can say which screen a note
/// is about (job 21, DECISIONS 21.6).
///
/// Feedback opens only from More, so the screen is the last one the user
/// was on before the More tab (the list, usually); a More page they
/// opened it beside (wide layouts: `account`, `access`, `privacy`) names
/// itself. Only [screenNames] are ever reported.
class ScreenTracker() {
  var _current = 'list';
  String? _beforeMore;

  /// The router moved to [location].
  void visit(Uri location) {
    _current = screenNameOf(location);
    if (!inMoreTab(location)) {
      _beforeMore = _current;
    }
  }

  /// The screen a note sent now is about. Opened on More itself without
  /// having been anywhere else (a reload on `/more`): `more`.
  String get feedbackScreen =>
      _current == 'more' ? _beforeMore ?? _current : _current;
}
