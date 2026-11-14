import { assertEquals, assertExists } from '@std/assert';
import { resendMailer } from './resend.ts';

Deno.test('Resend: a mail without reply-to or headers sends neither field', async () => {
  const requests: Request[] = [];
  const mailer = resendMailer('re_test_key', 'https://resend.test', (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(new Response('{"id":"x"}', { status: 200 }));
  });
  await mailer.send('hello@snacklist.app', {
    from: '"Peter · Snacklist" <hello@snacklist.app>',
    subject: 's',
    html: '<p>h</p>',
    text: 't',
  }, 'key/1');
  const [req] = requests;
  assertExists(req, 'the request');
  assertEquals(req.headers.get('idempotency-key'), 'key/1');
  assertEquals(await req.json(), {
    from: '"Peter · Snacklist" <hello@snacklist.app>',
    to: ['hello@snacklist.app'],
    subject: 's',
    html: '<p>h</p>',
    text: 't',
  });
});
