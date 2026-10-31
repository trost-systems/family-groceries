// Usage: node summarize.mjs <option-dir>: prints the option's tokens as compact Markdown
// tables (colours light/dark, type scale, space, radius, shadow, motion) for design-prototypes.md.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const t = JSON.parse(readFileSync(join(resolve(process.argv[2]), 'tokens.json'), 'utf8'));
const hex = (v) => (typeof v === 'string' ? v : v.hex);
const dim = (v) => (typeof v === 'object' ? `${v.value}${v.unit}` : v);
const px = (v) => (v.unit === 'rem' ? `${Math.round(v.value * 16 * 10) / 10}px` : `${v.value}${v.unit}`);
const kids = (g) => Object.entries(g ?? {}).filter(([k]) => !k.startsWith('$'));
const out = [];
const keys = ['brand', 'on-brand', 'accent', 'on-accent', 'surface', 'surface-raised', 'text', 'text-muted', 'border', 'success', 'warning', 'error'];
const extra = kids(t.color.light).map(([k]) => k).filter((k) => !keys.includes(k) && !/^on-(success|warning|error)$/.test(k));
out.push('| Colour | Light | Dark |', '| --- | --- | --- |');
for (const k of keys) out.push(`| ${k} | \`${hex(t.color.light[k].$value)}\` | \`${hex(t.color.dark[k].$value)}\` |`);
out.push('', `Extra colour roles: ${extra.map((k) => `\`${k}\``).join(', ') || 'none'}.`, '');
const fams = kids(t.font.family).map(([k, v]) => `${k}: ${[v.$value].flat()[0]} (${v.$extensions?.['com.hummlist']?.license})`);
out.push(`Fonts: ${fams.join('; ')}.`, '');
out.push('| Type role | Family | Size | Line height | Weight |', '| --- | --- | --- | --- | --- |');
for (const [k, v] of kids(t.type)) {
  const f = String(v.$value.fontFamily).replace(/[{}]/g, '').split('.').pop();
  out.push(`| ${k} | ${f} | ${px(v.$value.fontSize)} | ${v.$value.lineHeight} | ${v.$value.fontWeight} |`);
}
out.push('');
const list = (g) => kids(g).map(([k, v]) => (v.$value !== undefined ? `${k} ${dim(v.$value)}` : null)).filter(Boolean).join(', ');
out.push(`Space: ${list(t.space)}.`, '', `Radius: ${list(t.radius)}.`, '');
out.push(`Shadow levels: ${kids(t.shadow).map(([k]) => k).join(', ')}.`, '');
out.push(`Motion: ${list(t.motion.duration)}; easing ${kids(t.motion.easing).map(([k, v]) => `${k} (${v.$value.join(', ')})`).join(', ')}.`);
console.log(out.join('\n'));
