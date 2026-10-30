// The test CA is honoured only inside the local stack; a hosted project trusts Amazon's roots only.
import { assertEquals } from '@std/assert';
import { localStackUrl, trustFrom } from './config.ts';
import { makeTestCa, testCertUrl } from './test_ca.ts';

const b64 = (text: string) => btoa(text);

Deno.test('the test CA counts in the local stack only', async () => {
  const ca = await makeTestCa();
  const vars = {
    ALEXA_SKILL_ID: 'amzn1.ask.skill.a, amzn1.ask.skill.b',
    ALEXA_TEST_ROOT_PEM: b64(ca.root.toString('pem')),
    ALEXA_TEST_CHAIN_PEM: b64(ca.chainPem),
  };
  const local = trustFrom({ get: (k) => ({ ...vars, SUPABASE_URL: localStackUrl })[k] });
  assertEquals(local.test, true);
  assertEquals(local.anchors.map((a) => a.subject), ['CN=Hummlist Test Root']);
  assertEquals(await local.fetchChain(new URL(testCertUrl)), ca.chainPem);
  assertEquals(local.skillIds, ['amzn1.ask.skill.a', 'amzn1.ask.skill.b']);

  const hosted = trustFrom({
    get: (k) => ({ ...vars, SUPABASE_URL: 'https://jdwqrallbpdbshrdhenk.supabase.co' })[k],
  });
  assertEquals(hosted.test, false);
  assertEquals(hosted.anchors.map((a) => a.subject.match(/CN=([^,]+)/)?.[1]), [
    'Amazon Root CA 1',
    'Amazon Root CA 2',
    'Amazon Root CA 3',
    'Amazon Root CA 4',
    'Starfield Services Root Certificate Authority - G2',
  ]);
});

Deno.test('no skill id configured: an empty list, which refuses every request', () => {
  assertEquals(trustFrom({ get: () => undefined }).skillIds, []);
});
