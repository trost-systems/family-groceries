import { assert, assertEquals } from '@std/assert';
import { check } from './brand-names.ts';

function repo(files: Record<string, string>, entries?: unknown[]): string {
  const dir = Deno.makeTempDirSync();
  const all = { ...files };
  if (entries) all['scripts/brand-names.allow.json'] = JSON.stringify({ entries });
  for (const [path, text] of Object.entries(all)) {
    Deno.mkdirSync(`${dir}/${path.split('/').slice(0, -1).join('/')}`, { recursive: true });
    Deno.writeTextFileSync(`${dir}/${path}`, text);
  }
  return dir;
}

const arb = (value: string) =>
  JSON.stringify({ '@@locale': 'en', hello: 'Hi', '@hello': { description: value }, shown: value });
const clean = { 'site/content/a.md': 'Hummlist\n', 'app/l10n/app_en.arb': arb('Hello') };

Deno.test('a clean repo passes', () => {
  assertEquals(check(repo(clean)), []);
});

Deno.test('a brand in site/content fails with file and line', () => {
  const problems = check(repo({ ...clean, 'site/content/a.md': 'one\ntwo ChatGPT\n' }));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('site/content/a.md:2: names "ChatGPT"'));
});

Deno.test('a brand in a text file of site/public fails, a binary is skipped', () => {
  const problems = check(
    repo({ ...clean, 'site/public/x.svg': 'Claude', 'site/public/x.mp4': 'Claude' }),
  );
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('site/public/x.svg:1:'));
});

Deno.test('a brand in an ARB value fails', () => {
  const problems = check(repo({ ...clean, 'app/l10n/app_en.arb': arb('Ask OpenAI') }));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('app/l10n/app_en.arb:'));
});

Deno.test('a brand in @-metadata passes', () => {
  const text = JSON.stringify({ hello: 'Hi', '@hello': { description: 'Anthropic' } });
  assertEquals(check(repo({ ...clean, 'app/l10n/app_en.arb': text })), []);
});

Deno.test('a whole-file entry allows', () => {
  const dir = repo({ ...clean, 'site/content/a.md': 'Claude' }, [
    { file: 'site/content/a.md', reason: 'guide' },
  ]);
  assertEquals(check(dir), []);
});

Deno.test('a key entry allows that key only', () => {
  const files = { ...clean, 'app/l10n/app_en.arb': arb('Claude') };
  const entry = { file: 'app/l10n/app_en.arb', key: 'shown', reason: 'help' };
  assertEquals(check(repo(files, [entry])), []);
  assertEquals(check(repo(files, [{ ...entry, key: 'other' }])).length, 2);
});

Deno.test('a contains entry allows that line only', () => {
  const files = { ...clean, 'site/content/a.md': 'see https://x/claude.md\nAsk Claude\n' };
  const problems = check(
    repo(files, [{ file: 'site/content/a.md', contains: 'https://x/claude.md', reason: 'url' }]),
  );
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('site/content/a.md:2:'));
});

Deno.test('a stale entry fails', () => {
  const problems = check(repo(clean, [{ file: 'site/content/a.md', reason: 'guide' }]));
  assertEquals(problems.length, 1);
  assert(problems[0]?.includes('stale') && problems[0]?.includes('Remove it'));
});

Deno.test('an entry without a reason fails', () => {
  const dir = repo({ ...clean, 'site/content/a.md': 'Claude' }, [
    { file: 'site/content/a.md', reason: ' ' },
  ]);
  const problems = check(dir);
  assertEquals(problems.length, 1);
  assert(problems[0]?.includes('no reason'));
});

Deno.test('an entry for a missing file fails', () => {
  const problems = check(repo(clean, [{ file: 'site/content/gone.md', reason: 'guide' }]));
  assertEquals(problems.length, 1);
  assert(problems[0]?.includes('missing'));
});

Deno.test('case does not matter, word boundaries do', () => {
  assertEquals(check(repo({ ...clean, 'site/content/a.md': 'CLAUDE' })).length, 1);
  assertEquals(check(repo({ ...clean, 'site/content/a.md': 'Claudette' })), []);
});

Deno.test('a brands entry allows only the brands it lists', () => {
  const files = { ...clean, 'site/content/g.md': 'Claude here\nand Claude there\nalso ChatGPT\n' };
  const entry = { file: 'site/content/g.md', brands: ['Claude'], reason: 'guide' };
  const problems = check(repo(files, [entry]));
  assertEquals(problems.length, 1);
  assert(problems[0]?.startsWith('site/content/g.md:3: names "ChatGPT"'));
  const bad = check(repo(files, [{ ...entry, brands: ['Gemini'] }]));
  assert(bad.some((p) => p.includes('brands must list')));
});
