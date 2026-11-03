#!/usr/bin/env node
// Compares two runs by their manifests: which files are byte-identical, which differ, which are
// missing. Exit 1 on any difference. Reruns on the same commit should print no difference, except
// in the invite shots: every run creates a new invite, with its own code and its own expiry date.
//
//   node compare.mjs <old manifest.json> [new manifest.json, default out/manifest.json]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [a, b = join(new URL('.', import.meta.url).pathname, 'out/manifest.json')] = process.argv.slice(2);
if (!a) {
  console.error('usage: compare.mjs <old manifest.json> [new manifest.json]');
  process.exit(64);
}
const VARIES = new Set(['invite']);
const files = (f) => JSON.parse(readFileSync(f, 'utf8')).files;
const before = new Map(files(a).map((x) => [x.file, x.sha256]));
const after = new Map(files(b).map((x) => [x.file, x.sha256]));
const varies = new Set(files(b).filter((x) => VARIES.has(x.scene)).map((x) => x.file));
const same = [...after].filter(([f, h]) => before.get(f) === h).map(([f]) => f);
const differ = [...after].filter(([f, h]) => before.has(f) && before.get(f) !== h).map(([f]) => f);
const changed = differ.filter((f) => !varies.has(f));
const added = [...after.keys()].filter((f) => !before.has(f));
const gone = [...before.keys()].filter((f) => !after.has(f));
console.log(`${same.length} of ${after.size} identical`);
for (const [label, list] of [['differs as expected (new invite)', differ.filter((f) => varies.has(f))], ['changed', changed], ['new', added], ['missing', gone]]) {
  for (const f of list) console.log(`${label}: ${f}`);
}
process.exit(changed.length || added.length || gone.length ? 1 : 0);
