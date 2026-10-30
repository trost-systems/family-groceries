import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert';
import { decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import {
  appleAnchors,
  AppleConfigError,
  appleNotification,
  applePurchase,
  appleTransaction,
  AppStoreServerApi,
} from './apple.ts';
import { makeAppleTestCa, sampleTransaction } from './apple_test_ca.ts';
import { appId, Refused, StoreUnavailable } from './types.ts';

const refusedWith = async (p: Promise<unknown>, reason: string) => {
  const e = await assertRejects(() => p, Refused);
  assertEquals(e.reason, reason);
};

Deno.test('the pinned Apple root is Apple Root CA - G3, valid until 2039', () => {
  const [root] = appleAnchors();
  assertEquals(
    root.subject,
    'CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US',
  );
  assertEquals(root.notAfter.toISOString().slice(0, 10), '2039-04-30');
});

Deno.test('a transaction signed through the chain verifies and maps to a purchase', async () => {
  const ca = await makeAppleTestCa();
  const t = await appleTransaction(await ca.sign(sampleTransaction()), ca.trust());
  const p = applePurchase(t);
  assertEquals(p.store, 'apple');
  assertEquals(p.transactionId, '2000000812345678');
  assertEquals(p.environment, 'Sandbox');
  assertEquals(p.price, 9.99);
  assertEquals(p.currency, 'EUR');
  assertEquals(p.country, 'DE');
  assertEquals(p.revokedAt, null);
  assertEquals(p.pending, false);
});

Deno.test('a modified payload fails the signature', async () => {
  const ca = await makeAppleTestCa();
  const [h, , s] = (await ca.sign(sampleTransaction())).split('.');
  const forged = btoa(
    JSON.stringify(sampleTransaction({ productId: 'com.hummlist.app.lifetime', price: 1 })),
  )
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  await refusedWith(appleTransaction(`${h}.${forged}.${s}`, ca.trust()), 'bad_signature');
});

Deno.test('a JWS signed by another key under our chain fails the signature', async () => {
  const ours = await makeAppleTestCa();
  const theirs = await makeAppleTestCa();
  const jws = await theirs.sign(sampleTransaction(), ours.x5c);
  await refusedWith(appleTransaction(jws, ours.trust()), 'bad_signature');
});

Deno.test('a chain that does not end in a pinned root is refused', async () => {
  const ca = await makeAppleTestCa();
  const jws = await ca.sign(sampleTransaction());
  await refusedWith(
    appleTransaction(jws, { anchors: appleAnchors(), bundleId: appId, now: () => new Date() }),
    'untrusted_chain',
  );
});

Deno.test("a chain without Apple's marker OIDs is refused", async () => {
  for (const options of [{ leafOid: false }, { intermediateOid: false }]) {
    const ca = await makeAppleTestCa(options);
    await refusedWith(
      appleTransaction(await ca.sign(sampleTransaction()), ca.trust()),
      'untrusted_chain',
    );
  }
});

Deno.test('a chain that is not three certificates is refused', async () => {
  const ca = await makeAppleTestCa();
  const jws = await ca.sign(sampleTransaction(), ca.x5c.slice(0, 2));
  await refusedWith(appleTransaction(jws, ca.trust()), 'untrusted_chain');
});

Deno.test('a leaf not valid at signedDate is refused', async () => {
  const ca = await makeAppleTestCa({ leafNotAfter: new Date(Date.now() - 86_400_000) });
  await refusedWith(
    appleTransaction(await ca.sign(sampleTransaction()), ca.trust()),
    'untrusted_chain',
  );
});

Deno.test('an old transaction stays valid after its leaf expired, judged at signedDate', async () => {
  const signed = Date.now() - 10 * 86_400_000;
  const ca = await makeAppleTestCa({
    leafNotBefore: new Date(signed - 86_400_000),
    leafNotAfter: new Date(signed + 86_400_000),
  });
  const t = await appleTransaction(
    await ca.sign(sampleTransaction({ signedDate: signed })),
    ca.trust(),
  );
  assertEquals(t.signedDate, signed);
});

Deno.test('a signedDate from the future is refused', async () => {
  const ca = await makeAppleTestCa();
  const jws = await ca.sign(sampleTransaction({ signedDate: Date.now() + 3_600_000 }));
  await refusedWith(appleTransaction(jws, ca.trust()), 'malformed');
});

Deno.test('garbage, unsigned and HS256 tokens are refused', async () => {
  const ca = await makeAppleTestCa();
  await refusedWith(appleTransaction('not.a.jws', ca.trust()), 'malformed');
  const body = btoa(JSON.stringify(sampleTransaction())).replace(/=+$/, '');
  const none = `${btoa(JSON.stringify({ alg: 'none', x5c: ca.x5c })).replace(/=+$/, '')}.${body}.`;
  await refusedWith(appleTransaction(none, ca.trust()), 'bad_signature');
});

Deno.test("another app's transaction is refused", async () => {
  const ca = await makeAppleTestCa();
  const jws = await ca.sign(sampleTransaction({ bundleId: 'com.example.other' }));
  await refusedWith(appleTransaction(jws, ca.trust()), 'wrong_app');
});

Deno.test('another product and Xcode transactions are not a purchase of Lifetime', async () => {
  const ca = await makeAppleTestCa();
  const other = await appleTransaction(
    await ca.sign(sampleTransaction({ productId: 'com.hummlist.app.other' })),
    ca.trust(),
  );
  assertEquals(assertThrows(() => applePurchase(other), Refused).reason, 'wrong_product');
  const xcode = await appleTransaction(
    await ca.sign(sampleTransaction({ environment: 'Xcode' })),
    ca.trust(),
  );
  assertEquals(assertThrows(() => applePurchase(xcode), Refused).reason, 'wrong_environment');
});

Deno.test('a refunded transaction carries its revocation date', async () => {
  const ca = await makeAppleTestCa();
  const at = Date.now() - 5_000;
  const t = await appleTransaction(
    await ca.sign(sampleTransaction({ revocationDate: at, revocationReason: 0 })),
    ca.trust(),
  );
  assertEquals(applePurchase(t).revokedAt?.getTime(), at);
});

Deno.test('a REFUND notification verifies, with its transaction', async () => {
  const ca = await makeAppleTestCa();
  const transaction = await ca.sign(sampleTransaction({ revocationDate: Date.now() - 1000 }));
  const signedPayload = await ca.sign({
    notificationType: 'REFUND',
    notificationUUID: 'b3a1f8a0-0000-4000-8000-000000000001',
    signedDate: Date.now() - 500,
    version: '2.0',
    data: { bundleId: appId, environment: 'Sandbox', signedTransactionInfo: transaction },
  });
  const n = await appleNotification(signedPayload, ca.trust());
  assertEquals(n.notificationType, 'REFUND');
  assertEquals(n.transaction?.originalTransactionId, '2000000812345678');
  assert(n.transaction?.revocationDate);
});

Deno.test('a notification for another app or with a forged transaction is refused', async () => {
  const ca = await makeAppleTestCa();
  const other = await ca.sign({
    notificationType: 'REFUND',
    notificationUUID: 'u1',
    signedDate: Date.now(),
    data: { bundleId: 'com.example.other' },
  });
  await refusedWith(appleNotification(other, ca.trust()), 'wrong_app');
  const stranger = await makeAppleTestCa();
  const inner = await stranger.sign(sampleTransaction());
  const wrapped = await ca.sign({
    notificationType: 'REFUND',
    notificationUUID: 'u2',
    signedDate: Date.now(),
    data: { bundleId: appId, signedTransactionInfo: inner },
  });
  await refusedWith(appleNotification(wrapped, ca.trust()), 'untrusted_chain');
});

async function serverApi(
  answer: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  const ca = await makeAppleTestCa();
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const calls: { url: string; auth: string }[] = [];
  const api = new AppStoreServerApi(
    {
      keyId: 'TESTKEY123',
      issuerId: '57246542-96fe-1a63-e053-0824d011072a',
      privateKey: await exportPKCS8(privateKey),
    },
    {
      trust: ca.trust(),
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, auth: new Headers(init?.headers).get('authorization') ?? '' });
        return await answer(url, init);
      }) as typeof fetch,
    },
  );
  return { ca, api, calls, publicKey };
}

Deno.test('the server API is asked with an ES256 key JWT on the environment host', async () => {
  const { ca, api, calls, publicKey } = await serverApi(async () =>
    Response.json({
      signedTransactionInfo: await ca.sign(sampleTransaction({ revocationDate: 1 })),
    })
  );
  const t = await api.transaction('2000000812345678', 'Sandbox');
  assertEquals(t.revocationDate, 1);
  assertEquals(
    calls[0].url,
    'https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/2000000812345678',
  );
  const token = calls[0].auth.replace('Bearer ', '');
  assertEquals(decodeProtectedHeader(token).kid, 'TESTKEY123');
  const { payload } = await jwtVerify(token, publicKey, { audience: 'appstoreconnect-v1' });
  assertEquals(payload.bid, appId);
  assertEquals(payload.iss, '57246542-96fe-1a63-e053-0824d011072a');
  await api.transaction('1', 'Production');
  assert(calls[1].url.startsWith('https://api.storekit.itunes.apple.com/'));
});

Deno.test('server API failures: unknown, bad key, down, unreachable', async () => {
  const cases: [Response | Error, unknown][] = [
    [new Response('{"errorCode":4040010}', { status: 404 }), Refused],
    [new Response('', { status: 401 }), AppleConfigError],
    [new Response('', { status: 503 }), StoreUnavailable],
    [new Response('', { status: 429 }), StoreUnavailable],
    [new TypeError('network'), StoreUnavailable],
  ];
  for (const [answer, error] of cases) {
    const { api } = await serverApi(() => {
      if (answer instanceof Error) throw answer;
      return answer;
    });
    // deno-lint-ignore no-explicit-any
    await assertRejects(() => api.transaction('1', 'Sandbox'), error as any);
  }
});

Deno.test('a server API answer signed outside the chain is refused', async () => {
  const stranger = await makeAppleTestCa();
  const { api } = await serverApi(async () =>
    Response.json({ signedTransactionInfo: await stranger.sign(sampleTransaction()) })
  );
  await refusedWith(api.transaction('1', 'Sandbox'), 'untrusted_chain');
});

Deno.test('an In-App Purchase key that is not P-256 PKCS #8 is a configuration error', async () => {
  const ca = await makeAppleTestCa();
  const api = new AppStoreServerApi({ keyId: 'K', issuerId: 'I', privateKey: 'nope' }, {
    trust: ca.trust(),
    fetch: (() => Promise.resolve(new Response('{}'))) as typeof fetch,
  });
  await assertRejects(() => api.transaction('1', 'Sandbox'), AppleConfigError);
});
