// Tests tests/deadline.ts against servers on 127.0.0.1 that never answer, in plain Node (the
// lint gate runs it: node --experimental-strip-types --test e2e/deadline.test.mjs).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { withDeadline } from './tests/deadline.ts';

/** GET /silent: no byte, ever. GET /stream: headers at once, then a body that never ends. */
const server = createServer((req, res) => {
  if (req.url === '/silent') return;
  if (req.url === '/stream') return void res.writeHead(200, { 'content-type': 'text/event-stream' }).write('data: 1\n\n');
  req.resume().on('end', () => res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}'));
});
let origin = '';
before(async () => {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

const pending = Symbol('pending');
const within = (promise, ms) =>
  Promise.race([promise, new Promise((done) => setTimeout(done, ms, pending))]);

test('a request without an answer rejects at the deadline, naming method, URL and time', async () => {
  const quick = withDeadline(fetch, 300);
  const started = Date.now();
  const bare = fetch(`${origin}/silent`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(5_000) });
  bare.catch(() => {});
  await assert.rejects(quick(`${origin}/silent`, { method: 'POST', body: '{}' }), (e) => {
    assert.match(e.message, new RegExp(`^no response headers after \\d+ ms: POST ${origin}/silent$`));
    const [, ms] = e.message.match(/after (\d+) ms/);
    assert.ok(Number(ms) >= 300 && Number(ms) < 2_000, e.message);
    assert.equal(e.cause?.name, 'AbortError');
    return true;
  });
  assert.ok(Date.now() - started < 2_000);
  // The same request without the deadline is still waiting.
  assert.equal(await within(bare, 300), pending);
});

test('it names a Request object and the default method too', async () => {
  const quick = withDeadline(fetch, 200);
  await assert.rejects(quick(new Request(`${origin}/silent`, { method: 'DELETE' })), /: DELETE http:\/\/127\.0\.0\.1:\d+\/silent$/);
  await assert.rejects(quick(new URL(`${origin}/silent`)), /: GET http:\/\/127\.0\.0\.1:\d+\/silent$/);
});

test('an answer in time passes through, and its timer is gone', async () => {
  const quick = withDeadline(fetch, 300);
  const res = await quick(`${origin}/answer`, { method: 'POST', body: '{}' });
  await new Promise((done) => setTimeout(done, 500));
  assert.deepEqual(await res.json(), { ok: true });
});

test('a stream that stays open after its headers is not cut', async () => {
  const res = await withDeadline(fetch, 200)(`${origin}/stream`);
  const reader = res.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: 1\n\n');
  assert.equal(await within(reader.read(), 500), pending);
  await reader.cancel();
});

test("the caller's own abort keeps its reason, in init or on a Request", async () => {
  for (const ask of [(signal) => [`${origin}/silent`, { signal }], (signal) => [new Request(`${origin}/silent`, { signal })]]) {
    const mine = new AbortController();
    const request = withDeadline(fetch, 5_000)(...ask(mine.signal));
    mine.abort(new Error('test over'));
    await assert.rejects(request, /^Error: test over$/);
  }
});
