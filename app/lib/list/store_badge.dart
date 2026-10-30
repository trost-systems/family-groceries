import 'package:family_groceries/app/theme.dart';
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

/// The store's accent on [surface]: its badge colour, or the letter colour
/// when the badge is white. Where that is too dark (or light) to read as a
/// line on [surface] (Aldi's navy on the dark theme), it is mixed with
/// white (or black) until it has the 3:1 a control part needs (WCAG 1.4.11).
Color storeTint(Store store, Color surface) {
  final (:bg, :fg, label: _) = _lookOf(store);
  final base = bg == const Color(0xFFFFFFFF) ? fg : bg;
  final toward = surface.computeLuminance() < 0.5
      ? const Color(0xFFFFFFFF)
      : const Color(0xFF000000);
  var tint = base;
  for (
    var mix = 0.05;
    contrastRatio(tint, surface) < 3 && mix <= 1;
    mix += 0.05
  ) {
    tint = Color.lerp(base, toward, mix)!;
  }
  return tint;
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
          // Design H's ring is black at 8 %; on the dark theme a white one
          // keeps a dark badge (Aldi, Edeka) apart from the surface.
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0x33FFFFFF)
                : const Color(0x14000000),
          ),
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
