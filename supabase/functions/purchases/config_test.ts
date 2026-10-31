import { assertEquals } from '@std/assert';
import { telemetryFor } from '../_shared/telemetry.ts';
import { configFrom } from './config.ts';
import { productionDeps } from './deps.ts';
import { createHandler } from './handler.ts';

const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
const secrets = {
  REVENUECAT_WEBHOOK_AUTH: ' Bearer rc-secret ',
  REVENUECAT_TOMBSTONE_HMAC_KEY: 'tombstone-key',
};

Deno.test('the webhook is configured only with its Authorization value and the tombstone key', () => {
  assertEquals(configFrom(env({})).webhook, null);
  assertEquals(configFrom(env({ REVENUECAT_WEBHOOK_AUTH: 'Bearer x' })).webhook, null);
  assertEquals(configFrom(env({ REVENUECAT_TOMBSTONE_HMAC_KEY: 'k' })).webhook, null);
  assertEquals(configFrom(env({ ...secrets, REVENUECAT_WEBHOOK_AUTH: '  ' })).webhook, null);
  assertEquals(configFrom(env(secrets)).webhook, {
    authorization: 'Bearer rc-secret',
    signingSecret: null,
    tombstoneKey: 'tombstone-key',
  });
  assertEquals(
    configFrom(env({ ...secrets, REVENUECAT_WEBHOOK_HMAC_SECRET: 'sign' })).webhook?.signingSecret,
    'sign',
  );
});

Deno.test('only the local stack serves test events', async () => {
  const call = async (url: string) => {
    const config = configFrom(env({ ...secrets, SUPABASE_URL: url }));
    const handler = createHandler(productionDeps(config, telemetryFor('purchases', env({}))));
    const res = await handler(
      new Request('http://x/functions/v1/purchases/test/event', { method: 'POST', body: '{}' }),
    );
    await res.body?.cancel();
    return [config.local, res.status];
  };
  assertEquals(await call('https://jdwqrallbpdbshrdhenk.supabase.co'), [false, 404]);
  assertEquals(await call('http://kong:8000'), [true, 400]);
});

Deno.test('the region comes from SB_REGION', () => {
  assertEquals(configFrom(env({ SB_REGION: 'eu-central-1' })).region, 'eu-central-1');
  assertEquals(configFrom(env({})).region, null);
});

Deno.test('customer deletion needs both the v2 secret key and the project id', () => {
  assertEquals(configFrom(env({ REVENUECAT_SECRET_KEY: 'sk_x' })).revenueCat, null);
  assertEquals(configFrom(env({ REVENUECAT_PROJECT_ID: '9cb4a72e' })).revenueCat, null);
  assertEquals(
    configFrom(env({ REVENUECAT_SECRET_KEY: 'sk_x', REVENUECAT_PROJECT_ID: '9cb4a72e' }))
      .revenueCat,
    { secretKey: 'sk_x', projectId: '9cb4a72e' },
  );
});
