// Usage: node build-dart.mjs <option-dir> <out.dart>
// Generates the Flutter side of one token set from the same tokens.json through Style
// Dictionary: a HummlistTokens ThemeExtension with the light and dark colours, a
// ColorScheme built from them, and constants for type, space, radius and motion.
import StyleDictionary from 'style-dictionary';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RESERVED = new Set(['in', 'is', 'as', 'do', 'if', 'new', 'var', 'for', 'try', 'out', 'set', 'get', 'case', 'else', 'enum', 'null', 'this', 'true', 'false', 'void', 'with', 'class', 'const', 'final', 'super', 'switch', 'default', 'extends', 'return']);
const camel = (parts) => {
  const n = parts.join('-').replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, 'v$1');
  return RESERVED.has(n) ? `${n}Value` : n;
};
// Flutter names weights in hundreds; a variable font's in-between weight goes to the wght axis.
const weight = (w) => {
  const n = Number(w); const r = Math.min(900, Math.max(100, Math.round(n / 100) * 100));
  return n === r ? `fontWeight: FontWeight.w${r}` : `fontWeight: FontWeight.w${r}, fontVariations: [FontVariation('wght', ${n})]`;
};
const argb = (v) => {
  const hex = (typeof v === 'string' ? v : v.hex).replace('#', '');
  const a = typeof v === 'object' && (v.alpha ?? 1) < 1 ? Math.round(v.alpha * 255) : 255;
  return `Color(0x${a.toString(16).padStart(2, '0')}${hex.slice(0, 6)})`.toUpperCase().replace('COLOR(0X', 'Color(0x');
};
const px = (d) => (typeof d === 'object' ? (d.unit === 'rem' ? d.value * 16 : d.value) : Number(d));
const num = (n) => (Number.isInteger(n) ? `${n}` : `${Math.round(n * 1000) / 1000}`);

StyleDictionary.registerFormat({
  name: 'hummlist/flutter',
  format: ({ dictionary }) => {
    const byPath = (p) => dictionary.allTokens.filter((t) => t.path[0] === p);
    const light = dictionary.allTokens.filter((t) => t.path[0] === 'color' && t.path[1] === 'light');
    const dark = Object.fromEntries(dictionary.allTokens.filter((t) => t.path[0] === 'color' && t.path[1] === 'dark').map((t) => [t.path.slice(2).join('-'), t]));
    const names = light.map((t) => [camel(t.path.slice(2)), t.path.slice(2).join('-')]);
    const colorsOf = (mode) => names.map(([n, k]) => `    ${n}: ${argb((mode === 'light' ? light.find((t) => t.path.slice(2).join('-') === k) : dark[k]).$value)},`).join('\n');
    const fam = (f) => (Array.isArray(f) ? f[0] : f);
    const type = byPath('type').map((t) => {
      const v = t.$value; const size = px(v.fontSize);
      const ls = v.letterSpacing ? (v.letterSpacing.unit === 'em' ? v.letterSpacing.value * size : px(v.letterSpacing)) : 0;
      return `  static const ${camel(t.path.slice(1))} = TextStyle(fontFamily: '${fam(v.fontFamily)}', fontSize: ${num(size)}, ${weight(v.fontWeight)}, height: ${num(Number(v.lineHeight))}, letterSpacing: ${num(ls)});`;
    }).join('\n');
    const dims = (group) => byPath(group).filter((t) => t.$type === 'dimension').map((t) => `  static const double ${/^\d/.test(t.path[1]) ? group + t.path.slice(1).join('') : camel(t.path.slice(1))} = ${num(px(t.$value))};`).join('\n');
    const durations = byPath('motion').filter((t) => t.$type === 'duration').map((t) => `  static const ${camel(t.path.slice(2))} = Duration(milliseconds: ${t.$value.value * (t.$value.unit === 's' ? 1000 : 1)});`).join('\n');
    const curves = byPath('motion').filter((t) => t.$type === 'cubicBezier').map((t) => `  static const ${camel(t.path.slice(2))} = Cubic(${t.$value.map(num).join(', ')});`).join('\n');
    const has = (k) => names.some(([, key]) => key === k);
    const pick = (k, fallback) => (has(k) ? `t.${camel([k])}` : fallback);
    return `// GENERATED from tokens.json by build-dart.mjs (Style Dictionary). Do not edit.
import 'package:flutter/material.dart';

@immutable
class HummlistTokens extends ThemeExtension<HummlistTokens> {
  const HummlistTokens({
${names.map(([n]) => `    required this.${n},`).join('\n')}
  });

${names.map(([n]) => `  final Color ${n};`).join('\n')}

  static const light = HummlistTokens(
${colorsOf('light')}
  );

  static const dark = HummlistTokens(
${colorsOf('dark')}
  );

  @override
  HummlistTokens copyWith() => this;

  @override
  HummlistTokens lerp(HummlistTokens? other, double t) {
    if (other == null) return this;
    return HummlistTokens(
${names.map(([n]) => `      ${n}: Color.lerp(${n}, other.${n}, t)!,`).join('\n')}
    );
  }
}

ColorScheme hummlistColorScheme(Brightness brightness) {
  final t = brightness == Brightness.light ? HummlistTokens.light : HummlistTokens.dark;
  return ColorScheme(
    brightness: brightness,
    primary: t.brand,
    onPrimary: t.onBrand,
    primaryContainer: ${pick('brand-container', 't.brand')},
    onPrimaryContainer: ${pick('on-brand-container', 't.onBrand')},
    secondary: t.accent,
    onSecondary: t.onAccent,
    tertiary: t.accent,
    onTertiary: t.onAccent,
    error: t.error,
    onError: t.onError,
    surface: t.surface,
    onSurface: t.text,
    onSurfaceVariant: t.textMuted,
    surfaceContainerLowest: t.surfaceRaised,
    outline: t.textMuted,
    outlineVariant: t.border,
  );
}

ThemeData hummlistTheme(Brightness brightness) => ThemeData(
  colorScheme: hummlistColorScheme(brightness),
  extensions: [if (brightness == Brightness.light) HummlistTokens.light else HummlistTokens.dark],
);

abstract final class HummlistType {
${type}
}

abstract final class HummlistSpace {
${dims('space')}
}

abstract final class HummlistRadius {
${dims('radius')}
}

abstract final class HummlistMotion {
${durations}
${curves}
}
`;
  },
});

const dir = resolve(process.argv[2]);
const sd = new StyleDictionary({
  tokens: JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8')),
  usesDtcg: true,
  log: { verbosity: 'silent', warnings: 'disabled' },
  platforms: { flutter: { files: [{ destination: 'tokens.g.dart', format: 'hummlist/flutter' }] } },
});
const [out] = await sd.formatPlatform('flutter');
writeFileSync(resolve(process.argv[3]), out.output);
