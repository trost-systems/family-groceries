// build.mjs against scratch source directories: validation errors, samples, --check. Run by the lint gate.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { matcher } from './build.mjs';

const cli = fileURLToPath(new URL('build.mjs', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'item-icons-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

let runs = 0;
/** Runs build.mjs over a fresh source directory of [files] (path to content). */
function build(files, ...args) {
  return rerun(join(scratch, String(runs++)), files, ...args);
}

function rerun(dir, files, ...args) {
  for (const [path, content] of Object.entries({ REVISION: '1\n', ...files })) {
    mkdirSync(join(dir, 'src', path, '..'), { recursive: true });
    writeFileSync(join(dir, 'src', path), content);
  }
  const r = spawnSync('node', [cli, '--src', join(dir, 'src'), '--out', join(dir, 'out'), ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout + r.stderr, dir };
}

test('writes the Dart map and the JSON, sorted, stops as empty strings', () => {
  const { code, out, dir } = build({
    'b.tsv': '# comment\n\nVollmilch|Milch\t🥛\nKartoffelsalat\t-\tnot salat\n',
    'a.tsv': 'Äpfel\t🍎\n=Ei\t🥚\n',
  });
  assert.equal(code, 0, out);
  assert.match(out, /4 rows, 5 forms, 3 distinct emoji, 1 stops/);
  const json = JSON.parse(readFileSync(join(dir, 'out/site/public/data/item-icons.v1.json'), 'utf8'));
  assert.deepEqual(json, {
    schema: 1,
    revision: 1,
    entries: { '=ei': '🥚', aepfel: '🍎', kartoffelsalat: '', milch: '🥛', vollmilch: '🥛' },
  });
  const dart = readFileSync(join(dir, 'out/app/lib/list/list_view/item_icons.g.dart'), 'utf8');
  assert.match(dart, /const itemIconsRevision = 1;/);
  assert.match(dart, /\{\n {2}'=ei': '🥚',\n {2}'aepfel': '🍎',\n {2}'kartoffelsalat': '',\n/);
});

test('--check fails on a stale output and passes once written', () => {
  const files = { 'a.tsv': 'Milch\t🥛\n' };
  const first = build(files, '--check');
  assert.equal(first.code, 1);
  assert.match(first.out, /item-icons\.v1\.json is stale/);
  assert.equal(rerun(first.dir, files).code, 0);
  const second = rerun(first.dir, files, '--check');
  assert.equal(second.code, 0, second.out);
});

test('names every bad row with file and line', () => {
  const { code, out } = build({
    'a.tsv': 'Milch\t🥛\nTee\t🍵\nBrei\t🥣\n',
    'b.tsv': 'milch\t🥛\nEi\t🥚\nCrème-fraîche\t🥛\nApfel\t🍏🍎\nsaft\n',
  });
  assert.equal(code, 1);
  assert.match(out, /b\.tsv:1: "milch" duplicates "Milch" at .*a\.tsv:1/);
  assert.match(out, /b\.tsv:2: "Ei" is short: write "=ei"/);
  assert.match(out, /b\.tsv:3: form "Crème-fraîche"/);
  assert.match(out, /b\.tsv:4: "🍏🍎" is not in tool\/item_icons\/emoji\.tsv/);
  assert.match(out, /b\.tsv:5: expected <forms>/);
  assert.doesNotMatch(out, /a\.tsv:2/, 'tee is a safe short head');
});

test('a form with and without = is one form', () => {
  const { code, out } = build({ 'a.tsv': '=Reis\t🍚\nreis\t🍚\n' });
  assert.equal(code, 1);
  assert.match(out, /a\.tsv:2: "reis" duplicates "=Reis"/);
});

test('--samples lists every mismatch and writes nothing', () => {
  const { code, out } = build({
    'a.tsv': 'Milch\t🥛\nSalat\t🥬\nKartoffelsalat\t-\n',
    'samples/a.tsv': 'Vollmilch\t🥛\nKartoffelsalat\t🥬\nPreis\t🍚\nGurkensalat\t🥬\n',
  }, '--samples');
  assert.equal(code, 1);
  assert.match(out, /2\/4 samples pass/);
  assert.match(out, /samples\/a\.tsv:2: "Kartoffelsalat" wants 🥬, gets -/);
  assert.match(out, /samples\/a\.tsv:3: "Preis" wants 🍚, gets -/);
  assert.doesNotMatch(out, /wrote/);
});

test('matches phrases first, left to right, longest head, whole words for =', () => {
  const match = matcher(
    new Map([
      ['milch', '🥛'],
      ['kaffee', '☕'],
      ['reis', '🍚'],
      ['eis', '🍨'],
      ['=ei', '🥚'],
      ['salat', '🥬'],
      ['kartoffelsalat', ''],
      ['rote bete', '🟣'],
      ['bete', '🥕'],
      ['hot dog', '🌭'],
      ['dog food', ''],
    ]),
  );
  assert.equal(match('Milch für Kaffee'), '🥛');
  assert.equal(match('Kaffee, Milch'), '☕');
  assert.equal(match('Vollmilch'), '🥛');
  assert.equal(match('Basmatireis'), '🍚');
  assert.equal(match('Vanilleeis'), '🍨');
  assert.equal(match('Reis'), '🍚');
  assert.equal(match('Preis'), null);
  assert.equal(match('Ei'), '🥚');
  assert.equal(match('Brei'), null);
  assert.equal(match('Kartoffelsalat'), null);
  assert.equal(match('Kartoffelsalat mit Milch'), '🥛');
  assert.equal(match('Bio-Kartoffelsalat'), null);
  assert.equal(match('  ROTE   Bete '), '🟣');
  assert.equal(match('dog food hot dog'), '🌭');
  assert.equal(match(''), null);
});

test('--check wants a higher REVISION once the entries differ from origin/main', () => {
  const repo = join(scratch, 'repo');
  const tool = join(repo, 'tool/item_icons');
  mkdirSync(tool, { recursive: true });
  for (const f of ['build.mjs', 'emoji.tsv']) copyFileSync(fileURLToPath(new URL(f, import.meta.url)), join(tool, f));
  const classifier = join(repo, 'supabase/classifier');
  mkdirSync(classifier, { recursive: true });
  for (const f of ['brands', 'dictionary', 'sweep', 'synonyms', 'wordlist']) writeFileSync(join(classifier, `${f}.tsv`), '');
  writeFileSync(join(classifier, 'dictionary.tsv'), 'milch\tchilled\n');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: repo });
  const run = (tsv, revision) => {
    writeFileSync(join(tool, 'a.tsv'), tsv);
    writeFileSync(join(tool, 'REVISION'), `${revision}\n`);
    execFileSync('node', [join(tool, 'build.mjs')], { cwd: repo });
    const r = spawnSync('node', [join(tool, 'build.mjs'), '--check'], { cwd: repo, encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  git('init', '-q');
  run('Milch\t🥛\n', 1);
  git('add', '-A');
  git('commit', '-qm', 'main');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(run('Milch\t🥛\n', 1).code, 0, 'same entries, same revision');
  const same = run('Milch\t🥛\nTee\t🍵\n', 1);
  assert.equal(same.code, 1);
  assert.match(same.out, /REVISION is 1, as on origin\/main, but the entries changed: raise it to 2/);
  assert.equal(run('Milch\t🥛\nTee\t🍵\n', 2).code, 0, 'new entries, new revision');
  assert.equal(readFileSync(join(tool, 'classifier-sweep.tsv'), 'utf8').split('\n').at(-2), 'milch\t🥛');

  writeFileSync(join(classifier, 'wordlist.tsv'), 'Hafermilch\tchilled\tword\n');
  const swept = spawnSync('node', [join(tool, 'build.mjs'), '--check'], { cwd: repo, encoding: 'utf8' });
  assert.equal(swept.status, 1, 'a classifier name whose icon is not recorded fails');
  assert.match(swept.stderr, /classifier-sweep\.tsv is stale: the icons of classifier names changed/);
  execFileSync('node', [join(tool, 'build.mjs')], { cwd: repo });

  const shallow = join(scratch, 'shallow');
  git('add', '-A');
  git('commit', '-qm', 'branch');
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, shallow]);
  execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: shallow });
  const check = (env) =>
    spawnSync('node', ['tool/item_icons/build.mjs', '--check'], { cwd: shallow, encoding: 'utf8', env: { ...process.env, ...env } });
  const blind = check({ ITEM_ICONS_NO_MAIN: '' });
  assert.equal(blind.status, 1, 'a checkout without origin/main fails instead of skipping the REVISION rule');
  assert.match(blind.stderr, /cannot read origin\/main, so REVISION is unchecked/);
  assert.equal(check({ ITEM_ICONS_NO_MAIN: '1' }).status, 0, 'the opt-out skips it');
});
