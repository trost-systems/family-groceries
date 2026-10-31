import { assertEquals } from '@std/assert';
import { deleteDueCustomers, type Fetch } from './deletions.ts';

const A = '0b6f2c1e-6d0a-4c39-9a51-2f7d1f6a3b01';
const B = '7e1d9c22-1b3f-4f6e-8c0a-5a9e2d4b7c02';
const key = { secretKey: 'sk_test', projectId: '9cb4a72e' };

function fakeQueue(due: string[]) {
  const done: string[] = [];
  return {
    done,
    queue: {
      take: () => Promise.resolve(due),
      done: (id: string) => (done.push(id), Promise.resolve()),
    },
  };
}

/** RevenueCat: per customer, what DELETE and then GET answer. */
function fakeRevenueCat(answers: Record<string, { del: number; get: number }>) {
  const calls: string[] = [];
  const fetch: Fetch = (url, init) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url} ${(init?.headers as Record<string, string>).authorization}`);
    const a = answers[url.split('/').pop()!];
    return Promise.resolve(new Response(null, { status: method === 'DELETE' ? a.del : a.get }));
  };
  return { fetch, calls };
}

Deno.test('a due customer is deleted through API v2, verified gone, and leaves the queue', async () => {
  const q = fakeQueue([A]);
  const rc = fakeRevenueCat({ [A]: { del: 200, get: 404 } });
  assertEquals(await deleteDueCustomers(q.queue, key, rc.fetch), {
    due: 1,
    deleted: 1,
    pending: 0,
    failed: 0,
  });
  const url = `https://api.revenuecat.com/v2/projects/9cb4a72e/customers/${A}`;
  assertEquals(rc.calls, [`DELETE ${url} Bearer sk_test`, `GET ${url} Bearer sk_test`]);
  assertEquals(q.done, [A]);
});

Deno.test('still there after DELETE: stays queued for a later run', async () => {
  const q = fakeQueue([A]);
  const rc = fakeRevenueCat({ [A]: { del: 200, get: 200 } });
  assertEquals((await deleteDueCustomers(q.queue, key, rc.fetch)).pending, 1);
  assertEquals(q.done, []);
});

Deno.test('a customer that never existed (404) counts as deleted once GET agrees', async () => {
  const q = fakeQueue([A]);
  const rc = fakeRevenueCat({ [A]: { del: 404, get: 404 } });
  assertEquals((await deleteDueCustomers(q.queue, key, rc.fetch)).deleted, 1);
});

Deno.test('a refused key or a RevenueCat error keeps the row, the others go on', async () => {
  const q = fakeQueue([A, B]);
  const rc = fakeRevenueCat({ [A]: { del: 401, get: 401 }, [B]: { del: 200, get: 404 } });
  assertEquals(await deleteDueCustomers(q.queue, key, rc.fetch), {
    due: 2,
    deleted: 1,
    pending: 0,
    failed: 1,
  });
  assertEquals(
    rc.calls.filter((c) => c.startsWith('GET')).length,
    1,
    'no GET after a failed DELETE',
  );
  assertEquals(q.done, [B]);
});

Deno.test('an id that is no uuid is never put into a URL', async () => {
  const q = fakeQueue(['../../projects']);
  const rc = fakeRevenueCat({});
  assertEquals((await deleteDueCustomers(q.queue, key, rc.fetch)).failed, 1);
  assertEquals(rc.calls, []);
});
