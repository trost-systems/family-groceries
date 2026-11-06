// The waitlist form as an agent filling it in for its human meets it (job 93, docs/AGENT_FIRST.md):
// every field has a label, no CAPTCHA, axe finds nothing serious or critical, the consent text is
// Legal's newest versioned text byte for byte, and a sign-up ends pending the mailed confirmation.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { AXE_PATH } from './lib.mjs';

export const CAPTCHA = /recaptcha|hcaptcha|turnstile|challenges\.cloudflare\.com|friendlycaptcha|captcha/i;

// What the page must say once the address is sent: the sign-up waits for the link in the mail.
export const PENDING = { de: /bestätig/i, en: /confirm/i };

const md = new MarkdownIt({ html: false });
const decode = (s) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);

// Legal's newest consent text per locale, content/legal/consent/waitlist-<locale>-v<n>.md, as the
// text a reader sees (links become their text). null until the waitlist is on main (job 82).
export function readConsent(contentDir) {
  const dir = join(contentDir, 'legal/consent');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const newest = (locale) => {
    const pattern = new RegExp(`^waitlist-${locale}-v(\\d+)\\.md$`);
    const [file] = files.filter((f) => pattern.test(f)).sort((a, b) => Number(pattern.exec(b)[1]) - Number(pattern.exec(a)[1]));
    if (!file) return null;
    const markdown = readFileSync(join(dir, file), 'utf8').trim();
    return { version: file.slice(0, -3), text: decode(md.renderInline(markdown).replace(/<[^>]+>/g, '')) };
  };
  const found = Object.fromEntries(Object.keys(PENDING).map((locale) => [locale, newest(locale)]));
  return Object.values(found).some(Boolean) ? found : null;
}

const axeSerious = (page) =>
  page.evaluate(async () => {
    const res = await globalThis.axe.run(document, { resultTypes: ['violations'] });
    return res.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact))
      .flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}) at ${n.target.join(' ')}: ${v.help}`));
  });

// Problems with the sign-up form on `path`, as { check, page, message }.
export async function checkSignupForm(browser, { origin, path, locale, consent, email = 'agent-check@example.com' }) {
  const problems = [];
  const problem = (check, message) => problems.push({ check, page: path, message });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript({ path: AXE_PATH });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  try {
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    const form = page.locator('form:has(input[type="email"])');
    if ((await form.count()) !== 1) {
      problem('form', `want one form with an email field, found ${await form.count()}`);
      return problems;
    }

    const unlabelled = await form.evaluate((f) =>
      [...f.querySelectorAll('input, select, textarea')]
        .filter((el) => !['hidden', 'submit', 'button'].includes(el.type) && !el.closest('[aria-hidden="true"]'))
        .filter((el) => {
          const byLabel = [...(el.labels ?? [])].some((l) => l.textContent.trim() !== '');
          const byRef = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim());
          return !byLabel && !byRef && !el.getAttribute('aria-label')?.trim();
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    for (const el of unlabelled) problem('labels', `field without a label: ${el}`);

    const markup = await page.evaluate(() =>
      [...document.querySelectorAll('script[src], iframe, [class], [id], [name]')].map((el) =>
        [el.getAttribute('src'), el.getAttribute('class'), el.id, el.getAttribute('name')].filter(Boolean).join(' '),
      ),
    );
    for (const hit of new Set([...markup, ...requests].filter((s) => CAPTCHA.test(s)))) problem('captcha', `CAPTCHA on the page: ${hit}`);

    for (const v of await axeSerious(page)) problem('axe', v);

    const shown = await form.locator('[data-legal]').evaluateAll((els) => els.map((el) => ({ version: el.dataset.legal, text: el.textContent })));
    const want = consent?.[locale];
    if (!want) problem('consent', `no versioned consent text for ${locale} in content/legal/consent/`);
    else if (shown.length !== 1) problem('consent', `want one [data-legal] consent text in the form, found ${shown.length}`);
    else if (shown[0].version !== want.version) problem('consent', `form shows consent ${shown[0].version}, Legal's newest is ${want.version}`);
    else if (shown[0].text !== want.text) {
      const at = [...want.text].findIndex((c, i) => shown[0].text[i] !== c);
      problem('consent', `consent text differs from ${want.version}.md at character ${at === -1 ? want.text.length : at}: "${shown[0].text.slice(Math.max(0, at - 20), at + 20)}"`);
    }

    await form.locator('input[type="email"]').fill(email);
    const radio = form.locator('input[type="radio"]');
    if ((await radio.count()) > 0) await radio.first().check();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST', { timeout: 10_000 }).catch(() => null),
      form.locator('[type="submit"]').click(),
    ]);
    if (!response) problem('pending', 'submitting the form sent no POST');
    else if (response.status() !== 202) problem('pending', `sign-up answered ${response.status()}, want 202 Accepted (waits for the confirmation)`);
    await page.waitForFunction(() => document.querySelector('[data-waitlist="signup"]')?.dataset.state === 'done', null, { timeout: 5_000 }).catch(() => {});
    const done = await page.evaluate(() => {
      const root = document.querySelector('[data-waitlist="signup"]');
      return { state: root?.dataset.state, text: [...(root?.querySelectorAll('[data-when~="done"]') ?? [])].filter((el) => !el.hidden).map((el) => el.textContent).join(' ') };
    });
    if (done.state !== 'done') problem('pending', `after the sign-up the form is in state "${done.state}", want "done"`);
    else if (!PENDING[locale].test(done.text)) problem('pending', `the thank-you text does not ask to confirm the address (${PENDING[locale]}): "${done.text.trim().slice(0, 160)}"`);
    return problems;
  } finally {
    await ctx.close();
  }
}
