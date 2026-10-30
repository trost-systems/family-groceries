import { assertEquals } from '@std/assert';
import { appleNotification, appleTransaction } from './apple.ts';
import { makeAppleTestCa } from './apple_test_ca.ts';
import { configFrom } from './config.ts';
import { createHandler } from './handler.ts';
import { productionDeps } from './deps.ts';
import { telemetryFor } from '../_shared/telemetry.ts';

const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
const b64 = (text: string) => btoa(text);

async function testCaEnv(url: string) {
  const ca = await makeAppleTestCa();
  return {
    ca,
    config: configFrom(env({
      SUPABASE_URL: url,
      PURCHASES_ENVIRONMENTS: 'Sandbox',
      PURCHASES_TEST_ROOT_PEM: b64(ca.root.toString('pem')),
      PURCHASES_TEST_X5C: ca.x5c.join(','),
      PURCHASES_TEST_KEY: b64(ca.leafKeyPem),
    })),
  };
}

Deno.test('unset or unknown environments leave the function inert', () => {
  assertEquals(configFrom(env({})).environments, []);
  assertEquals(configFrom(env({ PURCHASES_ENVIRONMENTS: 'Xcode, sandbox' })).environments, []);
  assertEquals(
    configFrom(env({ PURCHASES_ENVIRONMENTS: 'Production, Sandbox,Production' })).environments,
    ['Production', 'Sandbox'],
  );
});

Deno.test('Production without Sandbox stays inert: App Review buys in the sandbox', () => {
  assertEquals(configFrom(env({ PURCHASES_ENVIRONMENTS: 'Production' })).environments, []);
  assertEquals(configFrom(env({ PURCHASES_ENVIRONMENTS: 'Production,Xcode' })).environments, []);
  assertEquals(configFrom(env({ PURCHASES_ENVIRONMENTS: 'Sandbox' })).environments, ['Sandbox']);
});

Deno.test('the In-App Purchase key needs all three parts', () => {
  assertEquals(configFrom(env({ APPLE_IAP_KEY_ID: 'K', APPLE_IAP_ISSUER_ID: 'I' })).appleKey, null);
  assertEquals(
    configFrom(
      env({ APPLE_IAP_KEY_ID: 'K', APPLE_IAP_ISSUER_ID: 'I', APPLE_IAP_PRIVATE_KEY: 'a\\nb' }),
    )
      .appleKey,
    { keyId: 'K', issuerId: 'I', privateKey: 'a\nb' },
  );
});

Deno.test('a hosted project ignores the test CA: Apple root only, no signer', async () => {
  const { config } = await testCaEnv('https://jdwqrallbpdbshrdhenk.supabase.co');
  assertEquals(config.testSigner, null);
  assertEquals(config.apple.anchors.map((a) => a.subject.includes('Apple Root CA - G3')), [true]);
  const handler = createHandler(productionDeps(config, telemetryFor('purchases', env({}))));
  const res = await handler(
    new Request('http://x/functions/v1/purchases/test/sign', {
      method: 'POST',
      body: JSON.stringify({ transactionId: '1' }),
    }),
  );
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test('the local stack signs with the test CA, and the same config verifies it', async () => {
  const { config } = await testCaEnv('http://kong:8000');
  const handler = createHandler(productionDeps(config, telemetryFor('purchases', env({}))));
  const sign = async (body: unknown) =>
    await (await handler(
      new Request('http://x/functions/v1/purchases/test/sign', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )).json();
  const { jws } = await sign({ transactionId: '2000000000099001' });
  const t = await appleTransaction(jws, config.apple);
  assertEquals([t.originalTransactionId, t.environment, t.revocationDate], [
    '2000000000099001',
    'Sandbox',
    undefined,
  ]);
  const { signedPayload } = await sign({ transactionId: '7', notificationType: 'REFUND' });
  const n = await appleNotification(signedPayload, config.apple);
  assertEquals([n.notificationType, typeof n.transaction?.revocationDate], ['REFUND', 'number']);
  assertEquals((await sign({})).error, 'bad_request');
});
