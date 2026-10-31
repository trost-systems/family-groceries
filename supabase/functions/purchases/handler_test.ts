// The purchases handler against an in-memory ledger that answers like the migration's
// purchase_record, purchase_claim, purchase_revoke and purchase_reinstate.
import { assert, assertEquals, assertRejects } from '@std/assert';
import { AuthError } from '../_shared/auth.ts';
import type { PurchaseEvent } from '../_shared/purchases.ts';
import type { Subject } from '../_shared/telemetry.ts';
import { createHandler, type Deps, type Ledger, maxBodyBytes } from './handler.ts';
import type { Claim, Recorded, Revoked } from './store.ts';
import { lifetimeProductId, type Sale, type StorePurchase } from './types.ts';

const PETER = '00000000-0000-4000-8000-0000000043a1';
const LEA = '00000000-0000-4000-8000-0000000043a2';
const HOME = '00000000-0000-4000-8000-00000000a0e1';
const OTHER = '00000000-0000-4000-8000-00000000a0e2';
const INSTALL = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const AUTH = 'Bearer rc-webhook-secret-for-tests';
const SIGNING = 'rc-signing-secret-for-tests';
const base = 'http://localhost/functions/v1/purchases';
const NOW = new Date('2026-10-31T14:00:00Z');

interface Row {
  purchase: StorePurchase;
  user: string | null;
  revoked: boolean;
  sent: boolean;
}

/** The migration's purchase bookkeeping, in memory. */
class Books implements Ledger {
  rows = new Map<string, Row>();
  claims = new Map<string, { user: string; household: string }>();
  eventIds = new Set<string>();
  members = new Map<string, string>([[PETER, HOME], [LEA, HOME]]);
  testers = new Set<string>();
  writes = 0;
  fail: Error | null = null;

  find(store: string, tx: string) {
    return [...this.rows.values()].find((r) =>
      r.purchase.store === store &&
      (r.purchase.transactionId === tx || r.purchase.latestTransactionId === tx)
    );
  }

  record(p: StorePurchase): Promise<Recorded> {
    if (this.fail) return Promise.reject(this.fail);
    this.writes++;
    const key = `${p.store}:${p.transactionId}`;
    const fresh = !this.rows.has(key);
    if (fresh) this.rows.set(key, { purchase: p, user: null, revoked: false, sent: false });
    const row = this.rows.get(key)!;
    const answer = (outcome: Recorded['outcome'], more: Partial<Recorded> = {}): Recorded => ({
      outcome,
      alreadyUnlocked: false,
      householdGone: false,
      internal: row.user !== null && this.testers.has(row.user),
      buyer: null,
      sendCompleted: false,
      ...more,
    });
    if (row.revoked) return Promise.resolve(answer('revoked'));
    if (row.purchase.householdId !== p.householdId) {
      return Promise.resolve(answer('used_elsewhere'));
    }
    for (const id of [p.transactionId, p.latestTransactionId]) {
      const c = this.claims.get(`${p.store}:${id}`);
      if (!row.user && c?.household === p.householdId) {
        row.user = c.user;
        this.claims.delete(`${p.store}:${id}`);
      }
    }
    const send = row.user !== null && !row.sent;
    if (send) row.sent = true;
    return Promise.resolve(answer(fresh ? 'granted' : 'restored', {
      buyer: row.user,
      sendCompleted: send,
      internal: row.user !== null && this.testers.has(row.user),
    }));
  }

  revoke(r: { store: 'apple' | 'google'; transactionId: string }): Promise<Revoked | null> {
    this.writes++;
    const row = this.rows.get(`${r.store}:${r.transactionId}`);
    if (!row || row.revoked) return Promise.resolve(null);
    row.revoked = true;
    return Promise.resolve({
      ...row.purchase,
      userId: row.user,
      internal: row.user !== null && this.testers.has(row.user),
    });
  }

  reinstate(store: string, tx: string): Promise<boolean> {
    this.writes++;
    const row = this.rows.get(`${store}:${tx}`);
    if (!row?.revoked) return Promise.resolve(false);
    row.revoked = false;
    return Promise.resolve(true);
  }

  claim(user: string, household: string, store: 'apple' | 'google', tx: string): Claim {
    if (this.members.get(user) !== household) throw new AuthError('no_household', 'left');
    const row = this.find(store, tx);
    if (!row) {
      if (!this.claims.has(`${store}:${tx}`)) {
        this.claims.set(`${store}:${tx}`, { user, household });
      }
      return { status: 'waiting', completed: null };
    }
    if (row.purchase.householdId !== household) return { status: 'elsewhere', completed: null };
    if (row.user && row.user !== user) return { status: 'taken', completed: null };
    row.user = user;
    if (row.sent || row.revoked) return { status: 'recorded', completed: null };
    row.sent = true;
    return {
      status: 'recorded',
      completed: { ...row.purchase, internal: this.testers.has(user) },
    };
  }
}

interface World {
  books: Books;
  sent: { name: PurchaseEvent; sale: Sale; subject: Subject }[];
  calls: string[];
  /** A request to [path]; GET without a body. */
  handle(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  /** RevenueCat's delivery of [event]: authorized, and signed when [signed]. */
  deliver(event: Record<string, unknown>, init?: { signed?: boolean }): Promise<Response>;
}

function world(overrides: Partial<Deps> = {}): World {
  const books = new Books();
  const sent: World['sent'] = [];
  const calls: string[] = [];
  const deps: Deps = {
    webhook: { authorization: AUTH, signingSecret: null },
    local: false,
    region: 'eu-central-1',
    authenticate: (req) => {
      const header = req.headers.get('authorization');
      if (!header) return Promise.reject(new AuthError('missing_token', 'missing'));
      if (header.startsWith('Bearer fgp_')) {
        return Promise.reject(new AuthError('session_required', 'pat'));
      }
      const userId = header === 'Bearer lea' ? LEA : PETER;
      return Promise.resolve({ userId, householdId: HOME });
    },
    takeCall: (userId) => {
      calls.push(userId);
      return Promise.resolve(true);
    },
    once: async (event, work) => {
      if (books.eventIds.has(event.id)) return null;
      const result = await work(books);
      books.eventIds.add(event.id);
      return result;
    },
    claim: (userId, householdId, store, tx) => {
      try {
        return Promise.resolve(books.claim(userId, householdId, store, tx));
      } catch (e) {
        return Promise.reject(e);
      }
    },
    subject: (userId) =>
      Promise.resolve({ installId: INSTALL, householdId: HOME, internal: userId === 'internal' }),
    event: (name, sale, subject) => {
      sent.push({ name, sale, subject });
      return Promise.resolve();
    },
    deleteDueCustomers: null,
    report: (e) => {
      throw e;
    },
    now: () => NOW,
    ...overrides,
  };
  const handler = createHandler(deps);
  const handle: World['handle'] = (path, body, headers = {}) =>
    handler(
      new Request(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined
          ? undefined
          : typeof body === 'string'
          ? body
          : JSON.stringify(body),
      }),
    );
  return {
    books,
    sent,
    calls,
    handle,
    deliver: async (event, { signed = false } = {}) => {
      const raw = JSON.stringify({ api_version: '1.0', event });
      const headers: Record<string, string> = { authorization: AUTH };
      if (signed) headers['x-revenuecat-webhook-signature'] = await signature(raw);
      return handle('/revenuecat/webhook', raw, headers);
    },
  };
}

/** RevenueCat's signature header for [raw], computed here independently of the handler's code. */
async function signature(raw: string, t = Math.floor(NOW.getTime() / 1000), secret = SIGNING) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${hex}`;
}

/** A NON_RENEWING_PURCHASE as RevenueCat sends it (webhooks/event-types-and-fields). */
function purchase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: crypto.randomUUID().toUpperCase(),
    type: 'NON_RENEWING_PURCHASE',
    app_id: 'app1a2b3c4d5',
    app_user_id: HOME,
    original_app_user_id: HOME,
    aliases: [HOME],
    store: 'APP_STORE',
    environment: 'SANDBOX',
    product_id: lifetimeProductId,
    entitlement_ids: ['lifetime'],
    period_type: 'NORMAL',
    transaction_id: '2000000812345679',
    original_transaction_id: '2000000812345678',
    purchased_at_ms: NOW.getTime() - 5_000,
    event_timestamp_ms: NOW.getTime(),
    expiration_at_ms: null,
    price: 10.49,
    price_in_purchased_currency: 9.99,
    currency: 'EUR',
    country_code: 'DE',
    takehome_percentage: 0.85,
    is_family_share: false,
    subscriber_attributes: {},
    future_field: { anything: true },
    ...overrides,
  };
}

const flipLast = (s: string) => s.slice(0, -1) + (s.endsWith('0') ? '1' : '0');

const of = (type: string, overrides: Record<string, unknown> = {}) =>
  purchase({ type, ...overrides });

async function expect(res: Response, status: number, body?: Record<string, unknown>) {
  const got = await res.json();
  assertEquals(res.status, status, JSON.stringify(got));
  if (body) assertEquals(got, body);
  return got;
}

/** What the handler logs while [work] runs. */
async function logsOf(work: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(' '));
  try {
    await work();
  } finally {
    console.log = original;
  }
  return lines;
}

Deno.test('unconfigured, the webhook answers 503; the status says so', async () => {
  const w = world({ webhook: null, local: true });
  await expect(await w.handle(''), 200, { configured: false });
  await expect(await w.deliver(purchase()), 503, { error: 'not_configured' });
  await expect(await w.handle('/test/event', { appUserId: HOME, transactionId: '1' }), 503);
  assertEquals(w.books.writes, 0);
  await expect(await world().handle(''), 200, { configured: true });
});

Deno.test('the webhook takes only the configured Authorization value', async () => {
  const w = world();
  const raw = JSON.stringify({ event: purchase() });
  for (
    const header of [
      undefined,
      '',
      'Bearer rc-webhook-secret-for-testX',
      'Bearer rc-webhook-secret-for-test',
      'rc-webhook-secret-for-tests',
      `${AUTH} `.repeat(2),
    ]
  ) {
    const headers: Record<string, string> = header === undefined ? {} : { authorization: header };
    await expect(await w.handle('/revenuecat/webhook', raw, headers), 401, {
      error: 'invalid_token',
    });
  }
  assertEquals(w.books.writes, 0);
  await expect(await w.handle('/revenuecat/webhook', raw, { authorization: AUTH }), 200, {
    status: 'granted',
  });
});

Deno.test('with a signing secret, every delivery must be signed over its raw bytes', async () => {
  const w = world({ webhook: { authorization: AUTH, signingSecret: SIGNING } });
  const event = purchase();
  const raw = JSON.stringify({ event });
  const t = Math.floor(NOW.getTime() / 1000);
  const send = (signatureHeader: string | null, body = raw) =>
    w.handle('/revenuecat/webhook', body, {
      authorization: AUTH,
      ...(signatureHeader === null ? {} : { 'x-revenuecat-webhook-signature': signatureHeader }),
    });
  const refused = [
    null,
    '',
    await signature(raw, t, 'another-secret'),
    await signature(raw, t - 301),
    await signature(raw, t + 301),
    flipLast(await signature(raw)),
    `t=${t}`,
  ];
  for (const header of refused) {
    await expect(await send(header), 401, { error: 'bad_signature' });
  }
  // Reformatted JSON is not what was signed.
  await expect(await send(await signature(raw), JSON.stringify({ event }, null, 1)), 401);
  assertEquals(w.books.writes, 0);
  await expect(await send(await signature(raw, t - 299)), 200, { status: 'granted' });
  const second = JSON.stringify({
    event: purchase({ transaction_id: 'b', original_transaction_id: 'b' }),
  });
  await expect(
    await send(`v1=00ff,${(await signature(second)).replace(`t=${t},`, '')},t=${t}`, second),
    200,
  );
});

Deno.test('a body that is no RevenueCat event is a 400', async () => {
  const w = world();
  const headers = { authorization: AUTH };
  for (const body of ['not json', '{}', '{"event":{"type":"TEST"}}', '{"event":{"id":"x"}}']) {
    await expect(await w.handle('/revenuecat/webhook', body, headers), 400, {
      error: 'bad_request',
    });
  }
  const huge = JSON.stringify({ event: purchase({ padding: 'x'.repeat(maxBodyBytes) }) });
  await expect(await w.handle('/revenuecat/webhook', huge, headers), 400);
  assertEquals(w.books.writes, 0);
});

Deno.test('a lifetime purchase is recorded for the household, with what RevenueCat says', async () => {
  const w = world();
  const logs = await logsOf(async () => {
    await expect(await w.deliver(purchase({ app_user_id: HOME.toUpperCase() })), 200, {
      status: 'granted',
    });
  });
  const [row] = w.books.rows.values();
  assertEquals(row.purchase, {
    store: 'apple',
    transactionId: '2000000812345678',
    latestTransactionId: '2000000812345679',
    productId: lifetimeProductId,
    kind: 'lifetime',
    environment: 'Sandbox',
    purchasedAt: new Date(NOW.getTime() - 5_000),
    price: 9.99,
    currency: 'EUR',
    country: 'DE',
    householdId: HOME,
  });
  assertEquals(logs, [JSON.stringify({ fn: 'purchases', region: 'eu-central-1' })]);
});

Deno.test('Play purchases are google, production ones Production; INITIAL_PURCHASE counts', async () => {
  const w = world();
  await expect(
    await w.deliver(purchase({
      type: 'INITIAL_PURCHASE',
      store: 'PLAY_STORE',
      environment: 'PRODUCTION',
      transaction_id: 'GPA.3333-4444-5555-66666',
      original_transaction_id: undefined,
      price_in_purchased_currency: -1,
      currency: 'eur',
      country_code: 'AUT',
    })),
    200,
    { status: 'granted' },
  );
  const [row] = w.books.rows.values();
  assertEquals(
    [row.purchase.store, row.purchase.transactionId, row.purchase.latestTransactionId],
    ['google', 'GPA.3333-4444-5555-66666', 'GPA.3333-4444-5555-66666'],
  );
  assertEquals(
    [row.purchase.environment, row.purchase.price, row.purchase.currency, row.purchase.country],
    ['Production', null, null, null],
  );
});

Deno.test('a duplicate delivery changes nothing', async () => {
  const w = world();
  const event = purchase();
  await expect(await w.deliver(event), 200, { status: 'granted' });
  await expect(await w.deliver(event), 200, { status: 'duplicate' });
  await expect(await w.deliver(of('TEST', { id: 'test-1' })), 200, { status: 'ignored' });
  await expect(await w.deliver(of('TEST', { id: 'test-1' })), 200, { status: 'duplicate' });
  assertEquals(w.books.writes, 1);
  // Another event for the same purchase (a restore) is no new one.
  await expect(await w.deliver(purchase()), 200, { status: 'restored' });
});

Deno.test('a failed write leaves the event unprocessed, so RevenueCat retries it', async () => {
  const w = world();
  const event = purchase();
  w.books.fail = new Error('connection reset');
  await assertRejects(() => w.deliver(event), Error, 'connection reset');
  w.books.fail = null;
  await expect(await w.deliver(event), 200, { status: 'granted' });
});

Deno.test('refused purchases unlock nothing and are logged without ids', async () => {
  const w = world();
  const cases: [Record<string, unknown>, string][] = [
    [purchase({ is_family_share: true }), 'family_share'],
    [purchase({ app_user_id: '$RCAnonymousID:8f3e0a1b2c3d4e5f' }), 'app_user_id'],
    [purchase({ app_user_id: PETER.slice(1) }), 'app_user_id'],
    [purchase({ product_id: 'com.hummlist.app.plus' }), 'product'],
    [purchase({ product_id: 'toString' }), 'product'],
    [purchase({ store: 'STRIPE' }), 'store'],
    [purchase({ store: 'PROMOTIONAL' }), 'store'],
    [purchase({ environment: 'XCODE' }), 'malformed'],
    [purchase({ transaction_id: null, original_transaction_id: null }), 'malformed'],
  ];
  for (const [event, refused] of cases) {
    const logs = await logsOf(async () => {
      await expect(await w.deliver(event), 200, { status: 'ignored' });
    });
    assertEquals(logs.slice(1), [
      JSON.stringify({ fn: 'purchases', event: 'NON_RENEWING_PURCHASE', refused }),
    ]);
  }
  assertEquals(w.books.writes, 0);
  assertEquals(w.books.eventIds.size, cases.length);
});

Deno.test('a purchase another household owns is not granted here, and is logged', async () => {
  const w = world();
  await w.deliver(purchase({ app_user_id: OTHER }));
  const logs = await logsOf(async () => {
    await expect(await w.deliver(purchase()), 200, { status: 'used_elsewhere' });
  });
  assertEquals(
    logs[1],
    JSON.stringify({ fn: 'purchases', event: 'NON_RENEWING_PURCHASE', refused: 'used_elsewhere' }),
  );
  assert(!logs.join().includes('2000000812345678') && !logs.join().includes(HOME));
});

Deno.test('TRANSFER never moves an unlock; it is logged by type alone', async () => {
  const w = world();
  await w.deliver(purchase());
  const logs = await logsOf(async () => {
    await expect(
      await w.deliver(of('TRANSFER', { transferred_from: [HOME], transferred_to: [OTHER] })),
      200,
      { status: 'ignored' },
    );
  });
  assertEquals(logs.slice(1), [JSON.stringify({ fn: 'purchases', event: 'TRANSFER' })]);
  assertEquals(w.books.writes, 1);
  assertEquals([...w.books.rows.values()][0].purchase.householdId, HOME);
});

Deno.test('other event types are acknowledged and ignored', async () => {
  const w = world();
  for (
    const type of ['TEST', 'TEMPORARY_ENTITLEMENT_GRANT', 'EXPIRATION', 'RENEWAL', 'SOMETHING_NEW']
  ) {
    await expect(await w.deliver(of(type)), 200, { status: 'ignored' });
  }
  assertEquals(w.books.writes, 0);
});

Deno.test('a refund takes the unlock away once, with one purchase_refunded', async () => {
  const w = world();
  await w.deliver(purchase());
  await expect(
    await w.handle('/claim', { store: 'apple', transactionId: '2000000812345679' }, {
      authorization: 'Bearer peter',
    }),
    200,
    { status: 'recorded' },
  );
  const refund = { cancel_reason: 'CUSTOMER_SUPPORT', event_timestamp_ms: NOW.getTime() };
  await expect(await w.deliver(of('CANCELLATION', refund)), 200, { status: 'revoked' });
  await expect(await w.deliver(of('CANCELLATION', refund)), 200, { status: 'unchanged' });
  assertEquals(w.sent.map((e) => e.name), ['purchase_completed', 'purchase_refunded']);
  assertEquals(w.sent[1].sale.transactionId, '2000000812345678');
  await expect(await w.deliver(of('REFUND_REVERSED')), 200, { status: 'reinstated' });
  await expect(await w.deliver(of('REFUND_REVERSED')), 200, { status: 'unchanged' });
  assertEquals(w.sent.length, 2);
  // A refund of a product we don't sell is not ours.
  await expect(await w.deliver(of('CANCELLATION', { product_id: 'other.product' })), 200, {
    status: 'ignored',
  });
});

Deno.test('a refund without a known buyer sends nothing', async () => {
  const w = world();
  await w.deliver(purchase());
  await expect(await w.deliver(of('CANCELLATION')), 200, { status: 'revoked' });
  assertEquals(w.sent, []);
});

Deno.test('the claim needs the app session in the household and a store transaction', async () => {
  const w = world();
  const body = { store: 'apple', transactionId: '2000000812345678' };
  await expect(await w.handle('/claim', body), 401, { error: 'missing_token' });
  await expect(await w.handle('/claim', body, { authorization: 'Bearer fgp_x' }), 403, {
    error: 'session_required',
  });
  for (
    const bad of [
      {},
      { store: 'stripe', transactionId: '1' },
      { store: 'apple' },
      { store: 'apple', transactionId: '' },
      { store: 'apple', transactionId: 7 },
      { store: 'google', transactionId: 'x'.repeat(201) },
    ]
  ) {
    await expect(await w.handle('/claim', bad, { authorization: 'Bearer peter' }), 400);
  }
  await expect(await w.handle('/claim', 'nope', { authorization: 'Bearer peter' }), 400);
  w.books.members.delete(PETER);
  await expect(await w.handle('/claim', body, { authorization: 'Bearer peter' }), 403, {
    error: 'no_household',
  });
});

Deno.test('the claim is rate limited', async () => {
  const w = world({ takeCall: () => Promise.resolve(false) });
  await expect(
    await w.handle('/claim', { store: 'google', transactionId: 'GPA.1' }, {
      authorization: 'Bearer peter',
    }),
    429,
    { error: 'rate_limited' },
  );
  assertEquals(w.books.claims.size, 0);
});

Deno.test('the claim works while the webhook is not configured', async () => {
  const w = world({ webhook: null });
  await expect(
    await w.handle('/claim', { store: 'apple', transactionId: '1' }, {
      authorization: 'Bearer peter',
    }),
    200,
    { status: 'waiting' },
  );
});

Deno.test('purchase_completed goes out once: claim first, then the webhook', async () => {
  const w = world();
  const claim = (who: string, tx = '2000000812345679') =>
    w.handle('/claim', { store: 'apple', transactionId: tx }, { authorization: `Bearer ${who}` });
  await expect(await claim('peter'), 200, { status: 'waiting' });
  assertEquals(w.sent, []);
  await expect(await w.deliver(purchase()), 200, { status: 'granted' });
  await expect(await w.deliver(purchase()), 200, { status: 'restored' });
  await expect(await claim('peter'), 200, { status: 'recorded' });
  await expect(await claim('lea', '2000000812345678'), 200, { status: 'taken' });
  assertEquals(w.sent.map((e) => [e.name, e.sale.transactionId, e.subject]), [[
    'purchase_completed',
    '2000000812345678',
    { installId: INSTALL, householdId: HOME, internal: true },
  ]]);
  assertEquals([w.sent[0].sale.price, w.sent[0].sale.currency], [9.99, 'EUR']);
});

Deno.test('purchase_completed goes out once: the webhook first, then the claim', async () => {
  const w = world();
  const claim = () =>
    w.handle('/claim', { store: 'apple', transactionId: '2000000812345679' }, {
      authorization: 'Bearer lea',
    });
  await expect(await w.deliver(purchase()), 200, { status: 'granted' });
  assertEquals(w.sent, []);
  await expect(await claim(), 200, { status: 'recorded' });
  await expect(await claim(), 200, { status: 'recorded' });
  await expect(await w.deliver(purchase()), 200, { status: 'restored' });
  assertEquals(w.sent.map((e) => [e.name, e.sale.householdId]), [['purchase_completed', HOME]]);
  assertEquals(w.calls, [LEA, LEA]);
});

Deno.test("a claim for another household's purchase is not its buyer", async () => {
  const w = world();
  await w.deliver(purchase({ app_user_id: OTHER }));
  await expect(
    await w.handle('/claim', { store: 'apple', transactionId: '2000000812345678' }, {
      authorization: 'Bearer peter',
    }),
    200,
    { status: 'elsewhere' },
  );
  assertEquals(w.sent, []);
});

Deno.test("production purchases are revenue, unless a tester's", async () => {
  const w = world();
  const claim = () =>
    w.handle('/claim', { store: 'apple', transactionId: '2000000812345678' }, {
      authorization: 'Bearer peter',
    });
  await w.deliver(purchase({ environment: 'PRODUCTION' }));
  await claim();
  w.books.testers.add(PETER);
  const tx = { transaction_id: 't2', original_transaction_id: 't2' };
  await w.deliver(purchase({ environment: 'PRODUCTION', ...tx }));
  await w.handle('/claim', { store: 'apple', transactionId: 't2' }, {
    authorization: 'Bearer peter',
  });
  await w.deliver(of('CANCELLATION', { environment: 'PRODUCTION', ...tx }));
  assertEquals(w.sent.map((e) => [e.name, e.subject.internal]), [
    ['purchase_completed', false],
    ['purchase_completed', true],
    ['purchase_refunded', true],
  ]);
});

Deno.test('the claim before the webhook makes the buyer a tester: internal', async () => {
  const w = world();
  w.books.testers.add(PETER);
  await w.handle('/claim', { store: 'apple', transactionId: '2000000812345678' }, {
    authorization: 'Bearer peter',
  });
  await w.deliver(purchase({ environment: 'PRODUCTION' }));
  assertEquals(w.sent.map((e) => e.subject.internal), [true]);
});

Deno.test('no event for a buyer without analytics consent', async () => {
  const w = world({ subject: () => Promise.resolve(null) });
  await w.deliver(purchase());
  await w.handle('/claim', { store: 'apple', transactionId: '2000000812345678' }, {
    authorization: 'Bearer peter',
  });
  assertEquals(w.sent, []);
});

Deno.test('analytics failing never fails the purchase', async () => {
  const reported: unknown[] = [];
  const w = world({
    event: () => Promise.reject(new Error('posthog down')),
    report: (e) => reported.push(e),
  });
  await w.deliver(purchase());
  await expect(
    await w.handle('/claim', { store: 'apple', transactionId: '2000000812345678' }, {
      authorization: 'Bearer peter',
    }),
    200,
    { status: 'recorded' },
  );
  assertEquals(reported.length, 1);
});

Deno.test('test events exist only inside a local stack', async () => {
  const body = { appUserId: HOME, transactionId: 'fake-1' };
  await expect(await world().handle('/test/event', body), 404, { error: 'not_found' });
  await expect(await world().handle('/test/sign', body), 404);
  const w = world({ local: true });
  await expect(await w.handle('/test/event', body), 200, { status: 'granted' });
  await expect(await w.handle('/test/event', body), 200, { status: 'restored' });
  await expect(await w.handle('/test/event', { ...body, type: 'CANCELLATION' }), 200, {
    status: 'revoked',
  });
  await expect(await w.handle('/test/event', { ...body, type: 'REFUND_REVERSED' }), 200, {
    status: 'reinstated',
  });
  await expect(await w.handle('/test/event', { ...body, type: 'TRANSFER' }), 200, {
    status: 'ignored',
  });
  await expect(
    await w.handle('/test/event', {
      appUserId: OTHER,
      transactionId: 'fake-2',
      store: 'PLAY_STORE',
      environment: 'PRODUCTION',
    }),
    200,
    { status: 'granted' },
  );
  const play = w.books.rows.get('google:fake-2')!.purchase;
  assertEquals([play.environment, play.householdId, play.price], ['Production', OTHER, 9.99]);
  await expect(
    await w.handle('/test/event', { ...body, isFamilyShare: true, transactionId: 'f3' }),
    200,
    {
      status: 'ignored',
    },
  );
  await expect(await w.handle('/test/event', { ...body, appUserId: 'not-a-household' }), 200, {
    status: 'ignored',
  });
  for (
    const bad of [
      {},
      { appUserId: HOME },
      { ...body, type: 'TEST' },
      { ...body, store: 'STRIPE' },
      { ...body, environment: 'XCODE' },
      { ...body, isFamilyShare: 'yes' },
    ]
  ) {
    await expect(await w.handle('/test/event', bad), 400);
  }
});

Deno.test('unknown routes and methods are 404', async () => {
  const w = world();
  await expect(await w.handle('/verify', {}), 404);
  await expect(await w.handle('/apple/notifications', {}), 404);
  await expect(await w.handle('/claim'), 404);
});

Deno.test('the webhook lives at /purchases/revenuecat/webhook only (ADDENDUM 6)', async () => {
  const w = world();
  const raw = JSON.stringify({ api_version: '1.0', event: purchase() });
  await expect(await w.handle('', raw, { authorization: AUTH }), 404, { error: 'not_found' });
  await expect(await w.handle('/revenuecat/webhook', raw, { authorization: AUTH }), 200, {
    status: 'granted',
  });
});

Deno.test("the deletion route skips without RevenueCat's key, and reports a failed run", async () => {
  await expect(await world().handle('/revenuecat/deletions', {}), 200, {
    status: 'not_configured',
  });
  const ok = { due: 1, deleted: 1, pending: 0, failed: 0 };
  const done = world({ deleteDueCustomers: () => Promise.resolve(ok) });
  await expect(await done.handle('/revenuecat/deletions', {}), 200, ok);
  const failed = { due: 1, deleted: 0, pending: 0, failed: 1 };
  const broken = world({ deleteDueCustomers: () => Promise.resolve(failed) });
  await expect(await broken.handle('/revenuecat/deletions', {}), 502, failed);
});
