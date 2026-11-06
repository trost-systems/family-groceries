// node --test agent-forms.test.mjs (after `npm run build` in site/): the waitlist form check on
// the built site, and on fixture pages broken one way per check, so each check is proven to fail.
import process from 'node:process';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { checkSignupForm, readConsent } from './agent-forms.mjs';
import { serve } from './lib.mjs';

const SITE = resolve(import.meta.dirname, '..');
const CONSENT = 'Mit „Auf die Warteliste“ willigst du ein. Mehr in der [Datenschutzerklärung](/datenschutz) & ab 16.';

const PAGE = ({ consent, done = 'Fast geschafft: bestätige deine Adresse mit dem Link in der Mail.', status = 202, extra = '', email = '<label for="e">E-Mail</label><input id="e" type="email" name="email">' }) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Warteliste</title></head><body><main>
<h1>Warteliste</h1>
<section data-waitlist="signup" data-state="idle">
<form data-when="idle">
${email}
<fieldset><legend>Handy</legend><label><input type="radio" name="platform" value="ios">iPhone</label><label><input type="radio" name="platform" value="android">Android</label></fieldset>
<div aria-hidden="true"><input name="website" tabindex="-1"></div>
${extra}
<button type="submit">Auf die Warteliste</button>
<p data-legal="waitlist-de-v2">${consent}</p>
</form>
<div data-when="done" hidden><p>${done}</p></div>
</section></main>
<script>
const root = document.querySelector('[data-waitlist]');
root.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await fetch('/api/waitlist?status=${status}', { method: 'POST', body: '{}' });
  root.dataset.state = 'done';
  for (const el of root.querySelectorAll('[data-when]')) el.hidden = el.dataset.when !== 'done';
});
</script></body></html>`;

const GOOD_CONSENT = 'Mit „Auf die Warteliste“ willigst du ein. Mehr in der Datenschutzerklärung &amp; ab 16.';

describe('waitlist form check on fixtures', () => {
  let browser;
  let server;
  let origin;
  let consent;
  const pages = new Map();
  before(async () => {
    const content = mkdtempSync(join(tmpdir(), 'agent-forms-'));
    mkdirSync(join(content, 'legal/consent'), { recursive: true });
    writeFileSync(join(content, 'legal/consent/waitlist-de-v1.md'), 'Alte Fassung.\n');
    writeFileSync(join(content, 'legal/consent/waitlist-de-v2.md'), `${CONSENT}\n`);
    consent = readConsent(content);
    server = createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'POST') return res.writeHead(Number(url.searchParams.get('status'))).end('{"status":"ok"}');
      const html = pages.get(url.pathname);
      res.writeHead(html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }).end(html ?? '');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
    server?.close();
  });

  const run = (name, options) => {
    pages.set(`/${name}`, PAGE({ consent: GOOD_CONSENT, ...options }));
    return checkSignupForm(browser, { origin, path: `/${name}`, locale: 'de', consent });
  };
  const failsWith = async (name, options, check) => {
    const problems = await run(name, options);
    assert.ok(problems.length > 0 && problems.every((p) => p.check === check), JSON.stringify(problems, null, 1));
  };

  test('reads the newest consent version as the text a reader sees', () => {
    assert.deepEqual(consent.de, { version: 'waitlist-de-v2', text: 'Mit „Auf die Warteliste“ willigst du ein. Mehr in der Datenschutzerklärung & ab 16.' });
  });
  test('the good fixture passes', async () => assert.deepEqual(await run('good', {}), []));
  test('an unlabelled field fails', () => failsWith('labels', { email: '<input type="email" name="email" placeholder="E-Mail">' }, 'labels'));
  test('a CAPTCHA fails', () => failsWith('captcha', { extra: '<div class="h-captcha" data-sitekey="x"></div>' }, 'captcha'));
  test('a serious axe finding fails', () => failsWith('axe', { extra: '<button type="button"></button>' }, 'axe'));
  test('one changed character in the consent text fails', () =>
    failsWith('consent-byte', { consent: GOOD_CONSENT.replace('16.', '16!') }, 'consent'));
  test('straight quotes instead of Legal\'s typographic ones fail', () =>
    failsWith('consent-quotes', { consent: GOOD_CONSENT.replace('„Auf die Warteliste“', '"Auf die Warteliste"') }, 'consent'));
  test('an older consent version fails', async () => {
    pages.set('/old', PAGE({ consent: GOOD_CONSENT }).replace('waitlist-de-v2', 'waitlist-de-v1'));
    const problems = await checkSignupForm(browser, { origin, path: '/old', locale: 'de', consent });
    assert.deepEqual(problems.map((p) => p.check), ['consent']);
  });
  test('a sign-up answered as done (200) fails', () => failsWith('status', { status: 200 }, 'pending'));
  test('a thank-you without the confirmation step fails', () => failsWith('done', { done: 'Danke, du bist dabei!' }, 'pending'));
});

// On until the waitlist (job 82) is on main: the form and Legal's consent texts come with it.
const consent = readConsent(join(SITE, 'content'));
describe('waitlist form on the built site', { skip: consent ? false : 'waits for job 82: no Legal consent text in site/content/legal/consent/ yet, so no waitlist form' }, () => {
  let browser;
  let upstream;
  let site;
  before(async () => {
    upstream = createServer((req, res) => res.writeHead(req.url === '/signup' ? 202 : 404, { 'content-type': 'application/json' }).end('{"status":"ok"}'));
    await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
    process.env.WAITLIST_UPSTREAM_URL = `http://127.0.0.1:${upstream.address().port}`;
    process.env.WAITLIST_PROXY_SECRET = 'agent-forms-check';
    site = await serve(join(SITE, 'dist'), Number(process.env.PORT ?? 57641));
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
    await site?.close();
    upstream?.close();
  });
  for (const locale of ['de', 'en']) {
    test(`/${locale}`, async () => {
      const problems = await checkSignupForm(browser, { origin: site.origin, path: `/${locale}`, locale, consent });
      assert.deepEqual(problems, []);
    });
  }
});
