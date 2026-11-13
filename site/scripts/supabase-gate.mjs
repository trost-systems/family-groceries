// Vercel's ignoreCommand for the site: a production build on main waits until the push-triggered
// supabase-deploy run covering the new site has succeeded, so the site never announces functions
// that are not live yet. Runs in site/ before `npm ci`: Node builtins and git only.
// Exit codes are Vercel's: 1 builds, 0 skips, anything else is an ERROR (the live site stays).
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// Mirrors on.push.paths of .github/workflows/supabase-deploy.yml (a test keeps them equal).
export const DEPLOY_PATHS = ['supabase/**', 'scripts/smoke-remote.sh', 'scripts/mcp-smoke.sh', '.github/workflows/supabase-deploy.yml'];

const SKIP_MARKERS = ['[skip ci]', '[ci skip]', '[no ci]', '[skip actions]', '[actions skip]'];
const POLL_MS = 30_000;
const GRACE_MS = 90_000;
const LIMIT_MS = 25 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const EXIT = { skip: 0, build: 1, fail: 2 };

export function touchesDeploy(file) {
  return DEPLOY_PATHS.some((p) => (p.endsWith('/**') ? file.startsWith(p.slice(0, -2)) : file === p));
}

// git(args) returns stdout and throws on a non-zero exit.
export function planFromGit(git, head, previous) {
  const known = (sha) => {
    try {
      git(['cat-file', '-e', `${sha}^{commit}`]);
      git(['merge-base', '--is-ancestor', sha, head]);
      return true;
    } catch {
      return false;
    }
  };
  const range = previous && known(previous) ? git(['rev-list', '--reverse', `${previous}..${head}`]).split('\n').filter(Boolean) : [head];
  if (range.at(-1) !== head) range.push(head);
  const triggering = range.filter((sha) =>
    git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '--diff-merges=first-parent', sha])
      .split('\n')
      .some((file) => file && touchesDeploy(file)),
  );
  const message = git(['log', '-1', '--format=%B', head]).toLowerCase();
  const headTriggers = triggering.includes(head) && !SKIP_MARKERS.some((m) => message.includes(m));
  return { head, range, triggering, headTriggers };
}

export function decide(plan, runs, elapsedMs, { graceMs, limitMs }) {
  if (plan.triggering.length === 0) return { action: 'build', reason: 'no supabase-deploy for the commits since the live site' };
  if (elapsedMs >= limitMs) {
    return { action: 'fail', reason: `timed out after ${Math.round(elapsedMs / 60_000)} min; Redeploy in Vercel once supabase-deploy is green` };
  }
  if (runs === null) return { action: 'wait', reason: 'GitHub API unavailable' };
  let newest;
  for (const run of runs) {
    const index = plan.range.indexOf(run.sha);
    if (index >= 0 && (newest === undefined || index > plan.range.indexOf(newest.sha))) newest = run;
  }
  if (plan.headTriggers && newest?.sha !== plan.head) return { action: 'wait', reason: `supabase-deploy for ${short(plan.head)} not created yet` };
  if (newest) {
    const what = `supabase-deploy for ${short(newest.sha)} ${newest.url}`;
    if (newest.status !== 'completed') return { action: 'wait', reason: `${what} is ${newest.status}` };
    if (newest.conclusion === 'success') return { action: 'build', reason: `${what} succeeded` };
    return { action: 'fail', reason: `${what} ended ${newest.conclusion}; Redeploy in Vercel once supabase-deploy is green` };
  }
  if (elapsedMs < graceMs) return { action: 'wait', reason: `no supabase-deploy run yet for ${plan.triggering.map(short).join(', ')}` };
  return { action: 'build', reason: `no supabase-deploy run started for ${plan.triggering.map(short).join(', ')} (skipped or not pushed alone)` };
}

const short = (sha) => sha.slice(0, 8);

// Resolves to { runs, waitMs }: runs is null when GitHub gave no list, waitMs how long GitHub asks us to
// back off (a rate limit's reset or Retry-After), else 0.
async function fetchRuns(fetch, env, log, now) {
  const owner = env.VERCEL_GIT_REPO_OWNER || 'trost-systems';
  const repo = env.VERCEL_GIT_REPO_SLUG || 'snacklist';
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/supabase-deploy.yml/runs?event=push&branch=main&per_page=50`;
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'snacklist-site-supabase-gate' };
  if (env.GITHUB_ACTIONS_READ_TOKEN) headers.authorization = `Bearer ${env.GITHUB_ACTIONS_READ_TOKEN}`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status !== 200) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const retryAfter = Number(res.headers.get('retry-after'));
      log(`supabase-gate: GitHub answered ${res.status} (rate limit remaining ${remaining}, reset ${res.headers.get('x-ratelimit-reset')})`);
      let waitMs = 0;
      if (retryAfter > 0) waitMs = retryAfter * 1000;
      else if (remaining === '0' && reset > 0) waitMs = reset * 1000 - now();
      return { runs: null, waitMs: Math.max(0, waitMs) };
    }
    const body = await res.json();
    return { runs: body.workflow_runs.map((r) => ({ sha: r.head_sha, status: r.status, conclusion: r.conclusion, url: r.html_url })), waitMs: 0 };
  } catch (error) {
    log(`supabase-gate: GitHub request failed: ${error.message}`);
    return { runs: null, waitMs: 0 };
  }
}

export async function main({ env, git, fetch, now, sleep, log }) {
  try {
    const ref = env.VERCEL_GIT_COMMIT_REF ?? '';
    if (ref === '') return EXIT.build;
    if (ref !== 'main') {
      log(`supabase-gate: skipping ${ref}, the site deploys from main only`);
      return EXIT.skip;
    }
    const head = env.VERCEL_GIT_COMMIT_SHA || git(['rev-parse', 'HEAD']).trim();
    const plan = planFromGit(git, head, env.VERCEL_GIT_PREVIOUS_SHA);
    const start = now();
    let lastReason;
    for (;;) {
      const { runs, waitMs } = plan.triggering.length === 0 ? { runs: [], waitMs: 0 } : await fetchRuns(fetch, env, log, now);
      const elapsed = now() - start;
      const verdict = decide(plan, runs, elapsed, { graceMs: GRACE_MS, limitMs: LIMIT_MS });
      if (verdict.reason !== lastReason) log(`supabase-gate: ${verdict.action}: ${verdict.reason}`);
      lastReason = verdict.reason;
      if (verdict.action !== 'wait') return EXIT[verdict.action];
      await sleep(Math.min(Math.max(POLL_MS, waitMs), LIMIT_MS - elapsed));
    }
  } catch (error) {
    log(`supabase-gate: failing closed: ${error.stack ?? error}`);
    return EXIT.fail;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main({
    env: process.env,
    git: (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    fetch: globalThis.fetch,
    now: Date.now,
    sleep: delay,
    log: (line) => console.log(line),
  });
}
