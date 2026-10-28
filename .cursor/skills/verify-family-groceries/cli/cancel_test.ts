import { assert, assertEquals, assertRejects } from '@std/assert';
import { type Ctx, FgError, stopIf } from './core.ts';
import { realShell } from './fg.ts';
import { type StopSignal, withTeardownOnFailure } from './fixture_commands.ts';
import { takeE2eLock } from './sync.ts';
import { Api, type Target } from './target.ts';

const logs: string[] = [];
const ctx = { log: (m: string) => logs.push(m), sh: realShell, dryRun: false } as unknown as Ctx;
const target = { kind: 'hosted', label: 'test target' } as Target;

/** Fake process hooks: send() delivers a signal, exits and teardowns are recorded. */
function hooks() {
  let deliver: ((sig: StopSignal) => void) | null = null;
  const record = { teardowns: 0, removed: false };
  return {
    record,
    send: (sig: StopSignal) => deliver!(sig),
    hooks: {
      listen: (on: (sig: StopSignal) => void) => {
        deliver = on;
        return () => {
          record.removed = true;
        };
      },
      teardown: () => Promise.resolve(record.teardowns++),
    },
  };
}

/** Work that waits until it is aborted, like the lock wait or the browser run. */
const waitUntilAborted = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new FgError('interrupted', 'stopped', ''))));

for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
  Deno.test(`${sig} aborts the work, tears the seeded run down, then fails with exit code ${code}`, async () => {
    const h = hooks();
    let aborted = false;
    const work = withTeardownOnFailure(ctx, target, 'r1', () => true, (signal) => {
      signal.addEventListener('abort', () => (aborted = true));
      return waitUntilAborted(signal);
    }, h.hooks);
    h.send(sig);
    const err = await assertRejects(() => work, FgError);
    assert(aborted, 'the signal reached the work');
    assertEquals(h.record.teardowns, 1);
    assertEquals([err.code, err.exitCode, err.details.tornDown], ['interrupted', code, true]);
    assert(h.record.removed, 'listeners removed');
  });
}

Deno.test('a stop before anything was seeded exits without a teardown', async () => {
  const h = hooks();
  const work = withTeardownOnFailure(ctx, target, 'r1', () => false, waitUntilAborted, h.hooks);
  h.send('SIGTERM');
  const err = await assertRejects(() => work, FgError);
  assertEquals(h.record.teardowns, 0);
  assertEquals([err.exitCode, err.message], [143, 'Stopped by SIGTERM; nothing was seeded yet.']);
});

Deno.test('a failure tears down and rethrows; a second signal is ignored', async () => {
  const h = hooks();
  await assertRejects(
    () => withTeardownOnFailure(ctx, target, 'r1', () => true, () => Promise.reject(new FgError('boom', 'boom', '')), h.hooks),
    FgError,
    'boom',
  );
  assertEquals(h.record.teardowns, 1);

  const h2 = hooks();
  const work = withTeardownOnFailure(ctx, target, 'r2', () => true, waitUntilAborted, h2.hooks);
  h2.send('SIGINT');
  h2.send('SIGTERM');
  const err = await assertRejects(() => work, FgError);
  assertEquals(err.exitCode, 130, 'the first signal decides');
  assertEquals(h2.record.teardowns, 1);
});

Deno.test('seeding loops stop at their next step once aborted', () => {
  const c = new AbortController();
  stopIf(c.signal, 'Seeding');
  c.abort();
  let code = '';
  try {
    stopIf(c.signal, 'Seeding');
  } catch (e) {
    code = (e as FgError).code;
  }
  assertEquals(code, 'interrupted');
});

Deno.test('a process run with the signal is killed when it aborts', async () => {
  const c = new AbortController();
  const started = Date.now();
  setTimeout(() => c.abort(), 200);
  const err = await assertRejects(() => realShell.run(['sleep', '30'], { signal: c.signal }), FgError);
  assertEquals(err.code, 'interrupted');
  assert(Date.now() - started < 5000, 'killed, not waited out');
});

async function pgrep(pattern: string): Promise<string> {
  const { stdout } = await new Deno.Command('pgrep', { args: ['-f', pattern] }).output();
  return new TextDecoder().decode(stdout).trim();
}

/** Polls until [ready] holds; a state to wait for, not a guessed delay. */
async function waitFor(ready: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await ready())) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 20));
  }
}

Deno.test('the e2e lock wait ends as soon as the signal aborts, and leaves no waiting flock behind', async () => {
  const lock = await Deno.makeTempFile({ suffix: '.lock' });
  const holder = new Deno.Command('flock', {
    args: [lock, 'sh', '-c', 'echo held; exec sleep 30'],
    stdout: 'piped',
    stderr: 'null',
  }).spawn();
  const held = holder.stdout.getReader();
  try {
    assert(new TextDecoder().decode((await held.read()).value).includes('held'), 'the holder has the lock');
    const c = new AbortController();
    const started = Date.now();
    const waiting = takeE2eLock(ctx, 120, c.signal, lock);
    await waitFor(async () => (await pgrep(`flock -w 120 ${lock}`)) !== '');
    c.abort();
    const err = await assertRejects(() => waiting, FgError);
    assertEquals(err.code, 'interrupted');
    assert(Date.now() - started < 5000, 'the 120 s wait was cut short');
    assertEquals(await pgrep(`flock -w 120 ${lock}`), '', 'no flock left waiting');

    const busy = await assertRejects(() => takeE2eLock(ctx, 1, undefined, lock), FgError);
    assertEquals(busy.code, 'e2e_lock_busy', 'without a signal the wait still times out normally');
  } finally {
    held.releaseLock();
    holder.kill('SIGTERM');
    await holder.stdout.cancel();
    await holder.status;
    await Deno.remove(lock);
  }
});

Deno.test('a stopped process is not waited on through pipes its own children keep open', async () => {
  const c = new AbortController();
  const started = Date.now();
  setTimeout(() => c.abort(), 200);
  // The shell is killed at once; its sleep keeps the shell's stdout and stderr open for 20 s.
  const err = await assertRejects(
    () => realShell.run(['bash', '-c', 'sleep 20 & wait'], { signal: c.signal, timeoutMs: 600_000 }),
    FgError,
  );
  assertEquals(err.code, 'interrupted');
  assert(Date.now() - started < 5000, `returned after ${Date.now() - started} ms`);
  await new Deno.Command('pkill', { args: ['-f', '^sleep 20$'] }).output();
});

Deno.test('a normal run still returns all of its output', async () => {
  const res = await realShell.run(['bash', '-c', 'head -c 3000000 /dev/zero | tr "\\\\0" a; echo; echo err >&2']);
  assertEquals([res.code, res.stdout.length, res.stderr], [0, 3_000_001, 'err\n']);
});

/** A shell whose fetch hangs until its signal aborts, like a connection that never answers. */
const hangingShell = {
  ...realShell,
  fetch: (_url: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
};
const hungTarget = { kind: 'hosted', label: 'test target', apiUrl: 'http://127.0.0.1:9', publishableKey: 'p', secretKey: 's' } as Target;

Deno.test('a hung API request ends at once when the command is stopped', async () => {
  const c = new AbortController();
  setTimeout(() => c.abort(), 100);
  const started = Date.now();
  const err = await assertRejects(() => new Api(hangingShell, hungTarget, c.signal).users(), FgError);
  assertEquals(err.code, 'interrupted');
  assert(Date.now() - started < 2000);
});

Deno.test('a hung API request without a stop times out with api_timeout', async () => {
  const err = await assertRejects(() => new Api(hangingShell, hungTarget, undefined, 200).count('items', ''), FgError);
  assertEquals([err.code, err.message], ['api_timeout', 'Counting items did not answer within 0.2 s.']);
});
