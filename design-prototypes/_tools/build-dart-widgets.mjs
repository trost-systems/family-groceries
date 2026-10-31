// Usage: node build-dart-widgets.mjs <out.dart> <variant-dir>...
// Generates the widgets-only Dart tokens for the Hummel Hex Flutter PoC from the hex variants'
// tokens.json (option-3a-hex-sharp, option-3b-hex-soft) through Style Dictionary. The output
// imports only package:flutter/widgets.dart: plain immutable classes, no ThemeExtension.
// Colours, type, space, depth and motion must be identical across the variants (they come from
// the same common tokens); only shape.hex differs, and becomes one HexShapeTokens per variant.
import StyleDictionary from 'style-dictionary';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const RESERVED = new Set(['in', 'is', 'as', 'do', 'if', 'new', 'var', 'for', 'try', 'out', 'set', 'get', 'case', 'else', 'enum', 'null', 'this', 'true', 'false', 'void', 'with', 'class', 'const', 'final', 'super', 'switch', 'default', 'extends', 'return']);
const camel = (parts) => {
  const n = parts.join('-').replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, 'v$1');
  return RESERVED.has(n) ? `${n}Value` : n;
};
const argb = (v) => {
  const hex = (typeof v === 'string' ? v : v.hex).replace('#', '').slice(0, 6).toUpperCase();
  const a = typeof v === 'object' && (v.alpha ?? 1) < 1 ? Math.round(v.alpha * 255) : 255;
  return `Color(0x${a.toString(16).padStart(2, '0').toUpperCase()}${hex})`;
};
const px = (d) => (typeof d === 'object' ? (d.unit === 'rem' ? d.value * 16 : d.value) : Number(d));
const num = (n) => (Number.isInteger(n) ? `${n}.0` : `${Math.round(n * 10000) / 10000}`);
const ms = (d) => d.value * (d.unit === 's' ? 1000 : 1);

// Per variant, the format reduces the resolved dictionary to a plain model; Dart is rendered
// from the models so the shared sections can be checked for equality first.
StyleDictionary.registerFormat({
  name: 'hummlist/hex-model',
  format: ({ dictionary }) => {
    const group = (p) => dictionary.allTokens.filter((t) => t.path[0] === p);
    const colors = (mode) => group('color').filter((t) => t.path[1] === mode)
      .map((t) => [camel(t.path.slice(2)), argb(t.$value)]);
    const type = group('type').map((t) => {
      const v = t.$value; const size = px(v.fontSize);
      const ls = v.letterSpacing ? (v.letterSpacing.unit === 'em' ? v.letterSpacing.value * size : px(v.letterSpacing)) : 0;
      return { name: camel(t.path.slice(1)), family: Array.isArray(v.fontFamily) ? v.fontFamily[0] : v.fontFamily, size, weight: Number(v.fontWeight), height: Number(v.lineHeight), letterSpacing: ls };
    });
    const dims = (p, prefix) => group(p).filter((t) => t.$type === 'dimension')
      .map((t) => [/^\d/.test(t.path[1]) ? `${prefix}${t.path.slice(1).join('')}` : camel(t.path.slice(1)), px(t.$value)]);
    const motion = group('motion');
    const hex = Object.fromEntries(group('shape').filter((t) => t.path[1] === 'hex').map((t) => [camel(t.path.slice(2)), typeof t.$value === 'number' ? t.$value : px(t.$value)]));
    return JSON.stringify({
      common: {
        light: colors('light'), dark: colors('dark'), type,
        space: dims('space', 's'), depth: dims('depth', 'd'), stroke: dims('border', 'w'),
        durations: motion.filter((t) => t.$type === 'duration').map((t) => [camel(t.path.slice(2)), ms(t.$value)]),
        curves: motion.filter((t) => t.$type === 'cubicBezier').map((t) => [camel(t.path.slice(2)), t.$value]),
      },
      hex,
    });
  },
});

const modelOf = async (dir) => {
  const tokens = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
  const variant = tokens.$extensions?.['com.hummlist']?.variant;
  if (!variant) throw new Error(`${dir}/tokens.json has no $extensions.com.hummlist.variant`);
  const sd = new StyleDictionary({
    tokens, usesDtcg: true,
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: { model: { files: [{ destination: 'model.json', format: 'hummlist/hex-model' }] } },
  });
  const [out] = await sd.formatPlatform('model');
  return { variant, dir, ...JSON.parse(out.output) };
};

const [outPath, ...dirs] = process.argv.slice(2);
if (!outPath || dirs.length === 0) throw new Error('usage: node build-dart-widgets.mjs <out.dart> <variant-dir>...');
const models = await Promise.all(dirs.map((d) => modelOf(resolve(d))));
for (const m of models.slice(1)) {
  if (!isDeepStrictEqual(m.common, models[0].common)) {
    throw new Error(`${m.dir} differs from ${models[0].dir} outside shape.hex; the Dart tokens assume one shared palette, type, space, depth and motion`);
  }
}
for (const m of models) {
  for (const k of ['tip', 'cornerRadius', 'referenceHeight']) {
    if (typeof m.hex[k] !== 'number') throw new Error(`${m.dir}: shape.hex.${k} missing`);
  }
}

const c = models[0].common;
const colorNames = c.light.map(([n]) => n);
const darkByName = Object.fromEntries(c.dark);
const textStyle = (t) => `TextStyle(fontFamily: '${t.family}', fontSize: ${num(t.size)}, fontWeight: FontWeight.w${Math.min(900, Math.max(100, Math.round(t.weight / 100) * 100))}, fontVariations: [FontVariation('wght', ${num(t.weight)})], height: ${num(t.height)}, letterSpacing: ${num(t.letterSpacing)})`;
const consts = (entries, type) => entries.map(([n, v]) => `  static const ${type ? `${type} ` : ''}${n} = ${v};`).join('\n');

const dart = `// GENERATED by design-prototypes/_tools/build-dart-widgets.mjs
// (Style Dictionary) from ${models.map((m) => m.dir.split('/').pop()).join(' and ')}.
// Do not edit.
import 'package:flutter/widgets.dart';

/// One colour set per brightness.
@immutable
final class HexColors {
  const HexColors({
${colorNames.map((n) => `    required this.${n},`).join('\n')}
  });

${colorNames.map((n) => `  final Color ${n};`).join('\n')}

  static const light = HexColors(
${c.light.map(([n, v]) => `    ${n}: ${v},`).join('\n')}
  );

  static const dark = HexColors(
${colorNames.map((n) => `    ${n}: ${darkByName[n]},`).join('\n')}
  );
}

enum HexVariant { ${models.map((m) => m.variant).join(', ')} }

/// The hexagon of one variant. [tip] is the width of each pointed end as a
/// fraction of the height; [cornerRadius] applies at [referenceHeight] and
/// scales with the shape's height.
@immutable
final class HexShapeTokens {
  const HexShapeTokens({required this.tip, required this.cornerRadius, required this.referenceHeight});

  final double tip;
  final double cornerRadius;
  final double referenceHeight;

${models.map((m) => `  static const ${m.variant} = HexShapeTokens(tip: ${num(m.hex.tip)}, cornerRadius: ${num(m.hex.cornerRadius)}, referenceHeight: ${num(m.hex.referenceHeight)});`).join('\n')}

  static HexShapeTokens of(HexVariant variant) => switch (variant) {
${models.map((m) => `    HexVariant.${m.variant} => ${m.variant},`).join('\n')}
  };
}

abstract final class HexType {
${c.type.map((t) => `  static const ${t.name} = ${textStyle(t)};`).join('\n')}
}

abstract final class HexSpace {
${consts(c.space.map(([n, v]) => [n, num(v)]), 'double')}
}

abstract final class HexDepth {
${consts(c.depth.map(([n, v]) => [n, num(v)]), 'double')}
}

abstract final class HexStroke {
${consts(c.stroke.map(([n, v]) => [n, num(v)]), 'double')}
}

abstract final class HexDuration {
${consts(c.durations.map(([n, v]) => [n, `Duration(milliseconds: ${v})`]))}
}

abstract final class HexEasing {
${consts(c.curves.map(([n, v]) => [n, `Cubic(${v.map(num).join(', ')})`]))}
}
`;
writeFileSync(resolve(outPath), dart);
// The PoC's lint set wants dart-formatted code; formatting here keeps the file reproducible.
execFileSync('dart', ['format', resolve(outPath)], { stdio: 'ignore' });
console.log(`wrote ${outPath} (${models.map((m) => m.variant).join(', ')})`);
