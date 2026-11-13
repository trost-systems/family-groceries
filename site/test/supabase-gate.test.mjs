import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { DEPLOY_PATHS, decide, main, planFromGit } from '../scripts/supabase-gate.mjs';
import { REPO_DIR, SITE_DIR, tempDir } from './helpers.mjs';

const LIMITS = { graceMs: 90_000, limitMs: 25 * 60_000 };
const run = (sha, status, conclusion = null) => ({ sha, status, conclusion, url: `https://github.com/runs/${sha}` });
const plan = (range, triggering, headTriggers = triggering.includes(range.at(-1))) => ({ head: range.at(-1), range, triggering, headTriggers });

const CASES = [
  ['site-only push builds at once', plan(['b'], []), [], 0, 'build'],
  ['site-only push builds even when GitHub is down', plan(['b'], []), null, 0, 'build'],
  ['supabase push waits while its run is queued', plan(['a'], ['a']), [run('a', 'queued')], 0, 'wait'],
  ['supabase push waits while its run is in progress', plan(['a'], ['a']), [run('a', 'in_progress')], 60_000, 'wait'],
  ['supabase push builds once its run succeeded', plan(['a'], ['a']), [run('a', 'completed', 'success')], 60_000, 'build'],
  ['mixed push builds once its run succeeded', plan(['x', 'a'], ['a']), [run('a', 'completed', 'success'), run('x', 'completed', 'failure')], 0, 'build'],
  ['a failed run fails the build', plan(['a'], ['a']), [run('a', 'completed', 'failure')], 0, 'fail'],
  ['a cancelled run fails the build', plan(['a'], ['a']), [run('a', 'completed', 'cancelled')], 0, 'fail'],
  ['two close pushes: B waits for its own run, not A green one', plan(['b'], ['b']), [run('a', 'completed', 'success')], 5 * 60_000, 'wait'],
  ['HEAD run not created yet waits past the grace period', plan(['b'], ['b']), [], 5 * 60_000, 'wait'],
  ['the newest run of a SHA counts (API order)', plan(['a'], ['a']), [run('a', 'in_progress'), run('a', 'completed', 'failure')], 0, 'wait'],
  ['site-only commit after a live supabase commit builds at once', plan(['b'], []), [run('a', 'in_progress')], 0, 'build'],
  ['site-only commit after a not yet live supabase commit waits for it', plan(['a', 'b'], ['a']), [run('a', 'in_progress')], 0, 'wait'],
  ['site-only commit after a not yet live supabase commit builds once it is green', plan(['a', 'b'], ['a']), [run('a', 'completed', 'success')], 0, 'build'],
  ['site-only commit after a failed supabase commit fails', plan(['a', 'b'], ['a']), [run('a', 'completed', 'failure')], 0, 'fail'],
  ['a newer green run supersedes an older failed one', plan(['a', 'c', 'b'], ['a', 'c']), [run('c', 'completed', 'success'), run('a', 'completed', 'failure')], 0, 'build'],
  ['runs outside the range never count', plan(['b'], ['b']), [run('z', 'completed', 'success')], 0, 'wait'],
  ['timeout fails', plan(['a'], ['a']), [run('a', 'in_progress')], 25 * 60_000, 'fail'],
  ['GitHub API error waits', plan(['a'], ['a']), null, 0, 'wait'],
  ['[skip ci] HEAD without a run waits through the grace period', plan(['a'], ['a'], false), [], 30_000, 'wait'],
  ['[skip ci] HEAD without a run builds after the grace period', plan(['a'], ['a'], false), [], 90_000, 'build'],
  ['[skip ci] HEAD with an older run in range follows that run', plan(['x', 'a'], ['x', 'a'], false), [run('x', 'in_progress')], 5 * 60_000, 'wait'],
];

for (const [name, p, runs, elapsed, action] of CASES) {
  test(`decide: ${name}`, () => {
    const verdict = decide(p, runs, elapsed, LIMITS);
    assert.equal(verdict.action, action, verdict.reason);
    assert.ok(verdict.reason.length > 0);
  });
}

test('decide: a failure names the SHA, the conclusion and the run', () => {
  const { reason } = decide(plan(['abcdef123456'], ['abcdef123456']), [run('abcdef123456', 'completed', 'failure')], 0, LIMITS);
  assert.match(reason, /abcdef12/);
  assert.match(reason, /failure/);
  assert.match(reason, /https:\/\/github\.com\/runs\/abcdef123456/);
});

test('decide: a timeout says to redeploy once supabase-deploy is green', () => {
  assert.match(decide(plan(['a'], ['a']), null, LIMITS.limitMs, LIMITS).reason, /Redeploy in Vercel/);
});

test('DEPLOY_PATHS equals the on.push.paths of supabase-deploy.yml', () => {
  const workflow = yaml.load(readFileSync(join(REPO_DIR, '.github/workflows/supabase-deploy.yml'), 'utf8'));
  assert.deepEqual(DEPLOY_PATHS, workflow.on.push.paths);
});

test('vercel.json runs the gate as its ignoreCommand', () => {
  const config = JSON.parse(readFileSync(join(SITE_DIR, 'vercel.json'), 'utf8'));
  assert.equal(config.ignoreCommand, 'node scripts/supabase-gate.mjs');
});

function tempRepo() {
  const dir = tempDir();
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);
  const commit = (message, files) => {
    for (const file of files) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), message);
    }
    git(['add', '-A']);
    git(['commit', '-q', '-m', message]);
    return git(['rev-parse', 'HEAD']).trim();
  };
  return { git, commit };
}

test('planFromGit: range, triggering commits, [skip ci] and an unknown previous SHA', () => {
  const { git, commit } = tempRepo();
  const root = commit('root', ['README.md']);
  const site = commit('site only', ['site/index.md']);
  const mixed = commit('mixed', ['site/guide.md', 'supabase/functions/api/index.ts']);
  const smoke = commit('smoke script', ['scripts/smoke-remote.sh', 'scripts/other.sh']);
  const lookalike = commit('lookalike paths', ['supabase-notes.md', 'site/supabase/x.md']);

  assert.deepEqual(planFromGit(git, lookalike, root), {
    head: lookalike,
    range: [site, mixed, smoke, lookalike],
    triggering: [mixed, smoke],
    headTriggers: false,
  });
  assert.deepEqual(planFromGit(git, mixed, site), { head: mixed, range: [mixed], triggering: [mixed], headTriggers: true });

  const skipped = commit('migration [skip ci]', ['supabase/migrations/1.sql']);
  assert.deepEqual(planFromGit(git, skipped, lookalike), { head: skipped, range: [skipped], triggering: [skipped], headTriggers: false });

  const missing = '0123456789abcdef0123456789abcdef01234567';
  for (const previous of [undefined, '', missing, skipped]) {
    assert.deepEqual(planFromGit(git, lookalike, previous).range, [lookalike], `previous ${previous}`);
  }
});

function harness({ ref = 'main', responses = [], files = ['supabase/functions/x.ts'], previous, rateLimitReset = 0 } = {}) {
  const { git, commit } = tempRepo();
  const base = commit('base', ['README.md']);
  const head = commit('change', files);
  const lines = [];
  const urls = [];
  let clock = 0;
  let sleeps = 0;
  const slept = [];
  const fetch = (url) => {
    urls.push(url);
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (typeof next === 'number') {
      return Promise.resolve(new Response('{}', { status: next, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(rateLimitReset) } }));
    }
    const runs = next.map(([status, conclusion]) => ({ head_sha: head, status, conclusion, html_url: `https://github.com/r/${head}` }));
    return Promise.resolve(Response.json({ workflow_runs: runs }));
  };
  const env = { VERCEL_GIT_COMMIT_REF: ref, VERCEL_GIT_COMMIT_SHA: head, VERCEL_GIT_PREVIOUS_SHA: previous ?? base };
  const result = main({
    env,
    git,
    fetch,
    now: () => clock,
    sleep: (ms) => {
      sleeps += 1;
      slept.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    log: (line) => lines.push(line),
  });
  return { result, lines, urls, slept, sleeps: () => sleeps };
}

test('main: a branch other than main skips without asking GitHub', async () => {
  const h = harness({ ref: 'job/x' });
  assert.equal(await h.result, 0);
  assert.equal(h.urls.length, 0);
});

test('main: a site-only push builds without asking GitHub', async () => {
  const h = harness({ files: ['site/index.md'] });
  assert.equal(await h.result, 1);
  assert.equal(h.urls.length, 0);
});

test('main: pending then success builds after sleeping, asking only for push runs on main', async () => {
  const h = harness({ responses: [[], [['queued', null]], [['in_progress', null]], [['in_progress', null]], [['completed', 'success']]] });
  assert.equal(await h.result, 1);
  assert.equal(h.sleeps(), 4);
  const url = new URL(h.urls[0]);
  assert.equal(url.pathname, '/repos/trost-systems/snacklist/actions/workflows/supabase-deploy.yml/runs');
  assert.equal(url.searchParams.get('event'), 'push');
  assert.equal(url.searchParams.get('branch'), 'main');
  assert.equal(h.lines.filter((l) => l.includes('in_progress')).length, 1, `one line per state change: ${h.lines.join('\n')}`);
});

test('main: a failed run exits 2', async () => {
  const h = harness({ responses: [[['completed', 'failure']]] });
  assert.equal(await h.result, 2);
});

test('main: a run that never finishes times out with exit 2', async () => {
  const h = harness({ responses: [[['in_progress', null]]] });
  assert.equal(await h.result, 2);
  assert.match(h.lines.at(-1), /timed out/);
});

test('main: GitHub errors wait and log the rate limit', async () => {
  const h = harness({ responses: [403, [['completed', 'success']]] });
  assert.equal(await h.result, 1);
  assert.match(h.lines.join('\n'), /403.*remaining 0/);
});

test('main: a spent rate limit sleeps until its reset, never past the limit', async () => {
  const h = harness({ responses: [403, [['completed', 'success']]], rateLimitReset: 600 });
  assert.equal(await h.result, 1);
  assert.deepEqual(h.slept, [600_000]);
  const late = harness({ responses: [403], rateLimitReset: 3600 });
  assert.equal(await late.result, 2);
  assert.deepEqual(late.slept, [25 * 60_000]);
});

test('main: a previous SHA git does not know checks HEAD alone', async () => {
  const h = harness({ responses: [[['completed', 'success']]], previous: 'not-a-sha' });
  assert.equal(await h.result, 1);
});

test('main: an unexpected error fails closed', async () => {
  const git = () => {
    throw new Error('no git');
  };
  const offline = () => Promise.reject(new Error('no network'));
  const code = await main({ env: { VERCEL_GIT_COMMIT_REF: 'main' }, git, fetch: offline, now: () => 0, sleep: () => Promise.resolve(), log: () => {} });
  assert.equal(code, 2);
});
