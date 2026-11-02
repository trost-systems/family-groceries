// Reading a household's promotional premium from RevenueCat's API v2 (promotional.ts), against
// recorded answer shapes (GET /v2/projects/{project}/customers/{id}/subscriptions).
import { assertEquals, assertRejects } from '@std/assert';
import { fetchPromotional, promotionalOf, RevenueCatUnavailable } from './promotional.ts';

const HOME = '00000000-0000-4000-8000-00000000a0e1';
const NOW = new Date('2026-11-01T10:00:00Z');
const day = 86_400_000;
const key = { secretKey: 'sk_test_for_tests', projectId: 'proj1234' };

const sub = (o: Record<string, unknown> = {}) => ({
  object: 'subscription',
  store: 'promotional',
  gives_access: true,
  status: 'active',
  ends_at: NOW.getTime() + 30 * day,
  current_period_ends_at: NOW.getTime() + 30 * day,
  entitlements: { items: [{ id: 'entl654efcfce4', lookup_key: 'premium' }] },
  ...o,
});

Deno.test('a running promotional premium grant counts, until its end', () => {
  assertEquals(promotionalOf([sub()], NOW), {
    active: true,
    expiresAt: new Date(NOW.getTime() + 30 * day),
  });
});

Deno.test('of several grants the latest end wins, and a grant without an end beats every end', () => {
  const later = NOW.getTime() + 90 * day;
  assertEquals(promotionalOf([sub(), sub({ ends_at: later })], NOW), {
    active: true,
    expiresAt: new Date(later),
  });
  assertEquals(
    promotionalOf([sub(), sub({ ends_at: null, current_period_ends_at: null })], NOW),
    { active: true, expiresAt: null },
  );
});

Deno.test('store subscriptions, other entitlements, revoked and ended grants do not count', () => {
  const none = { active: false };
  assertEquals(promotionalOf([], NOW), none);
  assertEquals(promotionalOf([sub({ store: 'app_store' })], NOW), none);
  assertEquals(promotionalOf([sub({ store: 'play_store' })], NOW), none);
  assertEquals(promotionalOf([sub({ gives_access: false, status: 'expired' })], NOW), none);
  assertEquals(promotionalOf([sub({ ends_at: NOW.getTime() - 1 })], NOW), none);
  assertEquals(
    promotionalOf([sub({ entitlements: { items: [{ id: 'entl1', lookup_key: 'pro' }] } })], NOW),
    none,
  );
  assertEquals(promotionalOf([sub({ entitlements: null })], NOW), none);
});

function api(pages: Record<string, { status: number; body?: unknown }>) {
  const seen: { url: string; auth: string | null }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, auth: new Headers(init?.headers).get('authorization') });
    const page = pages[url];
    if (!page) return Promise.resolve(new Response('{}', { status: 404 }));
    return Promise.resolve(
      new Response(page.body === undefined ? null : JSON.stringify(page.body), {
        status: page.status,
      }),
    );
  };
  return { fetch, seen };
}

const first =
  `https://api.revenuecat.com/v2/projects/proj1234/customers/${HOME}/subscriptions?limit=100`;

Deno.test("fetchPromotional reads every page of the customer's subscriptions, with the key", async () => {
  const next = `/v2/projects/proj1234/customers/${HOME}/subscriptions?starting_after=sub1`;
  const { fetch, seen } = api({
    [first]: { status: 200, body: { items: [sub({ store: 'app_store' })], next_page: next } },
    [`https://api.revenuecat.com${next}`]: {
      status: 200,
      body: { items: [sub()], next_page: null },
    },
  });
  assertEquals(await fetchPromotional(key, HOME, fetch, NOW), {
    active: true,
    expiresAt: new Date(NOW.getTime() + 30 * day),
  });
  assertEquals(seen.length, 2);
  assertEquals(seen[0].auth, 'Bearer sk_test_for_tests');
});

Deno.test('a customer RevenueCat does not know has no promotional premium', async () => {
  const { fetch } = api({});
  assertEquals(await fetchPromotional(key, HOME, fetch, NOW), { active: false });
});

Deno.test('next_page never leads off RevenueCat', async () => {
  const { fetch, seen } = api({
    [first]: { status: 200, body: { items: [], next_page: 'https://evil.example/v2/x' } },
  });
  assertEquals(await fetchPromotional(key, HOME, fetch, NOW), { active: false });
  assertEquals(seen.length, 1);
});

Deno.test('any other answer throws RevenueCatUnavailable, so nothing is stored', async () => {
  for (
    const page of [{ status: 500 }, { status: 401 }, { status: 429 }, { status: 200, body: {} }]
  ) {
    const { fetch } = api({ [first]: page });
    await assertRejects(() => fetchPromotional(key, HOME, fetch, NOW), RevenueCatUnavailable);
  }
  const offline = () => Promise.reject(new TypeError('network'));
  await assertRejects(() => fetchPromotional(key, HOME, offline, NOW), RevenueCatUnavailable);
  await assertRejects(() => fetchPromotional(key, '../customers', offline, NOW));
});

Deno.test('a RevenueCat read that never answers times out as RevenueCatUnavailable', async () => {
  const hang = () => new Promise<Response>(() => {});
  await assertRejects(() => fetchPromotional(key, HOME, hang, NOW, 20), RevenueCatUnavailable);
});
