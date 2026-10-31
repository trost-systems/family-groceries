// record.mjs against a scratch git repository: stats, contributors, refusals. Run by scripts/release/test.sh.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RecordError, parseRecord, serializeRecord } from '../../site/releases.mjs';
import { storeTexts } from './changelog.mjs';

const cli = fileURLToPath(new URL('record.mjs', import.meta.url));
const realRecord = fileURLToPath(new URL('../../releases/releases.json', import.meta.url));

const peter = 'Peter Trost <peter@petertrost.com>';
const botNoreply = 'petertrost-bot <341616691+petertrost-bot@users.noreply.github.com>';
const claude = 'Claude Opus 5.5 <noreply@anthropic.com>';

let repo;
let record;
const shas = {};
let day = 0;

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

function commit(name, author, files, trailers = []) {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) rmSync(join(repo, path));
    else writeFileSync(join(repo, path), content);
  }
  const [, authorName, authorEmail] = /^(.*) <(.*)>$/.exec(author);
  const date = `2026-10-${String(22 + day++).padStart(2, '0')}T10:00:00+02:00`;
  const message = trailers.length ? `${name}\n\n${trailers.join('\n')}` : name;
  git('add', '-A');
  execFileSync('git', ['-c', `user.name=${authorName}`, '-c', `user.email=${authorEmail}`, 'commit', '-q', '-m', message], {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
  shas[name] = git('rev-parse', 'HEAD');
}

function run(...args) {
  const result = spawnSync('node', [cli, 'add', '--main', 'main', '--file', record, ...args], { cwd: repo, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const read = () => parseRecord(readFileSync(record, 'utf8'));
const release = (version) => read().releases.find((r) => r.version === version);

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'record-test-'));
  git('init', '-q', '-b', 'main');
  commit('c1', peter, { 'a.txt': '1\n2\n3\n' });
  commit('c2', botNoreply, { 'a.txt': '1\nX\n3\n', 'img.bin': Buffer.from([0, 1, 2, 0, 255]) }, [
    `Co-authored-by: ${peter}`,
    'co-authored-by: petertrost-bot <bot@petertrost.com>',
    `Co-Authored-By: ${claude}`,
  ]);
  commit('c3', 'Lea <12345+Lea-X@users.noreply.github.com>', { 'b.txt': 'milk\neggs\n' }, [
    'Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>',
  ]);
  commit('c4', 'renovate[bot] <bot@renovate.example>', { 'b.txt': null });
  commit('c5', 'petertrost-bot <BOT@PeterTrost.com>', { 'c.txt': 'c\n' }, [`Co-authored-by: ${peter}`]);
  commit('c6', peter, { 'd.txt': 'd\n' });
  git('switch', '-q', '-c', 'side');
  commit('s1', peter, { 'e.txt': 'e\n' });
  git('switch', '-q', 'main');

  const real = parseRecord(readFileSync(realRecord, 'utf8'));
  record = join(repo, 'record.json');
  writeFileSync(record, serializeRecord({ ...real, project: { ...real.project, day_zero: '2026-10-22' }, releases: [] }));
});

after(() => rmSync(repo, { recursive: true, force: true }));

test('the real record parses', () => {
  assert.doesNotThrow(() => parseRecord(readFileSync(realRecord, 'utf8')));
});

test('the first release counts from the root commit', () => {
  const out = run('--version', '1.0.0', '--sha', shas.c4, '--build', '10', '--date', '2026-10-25', '--stores', 'app_store,play', '--notes-de', 'Erste', '--notes-en', 'First');
  assert.equal(out.code, 0, out.stderr);
  assert.equal(out.stdout.trim(), 'recorded 1.0.0 (day 3, 4 commits, 6 contributors)');
  const r = release('1.0.0');
  assert.deepEqual(
    { ...r, stats: { ...r.stats, contributors: undefined } },
    {
      version: '1.0.0',
      channel: 'public',
      date: '2026-10-25',
      day: 3,
      build: 10,
      sha: shas.c4,
      previous_sha: null,
      stores: { app_store: true, play: true, web: false },
      stats: { commits: 4, additions: 3, deletions: 0, files_changed: 2, contributors: undefined },
      notes: { de: 'Erste', en: 'First' },
    },
    'totals are the net diff: b.txt came and went, the binary file counts with 0 lines',
  );
  assert.deepEqual(r.stats.contributors, [
    { name: 'Peter Trost', github: 'peter-trost', commits: 2, additions: 4, deletions: 1, bot: false },
    { name: 'Lea', github: 'Lea-X', commits: 1, additions: 2, deletions: 0, bot: false },
    { name: 'dependabot[bot]', github: 'dependabot[bot]', commits: 1, additions: 2, deletions: 0, bot: true },
    { name: 'Claude', github: null, commits: 1, additions: 1, deletions: 1, bot: true },
    { name: 'petertrost-bot', github: 'petertrost-bot', commits: 1, additions: 1, deletions: 1, bot: true },
    { name: 'renovate[bot]', github: null, commits: 1, additions: 0, deletions: 2, bot: true },
  ]);
});

test('the next release counts from the previous one', () => {
  const out = run('--version', '1.1.0', '--sha', 'HEAD', '--build', '11', '--date', '2026-10-27');
  assert.equal(out.code, 0, out.stderr);
  const r = release('1.1.0');
  assert.equal(r.sha, shas.c6, '--sha is resolved to the full commit');
  assert.equal(r.previous_sha, shas.c4);
  assert.equal(r.day, 5);
  assert.deepEqual(r.stores, { app_store: true, play: true, web: true });
  assert.deepEqual(r.notes, { de: '', en: '' });
  assert.deepEqual({ ...r.stats, contributors: undefined }, { commits: 2, additions: 2, deletions: 0, files_changed: 2, contributors: undefined });
  assert.deepEqual(r.stats.contributors, [
    { name: 'Peter Trost', github: 'peter-trost', commits: 2, additions: 2, deletions: 0, bot: false },
    { name: 'petertrost-bot', github: 'petertrost-bot', commits: 1, additions: 1, deletions: 0, bot: true },
  ]);
  const text = readFileSync(record, 'utf8');
  assert.equal(text, serializeRecord(parseRecord(text)), 'the file is canonical');
  assert.deepEqual(read().releases.map((x) => x.version), ['1.0.0', '1.1.0']);
});

test('a dry run prints the entry and leaves the file as it was', () => {
  const text = readFileSync(record, 'utf8');
  const out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, /"version": "1.2.0"/);
  assert.match(out.stdout, /dry run: .* not changed/);
  assert.equal(readFileSync(record, 'utf8'), text);
});

test('notes may start with a dash when passed as --notes-de=… (the workflow does)', () => {
  const out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run', '--notes-de=- Neu: Uhr', '--notes-en=--x');
  assert.equal(out.code, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout.slice(0, out.stdout.lastIndexOf('}') + 1)).notes.de, '- Neu: Uhr');
});

const refusals = [
  ['an existing version', ['--version', '1.1.0', '--build', '20'], /already recorded/],
  ['a version that is not MAJOR.MINOR.PATCH', ['--version', '1.4', '--build', '20'], /MAJOR\.MINOR\.PATCH/],
  ['a version not above the newest', ['--version', '1.0.5', '--build', '20'], /must be above the newest public release 1\.1\.0/],
  ['a build not above the previous one', ['--version', '1.2.0', '--build', '11'], /build 11 must be above/],
  ['an unknown store', ['--version', '1.2.0', '--build', '20', '--stores', 'app_store,steam'], /unknown store steam/],
  ['a date before the previous release', ['--version', '1.2.0', '--build', '20', '--date', '2026-10-26'], /before 1\.1\.0's date/],
  ['an unknown channel', ['--version', '1.2.0', '--build', '20', '--channel', 'beta'], /--channel beta/],
];
for (const [what, args, reason] of refusals) {
  test(`refuses ${what}`, () => {
    const text = readFileSync(record, 'utf8');
    const out = run('--sha', shas.c6, '--date', '2026-10-31', ...args);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^record: /);
    assert.match(out.stderr, reason);
    assert.equal(readFileSync(record, 'utf8'), text);
  });
}

test('refuses a commit that is not on main', () => {
  const out = run('--version', '1.2.0', '--build', '20', '--sha', shas.s1);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /^record: .*is not on main/);
});

test('refuses a commit the previous release is not part of', () => {
  const out = run('--version', '1.2.0', '--build', '20', '--sha', shas.c5);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /^record: 1\.1\.0's sha .* is not an ancestor/);
});

// Job 39: the reviewed changelog draft next to the record goes into the entry.
const draftOf = (version, sha, previous, items = { new: [{ de: 'Neu.', en: 'New.', pr: 7, sha }], improved: [], fixed: [] }) => {
  const changelog = { title: { de: 'Titel', en: 'Title' }, items };
  return { version, status: 'draft', generated_from: { previous_sha: previous, sha }, ...changelog, store: storeTexts(changelog, version) };
};
const draftPath = (version) => join(repo, 'changelog', `${version}.json`);
const writeDraft = (draft) => {
  mkdirSync(join(repo, 'changelog'), { recursive: true });
  writeFileSync(draftPath(draft.version), `${JSON.stringify(draft, null, 2)}\n`);
};

test('a dry run shows the draft in the entry and keeps the draft file', () => {
  writeDraft(draftOf('1.2.0', shas.c6, shas.c6));
  const out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 0, out.stderr);
  const entry = JSON.parse(out.stdout.slice(0, out.stdout.lastIndexOf('}') + 1));
  assert.deepEqual(entry.changelog.items.new, [{ de: 'Neu.', en: 'New.', pr: 7, sha: shas.c6 }]);
  assert.match(out.stdout, /changelog\/1\.2\.0\.json kept/);
  assert.ok(existsSync(draftPath('1.2.0')));
});

test('without a draft the release has no changelog, with a warning', () => {
  rmSync(draftPath('1.2.0'));
  const out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stderr, /no .*changelog\/1\.2\.0\.json, so 1\.2\.0 has no changelog/);
  assert.ok(!('changelog' in JSON.parse(out.stdout.slice(0, out.stdout.lastIndexOf('}') + 1))));
});

test('refuses a draft of another version and a malformed draft', () => {
  writeDraft({ ...draftOf('1.3.0', shas.c6, shas.c6), version: '1.3.0' });
  writeFileSync(draftPath('1.2.0'), readFileSync(draftPath('1.3.0')));
  let out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 1);
  assert.match(out.stderr, /is the changelog of 1\.3\.0, not 1\.2\.0/);
  writeDraft({ ...draftOf('1.2.0', shas.c6, shas.c6), items: { new: [{ de: 'Neu.', pr: 7, sha: shas.c6 }], improved: [], fixed: [] } });
  out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 1);
  assert.match(out.stderr, /items\.new\[0\]\.en: missing/);
  rmSync(draftPath('1.3.0'));
  const stale = draftOf('1.2.0', shas.c6, shas.c6);
  stale.items.new[0].de = 'Anders.';
  writeDraft(stale);
  out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--dry-run');
  assert.equal(out.code, 1, 'store texts edited away from the items');
  assert.match(out.stderr, /store texts app_store\.de, play\.de are not what its title and items give/);
});

test('records the changelog and deletes the draft file', () => {
  writeDraft(draftOf('1.2.0', shas.c6, shas.c6));
  const out = run('--version', '1.2.0', '--sha', shas.c6, '--build', '12', '--date', '2026-10-31');
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, /moved the changelog from .*1\.2\.0\.json into the record/);
  assert.ok(!existsSync(draftPath('1.2.0')));
  const r = release('1.2.0');
  assert.deepEqual(r.changelog.title, { de: 'Titel', en: 'Title' });
  assert.equal(r.changelog.store.play.en, 'Title\n\nNew:\n• New.');
  assert.deepEqual(release('1.1.0').changelog, undefined, 'earlier entries keep their shape');
});

test('parseRecord: entries without changelog pass, a malformed changelog fails', () => {
  const data = JSON.parse(readFileSync(record, 'utf8'));
  const rejects = (patch, pattern) => {
    const copy = structuredClone(data);
    patch(copy.releases.at(-1).changelog);
    assert.throws(() => parseRecord(JSON.stringify(copy)), (e) => e instanceof RecordError && pattern.test(e.message), String(pattern));
  };
  assert.doesNotThrow(() => parseRecord(JSON.stringify(data)));
  rejects((c) => delete c.store, /changelog\.store: missing/);
  rejects((c) => (c.items.wow = []), /changelog\.items\.wow: unknown field/);
  rejects((c) => (c.items.new[0].de = ''), /items\.new\[0\]\.de: must not be empty/);
  rejects((c) => (c.items.new[0].en = 'two\nlines'), /items\.new\[0\]\.en: must be one line/);
  rejects((c) => (c.items.new[0].sha = 'abc'), /items\.new\[0\]\.sha: must be a full commit sha/);
  rejects((c) => (c.items.new[0].pr = '7'), /items\.new\[0\]\.pr: must be a PR number or null/);
  rejects((c) => (c.store.play.de = 'x'.repeat(501)), /store\.play\.de: is 501 Unicode characters, above the store's limit of 500/);
  rejects((c) => (c.store.app_store.de = 'ä'.repeat(2001)), /store\.app_store\.de: is 4002 UTF-8 bytes/);
});
