import { assertEquals } from '@std/assert';
import { handle } from './handler.ts';

const get = () => new Request('http://local/health');

Deno.test('health answers ok with JSON and CORS headers when the database answers', async () => {
  const res = await handle(get(), () => Promise.resolve(true));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('access-control-allow-origin'), '*');
  assertEquals(await res.json(), { ok: true, service: 'family-groceries', database: true });
});

Deno.test('health answers 503 when the database read fails', async () => {
  const res = await handle(get(), () => Promise.reject(new Error('connection refused')));
  assertEquals(res.status, 503);
  assertEquals(await res.json(), { ok: false, service: 'family-groceries', database: false });
});

Deno.test('health answers 503 when the database does not answer in time', async () => {
  const res = await handle(get(), () => new Promise(() => {}), 10);
  assertEquals(res.status, 503);
  assertEquals((await res.json()).database, false);
});

Deno.test('health answers CORS preflight without touching the database', async () => {
  const res = await handle(
    new Request('http://local/health', { method: 'OPTIONS' }),
    () => Promise.reject(new Error('not called')),
  );
  assertEquals(res.status, 204);
  assertEquals(await res.text(), '');
});
