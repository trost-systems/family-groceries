// Guardrail: every page's words stay byte-identical. Compares two builds of site/ page by page:
// text nodes in document order plus the attributes people read or hear (alt, aria-label, title,
// placeholder, meta content). Usage: node copy-check.mjs <base dist> <new dist>; exit 1 on a change.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { parse } = createRequire(join(repo, 'site/package.json'))('node-html-parser');

const ATTRS = ['alt', 'aria-label', 'title', 'placeholder', 'content', 'data-play', 'data-pause'];
const htmlFiles = (dir) => readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.html')).sort();

function words(file) {
  const out = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      const t = node.rawText.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      return;
    }
    if (node.nodeType !== 1 && node !== root) return;
    if (['script', 'style'].includes(node.rawTagName)) return;
    for (const a of ATTRS) if (node.getAttribute?.(a)) out.push(`@${a}=${node.getAttribute(a)}`);
    node.childNodes.forEach(walk);
  };
  const root = parse(readFileSync(file, 'utf8'), { comment: false });
  walk(root);
  return out;
}

const [base, next] = process.argv.slice(2).map((p) => resolve(p));
const a = htmlFiles(base), b = htmlFiles(next);
let bad = 0;
for (const f of new Set([...a, ...b])) {
  if (!a.includes(f) || !b.includes(f)) { console.log(`page set changed: ${f}`); bad++; continue; }
  const x = words(join(base, f)), y = words(join(next, f));
  const i = x.findIndex((w, k) => w !== y[k]);
  if (i >= 0 || x.length !== y.length) {
    const k = i >= 0 ? i : Math.min(x.length, y.length);
    console.log(`${relative(next, join(next, f))}: words differ at #${k}: ${JSON.stringify(x[k])} -> ${JSON.stringify(y[k])}`);
    bad++;
  }
}
console.log(bad ? `copy-check: ${bad} page(s) changed` : `copy-check: ${a.length} pages, words identical`);
process.exit(bad ? 1 : 0);
