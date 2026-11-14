import { assert, assertEquals, assertFalse } from '@std/assert';
import { discardUnreadBody } from './http.ts';

/** A body of `chunks` chunks of `size` bytes that records how far it was read. */
function countedBody(chunks: number, size: number) {
  const seen = { pulled: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (seen.pulled === chunks) return controller.close();
      seen.pulled++;
      controller.enqueue(new Uint8Array(size));
    },
    cancel() {
      seen.cancelled = true;
    },
  }, { highWaterMark: 0 });
  return { seen, req: new Request('http://x/mcp', { method: 'POST', body }) };
}

Deno.test('discardUnreadBody reads an unread body to its end', async () => {
  const { seen, req } = countedBody(3, 1024);
  await discardUnreadBody(req);
  assertEquals(seen, { pulled: 3, cancelled: false });
  assert(req.bodyUsed);
});

Deno.test('discardUnreadBody stops past the limit and cancels the rest', async () => {
  const { seen, req } = countedBody(10, 1024);
  await discardUnreadBody(req, 2048);
  assertEquals(seen, { pulled: 3, cancelled: true });
});

Deno.test('discardUnreadBody does nothing without a body, or with one in use', async () => {
  const get = new Request('http://x/mcp');
  await discardUnreadBody(get);
  assertFalse(get.bodyUsed);

  const read = new Request('http://x/mcp', { method: 'POST', body: 'Milch' });
  assertEquals(await read.text(), 'Milch');
  await discardUnreadBody(read);

  const { seen, req } = countedBody(3, 1024);
  const reader = req.body?.getReader();
  await discardUnreadBody(req);
  assertEquals(seen.pulled, 0);
  reader?.releaseLock();
});

Deno.test('discardUnreadBody swallows a body that fails mid-way', async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error('connection reset'));
    },
  });
  await discardUnreadBody(new Request('http://x/mcp', { method: 'POST', body }));
});

Deno.test('discardUnreadBody stops waiting for a body that stalls', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(5));
    },
    cancel() {
      cancelled = true;
    },
  });
  const started = Date.now();
  await discardUnreadBody(new Request('http://x/mcp', { method: 'POST', body }), 1024, 50);
  const waited = Date.now() - started;
  assert(waited >= 40 && waited < 2_000, `waited ${waited} ms`);
  assert(cancelled);
});
