import { assert, assertEquals, assertMatch } from '@std/assert';
import { type Mail, MailError } from '../_shared/resend.ts';
import {
  type Batch,
  configFrom,
  createHandler,
  type RunError,
  type Store,
  type Watermark,
} from './handler.ts';
import { batch, note } from './test_notes.ts';

const SECRET = 'digest-secret-for-tests';
const MESSAGE = 'Bitte <script>alert(1)</script> nicht verlieren';
const EMAIL = 'anna.private@gmail.com';

interface Sent {
  to: string;
  mail: Mail;
  key: string;
}

interface Fake {
  batches: Batch[];
  advances: { from: Watermark; to: Watermark; digestOn: string }[];
  records: (RunError | null)[];
  sent: Sent[];
  logs: string[];
  call(path?: string, init?: RequestInit): Promise<Response>;
  run(secret?: string): Promise<{ status: number; body: unknown; raw: string }>;
}

const mixed = () =>
  batch([
    note({
      id: '30000000-0000-4000-8000-000000000001',
      message: MESSAGE,
      contact_ok: true,
      email: EMAIL,
    }),
    note({
      id: '30000000-0000-4000-8000-000000000002',
      created_at: '2026-11-11T17:00:00.000001Z',
      message: 'Zweite Notiz',
    }),
  ]);

function harness(opts: {
  batch?: () => Batch;
  secret?: string | null;
  mailer?: 'ok' | 'fail' | null;
  advance?: (n: number) => boolean | Error;
  batchError?: Error;
  recordError?: Error;
}): Fake {
  const fake: Omit<Fake, 'call' | 'run'> = {
    batches: [],
    advances: [],
    records: [],
    sent: [],
    logs: [],
  };
  const store: Store = {
    batch() {
      if (opts.batchError) return Promise.reject(opts.batchError);
      const b = (opts.batch ?? mixed)();
      fake.batches.push(b);
      return Promise.resolve(b);
    },
    advance(from, to, digestOn) {
      fake.advances.push({ from, to, digestOn });
      const result = (opts.advance ?? (() => true))(fake.advances.length);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
    record(error) {
      fake.records.push(error);
      return opts.recordError ? Promise.reject(opts.recordError) : Promise.resolve();
    },
    status: () => Promise.resolve({ enabled: true, healthy: false }),
  };
  const mailer = opts.mailer === null ? null : {
    send(to: string, mail: Mail, key: string) {
      if (opts.mailer === 'fail') return Promise.reject(new MailError(422));
      fake.sent.push({ to, mail, key });
      return Promise.resolve();
    },
  };
  const handler = createHandler({
    secret: opts.secret === undefined ? SECRET : opts.secret,
    store,
    mailer,
    now: () => new Date('2026-11-12T07:00:00Z'),
  });
  const call = async (path = '/feedback-digest', init: RequestInit = {}) => {
    const original = console.log;
    console.log = (...args: unknown[]) => fake.logs.push(args.join(' '));
    try {
      return await handler(new Request(`http://localhost${path}`, init));
    } finally {
      console.log = original;
    }
  };
  return {
    ...fake,
    call,
    async run(secret = SECRET) {
      const res = await call('/functions/v1/feedback-digest', {
        method: 'POST',
        headers: { 'x-feedback-digest-secret': secret, 'content-type': 'application/json' },
        body: '{}',
      });
      const raw = await res.text();
      return { status: res.status, body: JSON.parse(raw), raw };
    },
  };
}

/** Logs are fixed codes; neither they nor any answer carries a note or an address. */
function assertNoContent(f: Fake, raws: string[]) {
  for (const line of f.logs) assertMatch(line, /^feedback-digest: [a-z_]+( [0-9A-Z]{3,5})?$/);
  for (const text of [...f.logs, ...raws]) {
    for (const secret of [MESSAGE, 'script', 'Zweite Notiz', EMAIL, 'gmail']) {
      assert(!text.includes(secret), `${secret} in ${text}`);
    }
  }
}

Deno.test('without FEEDBACK_DIGEST_SECRET every run is 503 not_configured and reads nothing', async () => {
  const f = harness({ secret: null });
  const res = await f.run('anything');
  assertEquals([res.status, res.body], [503, { error: 'not_configured' }]);
  assertEquals([f.batches.length, f.sent.length, f.records.length], [0, 0, 0]);
});

Deno.test('a wrong or missing secret is 401 and reads nothing', async () => {
  const f = harness({});
  const wrong = await f.run('nope');
  assertEquals([wrong.status, wrong.body], [401, { error: 'unauthorized' }]);
  const missing = await f.call('/feedback-digest', { method: 'POST', body: '{}' });
  assertEquals(missing.status, 401);
  await missing.body?.cancel();
  assertEquals([f.batches.length, f.sent.length, f.records.length], [0, 0, 0]);
});

Deno.test('switched off: 200 disabled, no mail, nothing recorded', async () => {
  const f = harness({ batch: () => ({ enabled: false }) });
  const res = await f.run();
  assertEquals([res.status, res.body], [200, { status: 'disabled' }]);
  assertEquals([f.sent.length, f.records.length, f.advances.length], [0, 0, 0]);
});

Deno.test('an empty day: no mail, a good run recorded', async () => {
  const f = harness({ batch: () => batch([]) });
  const res = await f.run();
  assertEquals([res.status, res.body], [200, { status: 'empty' }]);
  assertEquals(f.sent.length, 0);
  assertEquals(f.advances.length, 0);
  assertEquals(f.records, [null]);
});

Deno.test('notes: one mail to hello@, then the watermark moves to the last note', async () => {
  const f = harness({});
  const res = await f.run();
  assertEquals([res.status, res.body], [200, { status: 'sent', count: 2 }]);
  assertEquals(f.sent.length, 1);
  const [sent] = f.sent;
  assert(sent);
  assertEquals(sent.to, 'hello@snacklist.app');
  assertEquals(sent.mail.from, '"Peter · Snacklist" <hello@snacklist.app>');
  assertEquals(sent.mail.replyTo, undefined, 'no reply-to');
  assertEquals(sent.mail.headers, undefined);
  assertEquals(sent.mail.subject, 'Snacklist feedback digest 2026-11-12 (2 new)');
  assertMatch(sent.key, /^feedback-digest\/2026-11-12\/[0-9a-f]{32}$/);
  assertEquals(f.advances, [{
    from: mixed().since,
    to: { created_at: '2026-11-11T17:00:00.000001Z', id: '30000000-0000-4000-8000-000000000002' },
    digestOn: '2026-11-12',
  }]);
  assertEquals(f.records, [null]);
  assertEquals(f.logs, ['feedback-digest: sent']);
  assertNoContent(f, [res.raw]);
});

Deno.test('a failed send: 502, the watermark stays, send_failed recorded, no content', async () => {
  const f = harness({ mailer: 'fail' });
  const res = await f.run();
  assertEquals([res.status, res.body], [502, { status: 'failed' }]);
  assertEquals(f.advances.length, 0);
  assertEquals(f.records, ['send_failed']);
  assertEquals(f.logs, ['feedback-digest: send_failed 422']);
  assertNoContent(f, [res.raw]);
});

Deno.test('a rerun after a lost advance sends the same payload under the same key', async () => {
  const f = harness({ advance: (n) => n === 1 ? new Error('connection lost') : true });
  const first = await f.run();
  assertEquals([first.status, first.body], [500, { error: 'failed' }]);
  assertEquals(f.records, ['db_error']);
  const second = await f.run();
  assertEquals([second.status, second.body], [200, { status: 'sent', count: 2 }]);
  assertEquals(f.sent.length, 2);
  assertEquals(f.sent[0], f.sent[1], 'identical mail and idempotency key: Resend delivers once');
  assertNoContent(f, [first.raw, second.raw]);
});

Deno.test('another run moved the watermark first: 200 raced, a good run recorded', async () => {
  const f = harness({ advance: () => false });
  const res = await f.run();
  assertEquals([res.status, res.body], [200, { status: 'raced' }]);
  assertEquals(f.records, [null]);
  assertEquals(f.logs, ['feedback-digest: raced']);
});

Deno.test('notes but no Resend key: 503, recorded, the watermark stays', async () => {
  const f = harness({ mailer: null });
  const res = await f.run();
  assertEquals([res.status, res.body], [503, { error: 'mail_not_configured' }]);
  assertEquals(f.records, ['mail_not_configured']);
  assertEquals(f.advances.length, 0);
});

Deno.test('a database error: 500, db_error recorded best effort, only the SQLSTATE logged', async () => {
  const pgError = Object.assign(new Error(`duplicate key: ${EMAIL}`), { code: '23505' });
  const f = harness({ batchError: pgError, recordError: new Error('down') });
  const res = await f.run();
  assertEquals([res.status, res.body], [500, { error: 'failed' }]);
  assertEquals(f.records, ['db_error']);
  assertEquals(f.logs, ['feedback-digest: db_error 23505']);
  assertNoContent(f, [res.raw]);
});

Deno.test('GET /status answers two booleans without a secret', async () => {
  const f = harness({ secret: null });
  for (const path of ['/feedback-digest/status', '/functions/v1/feedback-digest/status/']) {
    const res = await f.call(path);
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { enabled: true, healthy: false });
  }
  assertEquals(f.batches.length, 0);
});

Deno.test('everything else is 404', async () => {
  const f = harness({});
  const cases: [string, RequestInit][] = [
    ['/feedback-digest', { method: 'GET' }],
    ['/feedback-digest/status', {
      method: 'POST',
      headers: { 'x-feedback-digest-secret': SECRET },
    }],
    ['/feedback-digest/run', { method: 'POST', headers: { 'x-feedback-digest-secret': SECRET } }],
    ['/other', { method: 'POST', headers: { 'x-feedback-digest-secret': SECRET } }],
  ];
  for (const [path, init] of cases) {
    const res = await f.call(path, init);
    assertEquals(res.status, 404, path);
    await res.body?.cancel();
  }
  assertEquals(f.batches.length, 0);
});

Deno.test('configFrom: a blank secret is none; the mailer needs RESEND_API_KEY', () => {
  assertEquals(configFrom(new Map()).secret, null);
  assertEquals(configFrom(new Map([['FEEDBACK_DIGEST_SECRET', '']])).secret, null);
  assertEquals(configFrom(new Map([['FEEDBACK_DIGEST_SECRET', 's']])).secret, 's');
  assertEquals(configFrom(new Map()).mailer, null);
  assert(configFrom(new Map([['RESEND_API_KEY', 're_x']])).mailer);
});
