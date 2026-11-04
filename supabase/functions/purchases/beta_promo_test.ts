import { assertEquals, assertRejects } from '@std/assert';
import { type BetaQueue, defaultBetaEnd, grantDue } from './beta_promo.ts';
import { betaEnd } from './config.ts';
import type { Fetch } from './deletions.ts';
import { grantEntitlement, premiumEntitlementId, revokeGrantedEntitlement } from './grants.ts';
import { RevenueCatUnavailable } from './promotional.ts';

const A = '0b6f2c1e-6d0a-4c39-9a51-2f7d1f6a3b01';
const B = '7e1d9c22-1b3f-4f6e-8c0a-5a9e2d4b7c02';
const C = 'a2c4e6f8-1b3d-4f5a-8c7e-9d0b1a2c3e4f';
const key = { secretKey: 'sk_test', projectId: 'proj9cb4a72e' };
const NOW = new Date('2026-11-09T10:00:00Z');
const END = new Date('2027-12-31T23:00:00Z');

function fakeQueue(on: boolean, due: string[]) {
  const granted: [string, string][] = [];
  const skipped: string[] = [];
  const queue: BetaQueue = {
    on: () => Promise.resolve(on),
    take: () => Promise.resolve(due),
    granted: (id, at) => (granted.push([id, at.toISOString()]), Promise.resolve()),
    skipped: (id) => (skipped.push(id), Promise.resolve()),
  };
  return { queue, granted, skipped };
}

/** RevenueCat: per customer its promotional subscriptions (end in ms, null: no end), or a status. */
function fakeRevenueCat(customers: Record<string, (number | null)[] | number>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetch: Fetch = (url, init) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const id = url.match(/customers\/([0-9a-f-]{36})/)?.[1] ?? '';
    const c = customers[id];
    if (typeof c === 'number') return Promise.resolve(new Response(null, { status: c }));
    if (method === 'GET') {
      const items = (c ?? []).map((ends) => ({
        store: 'promotional',
        gives_access: true,
        ends_at: ends,
        entitlements: { items: [{ lookup_key: 'premium' }] },
      }));
      return Promise.resolve(Response.json({ items, next_page: null }));
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  };
  return { fetch, calls };
}

Deno.test('off: nothing is taken, nothing goes to RevenueCat', async () => {
  const q = fakeQueue(false, [A]);
  const rc = fakeRevenueCat({ [A]: [] });
  const reconciled: string[] = [];
  const outcome = await grantDue(q.queue, key, END, rc.fetch, (id) => {
    reconciled.push(id);
    return Promise.resolve();
  }, NOW);
  assertEquals(outcome, { status: 'off' });
  assertEquals(rc.calls, []);
  assertEquals(reconciled, []);
});

Deno.test('a queued household is granted until the end with nothing but its id and the dates', async () => {
  const q = fakeQueue(true, [A]);
  const rc = fakeRevenueCat({ [A]: [] });
  const reconciled: string[] = [];
  const outcome = await grantDue(q.queue, key, END, rc.fetch, (id) => {
    reconciled.push(id);
    return Promise.resolve();
  }, NOW);
  assertEquals(outcome, { status: 'done', due: 1, granted: 1, skipped: 0, failed: 0 });
  const grant = rc.calls.find((c) => c.method === 'POST')!;
  assertEquals(
    grant.url,
    `https://api.revenuecat.com/v2/projects/proj9cb4a72e/customers/${A}/actions/grant_entitlement`,
  );
  assertEquals(grant.body, { entitlement_id: premiumEntitlementId, expires_at: END.getTime() });
  assertEquals(reconciled, [A]);
  assertEquals(q.granted, [[A, END.toISOString()]]);
});

Deno.test('a tester or app-review household (grant for good) is skipped, never touched', async () => {
  const q = fakeQueue(true, [A, B]);
  const rc = fakeRevenueCat({
    [A]: [Date.parse('2100-01-01T00:00:00Z')],
    [B]: [null],
  });
  const outcome = await grantDue(q.queue, key, END, rc.fetch, () => Promise.resolve(), NOW);
  assertEquals(outcome, { status: 'done', due: 2, granted: 0, skipped: 2, failed: 0 });
  assertEquals(rc.calls.filter((c) => c.method === 'POST'), []);
  assertEquals(q.skipped, [A, B]);
});

Deno.test('a household already granted until the end is recorded without a second grant', async () => {
  const q = fakeQueue(true, [A]);
  const rc = fakeRevenueCat({ [A]: [END.getTime()] });
  await grantDue(q.queue, key, END, rc.fetch, () => Promise.resolve(), NOW);
  assertEquals(rc.calls.filter((c) => c.method === 'POST'), []);
  assertEquals(q.granted, [[A, END.toISOString()]]);
});

Deno.test('a failure leaves the household queued; the others go on', async () => {
  const q = fakeQueue(true, [A, C]);
  const rc = fakeRevenueCat({ [A]: 503, [C]: [] });
  const outcome = await grantDue(q.queue, key, END, rc.fetch, () => Promise.resolve(), NOW);
  assertEquals(outcome, { status: 'done', due: 2, granted: 1, skipped: 0, failed: 1 });
  assertEquals(q.granted.map(([id]) => id), [C]);
});

Deno.test('grant creates an unknown customer first; revoke takes every promotional grant away', async () => {
  const calls: string[] = [];
  let created = false;
  const fetch: Fetch = (url, init) => {
    calls.push(`${init?.method} ${url.replace('https://api.revenuecat.com/v2/projects/p', '')}`);
    if (url.endsWith('/grant_entitlement') && !created) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    if (url.endsWith('/customers')) created = true;
    return Promise.resolve(new Response(null, { status: url.endsWith('/customers') ? 201 : 200 }));
  };
  await grantEntitlement({ secretKey: 'sk', projectId: 'p' }, A, END, fetch);
  await revokeGrantedEntitlement({ secretKey: 'sk', projectId: 'p' }, A, fetch);
  assertEquals(calls, [
    `POST /customers/${A}/actions/grant_entitlement`,
    'POST /customers',
    `POST /customers/${A}/actions/grant_entitlement`,
    `POST /customers/${A}/actions/revoke_granted_entitlement`,
  ]);
  const refused: Fetch = () => Promise.resolve(new Response(null, { status: 403 }));
  await assertRejects(
    () => revokeGrantedEntitlement({ secretKey: 'sk', projectId: 'p' }, A, refused),
    RevenueCatUnavailable,
  );
});

Deno.test('the beta end: 2027-12-31 by default, a later date from BETA_PROMO_ENDS_AT, never a past one', () => {
  assertEquals(defaultBetaEnd.toISOString(), '2027-12-31T23:00:00.000Z');
  assertEquals(betaEnd(null, NOW), defaultBetaEnd);
  assertEquals(
    betaEnd('2027-03-01T00:00:00+01:00', NOW)?.toISOString(),
    '2027-02-28T23:00:00.000Z',
  );
  assertEquals(betaEnd('2026-01-01', NOW), null);
  assertEquals(betaEnd('not a date', NOW), null);
});
