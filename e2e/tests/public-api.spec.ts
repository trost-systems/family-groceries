// Job 73: the Hummlist API over HTTP through the local gateway (docs/API.md): an API key made in
// the app's session adds, lists, ticks and moves items that the open list shows, a read key
// cannot write, every answer carries the rate-limit headers, and a burst ends in 429.
import { expect, test } from './fixtures';
import { adminClient, apiAs, firstOf, functionJson, functionsUrl, itemRow, newEmail, screenshot, signUpWithHousehold } from './helpers';

const api = `${functionsUrl}/api/v1`;

// The API is switched off after the migrations (job 75). No afterAll turns it off again: with
// fullyParallel another worker may still be running a test of this file.
test.beforeAll(async () => {
  const { error } = await adminClient().from('app_switches').update({ enabled: true }).eq('key', 'public_api');
  if (error) throw error;
});

/** A key made the way the app makes one: create_api_token from the member's own session. */
async function apiKey(email: string, scopes: string[]): Promise<string> {
  const client = await apiAs(email);
  const { data, error } = await client.rpc('create_api_token', { p_name: 'e2e', p_scopes: scopes });
  if (error) throw new Error(error.message);
  return firstOf(data as { token: string }[], 'token').token;
}

/** One request through the gateway, which sets X-Real-IP to this machine's address. */
async function call(
  key: string | null,
  method: string,
  path: string,
  init: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return { status: res.status, headers: res.headers, body: await functionJson(res) };
}

test('an API key adds, lists, ticks and moves items the open list shows', async ({ page }) => {
  const email = newEmail('public-api');
  await signUpWithHousehold(page, email, { stores: ['dm'] });
  const key = await apiKey(email, ['read', 'write']);

  const anonymous = await call(null, 'GET', '/items');
  expect(anonymous.status).toBe(401);
  expect(anonymous.body.error.code).toBe('missing_token');
  expect(anonymous.headers.get('x-ratelimit-limit')).toBe('20');
  expect(anonymous.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

  const idempotency = { 'idempotency-key': crypto.randomUUID() };
  const body = { items: [{ name: '2 Gurken' }, { name: 'Milch' }, { name: 'Zahnpasta' }] };
  const added = await call(key, 'POST', '/items', { body, headers: idempotency });
  expect(added.status).toBe(201);
  expect(added.headers.get('x-ratelimit-limit')).toBe('20');
  expect(Number(added.headers.get('x-ratelimit-remaining'))).toBeLessThan(20);
  const names = added.body.data.added.map((i: { name: string; quantity: string | null }) =>
    [i.name, i.quantity]
  );
  expect(names).toEqual([['Gurken', '2'], ['Milch', null], ['Zahnpasta', null]]);
  const replay = await call(key, 'POST', '/items', { body, headers: idempotency });
  expect(replay.status).toBe(201);
  expect(replay.headers.get('idempotent-replayed')).toBe('true');
  expect(replay.body).toEqual(added.body);

  await expect(itemRow(page, 'Gurken 2')).toBeVisible();
  await expect(itemRow(page, 'Milch')).toHaveCount(1);

  const milk = added.body.data.added.find((i: { name: string }) => i.name === 'Milch');
  const ticked = await call(key, 'POST', `/items/${milk.id}/tick`);
  expect(ticked.body.data.status).toBe('ticked');
  await expect(itemRow(page, 'Milch')).toHaveCount(0);

  const paste = added.body.data.added.find((i: { name: string }) => i.name === 'Zahnpasta');
  const moved = await call(key, 'PATCH', `/items/${paste.id}`, { body: { store: 'dm' } });
  expect(moved.status).toBe(200);
  expect(moved.body.data.store).toBe('dm');

  const open = await call(key, 'GET', '/items?limit=1');
  expect(open.body.counts).toEqual({ open: 2, checkedLast24h: 1 });
  expect(open.body.data).toHaveLength(1);
  const next = await call(key, 'GET', `/items?limit=1&cursor=${open.body.nextCursor}`);
  expect(next.body.data).toHaveLength(1);
  expect(next.body.data[0].id).not.toBe(open.body.data[0].id);
  expect(next.body.nextCursor).toBeNull();
  await screenshot(page, 'public-api-01-items-from-the-api');

  const reader = await apiKey(email, ['read']);
  const refused = await call(reader, 'POST', '/items', { body: { items: [{ name: 'Brot' }] } });
  expect(refused.status).toBe(403);
  expect(refused.body.error).toMatchObject({ code: 'insufficient_scope', details: { required: 'write' } });
  expect((await call(reader, 'GET', '/stores')).body.data.map((s: { name: string }) => s.name))
    .toContain('dm');
});

test('a burst past 20 is refused with 429, Retry-After and the rate headers', async ({ page }) => {
  const email = newEmail('public-api-burst');
  await signUpWithHousehold(page, email);
  const key = await apiKey(email, ['read']);

  const answers = await Promise.all(
    Array.from({ length: 30 }, () => call(key, 'GET', '/categories')),
  );
  const limited = answers.filter((a) => a.status === 429);
  expect(answers.filter((a) => a.status === 200).length).toBeGreaterThanOrEqual(20);
  expect(limited.length).toBeGreaterThan(0);
  for (const answer of limited) {
    expect(answer.body.error.code).toBe('rate_limited');
    expect(Number(answer.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(answer.headers.get('x-ratelimit-limit')).toBe('20');
    expect(answer.headers.get('x-ratelimit-remaining')).toBe('0');
  }
});

test('unknown keys from one address end in 429; forged addresses, revoked and valid keys do not', async ({ page }) => {
  const email = newEmail('public-api-throttle');
  await signUpWithHousehold(page, email);
  const key = await apiKey(email, ['read']);
  const revoked = await apiKey(email, ['read']);
  const client = await apiAs(email);
  await client.from('personal_access_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('token_hint', revoked.slice(-4)).eq('kind', 'api');

  for (let i = 0; i < 30; i++) {
    const polled = await call(revoked, 'GET', '/items');
    expect(polled.status, 'an integration polling with a revoked key is never throttled').toBe(401);
    expect(polled.body.error.code).toBe('invalid_token');
  }

  // Every local request comes from the same gateway address, so an earlier run may have used up
  // part of its budget: send unknown keys until the block, at most 21.
  let blocked = null;
  for (let i = 0; i < 21 && !blocked; i++) {
    const answer = await call(`fgp_wrong${i}${crypto.randomUUID()}`, 'GET', '/items', {
      headers: { 'x-forwarded-for': `198.51.100.${i + 1}`, 'x-real-ip': `192.0.2.${i + 1}` },
    });
    if (answer.status === 429) blocked = answer;
    else expect(answer.status).toBe(401);
  }
  expect(blocked, 'forged X-Forwarded-For and X-Real-IP headers do not dodge the throttle').not.toBeNull();
  if (blocked === null) throw new Error('never throttled');
  expect(blocked.body.error.code).toBe('auth_throttled');
  expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

  expect((await call(key, 'GET', '/items')).status, 'a valid key from the blocked address works').toBe(200);
  expect((await call(revoked, 'GET', '/items')).body.error.code).toBe('invalid_token');
});
