#!/usr/bin/env node
// Helper functions the e2e specs hold more than once.
//
// Prints the top-level functions (declarations and arrow functions in a const) whose code, without
// comments and line breaks, is the same in several files of a directory, then the names that
// several files declare with any code. The first list is what moving a helper to helpers.ts
// would save; the second also holds helpers that only share a name. A run of whitespace counts
// as one space, in a string too, and the lines are those of the first copy.
//
// Usage: node tool/hotspots/e2e-duplicates.mjs [<directory, default e2e/tests>]
//   Needs e2e's node_modules (npm ci in e2e) for the TypeScript parser.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const repo = path.resolve(import.meta.dirname, '../..');
const dir = path.resolve(process.argv[2] ?? path.join(repo, 'e2e/tests'));
const ts = createRequire(path.join(repo, 'e2e/package.json'))('typescript');
const printer = ts.createPrinter({ removeComments: true });

/** The name of a top-level function statement, undefined for any other statement. */
function functionName(node) {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (!ts.isVariableStatement(node) || node.declarationList.declarations.length !== 1) return undefined;
  const [declaration] = node.declarationList.declarations;
  const value = declaration.initializer;
  return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ? declaration.name.getText() : undefined;
}

const byCode = new Map();
const byName = new Map();
for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts')).sort()) {
  const source = ts.createSourceFile(file, readFileSync(path.join(dir, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const lineOf = (position) => source.getLineAndCharacterOfPosition(position).line;
  for (const node of source.statements) {
    const name = functionName(node);
    if (name === undefined) continue;
    const code = printer.printNode(ts.EmitHint.Unspecified, node, source).replace(/^export /, '').replace(/\s+/g, ' ');
    const lines = lineOf(node.end) - lineOf(node.getStart()) + 1;
    byCode.set(code, [...(byCode.get(code) ?? []), { file, name, lines }]);
    byName.set(name, new Set([...(byName.get(name) ?? []), file]));
  }
}

const short = (file) => file.replace(/\.spec\.ts$/, '');
const copied = [...byCode.values()].filter((places) => places.length > 1).sort((a, b) => b.length - a.length);
console.log('the same code in several files:');
for (const places of copied) {
  const [{ name, lines }] = places;
  console.log(`  ${name} (${lines} lines) x${places.length}: ${places.map((place) => short(place.file)).join(', ')}`);
}
const spare = copied.reduce((sum, places) => sum + places.length - 1, 0);
const spareLines = copied.reduce((sum, places) => sum + (places.length - 1) * places[0].lines, 0);
console.log(`${spare} spare copies, ${spareLines} lines`);
console.log('\nthe same name in several files, any code:');
for (const [name, files] of [...byName].filter(([, files]) => files.size > 1).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${name} x${files.size}: ${[...files].map(short).join(', ')}`);
}
