import { assertEquals, assertThrows } from 'jsr:@std/assert@^1';
import { describe, parseArgs, reconcileUrl } from './promotional.ts';

const HOME = 'eb021cef-9284-4e67-91a8-2c63780db5ae';

Deno.test('parseArgs: a household id, dry run unless --apply', () => {
  assertEquals(parseArgs(['status', '--household', HOME]), {
    action: 'status',
    household: HOME,
    apply: false,
  });
  assertEquals(parseArgs(['reconcile', '--household', HOME.toUpperCase(), '--apply']), {
    action: 'reconcile',
    household: HOME,
    apply: true,
  });
  assertThrows(() => parseArgs(['status', '--household', HOME, '--apply']));
  assertThrows(() => parseArgs(['reconcile', '--household', 'peter@example.com']));
  assertThrows(() => parseArgs(['reconcile']));
  assertThrows(() => parseArgs(['grant', '--household', HOME]));
});

Deno.test('describe says what RevenueCat grants, and until when', () => {
  assertEquals(describe({ active: false }), 'no promotional premium at RevenueCat');
  assertEquals(
    describe({ active: true, expiresAt: new Date('2100-01-01T00:00:00Z') }),
    'promotional premium at RevenueCat until 2100-01-01T00:00:00.000Z',
  );
  assertEquals(
    describe({ active: true, expiresAt: null }),
    'promotional premium at RevenueCat, without end',
  );
});

Deno.test('reconcileUrl: the hosted project by default, the local stack on request', () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  assertEquals(
    reconcileUrl(env({})),
    'https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/purchases/revenuecat/reconcile' +
      '?forceFunctionRegion=eu-central-1',
  );
  assertEquals(
    reconcileUrl(env({ PURCHASES_URL: 'http://127.0.0.1:54321/functions/v1/purchases/' })),
    'http://127.0.0.1:54321/functions/v1/purchases/revenuecat/reconcile',
  );
  assertThrows(() => reconcileUrl(env({ SUPABASE_PROJECT_REF: 'evil.example/x' })));
});
