import 'dart:js_interop';
import 'dart:js_interop_unsafe';

/// Whether this browser has the Web Share API (Safari, Chrome on Android
/// and some desktops). Without it share_plus would open a mailto: link, so
/// the invite offers copying instead.
bool shareSheetAvailable() {
  final navigator = globalContext.getProperty<JSObject?>('navigator'.toJS);
  return navigator != null &&
      navigator.has('share') &&
      navigator.has('canShare');
}
