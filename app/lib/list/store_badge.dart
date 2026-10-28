import 'package:family_groceries/list/model.dart';
import 'package:flutter/material.dart';

typedef _Look = ({Color bg, Color fg, String label});

/// The chains' own colours, by seed key or, for a store the user named
/// like one, by its folded name.
const _chains = <String, _Look>{
  'dm': (bg: Color(0xFFFFFFFF), fg: Color(0xFFD6001C), label: 'dm'),
  'edeka': (bg: Color(0xFF1D4EA3), fg: Color(0xFFFFD400), label: 'E'),
  'lidl': (bg: Color(0xFF0050AA), fg: Color(0xFFFFF000), label: 'L'),
  'rewe': (bg: Color(0xFFCC071E), fg: Color(0xFFFFFFFF), label: 'R'),
  'aldi': (bg: Color(0xFF00005F), fg: Color(0xFFFF9A00), label: 'A'),
};

/// Other stores get one of these, picked by name, so a store keeps its
/// colour on every device.
const _palette = <({Color bg, Color fg})>[
  (bg: Color(0xFF00796B), fg: Color(0xFFFFFFFF)),
  (bg: Color(0xFF6A1B9A), fg: Color(0xFFFFFFFF)),
  (bg: Color(0xFFE65100), fg: Color(0xFFFFFFFF)),
  (bg: Color(0xFF5D4037), fg: Color(0xFFFFFFFF)),
  (bg: Color(0xFF283593), fg: Color(0xFFFFFFFF)),
  (bg: Color(0xFF2E7D32), fg: Color(0xFFFFFFFF)),
];

_Look _lookOf(Store store) {
  if (_chains[store.seedKey ?? foldName(store.name)] case final chain?) {
    return chain;
  }
  final name = store.name.trim();
  final sum = name.codeUnits.fold(0, (a, b) => a + b);
  final (:bg, :fg) = _palette[sum % _palette.length];
  final first = String.fromCharCodes(name.runes.take(1)).toUpperCase();
  return (bg: bg, fg: fg, label: first.isEmpty ? '?' : first);
}

/// The store's accent: its badge colour, or the letter colour when the
/// badge is white.
Color storeTint(Store store) {
  final (:bg, :fg, label: _) = _lookOf(store);
  return bg == const Color(0xFFFFFFFF) ? fg : bg;
}

/// A store's logo-like square: its letter in its colours. Decorative; the
/// store's name is always next to it.
class const StoreBadge(final Store store, {final double size = 24, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final (:bg, :fg, :label) = _lookOf(store);
    final shape = BorderRadius.circular(6);
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: shape),
        foregroundDecoration: BoxDecoration(
          borderRadius: shape,
          border: Border.all(color: const Color(0x14000000)),
        ),
        child: Text(
          label,
          maxLines: 1,
          textScaler: TextScaler.noScaling,
          style: TextStyle(
            color: fg,
            fontSize: size * 0.48,
            fontWeight: FontWeight.w800,
            height: 1,
            letterSpacing: size * 0.48 * -0.03,
          ),
        ),
      ),
    );
  }
}
