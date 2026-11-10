import { assert, assertEquals, assertExists, assertMatch, assertNotEquals } from '@std/assert';
import { CONFIRM_VERSIONS, CONSENT_VERSIONS } from './consent.ts';
import {
  configFrom,
  type ConfirmPress,
  createHandler,
  LIMITS,
  type Recipient,
  type SignupRow,
  type Store,
} from './handler.ts';
import type { Mail } from './mail.ts';

const PROXY = 'proxy-secret-for-tests';
const HMAC = 'hmac-secret-for-tests';
const T0 = new Date('2026-11-16T10:00:00Z');
const HOUR = 3600_000;

interface Row extends SignupRow {
  id: string;
  launchNews: boolean;
  confirmVersion: string | null;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  lastMailAt: Date;
}

/** The SQL functions' rules over a map, enough to drive the handler. */
class FakeStore implements Store {
  rows = new Map<string, Row>();
  calls = 0;
  failWith: unknown = null;
  hits = new Map<string, number>();

  rateHit(keyHash: string, now: Date, limits: typeof LIMITS) {
    this.calls++;
    if (this.failWith) return Promise.reject(this.failWith);
    const hour = Math.floor(now.getTime() / HOUR);
    const bump = (k: string) => {
      const n = (this.hits.get(`${k}/${hour}`) ?? 0) + 1;
      this.hits.set(`${k}/${hour}`, n);
      return n;
    };
    const key = bump(keyHash);
    const all = bump('all');
    return Promise.resolve(key <= limits.perKey && all <= limits.total);
  }

  signup(r: SignupRow, now: Date): Promise<Recipient | null> {
    this.calls++;
    if (this.failWith) return Promise.reject(this.failWith);
    const known = this.rows.get(r.email.toLowerCase());
    const expiresAt = new Date(now.getTime() + 48 * HOUR);
    if (!known) {
      const row = {
        ...r,
        id: crypto.randomUUID(),
        launchNews: false,
        confirmVersion: null,
        confirmedAt: null,
        expiresAt,
        lastMailAt: now,
      };
      this.rows.set(r.email.toLowerCase(), row);
      return Promise.resolve(this.recipient(row));
    }
    if (known.confirmedAt || now.getTime() - known.lastMailAt.getTime() < 24 * HOUR) {
      return Promise.resolve(null);
    }
    Object.assign(known, { ...r, email: known.email, expiresAt, lastMailAt: now });
    return Promise.resolve(this.recipient(known));
  }

  confirm(tokenHash: string, now: Date, press: ConfirmPress) {
    this.calls++;
    const row = [...this.rows.values()].find((r) =>
      !r.confirmedAt && r.tokenHash === tokenHash && r.expiresAt !== null && r.expiresAt > now
    );
    if (!row) return Promise.resolve(null);
    Object.assign(row, {
      confirmedAt: now,
      tokenHash: '',
      expiresAt: null,
      confirmVersion: press.confirmVersion,
      launchNews: press.launchNews,
    });
    return Promise.resolve(this.recipient(row));
  }

  mailed(id: string, _kind: string, now: Date) {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (row) row.lastMailAt = now;
    return Promise.resolve(!!row);
  }

  unsubscribe(id: string) {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (row) this.rows.delete(row.email.toLowerCase());
    return Promise.resolve(!!row);
  }

  private recipient(r: Row): Recipient {
    return { id: r.id, email: r.email, locale: r.locale, launchNews: r.launchNews };
  }
}

interface Sent {
  to: string;
  mail: Mail;
  key: string;
}

function setup(env: Record<string, string> = {}) {
  const store = new FakeStore();
  const sent: Sent[] = [];
  const deferred: (() => Promise<void>)[] = [];
  const clock = { now: T0 };
  let seed = 0;
  const { config } = configFrom(
    new Map(Object.entries({
      WAITLIST_PROXY_SECRET: PROXY,
      WAITLIST_HMAC_SECRET: HMAC,
      ...env,
    })),
  );
  const handler = createHandler({
    config,
    store,
    mailer: {
      send(to, mail, key) {
        sent.push({ to, mail, key });
        return Promise.resolve();
      },
    },
    now: () => clock.now,
    random: (n) => new Uint8Array(n).fill(++seed),
    defer: (work) => {
      deferred.push(work);
    },
  });
  const call = (
    route: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    handler(
      new Request(`http://localhost/waitlist/${route}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-waitlist-proxy-secret': PROXY,
          'x-waitlist-client': 'client-a',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  /** Runs what the function does after its answer, as EdgeRuntime.waitUntil would. */
  const flush = async () => {
    for (let work = deferred.shift(); work; work = deferred.shift()) await work();
  };
  return { store, sent, deferred, clock, call, flush };
}

const form = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  platform: 'ios',
  locale: 'de',
  consent_version: CONSENT_VERSIONS.de,
  website: '',
  elapsed_ms: 5000,
  ...extra,
});

/** The confirmation page's POST: the token, the page's text version, the unticked box. */
const press = (token: unknown, extra: Record<string, unknown> = {}) => ({
  token,
  confirm_version: CONFIRM_VERSIONS.de,
  launch_news: false,
  ...extra,
});

/** The [i]th of [items]; fails the test when there is none. */
function nth<T>(items: readonly T[], i: number): T {
  const item = items[i];
  assertExists(item, `no item ${i}`);
  return item;
}

function rowOf(store: FakeStore, email: string): Row {
  const row = store.rows.get(email);
  assertExists(row, `no row for ${email}`);
  return row;
}

function tokenOf(mail: Mail): string {
  const token = mail.text.match(/#t=(?<token>[A-Za-z0-9_-]{43})/)?.groups?.token;
  assertExists(token, 'a confirm link in the mail');
  return token;
}

function oneClick(mail: Mail): { id: string; sig: string } {
  const header = mail.headers['List-Unsubscribe'];
  assertExists(header, 'a List-Unsubscribe header');
  const url = new URL(header.slice(1, -1));
  const id = url.searchParams.get('id');
  const sig = url.searchParams.get('s');
  assertExists(id, 'an id in the one-click link');
  assertExists(sig, 'a signature in the one-click link');
  return { id, sig };
}

/** Everything the function writes to the console during [work]. */
async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const saved = methods.map((m) => ({ m, write: console[m] }));
  for (const m of methods) {
    console[m] = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  }
  try {
    await work();
  } finally {
    for (const { m, write } of saved) console[m] = write;
  }
  return lines;
}

const assertNoPersonalData = (lines: string[], ...secrets: string[]) => {
  for (const line of lines) {
    assertMatch(line, /^waitlist: [a-z_]+( [0-9A-Z]{5})?$/, `a fixed outcome code: ${line}`);
    for (const s of ['@', 'hello+', ...secrets]) assert(!line.includes(s), `no ${s} in "${line}"`);
  }
};

Deno.test('off without both secrets, and 404 to anyone without the proxy secret', async () => {
  const req = (headers: Record<string, string>, path = 'signup', method = 'POST') =>
    new Request(`http://localhost/waitlist/${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(form('hello+off@hummlist.com')) : null,
    });
  for (const env of [{}, { WAITLIST_PROXY_SECRET: PROXY }, { WAITLIST_HMAC_SECRET: HMAC }]) {
    const store = new FakeStore();
    const handler = createHandler({
      config: configFrom(new Map(Object.entries(env))).config,
      store,
      mailer: null,
      now: () => T0,
      random: (n) => new Uint8Array(n),
      defer: () => {
        throw new Error('nothing may be deferred');
      },
    });
    const res = await handler(req({ 'x-waitlist-proxy-secret': PROXY }));
    assertEquals(res.status, 404, JSON.stringify(Object.keys(env)));
    assertEquals(store.calls, 0);
  }
  const { call, store } = setup();
  for (const secret of ['', 'proxy-secret-for-test', `${PROXY}x`]) {
    const res = await call('signup', form('hello+off@hummlist.com'), {
      'x-waitlist-proxy-secret': secret,
    });
    assertEquals(res.status, 404);
  }
  assertEquals((await call('admin', {})).status, 404);
  assertEquals((await call('signup/extra', {})).status, 404);
  const handler = createHandler({
    config: configFrom(new Map([['WAITLIST_PROXY_SECRET', PROXY], ['WAITLIST_HMAC_SECRET', HMAC]]))
      .config,
    store,
    mailer: null,
    now: () => T0,
    random: (n) => new Uint8Array(n),
    defer: () => {},
  });
  assertEquals(
    (await handler(req({ 'x-waitlist-proxy-secret': PROXY }, 'signup', 'GET'))).status,
    404,
  );
  assertEquals(store.calls, 0);
});

Deno.test('AC5: an invalid address is refused and stores nothing', async () => {
  const { call, store, deferred } = setup();
  for (
    const email of [
      '',
      'nope',
      'a@b',
      'a b@hummlist.com',
      'hello+x@hummlist.c',
      'hello+\u0007@hummlist.com',
      `hello+${'x'.repeat(240)}@hummlist.com`,
      42,
    ]
  ) {
    const res = await call('signup', form('', { email }));
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { error: 'invalid_email' });
  }
  const cases: [Record<string, unknown>, string][] = [
    [{ platform: 'windows' }, 'invalid_platform'],
    [{ platform: undefined }, 'invalid_platform'],
    [{ locale: 'fr' }, 'invalid_request'],
    [{ consent_version: CONSENT_VERSIONS.en }, 'invalid_request'],
    [{ consent_version: 'waitlist-de-v1' }, 'invalid_request'],
  ];
  for (const [extra, error] of cases) {
    const res = await call('signup', form('hello+ac5@hummlist.com', extra));
    assertEquals([res.status, await res.json()], [400, { error }], JSON.stringify(extra));
  }
  for (
    const body of [
      'not json',
      '[1]',
      JSON.stringify(form('hello+ac5@hummlist.com', { pad: 'x'.repeat(2048) })),
    ]
  ) {
    const res = await call('signup', body);
    assertEquals([res.status, await res.json()], [400, { error: 'invalid_request' }]);
  }
  assertEquals(store.calls, 0);
  assertEquals(deferred.length, 0);
});

Deno.test('AC6: new, known, confirmed, bot, non-test and rate-limited sign-ups get the same answer before any database work', async () => {
  const { call, store, sent, deferred, flush } = setup();
  await call('signup', form('hello+known@hummlist.com'));
  await call('signup', form('hello+confirmed@hummlist.com'), { 'x-waitlist-client': 'client-b' });
  await flush();
  await call('confirm', press(tokenOf(nth(sent, 1).mail)));
  for (let i = 0; i < LIMITS.perKey; i++) {
    await call('signup', form(`hello+fill${i}@hummlist.com`, { website: 'x' }), {
      'x-waitlist-client': 'client-limited',
    });
  }
  await flush();
  sent.length = 0;

  const requests: [string, Record<string, unknown>][] = [
    ['new', form('hello+new@hummlist.com')],
    ['known in other letters', form('HELLO+Known@hummlist.com', { platform: 'android' })],
    ['confirmed', form('hello+confirmed@hummlist.com')],
    ['honeypot', form('hello+bot@hummlist.com', { website: 'https://spam.example' })],
    ['too fast', form('hello+fast@hummlist.com', { elapsed_ms: 1499 })],
    ['no timing', form('hello+notime@hummlist.com', { elapsed_ms: undefined })],
    ['not a test address', form('someone@example.com')],
    ['rate-limited', form('hello+limited@hummlist.com')],
  ];
  const answers = [];
  for (const [i, [name, body]] of requests.entries()) {
    const calls = store.calls;
    const client = name === 'rate-limited' ? 'client-limited' : `client-${i}`;
    const res = await call('signup', body, { 'x-waitlist-client': client });
    answers.push({
      name,
      status: res.status,
      body: await res.text(),
      type: res.headers.get('content-type'),
      cache: res.headers.get('cache-control'),
    });
    assertEquals(store.calls, calls + 1, `${name}: only the rate counter before the answer`);
  }
  for (const a of answers) {
    assertEquals(
      { status: a.status, body: a.body, type: a.type, cache: a.cache },
      {
        status: 202,
        body: '{"status":"ok"}',
        type: 'application/json; charset=utf-8',
        cache: 'no-store',
      },
      a.name,
    );
  }
  assertEquals(deferred.length, requests.length - 1, 'every sign-up but the limited one defers');
  assertEquals(sent.length, 0, 'no mail before the answer');

  await flush();
  assertEquals(sent.map((s) => s.to), ['hello+new@hummlist.com'], 'only the new address is mailed');
  assertEquals(store.rows.size, 3, 'no second row for the known address, none for the dropped');
  assertEquals(
    rowOf(store, 'hello+known@hummlist.com').platform,
    'ios',
    'nothing changed in 24 h',
  );
});

Deno.test('AC9: one sign-up over the per-client limit in an hour gets the same 202 and stores nothing, others still pass', async () => {
  const { call, clock, flush, store, sent, deferred } = setup();
  const ok = (res: Response) => res.text().then((body) => [res.status, body]);
  for (let i = 0; i < LIMITS.perKey; i++) {
    assertEquals(
      await ok(await call('signup', form(`hello+rate${i}@hummlist.com`))),
      [202, '{"status":"ok"}'],
    );
  }
  await flush();
  const mailed = sent.length;
  const refused = await call('signup', form('hello+rate-over@hummlist.com'));
  assertEquals(await ok(refused), [202, '{"status":"ok"}'], 'the answer every sign-up gets');
  assertEquals(deferred.length, 0, 'nothing runs after the answer');
  await flush();
  assertEquals(store.rows.has('hello+rate-over@hummlist.com'), false, 'nothing stored');
  assertEquals(sent.length, mailed, 'nothing sent');
  assertEquals(
    (await call('signup', form('hello+rate-over@hummlist.com'), { 'x-waitlist-client': 'other' }))
      .status,
    202,
  );
  clock.now = new Date(T0.getTime() + HOUR);
  assertEquals((await call('signup', form('hello+rate6@hummlist.com'))).status, 202);
  await flush();
  assertEquals(store.rows.has('hello+rate-over@hummlist.com'), true, 'another client stores it');
  const missing = await call('signup', form('hello+rate7@hummlist.com'), {
    'x-waitlist-client': '',
  });
  assertEquals([missing.status, await missing.json()], [400, { error: 'invalid_request' }]);
});

Deno.test('AC9: a filled honeypot stores nothing', async () => {
  const { call, flush, store, sent } = setup();
  await call('signup', form('hello+pot@hummlist.com', { website: 'x' }));
  await flush();
  assertEquals(store.rows.size, 0);
  assertEquals(sent.length, 0);
});

Deno.test('AC10: one confirmation mail from Peter, with the confirm and delete links of the page the sign-up came from', async () => {
  const { call, flush, sent, store } = setup();
  await call('signup', form('hello+ac10@hummlist.com', { launch_news: true }), {
    'x-waitlist-origin': 'https://hummlist-site-git-job-82-peter-trost.vercel.app',
  });
  await flush();
  assertEquals(sent.length, 1);
  const { to, mail, key } = nth(sent, 0);
  const row = rowOf(store, 'hello+ac10@hummlist.com');
  assertEquals(to, 'hello+ac10@hummlist.com');
  assertEquals(mail.from, '"Peter von Hummlist" <hello@hummlist.com>');
  assertEquals(mail.replyTo, 'hello@hummlist.com');
  assertEquals(mail.subject, 'Bitte bestätige deine E-Mail für Hummlist');
  assertEquals(mail.headers, {}, 'the confirmation has no List-Unsubscribe');
  const token = tokenOf(mail);
  assert(
    mail.text.includes(
      `E-Mail bestätigen <https://hummlist-site-git-job-82-peter-trost.vercel.app/de/warteliste/bestaetigen#t=${token}>`,
    ),
  );
  assert(mail.text.includes(`/de/warteliste/abmelden#id=${row.id}&s=`));
  assert(!mail.text.includes('offiziell startet'), 'no launch line, whatever the form sent');
  assertEquals(row.launchNews, false, 'launch_news from the form is dropped');
  assertEquals(row.tokenHash.length, 64);
  assertNotEquals(row.tokenHash, token, 'only the hash is stored');
  assertMatch(key, new RegExp(`^confirm/${row.id}/[0-9a-f]{16}$`));
});

Deno.test('links in mails go only to known sites', async () => {
  for (
    const origin of [
      'https://evil.example',
      'https://hummlist.com.evil.example',
      'http://localhost:3000',
    ]
  ) {
    const { call, flush, sent } = setup();
    await call(
      'signup',
      form('hello+origin@hummlist.com', { locale: 'en', consent_version: CONSENT_VERSIONS.en }),
      {
        'x-waitlist-origin': origin,
      },
    );
    await flush();
    assert(
      nth(sent, 0).mail.text.includes(
        'Confirm email <https://snacklist.app/en/waitlist/confirm#t=',
      ),
      origin,
    );
  }
});

Deno.test('the 24 h rule: a known unconfirmed address is mailed again only after a day, with a new token', async () => {
  const { call, flush, sent, clock } = setup();
  await call('signup', form('hello+again@hummlist.com'));
  await flush();
  clock.now = new Date(T0.getTime() + 24 * HOUR - 1000);
  await call('signup', form('hello+again@hummlist.com', { platform: 'android' }));
  await flush();
  assertEquals(sent.length, 1);
  clock.now = new Date(T0.getTime() + 24 * HOUR);
  await call('signup', form('hello+again@hummlist.com', { platform: 'android' }));
  await flush();
  assertEquals(sent.length, 2);
  const [first, second] = sent.map((s) => tokenOf(s.mail));
  assertNotEquals(first, second);
  assertEquals(await (await call('confirm', press(first))).json(), { status: 'invalid' });
  assertEquals(await (await call('confirm', press(second))).json(), { status: 'confirmed' });
});

Deno.test('AC11: the token confirms once within 48 h, then the welcome mail goes out with one-click unsubscribe', async () => {
  const { call, flush, sent, clock, store } = setup();
  await call('signup', form('hello+ac11@hummlist.com'));
  await call('signup', form('hello+late@hummlist.com'), { 'x-waitlist-client': 'b' });
  await flush();
  const [token, late] = sent.map((s) => tokenOf(s.mail));

  for (const bad of ['', 'short', `${token}x`, 42]) {
    const res = await call('confirm', press(bad));
    assertEquals([res.status, await res.json()], [200, { status: 'invalid' }]);
  }
  const res = await call('confirm', press(token));
  assertEquals([res.status, await res.json()], [200, { status: 'confirmed' }]);
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(sent.length, 2, 'the welcome mail waits for the answer');
  await flush();
  assertEquals(sent.length, 3);
  const welcome = nth(sent, 2);
  assertEquals(welcome.to, 'hello+ac11@hummlist.com');
  assertEquals(welcome.key, `welcome/${rowOf(store, 'hello+ac11@hummlist.com').id}`);
  assertEquals(welcome.mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assertMatch(
    welcome.mail.headers['List-Unsubscribe'] ?? '',
    /^<https:\/\/snacklist\.app\/api\/waitlist\/unsubscribe\?id=[0-9a-f-]{36}&s=[0-9a-f]{64}&l=de>$/,
  );
  assertEquals(await (await call('confirm', press(token))).json(), { status: 'invalid' }, 'used');
  await flush();
  assertEquals(sent.length, 3, 'no second welcome');

  clock.now = new Date(T0.getTime() + 48 * HOUR);
  assertEquals(
    await (await call('confirm', press(late))).json(),
    { status: 'invalid' },
    'expired',
  );
  assertEquals(rowOf(store, 'hello+late@hummlist.com').confirmedAt, null);
});

Deno.test('AC12: the one-click link deletes the row, again and again; a forged one does nothing', async () => {
  const { call, flush, sent, store } = setup();
  await call('signup', form('hello+ac12@hummlist.com'));
  await flush();
  await call('confirm', press(tokenOf(nth(sent, 0).mail)));
  await flush();
  const { id, sig } = oneClick(nth(sent, 1).mail);
  const page = nth(sent, 1).mail.text.match(/abmelden#id=([0-9a-f-]+)&s=([0-9a-f]+)/);
  assertEquals(page?.slice(1), [id, sig], 'the page link and the header carry the same values');

  const otherId = crypto.randomUUID();
  for (
    const body of [
      { id, sig: sig.replace(/^./, sig[0] === 'a' ? 'b' : 'a') },
      { id: otherId, sig },
      { id },
      {},
    ]
  ) {
    const res = await call('unsubscribe', body);
    assertEquals([res.status, await res.json()], [200, { status: 'invalid' }]);
  }
  assertEquals(store.rows.size, 1);
  const res = await call('unsubscribe', { id: id.toUpperCase(), sig });
  assertEquals([res.status, await res.json()], [200, { status: 'deleted' }]);
  assertEquals(store.rows.size, 0, 'deleted at once: no further mail can find it');
  assertEquals(await (await call('unsubscribe', { id, sig })).json(), { status: 'deleted' });
  assertEquals(await (await call('confirm', press(tokenOf(nth(sent, 0).mail)))).json(), {
    status: 'invalid',
  });
});

Deno.test('the recipient allow-list: unset keeps to hello+…@hummlist.com, * lets everyone in', async () => {
  const test = setup();
  await test.call('signup', form('peter@example.com'));
  await test.flush();
  assertEquals([test.store.rows.size, test.sent.length], [0, 0]);

  const all = setup({ WAITLIST_MAIL_ALLOW: '*' });
  await all.call('signup', form('peter@example.com'));
  await all.flush();
  assertEquals([all.store.rows.size, all.sent.map((s) => s.to)], [1, ['peter@example.com']]);
});

Deno.test('the approved texts go out with the placeholder guard on (WAITLIST_ALLOW_PLACEHOLDERS unset)', async () => {
  const { call, flush, sent, store } = setup();
  const logs = await logsOf(async () => {
    await call('signup', form('hello+approved@hummlist.com'));
    await flush();
    await call('confirm', press(tokenOf(nth(sent, 0).mail)));
    await flush();
  });
  assertEquals(store.rows.size, 1);
  assertEquals(sent.length, 2, 'the confirmation and the welcome mail');
  for (const { mail } of sent) assert(![mail.subject, mail.html, mail.text].join().includes('⟦'));
  assertEquals(logs, [
    'waitlist: signup_stored',
    'waitlist: confirmation_sent',
    'waitlist: confirm_ok',
    'waitlist: welcome_sent',
  ]);
});

Deno.test('N-74: launch_news sent at sign-up is ignored, on the first sign-up and on the re-send', async () => {
  const { call, flush, sent, store, clock } = setup();
  for (const [i, value] of [true, 'yes', 1, null, { a: 1 }].entries()) {
    const email = `hello+news${i}@hummlist.com`;
    const res = await call('signup', form(email, { launch_news: value }));
    assertEquals([res.status, await res.text()], [202, '{"status":"ok"}'], JSON.stringify(value));
    await flush();
    assertEquals(rowOf(store, email).launchNews, false, JSON.stringify(value));
  }
  clock.now = new Date(T0.getTime() + 24 * HOUR);
  await call('signup', form('hello+news0@hummlist.com', { launch_news: true }));
  await flush();
  assertEquals(sent.length, 6, 'the re-send went out');
  assertEquals(rowOf(store, 'hello+news0@hummlist.com').launchNews, false, 'still false');
  for (const { mail } of sent) assert(!mail.text.includes('offiziell startet'));
});

Deno.test('N-73: the confirm press names the current confirmation text, else 400 and nothing changes', async () => {
  const { call, flush, sent, store } = setup();
  await call('signup', form('hello+press@hummlist.com'));
  await flush();
  const token = tokenOf(nth(sent, 0).mail);
  for (
    const extra of [
      { confirm_version: undefined },
      { confirm_version: '' },
      { confirm_version: 'waitlist-confirm-de-v2' },
      { confirm_version: CONSENT_VERSIONS.de },
      { confirm_version: ['waitlist-confirm-de-v1'] },
      { launch_news: 'true' },
      { launch_news: 1 },
      { launch_news: null },
    ]
  ) {
    const res = await call('confirm', press(token, extra));
    assertEquals(
      [res.status, await res.json()],
      [400, { error: 'invalid_request' }],
      JSON.stringify(extra),
    );
  }
  const unconfirmed = rowOf(store, 'hello+press@hummlist.com');
  assertEquals([unconfirmed.confirmedAt, unconfirmed.confirmVersion], [null, null]);
  assertEquals(
    await (await call('confirm', press('short', { confirm_version: 'x' }))).json(),
    { error: 'invalid_request' },
    'the body is checked before the token',
  );
  const res = await call('confirm', press(token, { launch_news: undefined }));
  assertEquals([res.status, await res.json()], [200, { status: 'confirmed' }]);
  const row = rowOf(store, 'hello+press@hummlist.com');
  assertEquals(
    [row.confirmVersion, row.launchNews],
    ['waitlist-confirm-de-v1', false],
    'no launch_news is the unticked box',
  );
});

Deno.test('N-73/N-74: the press stores its text version and the launch-news box, and the welcome mail follows it', async () => {
  const { call, flush, sent, store } = setup();
  const cases = [
    { email: 'hello+tick-de@hummlist.com', locale: 'de', version: CONFIRM_VERSIONS.de, news: true },
    {
      email: 'hello+tick-en@hummlist.com',
      locale: 'en',
      version: CONFIRM_VERSIONS.en,
      news: false,
    },
  ] as const;
  for (const [i, c] of cases.entries()) {
    sent.length = 0;
    await call(
      'signup',
      form(c.email, { locale: c.locale, consent_version: CONSENT_VERSIONS[c.locale] }),
      { 'x-waitlist-client': `client-${i}` },
    );
    await flush();
    const res = await call(
      'confirm',
      press(tokenOf(nth(sent, 0).mail), { confirm_version: c.version, launch_news: c.news }),
    );
    assertEquals(await res.json(), { status: 'confirmed' });
    await flush();
    const row = rowOf(store, c.email);
    assertEquals([row.confirmVersion, row.launchNews], [c.version, c.news], c.email);
    const welcome = nth(sent, 1).mail.text;
    const sentence = c.locale === 'de'
      ? 'Sonst schreiben wir dir nur noch einmal'
      : "Otherwise we'll only email you once more";
    assertEquals(welcome.includes(sentence), c.news, `${c.email}: the launch line when ticked`);
  }
});

Deno.test('logs are outcome codes only: no address, token or database message', async () => {
  const { call, flush, sent, store } = setup();
  const pgError = Object.assign(
    new Error('duplicate key value violates unique constraint "waitlist_email_key"'),
    { code: '23505', detail: 'Key (lower(email))=(hello+log@hummlist.com) already exists.' },
  );
  const logs = await logsOf(async () => {
    await call('signup', form('hello+log@hummlist.com', { launch_news: true }));
    await call('signup', form('HELLO+log@hummlist.com'));
    await call('signup', form('hello+logbot@hummlist.com', { website: 'x' }));
    await call('signup', form('someone@example.com'));
    await flush();
    const token = tokenOf(nth(sent, 0).mail);
    await call('confirm', press(token, { confirm_version: 'waitlist-confirm-fr-v1' }));
    await call('confirm', press(token, { launch_news: true }));
    await call('confirm', press(token));
    await flush();
    const { id, sig } = oneClick(nth(sent, 1).mail);
    await call('unsubscribe', { id, sig });
    await call('unsubscribe', { id, sig: '0'.repeat(64) });
    for (let i = 0; i <= LIMITS.perKey; i++) {
      await call('signup', form(`hello+lograte${i}@hummlist.com`, { website: 'x' }), {
        'x-waitlist-client': 'client-log-limited',
      });
    }
    await flush();
    store.failWith = pgError;
    const res = await call('signup', form('hello+log2@hummlist.com'));
    assertEquals([res.status, await res.json()], [503, { error: 'unavailable' }]);
  });
  assertEquals(logs, [
    'waitlist: signup_stored',
    'waitlist: confirmation_sent',
    'waitlist: signup_unchanged',
    'waitlist: signup_dropped_honeypot',
    'waitlist: signup_dropped_recipient',
    'waitlist: confirm_invalid_request',
    'waitlist: confirm_ok',
    'waitlist: confirm_invalid',
    'waitlist: welcome_sent',
    'waitlist: unsubscribe_deleted',
    'waitlist: unsubscribe_invalid',
    'waitlist: signup_rate_limited',
    ...Array(LIMITS.perKey).fill('waitlist: signup_dropped_honeypot'),
    'waitlist: signup_failed 23505',
  ]);
  assertNoPersonalData(logs, tokenOf(nth(sent, 0).mail), HMAC, PROXY);
});

Deno.test('a database failure after the answer is logged by its code only', async () => {
  const { call, flush, store } = setup();
  await call('signup', form('hello+late-fail@hummlist.com'));
  store.failWith = Object.assign(new Error('Key (lower(email))=(hello+late-fail@hummlist.com)'), {
    code: '23505',
  });
  const logs = await logsOf(flush);
  assertEquals(logs, ['waitlist: signup_failed 23505']);
});

Deno.test('draft texts can be allowed only while just test addresses are mailed', () => {
  const env = (extra: Record<string, string>) =>
    new Map(Object.entries({
      WAITLIST_PROXY_SECRET: 'p',
      WAITLIST_HMAC_SECRET: 'h',
      WAITLIST_ALLOW_PLACEHOLDERS: '1',
      ...extra,
    }));
  assertEquals(configFrom(env({})).config?.allowPlaceholders, true);
  assertEquals(configFrom(env({ WAITLIST_MAIL_ALLOW: '*' })).config?.allowPlaceholders, false);
});
