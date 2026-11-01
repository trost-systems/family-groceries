import { assert, assertEquals, assertFalse, assertThrows } from '@std/assert';
import {
  checkServerEvent,
  type Env,
  framesOf,
  RefusedEvent,
  scrubMessage,
  telemetryFor,
  withTelemetry,
} from './telemetry.ts';

const KEY = 'phc_testprojectkey0123456789';
const EU = 'https://eu.i.posthog.com';
const INSTALL = '0b6f7a52-6c1e-4f4e-9d55-3f1f0c2a9e01';

const env = (vars: Record<string, string>): Env => ({ get: (k) => vars[k] });

/** A fetch that records each request instead of sending it. */
function recorder() {
  const sent: { url: string; body: { api_key: string; batch: Record<string, unknown>[] } }[] = [];
  const fetchImpl = (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
  return { sent, fetchImpl: fetchImpl as typeof fetch };
}

Deno.test('no key, a personal key or another host: off, nothing sent', async () => {
  const cases: Record<string, string>[] = [
    {},
    { POSTHOG_PROJECT_API_KEY: KEY },
    { POSTHOG_PROJECT_API_KEY: 'phx_personalkey0123456789', POSTHOG_HOST: EU },
    { POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: 'https://us.i.posthog.com' },
    { POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: 'https://eu.i.posthog.com.evil.example' },
  ];
  for (const vars of cases) {
    const { sent, fetchImpl } = recorder();
    const t = telemetryFor('voice', env(vars), fetchImpl);
    t.exception(new Error('x'));
    await t.flush();
    assertFalse(t.enabled);
    assertEquals(sent, []);
  }
});

Deno.test('an unhandled exception is reported with the function name, before the 500', async () => {
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor(
    'voice',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU, ANALYTICS_INTERNAL: 'true' }),
    fetchImpl,
  );
  const handler = withTelemetry('voice', async (req) => {
    const body = await req.json();
    throw new TypeError(`cannot add "${body.text}" for peter@example.com`);
  }, t);
  const response = await handler(
    new Request('http://x/voice', {
      method: 'POST',
      headers: { authorization: 'Bearer fgp_secret-token' },
      body: JSON.stringify({ text: 'Milch und Hafermilch' }),
    }),
  );
  assertEquals(response.status, 500);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].url, `${EU}/batch/`);
  assertEquals(sent[0].body.api_key, KEY);
  const [event] = sent[0].body.batch;
  const properties = event.properties as Record<string, unknown>;
  assertEquals(event.event, '$exception');
  assertEquals(event.uuid, properties.event_id);
  assertEquals(properties.function_name, 'voice');
  assertEquals(properties.is_internal, true);
  assertEquals(properties.$geoip_disable, true);
  const [exception] = properties.$exception_list as Record<string, unknown>[];
  assertEquals(exception.type, 'TypeError');
  assertEquals(exception.value, 'cannot <w> <redacted> <w> <email>');
  assertEquals((exception.mechanism as Record<string, unknown>).handled, false);
  const frames = (exception.stacktrace as { frames: Record<string, unknown>[] }).frames;
  assert(frames.length > 0);
  assertEquals(frames.at(-1)!.filename, '_shared/telemetry_test.ts');
  const text = JSON.stringify(sent);
  for (const secret of ['Hafermilch', 'Milch', 'fgp_secret-token', 'peter@', 'authorization']) {
    assertFalse(text.includes(secret), secret);
  }
});

Deno.test('an error report carries no personal data from the request or the message', async () => {
  const user = '5d1c3a9e-2b7f-4c1d-8e6a-9f0b1c2d3e4f';
  const household = '7a2b4c6d-8e0f-4a1b-9c3d-5e7f9a1b3c5d';
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor(
    'voice',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }),
    fetchImpl,
  );
  const handler = withTelemetry('voice', async (req) => {
    const body = await req.json();
    throw new TypeError(
      `cannot parse ${body.text} for ${body.email} in ${body.household_id} by ${body.user_id}`,
    );
  }, t);
  const response = await handler(
    new Request('http://x/voice', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fgp_secret-token',
        'x-forwarded-for': '203.0.113.42',
        'x-install-id': INSTALL,
      },
      body: JSON.stringify({
        text: 'Hafermilch 2 Liter',
        email: 'peter@example.com',
        household_id: household,
        user_id: user,
        install_id: INSTALL,
      }),
    }),
  );
  assertEquals(response.status, 500);
  const [event] = sent[0].body.batch;
  const properties = event.properties as Record<string, unknown>;
  assertEquals(properties.distinct_id, 'edge-function-voice');
  const [exception] = properties.$exception_list as Record<string, unknown>[];
  assertEquals(exception.type, 'TypeError');
  assertEquals(exception.value, 'cannot <w> <n> <w> <email> in <uuid> <w> <uuid>');
  const text = JSON.stringify(sent);
  for (
    const secret of [
      user,
      household,
      INSTALL,
      'peter@example.com',
      'Hafermilch',
      'Liter',
      'fgp_secret-token',
      '203.0.113.42',
    ]
  ) {
    assertFalse(text.includes(secret), secret);
  }
});

Deno.test('a handler that answers is not slowed by an empty queue', async () => {
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor(
    'health',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }),
    fetchImpl,
  );
  const response = await withTelemetry('health', () => new Response('ok'), t)(
    new Request('http://x/health'),
  );
  assertEquals(await response.text(), 'ok');
  assertEquals(sent, []);
});

Deno.test('a PostHog outage never breaks the response', async () => {
  const t = telemetryFor(
    'mcp',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }),
    (() => Promise.reject(new Error('down'))) as typeof fetch,
  );
  const response = await withTelemetry('mcp', () => {
    throw new Error('boom');
  }, t)(new Request('http://x/mcp'));
  assertEquals(response.status, 500);
});

Deno.test('scrubMessage keeps codes and the shape of runtime errors, nothing else', () => {
  assertEquals(
    scrubMessage(Object.assign(new Error('duplicate (name)=(Milch)'), { code: '23505' })),
    '23505',
  );
  assertEquals(scrubMessage(Object.assign(new Error('bad'), { status: 401 })), '401');
  assertEquals(scrubMessage(new Error('Milch fehlt')), '<redacted>');
  assertEquals(scrubMessage('Milch'), '<redacted>');
  assertEquals(
    scrubMessage(new RangeError('id 0f8fad5b-d9cb-469f-a165-70867728950e at https://a.b/c?x=1')),
    '<w> <uuid> at <url>',
  );
  assertEquals(
    scrubMessage(new TypeError("Cannot read properties of undefined (reading 'name')")),
    'Cannot read properties of undefined (reading <redacted>)',
  );
  assertEquals(
    scrubMessage(new TypeError('body.items.map is not a function')),
    '<w> is not a function',
  );
  assertEquals(
    scrubMessage(new SyntaxError('Unexpected token H in JSON at position 12\nHafermilch')),
    'Unexpected token <w> in JSON at position <n>',
  );
  assertEquals(
    scrubMessage(new ReferenceError('Peter Trost Hafermilch is not defined')),
    '<w> is not defined',
  );
  assertEquals(
    scrubMessage(new TypeError('cannot add <milch> to <email>')),
    'cannot <w> to <email>',
  );
  assertEquals(scrubMessage(new RangeError('x'.repeat(500))).length, 3);
  assert(scrubMessage(new TypeError('cannot set '.repeat(40))).length <= 120);
});

Deno.test('frames: functions-relative paths, crash site last', () => {
  const frames = framesOf(
    'TypeError: x\n' +
      '    at addItems (file:///home/deno/functions/voice/items.ts:10:5)\n' +
      '    at async handler (file:///var/tmp/sb-compile/functions/voice/handler.ts:20:7)\n' +
      '    at ext:core/01_core.js:3:1',
  );
  assertEquals(frames.map((f) => f.filename), ['01_core.js', 'voice/handler.ts', 'voice/items.ts']);
  assertEquals(frames.at(-1)!.in_app, true);
  assertEquals(frames[0].in_app, false);
});

Deno.test('server events pass the catalog only', async () => {
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor('iap', env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }), fetchImpl);
  const subject = { installId: INSTALL, householdId: null };
  assert(t.event('purchase_restored', subject, { product_id: 'lifetime', app_store: 'apple' }));
  assertFalse(
    t.event('purchase_restored', subject, { product_id: 'Lifetime für Peter', app_store: 'apple' }),
  );
  assertFalse(t.event('item_ticked', subject, {}));
  assertFalse(t.event('purchase_completed', subject, { email: 'peter@example.com' }));
  await t.flush();
  assertEquals(sent[0].body.batch.length, 1);
  const p = sent[0].body.batch[0].properties as Record<string, unknown>;
  assertEquals(p.distinct_id, INSTALL);
  assertEquals(p.$geoip_disable, true);
  assertFalse('$ip' in p);
});

Deno.test('premium_source (job 49): yearly or lifetime on purchase events only', () => {
  for (const name of ['purchase_completed', 'purchase_refunded']) {
    for (const source of ['yearly', 'lifetime']) {
      checkServerEvent(name, { product_id: 'com.hummlist.app.yearly', premium_source: source });
    }
    for (const bad of ['tester_grant', 'Yearly', 'premium', 1]) {
      assertThrows(() => checkServerEvent(name, { premium_source: bad }), RefusedEvent);
    }
  }
  assertThrows(
    () => checkServerEvent('purchase_restored', { premium_source: 'yearly' }),
    RefusedEvent,
  );
});

Deno.test('checkServerEvent names the property, never the value', () => {
  const e = assertThrows(
    () => checkServerEvent('purchase_completed', { country: 'Deutschland' }),
    RefusedEvent,
  );
  assertFalse(e.message.includes('Deutschland'));
});

Deno.test('item_added (job 31): source alexa, role and household size only', async () => {
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor(
    'alexa',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }),
    fetchImpl,
  );
  const household = '7d1e4f0a-2b3c-4d5e-8f90-a1b2c3d4e5f6';
  const subject = { installId: INSTALL, householdId: household, internal: true };
  const ok = { source: 'alexa', actor_role: 'member', household_size: 2 };
  assert(t.event('item_added', subject, ok));
  assertFalse(t.event('item_added', subject, { ...ok, source: 'typed' }));
  assertFalse(t.event('item_added', subject, { ...ok, household_size: 1.5 }));
  assertFalse(t.event('item_added', subject, { ...ok, household_size: 0 }));
  assertFalse(t.event('item_added', subject, { ...ok, name: 'Milch' }));
  assertFalse(t.event('item_added', subject, { ...ok, actor_role: 'Peter' }));
  await t.flush();
  assertEquals(sent[0].body.batch.length, 1);
  const p = sent[0].body.batch[0].properties as Record<string, unknown>;
  assertEquals(p.source, 'alexa');
  assertEquals(p.household_id, household);
  assertEquals(p.is_internal, true, 'an internal install says so');
});

Deno.test('siri_add and siri_read (job 51): result, reason, language, source and count only', async () => {
  const { sent, fetchImpl } = recorder();
  const t = telemetryFor(
    'voice',
    env({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: EU }),
    fetchImpl,
  );
  const household = '7d1e4f0a-2b3c-4d5e-8f90-a1b2c3d4e5f6';
  const subject = { installId: INSTALL, householdId: household };
  const add = { result: 'success', reason: 'added', language: 'en', source: 'native', count: 3 };
  assert(t.event('siri_add', subject, add));
  assert(
    t.event('siri_add', subject, { ...add, result: 'fail', reason: 'premium_required', count: 0 }),
  );
  assertFalse(t.event('siri_add', subject, { ...add, count: 31 }));
  assertFalse(t.event('siri_add', subject, { ...add, count: 2.5 }));
  assertFalse(t.event('siri_add', subject, { ...add, reason: 'read' }));
  assertFalse(t.event('siri_add', subject, { ...add, language: 'fr' }));
  assertFalse(t.event('siri_add', subject, { ...add, source: 'alexa' }));
  assertFalse(t.event('siri_add', subject, { ...add, text: 'milk, eggs and bread' }));
  assertFalse(t.event('siri_add', subject, { ...add, items: ['milk'] }));
  const read = { result: 'success', reason: 'read', language: 'de', source: 'shortcut', count: 42 };
  assert(t.event('siri_read', subject, read));
  assertFalse(t.event('siri_read', subject, { ...read, reason: 'added' }));
  assertFalse(t.event('siri_read', subject, { ...read, names: 'Milch' }));
  await t.flush();
  const batch = sent[0].body.batch;
  assertEquals(batch.map((e) => e.event), ['siri_add', 'siri_add', 'siri_read']);
  assertEquals((batch[0].properties as Record<string, unknown>).household_id, household);
});
