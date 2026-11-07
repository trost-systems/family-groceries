// Films and checks /internal/sync-indicator-v2 under the production CSP:
// node docs/done/157-shots.mjs [outDir]
// Prints one JSON report: tap targets, contrast, semantics, behaviour, console errors. Exits 1 on any failure.
import { createRequire } from 'node:module';
import process from 'node:process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve, repo } from './157-serve.mjs';

const require = createRequire(join(process.env.HOME, 'family-groceries/e2e/package.json'));
const { chromium, devices } = require('playwright');
const out = process.argv[2] || join(repo, 'docs/screenshots/157');
mkdirSync(out, { recursive: true });
const { server, url } = await serve();
const b = await chromium.launch();
const errs = [];
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

async function open(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('.bar').style.setProperty('position', 'static'));
  return p;
}
const click = (p, control, value) => p.click(`[data-control=${control}] [data-value=${value}]`);
const phase = (p, id) => p.$eval(`.phone[data-variant="${id}"]`, (ph) => ph.dataset.phase);
const tapPhone = (p, id) => p.$eval(`.phone[data-variant="${id}"]`, (ph) => {
  const el = [...ph.querySelectorAll('[data-tap]')].find((e) => e.getAttribute('aria-hidden') === 'false');
  el.click();
});

// Every visible tap target: its hit box in phone points, its label and role.
const audit = (p) => p.$$eval('.phone', (phones) => phones.flatMap((ph) => {
  if (ph.dataset.phase === 'hidden') return [];
  const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s'));
  const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => {
    for (let n = el; n && n !== ph.parentElement; n = n.parentElement) {
      const hex = n.querySelector(':scope > svg.hexbg path');
      if (hex) { const f = rgb(getComputedStyle(hex).fill); if (f.length >= 3 && f[3] !== 0) return f; }
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c.length === 3 || c[3] > 0) return c;
      // A capsule paints its fill on the morphing sibling layer (in reduced motion on the layer itself).
      const capBg = n.classList.contains('cap') && n.querySelector('.cap__bg');
      if (capBg && getComputedStyle(capBg).display !== 'none') {
        const hp = capBg.querySelector('svg.hexbg path');
        return rgb(hp ? getComputedStyle(hp).fill : getComputedStyle(capBg).backgroundColor);
      }
    }
    return [255, 255, 255];
  };
  const rows = [];
  for (const el of ph.querySelectorAll('[data-tap]')) {
    if (el.getAttribute('aria-hidden') !== 'false') continue;
    const layer = el.classList.contains('cap')
      ? el.querySelector(ph.dataset.phase === 'open' || ph.dataset.from === 'open' && ph.dataset.phase === 'busy' ? '.cap__full' : '.cap__compact')
      : el;
    const hb = layer.querySelector(':scope > .hitbox, :scope .banner__row > .hitbox') || layer;
    const r = hb.getBoundingClientRect();
    const texts = [...layer.querySelectorAll('span, strong')].filter((t) => t.childElementCount === 0 && t.textContent.trim() && t.offsetParent !== null && getComputedStyle(t).display !== 'none');
    const low = texts.map((t) => ({ text: t.textContent.trim(), ratio: ratio(rgb(getComputedStyle(t).color), bgOf(t)) })).filter((x) => x.ratio < 4.5);
    rows.push({ id: ph.dataset.variant, phase: ph.dataset.phase, w: Math.round(r.width / s), h: Math.round(r.height / s), role: el.getAttribute('role'), label: el.getAttribute('aria-label'), low });
  }
  return rows;
}));

const report = {};
const p = await open();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/overview-online.png`, fullPage: false });

for (const [lang, theme] of [['de', 'light'], ['en', 'dark']]) {
  await click(p, 'lang', lang);
  await click(p, 'theme', theme);
  for (const st of ['offline', 'failing']) {
    await click(p, 'sync', st);
    await p.waitForTimeout(700);
    const tag = `${st}-${lang}-${theme}`;
    const open1 = await audit(p);
    for (const g of ['s3', 's1', 's2']) await p.locator(`#${g}`).screenshot({ path: `${out}/${g}-${tag}-open.png` });
    await p.waitForTimeout(3400);
    const rest = await audit(p);
    for (const g of ['s3', 's1', 's2']) await p.locator(`#${g}`).screenshot({ path: `${out}/${g}-${tag}-rest.png` });
    for (const r of [...open1, ...rest]) {
      check(r.w >= 44 && r.h >= 44, `${tag} ${r.id} ${r.phase}: hit ${r.w}x${r.h}`);
      check(r.label && r.role, `${tag} ${r.id} ${r.phase}: no semantics`);
      check(r.low.length === 0, `${tag} ${r.id} ${r.phase}: contrast ${JSON.stringify(r.low)}`);
    }
    report[tag] = { targets: open1.length + rest.length, minHit: Math.min(...[...open1, ...rest].map((r) => Math.min(r.w, r.h))) };
    report[`${tag}-status`] = await p.$$eval('.frame__status', (els) => els.map((e) => `${e.closest('.frame').dataset.id}: ${e.textContent}`));
  }
  await click(p, 'sync', 'online');
  await p.waitForTimeout(500);
  const shown = await p.$$eval('.phone', (phs) => phs.filter((ph) => ph.dataset.phase !== 'hidden').length);
  check(shown === 0, `online ${lang}: ${shown} phones still show an indicator`);
}
await click(p, 'lang', 'de');
await click(p, 'theme', 'light');

// Behaviour: collapse triggers, tap to explain, tap to retry.
await click(p, 'sync', 'offline');
await p.waitForTimeout(400);
check(await phase(p, 'S2-C2F3') === 'open' && await phase(p, 'S2-C1F2') === 'open', 'offline opens S2 expanded');
await p.waitForTimeout(3200);
const t3 = { C1F2: await phase(p, 'S2-C1F2'), C2F3: await phase(p, 'S2-C2F3'), C3F3: await phase(p, 'S2-C3F3'), s3a1: await phase(p, 'S3-a1') };
check(t3.C1F2 === 'rest' && t3.C3F3 === 'rest' && t3.C2F3 === 'open' && t3.s3a1 === 'rest', `after 3 s: ${JSON.stringify(t3)}`);
await p.click('[data-action=replay]');
await p.waitForTimeout(400);
await p.click('[data-action=scroll]');
await p.waitForTimeout(800);
const sc = { C1F2: await phase(p, 'S2-C1F2'), C2F3: await phase(p, 'S2-C2F3'), C3F2: await phase(p, 'S2-C3F2') };
check(sc.C1F2 === 'open' && sc.C2F3 === 'rest' && sc.C3F2 === 'rest', `scroll: ${JSON.stringify(sc)}`);
await p.locator('.frame[data-id="S2-C2F3"]').screenshot({ path: `${out}/s2-C2F3-after-scroll.png` });
await tapPhone(p, 'S2-C2F3');
await p.waitForTimeout(400);
check(await phase(p, 'S2-C2F3') === 'open', 'offline: tapping the collapsed form re-expands');
await tapPhone(p, 'S2-C2F3');
await p.waitForTimeout(400);
check(await phase(p, 'S2-C2F3') === 'rest', 'offline: tapping the expanded card collapses, no retry');
report.behaviour = { t3, sc };

await click(p, 'sync', 'failing');
await p.waitForTimeout(3600);
const ids = ['S2-C3F3', 'S2-C1F2', 'S3-a1', 'S3-d1', 'S1-a1'];
for (const id of ids) await tapPhone(p, id);
await p.waitForTimeout(300);
const busy = await Promise.all(ids.map((id) => phase(p, id)));
const icons = await p.$$eval('.phone[data-phase="busy"] .si', (els) => els.filter((e) => e.offsetParent).map((e) => [...e.children].filter((c) => getComputedStyle(c).display !== 'none').length));
check(icons.every((n) => n === 1), `busy shows one icon per slot: ${icons}`);
check(busy.every((x) => x === 'busy'), `failing tap → busy: ${busy}`);
for (const id of ['S2-C3F3', 'S3-a1', 'S1-a1']) await p.locator(`.frame[data-id="${id}"] .phone`).screenshot({ path: `${out}/retry-${id}.png` });
await p.waitForTimeout(1300);
const done = await Promise.all(ids.map((id) => phase(p, id)));
const live = await p.$eval('.phone[data-variant="S2-C3F3"] .live', (e) => e.textContent);
check(done.every((x) => x === 'hidden'), `retry success → hidden: ${done}`);
check(live === 'Synchronisiert', `announcement: ${live}`);
check(await p.$$eval('[role=alert], .snackbar', (e) => e.length) === 0, 'no confirmation snackbar');
await click(p, 'outcome', 'fail');
await click(p, 'sync', 'online');
await click(p, 'sync', 'failing');
await p.waitForTimeout(400);
await tapPhone(p, 'S2-C3F2');
await p.waitForTimeout(1500);
check(await phase(p, 'S2-C3F2') === 'rest', 'retry fails → stays collapsed and failing');
report.behaviour.retry = { busy, done, live };
await click(p, 'outcome', 'ok');

// Real input: a mouse drag and a CDP touch swipe up on the open card collapse C2; a real click retries.
const centre = async (pg, sel) => { await pg.locator(sel).scrollIntoViewIfNeeded(); const r = await pg.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
await click(p, 'outcome', 'ok');
await click(p, 'sync', 'online');
await click(p, 'sync', 'offline');
await p.waitForTimeout(500);
for (const [id, dist] of [['S2-C2F1', 80], ['S2-C2F3', 40]]) {
  const c = await centre(p, `.phone[data-variant="${id}"] .snack`);
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(c.x, c.y - (dist * i) / 8);
  await p.mouse.up();
  await p.waitForTimeout(400);
  check(await phase(p, id) === 'rest', `mouse swipe ${dist}px up collapses ${id}: ${await phase(p, id)}`);
}
const c1 = await centre(p, '.phone[data-variant="S2-C1F2"] .snack');
await p.mouse.move(c1.x, c1.y);
await p.mouse.down();
await p.mouse.up();
await p.waitForTimeout(300);
check(await phase(p, 'S2-C1F2') === 'rest', `offline mouse tap on the open card collapses: ${await phase(p, 'S2-C1F2')}`);
const touch = await open({ hasTouch: true, isMobile: true, viewport: { width: 1700, height: 1000 } });
const cdp = await touch.context().newCDPSession(touch);
await click(touch, 'sync', 'offline');
await touch.waitForTimeout(500);
for (const id of ['S2-C2F1', 'S2-C3F4']) {
  const c = await centre(touch, `.phone[data-variant="${id}"] .snack`);
  const pt = (y) => [{ x: c.x, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.y) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.y - 10 * i) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.waitForTimeout(400);
  check(await phase(touch, id) === 'rest', `touch swipe 80px up collapses ${id}: ${await phase(touch, id)}`);
}
await touch.context().close();
await click(p, 'sync', 'failing');
await p.waitForTimeout(3600);
const f1 = await centre(p, '.phone[data-variant="S2-C1F1"] .mini');
await p.mouse.click(f1.x, f1.y);
await p.waitForTimeout(200);
check(await phase(p, 'S2-C1F1') === 'busy', `real click on F1 retries: ${await phase(p, 'S2-C1F1')}`);
await click(p, 'lang', 'en');
await p.waitForTimeout(1400);
check(await phase(p, 'S2-C1F1') === 'hidden', `a retry survives a language switch: ${await phase(p, 'S2-C1F1')}`);
await click(p, 'lang', 'de');

// S3 open: no open card overlaps the top bar.
for (const st of ['offline', 'failing']) {
  await click(p, 'sync', 'online');
  await click(p, 'sync', st);
  await p.waitForTimeout(800);
  const clash = await p.$$eval('.phone[data-group="s3"]', (phs) => phs.map((ph) => {
    const a = ph.querySelector('.cap__bg').getBoundingClientRect();
    const b = ph.querySelector('.topbar').getBoundingClientRect();
    return { id: ph.dataset.variant, phase: ph.dataset.phase, gap: Math.round(b.top - a.bottom) };
  }).filter((x) => x.phase !== 'open' || x.gap < 4));
  check(clash.length === 0, `S3 ${st} open cards over the top bar: ${JSON.stringify(clash)}`);
}
await click(p, 'sync', 'online');

// Expanded from the open state, offline, for the single-frame shots.
await click(p, 'sync', 'online');
await click(p, 'size', 'real');
await p.$$eval('.content', (els) => els.forEach((c) => c.scrollTo(0, 0)));
await click(p, 'sync', 'offline');
await p.waitForTimeout(500);
for (const id of ['S3-a1', 'S3-b1', 'S3-c1', 'S3-d1', 'S3-e1', 'S3-a3', 'S2-C3F3', 'S1-a1']) await p.locator(`.frame[data-id="${id}"] .phone`).screenshot({ path: `${out}/frame-${id}-offline-open.png` });
await p.waitForTimeout(3300);
for (const id of ['S3-a1', 'S3-a2', 'S3-b1', 'S3-c1', 'S3-c3', 'S3-d1', 'S3-d2', 'S3-e1', 'S3-a3', 'S2-C3F3', 'S2-C3F2', 'S2-C1F1', 'S2-C3F4', 'S1-a1', 'S1-c1', 'S1-d1']) await p.locator(`.frame[data-id="${id}"] .phone`).screenshot({ path: `${out}/frame-${id}-offline-rest.png` });
await click(p, 'sync', 'failing');
await p.waitForTimeout(3600);
for (const id of ['S3-a1', 'S3-d1', 'S2-C3F3', 'S1-a1', 'S1-a3', 'S1-d3']) await p.locator(`.frame[data-id="${id}"] .phone`).screenshot({ path: `${out}/frame-${id}-failing-rest.png` });
await click(p, 'size', 'fit');

// Reduced motion: nothing moves, only opacity and colour change.
await click(p, 'motion', 'reduced');
await click(p, 'sync', 'online');
await click(p, 'sync', 'offline');
const props = await p.$$eval('.phone .snack, .phone .cap__compact, .phone .cap__full, .phone .banner, .phone .mini', (els) => [...new Set(els.map((e) => getComputedStyle(e).transitionProperty))]);
const moving = await p.$$eval('.phone .snack, .phone .mini', (els) => els.filter((e) => getComputedStyle(e).transform !== 'none').length);
const refade = await p.$$eval('.phone[data-variant="S3-a3"] > .shift, .phone[data-variant="S1-a1"] > .shift, .phone[data-variant="S2-C3F3"] > .shift', (els) => els.map((e) => getComputedStyle(e).animationName));
check(refade[0].startsWith('refade') && refade[1].startsWith('refade') && refade[2] === 'none', `reduced: a list that moves fades in, one that doesn't keeps still: ${refade}`);
const pan = await p.$$eval('.phone[data-variant="S2-C1F2"] .snack, .phone[data-variant="S2-C3F2"] .snack', (els) => els.map((e) => getComputedStyle(e).touchAction));
check(pan[0] === 'pan-y' && pan[1] === 'none', `touch-action C1 pan-y, C3 none: ${pan}`);
check(props.every((x) => !/transform|width|height|max-width/.test(x)), `reduced transitions: ${props}`);
check(moving === 0, `reduced: ${moving} transformed elements`);
await p.waitForTimeout(100);
await p.locator('#s2').screenshot({ path: `${out}/s2-offline-reduced-mid.png` });
await p.waitForTimeout(3400);
await p.locator('#s3').screenshot({ path: `${out}/s3-offline-reduced-rest.png` });
report.reduced = { props, moving, refade, pan };

// A phone-width viewport: no horizontal overflow.
const ph = await open({ ...devices['iPhone 13'] });
await click(ph, 'sync', 'failing');
await ph.waitForTimeout(3600);
const overflow = await ph.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!overflow, 'phone viewport overflows');
await ph.screenshot({ path: `${out}/phone-failing.png` });

report.errors = errs;
check(errs.length === 0, `console errors: ${errs.length}`);
report.fails = fails;
console.log(JSON.stringify(report, null, 1));
await b.close();
server.close();
process.exit(fails.length ? 1 : 0);
