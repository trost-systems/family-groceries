import { assert, assertEquals } from '@std/assert';
import { check } from './pinned-deps.ts';

const DENO_JSON = 'supabase/functions/deno.json';
const WRAPPER = 'app/android/gradle/wrapper/gradle-wrapper.properties';
const SUM = 'a'.repeat(64);
const wrapper = (...extra: string[]) =>
  [
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.3.1-all.zip',
    ...extra,
  ]
    .join('\n') + '\n';

function repo(
  imports: Record<string, string> | string | undefined,
  properties?: string,
  sources: Record<string, string> = {},
): string {
  const dir = Deno.makeTempDirSync();
  const files: Record<string, string | undefined> = {
    [DENO_JSON]: typeof imports === 'object'
      ? JSON.stringify({ fmt: { lineWidth: 100 }, imports }, null, 2)
      : imports,
    [WRAPPER]: properties,
    ...Object.fromEntries(
      Object.entries(sources).map(([path, text]) => [`supabase/functions/${path}`, text]),
    ),
  };
  for (const [path, text] of Object.entries(files)) {
    if (text === undefined) continue;
    Deno.mkdirSync(`${dir}/${path.split('/').slice(0, -1).join('/')}`, {
      recursive: true,
    });
    Deno.writeTextFileSync(`${dir}/${path}`, text);
  }
  return dir;
}

const pinned = wrapper(`distributionSha256Sum=${SUM}`);
const exact = {
  zod: 'npm:zod@4.6.7',
  '@peculiar/x509': 'npm:@peculiar/x509@1.14.3',
  '@std/assert': 'jsr:@std/assert@1.0.19',
  'ajv/': 'npm:/ajv@8.17.1/',
  next: 'npm:zod@5.0.0-beta.1',
  './local.ts': './other.ts',
};

Deno.test('exact specifiers and a wrapper checksum pass', () => {
  assertEquals(check(repo(exact, pinned)), []);
  assertEquals(check(repo({ ...exact, built: 'npm:zod@4.6.7+build.5' }, pinned)), []);
});

for (
  const [specifier, what] of [
    ['npm:zod@^4.2.0', 'asks for "^4.2.0"'],
    ['npm:zod@~4.6.0', 'asks for "~4.6.0"'],
    ['jsr:@std/assert@^1', 'asks for "^1"'],
    ['jsr:@std/assert@1', 'asks for "1"'],
    ['npm:zod@4.6', 'asks for "4.6"'],
    ['npm:zod@4.x', 'asks for "4.x"'],
    ['npm:zod@>=4.2.0 <5', 'asks for ">=4.2.0 <5"'],
    ['npm:zod@latest', 'asks for "latest"'],
    ['npm:zod@*', 'asks for "*"'],
    ['npm:zod', 'has no version'],
    ['npm:zod@', 'has no version'],
    ['npm:@peculiar/x509', 'has no version'],
    ['npm:@peculiar/x509/sub', 'has no version'],
    ['npm:/ajv@^8.17.1/', 'asks for "^8.17.1"'],
    ['npm:zod@4.6.7 || ^5', 'asks for "4.6.7 || ^5"'],
    ['NPM:zod@^4.2.0', 'asks for "^4.2.0"'],
    [' npm:jose@^6', 'asks for "^6"'],
    ['JSR:@std/assert', 'has no version'],
    ['\u0001npm:zod@^4.2.0', 'asks for "^4.2.0"'],
    ['n\tpm:zod@^4.2.0', 'asks for "^4.2.0"'],
    ['npm\n:zod@^4.2.0', 'asks for "^4.2.0"'],
  ] as const
) {
  Deno.test(`${JSON.stringify(specifier)} fails with file, line and fix`, () => {
    const problems = check(repo({ ...exact, dep: specifier }, pinned));
    assertEquals(problems.length, 1);
    assert(
      problems[0]?.startsWith(`${DENO_JSON}:12: ${JSON.stringify(specifier)} ${what}`),
      problems[0],
    );
    assert(problems[0]?.includes('deno install --lockfile-only'), problems[0]);
  });
}

Deno.test('a specifier behind another JSON escape fails, without a line', () => {
  const dir = repo(exact, pinned);
  Deno.writeTextFileSync(`${dir}/${DENO_JSON}`, '{"imports":{"zod":"\\u006epm:zod@^4.2.0"}}');
  const problems = check(dir);
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith(`${DENO_JSON}: "npm:zod@^4.2.0" asks for "^4.2.0"`), problems[0]);
});

Deno.test('every bad specifier is reported, outside imports too', () => {
  const dir = repo(exact, pinned);
  const config = {
    imports: { a: 'npm:a@^1.0.0' },
    scopes: { './x/': { b: 'jsr:@b/b@2' } },
  };
  Deno.writeTextFileSync(
    `${dir}/${DENO_JSON}`,
    JSON.stringify(config, null, 2),
  );
  assertEquals(check(dir).map((p) => p.split(' ')[0]), [
    `${DENO_JSON}:3:`,
    `${DENO_JSON}:7:`,
  ]);
});

Deno.test('a missing deno.json fails', () => {
  const problems = check(repo(undefined, pinned));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith(`${DENO_JSON}: is missing`), problems[0]);
});

Deno.test('a wrapper without a checksum fails with file and fix', () => {
  const problems = check(repo(exact, wrapper()));
  assertEquals(problems.length, 1);
  assert(
    problems[0]?.startsWith(`${WRAPPER}: has no distributionSha256Sum=`),
    problems[0],
  );
  assert(problems[0]?.includes('<distributionUrl>.sha256'), problems[0]);
});

Deno.test('a checksum that is empty, short or commented out fails', () => {
  for (
    const line of [
      'distributionSha256Sum=',
      `distributionSha256Sum=${SUM.slice(1)}`,
      `#distributionSha256Sum=${SUM}`,
    ]
  ) {
    assertEquals(check(repo(exact, wrapper(line))).length, 1, line);
  }
});

Deno.test('a missing wrapper file fails', () => {
  const problems = check(repo(exact));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith(`${WRAPPER}: is missing`), problems[0]);
});

Deno.test('a second place for imports beside deno.json fails', () => {
  for (const key of ['importMap', 'workspace']) {
    const config = JSON.stringify({ [key]: './other', imports: exact });
    const problems = check(repo(config, pinned));
    assertEquals(problems.length, 1, key);
    assert(problems[0]?.startsWith(`${DENO_JSON}: "${key}" takes imports from`), problems[0]);
  }
  const problems = check(repo(exact, pinned, { 'package.json': '{"dependencies":{"ms":"^2"}}' }));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('supabase/functions/package.json: '), problems[0]);
});

Deno.test('a URL in deno.json fails with file and line, node: passes', () => {
  for (
    const url of [
      'https://esm.sh/zod@^4',
      'HTTP://esm.sh/zod',
      "data:text/javascript,export { default } from 'npm:ms@^2.0.0';",
    ]
  ) {
    const problems = check(repo({ ...exact, dep: url }, pinned));
    assertEquals(problems.length, 1, url);
    assert(
      problems[0]?.startsWith(`${DENO_JSON}:12: ${JSON.stringify(url)} is a URL`),
      problems[0],
    );
  }
  assertEquals(check(repo({ ...exact, crypto: 'node:crypto' }, pinned)), []);
});

Deno.test('a deno.json with a comment or a trailing comma fails with the file', () => {
  for (const config of ['{ // c\n"imports": {} }', '{ "imports": {}, }']) {
    const problems = check(repo(config, pinned));
    assertEquals(problems.length, 1, config);
    assert(problems[0]?.startsWith(`${DENO_JSON}: is not plain JSON`), problems[0]);
  }
});

for (
  const line of [
    "export { z } from 'npm:zod@^4';",
    "export * from 'jsr:@std/assert@^1';",
    'export * as q from "npm:jose@^6";',
    "import { z } from 'npm:zod@4.6.7';",
    "import { z } from 'NPM:zod@^4.2.0';",
    "import { z } from ' npm:zod@^4.2.0';",
    "import { z } from 'n\\tpm:zod@^4.2.0';",
    'const z = await import(`npm:zod@^4`);',
    "type Z = import('npm:zod@^4').ZodType;",
    "import 'https://esm.sh/zod@4.6.7';",
    "export * from 'data:text/javascript,export {}';",
    "import 'http://esm.sh/zod@4.6.7';",
    'const z = await import(`https://esm.sh/zod@4.6.7`);',
    'import \'h\\u0074tps://esm.sh/ms?a="b"\';',
    "export * from /* c */ 'npm:ms@^2';",
    '/** @jsxImportSource npm:preact@^10 */',
    '/** @jsxImportSourceTypes npm:@types/react@^18 */',
    '/* @jsxImportSource https://esm.sh/preact@10.27.2 */',
    '// @ts-types="npm:@types/ms@^2"',
    '// @deno-types="https://esm.sh/v135/ms@2.1.3/index.d.ts"',
    '/// <reference types="npm:@types/node@^22" />',
    '/// <reference types="https://esm.sh/ms@2.1.3/index.d.ts" />',
    "const later = 'npm:zod@^4';",
    "const shouted = 'JSR:@std/assert@^1';",
    "const letters = Array.from('jsr:@std/assert');",
    "import { z } from 'npm:zod@^4'; import { y } from 'npm:yaml@^2';",
  ]
) {
  Deno.test(`${JSON.stringify(line)} in a function's source fails with file, line and fix`, () => {
    const source = `import { a } from './a.ts';\n\n${line}\n`;
    const problems = check(repo(exact, pinned, { 'api/v1/index.ts': source }));
    assertEquals(problems.length, 1);
    assert(problems[0]?.startsWith('supabase/functions/api/v1/index.ts:3: '), problems[0]);
    assert(problems[0]?.includes(`${DENO_JSON}'s "imports"`), problems[0]);
  });
}

Deno.test('import-map names, paths, node: and URLs that are no specifier pass', () => {
  const source = [
    "import { z } from 'zod';",
    "import './a.ts';",
    "export * from '../_shared/b.ts';",
    "import { hash } from 'node:crypto';",
    "const page = await fetch('https://example.com/npm:zod@^4');",
    "const tool = 'pnpm:zod';",
    "const letters = Array.from('https://example.com/a');",
    "const mail = { from: 'https://example.com' };",
    "const sent = from('https://example.com');",
    "const mine = _import('https://example.com');",
    "const theirs = loader.import('https://example.com');",
    "const lazy = await import('./c.ts');",
    '/** @jsxImportSource preact */',
    '// @ts-types="./ms.d.ts"',
    '/// <reference types="./globals.d.ts" />',
    '// See https://example.com/docs and the npm: prefix.',
  ].join('\n');
  assertEquals(check(repo(exact, pinned, { 'api/index.ts': source })), []);
});

Deno.test('a specifier on the line after its keyword is reported on its own line', () => {
  const source = "import { z } from\n  'npm:zod@^4';\nexport * from\n  'https://esm.sh/ms';\n";
  const problems = check(repo(exact, pinned, { 'a.ts': source }));
  assertEquals(problems.map((p) => p.split(' ')[0]), [
    'supabase/functions/a.ts:2:',
    'supabase/functions/a.ts:4:',
  ]);
});

Deno.test('findings come in file order, lines in order within a file', () => {
  const bad = "// npm:ms@^2\nimport 'https://esm.sh/ms';\n";
  const problems = check(repo(exact, pinned, { 'b.ts': bad, 'a/z.ts': bad, 'a.ts': bad }));
  assertEquals(
    problems.map((p) => p.split(' ')[0]?.replace('supabase/functions/', '')),
    ['a.ts:1:', 'a.ts:2:', 'a/z.ts:1:', 'a/z.ts:2:', 'b.ts:1:', 'b.ts:2:'],
  );
});

Deno.test('a long run of blanks after a keyword does not stall the check', () => {
  const source = `export * from${' '.repeat(200_000)}x;\nimport${' '.repeat(200_000)}(x);\n`;
  const started = performance.now();
  assertEquals(check(repo(exact, pinned, { 'a.ts': source })), []);
  assert(performance.now() - started < 2_000);
});

Deno.test('every script kind is read, other files and node_modules are not', () => {
  const bad = "export * from 'npm:ms@^2';\n";
  for (const name of ['a.ts', 'a.tsx', 'a.js', 'a.mjs', 'a.cjs', 'a.jsx', 'a.mts']) {
    assertEquals(check(repo(exact, pinned, { [name]: bad })).length, 1, name);
  }
  for (const name of ['README.md', 'a.json', 'node_modules/ms/index.js', '.cache/a.ts']) {
    assertEquals(check(repo(exact, pinned, { [name]: bad })), [], name);
  }
});
