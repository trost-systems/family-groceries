// The ST set (job 230): screenshots, rows visible on a 390 × 844 phone against R2, and that the subtotals add up.
// Usage: node shoot-st.mjs <sandbox-url> <out-dir> [playwright-module-dir], the sandbox URL ending in `list-declutter/`.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const [base, out, pwDir = `${process.env.HOME}/family-groceries/e2e/node_modules/`] = process.argv.slice(2);
const url = new URL('st/', base).href;
const { chromium } = createRequire(pwDir)('playwright');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 3000, height: 1300 }, deviceScaleFactor: 2, locale: 'de-DE' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failures = [];
const check = (ok, label) => {
  if (!ok) failures.push(label);
};
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
const open = async (q, view = 'st') => {
  await page.goto(`${url}?${new URLSearchParams({ lang: 'de', theme: 'light', data: 'three', ts: '100', ...q, n: String(Math.random()) })}#/${view}`);
  await page.waitForSelector('.phone');
  await settle();
};
const ST = ['ST1', 'ST2', 'ST3', 'ST4', 'ST5'];
const all = ['today', 'R2', ...ST];
const phone = (v) => page.locator(`.phone[data-v="${v}"]`);
const measure = () => page.evaluate(() => globalThis.__measure());
const toEnd = () =>
  page.evaluate(() => {
    for (const s of document.querySelectorAll('.phone .scroll')) {
      s.scrollTop = 1e5;
      s.dispatchEvent(new Event('scroll'));
    }
  });
const hideFs = async () => {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.phone .fs-card [data-act="fs-hide"]')) b.click();
  });
  await settle();
};
const contentH = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.phone')].map((ph) => [ph.dataset.v, ph.querySelector('.scroll').scrollHeight])));
// Subtotals drawn in a phone, the total, and the "N ohne Preis" texts.
const sums = (v) =>
  phone(v).evaluate((ph) => ({
    subs: [...ph.querySelectorAll('[data-sub]')].map((e) => Number(e.dataset.sub)),
    grand: Number(ph.querySelector('[data-grand]')?.dataset.grand ?? NaN),
    meta: ph.querySelector('.total-row small')?.innerText ?? '',
    text: ph.querySelector('.scroll').innerText,
  }));
const expect = {
  one: { stores: 1, grand: 3353, unpriced: 5, per: {} },
  three: { stores: 3, grand: 3208, unpriced: 4, per: { Lidl: 2, dm: 1 } },
  mixed: { stores: 4, grand: 3353, unpriced: 5, per: { Lidl: 2, dm: 1 } },
};
const unpricedWord = { de: 'ohne Preis', en: 'unpriced' };
// What the total's line says about stores: "Ohne Laden" is a group with a subtotal, not a store (review 0).
const storeWords = {
  one: { de: null, en: null },
  three: { de: '3 Läden ·', en: '3 stores ·' },
  mixed: { de: '3 Läden + ohne Laden ·', en: '3 stores + no store ·' },
};
const expandST4 = async () => {
  if (!(await phone('ST4').locator('.st-lines').count()) && (await phone('ST4').locator('[data-act="st-exp"]').count())) await phone('ST4').locator('[data-act="st-exp"]').click();
  await settle();
};

const rows = [['data', 'text', 'lang', 'theme', 'where', ...all].join('\t')];
const cost = [['data', 'text', ...all.map((v) => `${v} px`)].join('\t')];
for (const data of ['one', 'three', 'mixed'])
  for (const ts of ['100', '130', '160'])
    for (const lang of ['de', 'en'])
      for (const theme of ['light', 'dark']) {
        const tag = `${data}/${ts}/${lang}/${theme}`;
        await open({ data, ts, lang, theme });
        const m = await measure();
        for (const v of all) check(m[v].size === '390×844', `${v} ${tag}: phone is ${m[v].size}`);
        rows.push([data, ts, lang, theme, 'top', ...all.map((v) => m[v].full)].join('\t'));
        await hideFs();
        const f = await measure();
        rows.push([data, ts, lang, theme, 'first steps hidden', ...all.map((v) => f[v].full)].join('\t'));
        if (lang === 'de' && theme === 'light') {
          const h = await contentH();
          cost.push([data, ts, ...all.map((v) => h[v] - h.R2)].join('\t'));
        }
        await toEnd();
        await settle();
        if (ts === '100' && ((lang === 'de' && theme === 'light') || (lang === 'en' && theme === 'dark'))) await page.locator('.grid').screenshot({ path: `${out}/st-${data}-${lang}-${theme}-end.png` });
        if (ts !== '100' && data === 'three' && lang === theme.replace('light', 'de').replace('dark', 'en')) await page.locator('.grid').screenshot({ path: `${out}/st-${data}-${ts}-${lang}-${theme}-end.png` });
        await expandST4();
        await toEnd();
        await settle();
        const e = expect[data];
        for (const v of ST) {
          const s = await sums(v);
          check(s.grand === e.grand, `${v} ${tag}: total ${s.grand}, wants ${e.grand}`);
          check(s.meta.includes(`${e.unpriced} ${unpricedWord[lang]}`), `${v} ${tag}: the total says "${e.unpriced} ${unpricedWord[lang]}" (${s.meta})`);
          const sw = storeWords[data][lang];
          check(sw ? s.meta.startsWith(sw) : !/Läden|Laden|stores?\b/.test(s.meta), `${v} ${tag}: the total counts stores as "${sw ?? 'nothing'}" (${s.meta})`);
          if (e.stores === 1) check(!s.subs.length, `${v} ${tag}: one store shows no subtotal (${s.subs})`);
          else {
            check(s.subs.length === e.stores, `${v} ${tag}: ${s.subs.length} subtotals for ${e.stores} stores`);
            check(s.subs.reduce((a, b) => a + b, 0) === s.grand, `${v} ${tag}: subtotals ${s.subs} add up to ${s.grand}`);
            if (v !== 'ST5') check(s.text.includes(`2 ${unpricedWord[lang]}`) && s.text.includes(`1 ${unpricedWord[lang]}`), `${v} ${tag}: per-store "ohne Preis" shown`);
          }
        }
        const over = await page.evaluate(() =>
          [...document.querySelectorAll('.phone')].flatMap((ph) => {
            const r = ph.getBoundingClientRect();
            return [...ph.querySelectorAll('.scroll *, .top *, .bottom *')]
              .filter((el) => el.getBoundingClientRect().width && !el.closest('.track'))
              .filter((el) => el.getBoundingClientRect().right > r.right + 0.5 || el.getBoundingClientRect().left < r.left - 0.5)
              .slice(0, 1)
              .map((el) => `${ph.dataset.v} ${el.className.baseVal ?? el.className}`);
          }),
        );
        check(!over.length, `${tag}: something sticks out of a phone (${over})`);
        // Text drawn over other text: amounts must not overlap the badge or label on their line.
        const clash = await page.evaluate(() =>
          [...document.querySelectorAll('.phone .div, .phone .st-foot, .phone .st-line, .phone .total-row, .phone .st-chip')].flatMap((row) => {
            const kids = [...row.querySelectorAll('.badge-hex, b, small, .ell, .count, .sub')].filter((k) => !k.querySelector('b, small') && k.getBoundingClientRect().width);
            const bad = [];
            for (let i = 0; i < kids.length; i++)
              for (let j = i + 1; j < kids.length; j++) {
                if (kids[i].contains(kids[j]) || kids[j].contains(kids[i])) continue;
                const a = kids[i].getBoundingClientRect();
                const b = kids[j].getBoundingClientRect();
                if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(`${row.closest('.phone').dataset.v} ${row.className}: ${kids[i].innerText} / ${kids[j].innerText}`);
              }
            return bad.slice(0, 1);
          }),
        );
        check(!clash.length, `${tag}: text overlaps (${clash.slice(0, 3)})`);
      }
writeFileSync(`${out}/st-items-visible.tsv`, `${rows.join('\n')}\n`);
writeFileSync(`${out}/st-height-vs-r2.tsv`, `${cost.join('\n')}\n`);

// Behaviour, German, three stores, 100 %.
await open({});
for (const v of ST) {
  await phone(v).locator('.item', { hasText: 'Zahnpasta' }).click();
  await page.waitForTimeout(150);
  check(!(await phone(v).locator('.snack.prompt').count()), `${v}: no "Kaufst du gerade ein?" (job 217 is not on main)`);
}
await page.waitForTimeout(500);
for (const v of ST)
  for (const n of ['Shampoo', 'Taschentücher']) {
    await phone(v).locator('.item', { hasText: n }).click();
    await page.waitForTimeout(500);
  }
await expandST4();
for (const v of ST) {
  const s = await sums(v);
  check(s.subs.length === 3 && s.subs.reduce((a, b) => a + b, 0) === s.grand && s.subs.includes(490), `${v}: with dm bought in full the subtotals still add up (${s.subs} = ${s.grand})`);
  check(v === 'ST5' ? (await phone(v).locator('.st-chip.done[data-store="dm"][aria-label*="alles gekauft"] .icon').count()) === 1 : /alles gekauft/.test(s.text), `${v}: dm says "alles gekauft"`);
}
await toEnd();
await settle();
await page.locator('.grid').screenshot({ path: `${out}/st-three-de-light-dm-bought.png` });

await open({});
await toEnd();
await settle();
check(!(await phone('ST4').locator('.st-lines').count()), 'ST4: folded at first');
await phone('ST4').locator('[data-act="st-exp"]').click();
check((await phone('ST4').locator('.st-lines .st-line').count()) === 3, 'ST4: a tap unfolds three store lines');
await toEnd();
await settle();
await phone('ST4').screenshot({ path: `${out}/ST4-three-de-light-open.png` });
await phone('ST4').locator('[data-act="st-exp"]').click();
check(!(await phone('ST4').locator('.st-lines').count()), 'ST4: a second tap folds them');

// A store line or chip jumps to its section, right under the header.
for (const [v, sel] of [['ST3', '.st-line'], ['ST5', '.st-chip']]) {
  await toEnd();
  await settle();
  await phone(v).locator(`${sel}[data-store="dm"]`).click();
  await page.waitForTimeout(900);
  const gap = await phone(v).evaluate((ph) => Math.round(ph.querySelector('.scroll [data-sec="dm"]').getBoundingClientRect().top - ph.querySelector('.top').getBoundingClientRect().bottom));
  check(gap >= 0 && gap <= 12, `${v}: a tap on dm brings its section under the header (${gap} px)`);
}

// Targets: the hit test at the centre and ±23 px lands on the element.
await open({});
await expandST4();
await toEnd();
await settle();
for (const [v, sel] of [['ST3', '.st-line'], ['ST4', '[data-act="st-exp"]'], ['ST4', '.st-line'], ['ST5', '.st-chip']]) {
  const hit = await phone(v).evaluate((ph, sel) => {
    const el = ph.querySelector(sel);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { h: Math.round(r.height), ok: [[cx, cy], [cx, cy - 23], [cx, cy + 23]].every(([x, y]) => document.elementFromPoint(x, y)?.closest(sel) === el) };
  }, sel);
  check(hit.h >= 48 && hit.ok, `${v}: ${sel} is a 48 px target (${hit.h}, hit ${hit.ok})`);
}

// ST3's store line shows a long store name in full where there is room (review 0).
await open({});
await toEnd();
await settle();
const cut = await phone('ST3').evaluate((ph) => [...ph.querySelectorAll('.st-line .nm')].filter((i) => i.scrollWidth > i.clientWidth + 0.5).map((i) => i.textContent));
check(!cut.length && (await phone('ST3').locator('.st-line .nm', { hasText: 'Wochenmarkt am Kollwitzplatz (Samstag)' }).count()) === 1, `ST3: store lines show the names in full at 100 % (${cut})`);

// Folding a store in ST2 moves its sum into the divider.
await open({});
await phone('ST2').locator('[data-act="fold"][data-store="Lidl"]').click();
check((await phone('ST2').locator('[data-act="fold"][data-store="Lidl"] [data-sub="1005"]').count()) === 1, 'ST2: folded, the Lidl sum sits on its divider');
check((await sums('ST2')).subs.reduce((a, b) => a + b, 0) === 3208, 'ST2: folded, the subtotals still add up');

// The switcher opens SS5's sheet (Peter's pick).
await phone('ST3').locator('.top [data-act="switch"]').click();
check(await phone('ST3').locator('.sheet .back').isVisible(), 'ST3: the switcher opens the SS5 sheet');

// One phone per variant, scrolled to the totals, for the PR.
for (const v of ['R2', ...ST]) {
  await open({}, v);
  await hideFs();
  await toEnd();
  await settle();
  await phone(v).screenshot({ path: `${out}/${v}-three-de-light-end.png` });
}
await open({ data: 'one' }, 'ST1');
await toEnd();
await settle();
await phone('ST1').screenshot({ path: `${out}/ST1-one-de-light-end.png` });
// Without a lang parameter the page is English (lead note t870u); ?lang=de still gives German.
const german = /Läden|ohne Preis|Summe|Gesamt|offen|gekauft|Zuletzt|mit Preis|Einkauf/;
for (const [q, view, lang] of [['', 'st', 'en'], ['', 'recst', 'en'], ['', 'ST3', 'en'], ['?lang=de', 'st', 'de'], ['?lang=de', 'recst', 'de']]) {
  await page.goto(`${url}${q}#/${view}`);
  await page.waitForSelector(view === 'recst' ? '.rec h2' : '.phone');
  await settle();
  const r = await page.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText, pressed: document.querySelector('.controls [data-set="lang"][aria-pressed="true"]')?.dataset.val }));
  const ok = lang === 'en' ? !german.test(r.text) : /Summe|Läden/.test(r.text);
  check(r.lang === lang && r.pressed === lang && ok, `${q || 'no lang'} #/${view}: renders ${lang} (html ${r.lang}, switch ${r.pressed}, ${lang === 'en' ? `German word: ${r.text.match(german)?.[0]}` : 'German text'})`);
}

await browser.close();

// On a phone (390 × 664): one ST phone fills the screen, and the recommendation fits.
const tb = await chromium.launch();
const mp = await (await tb.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })).newPage();
mp.on('pageerror', (e) => errors.push(String(e)));
for (const v of ST) {
  await mp.goto(`${url}?lang=de&n=${Math.random()}#/${v}`);
  await mp.waitForSelector('.phone');
  await mp.waitForTimeout(400);
  const fit = await mp.evaluate(() => ({ bottom: document.querySelector('.phone').getBoundingClientRect().bottom, h: innerHeight, w: document.documentElement.scrollWidth, data: new URLSearchParams(location.search).get('data'), subs: document.querySelectorAll('.phone [data-sub]').length }));
  check(fit.bottom <= fit.h + 0.5 && fit.w <= 390, `${v} at 390 × 664: the phone fits (${Math.round(fit.bottom)} of ${fit.h}, width ${fit.w})`);
  if (v === 'ST3') {
    await mp.evaluate(() => (document.querySelector('.phone .scroll').scrollTop = 1e5));
    await mp.waitForTimeout(300);
    await mp.screenshot({ path: `${out}/phone-390x664-ST3-end.png` });
  }
}
// What Peter's phone shows from the bare link: English, the phone filling the screen.
await mp.goto(`${url}?n=${Math.random()}#/ST3`);
await mp.waitForSelector('.phone');
await mp.waitForTimeout(400);
await mp.evaluate(() => (document.querySelector('.phone .scroll').scrollTop = 1e5));
await mp.waitForTimeout(300);
const strip = await mp.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText }));
check(strip.lang === 'en' && !/Läden|ohne Preis|Optionen|Gesamt/.test(strip.text), `ST3 at 390 × 664 without lang: English, strip included (${strip.text.match(/Läden|ohne Preis|Optionen|Gesamt/)?.[0]})`);
await mp.screenshot({ path: `${out}/phone-390x664-ST3-end-en.png` });
for (const lang of ['de', 'en']) {
  await mp.goto(`${url}?lang=${lang}&n=${Math.random()}#/recst`);
  await mp.waitForSelector('.rec h2');
  const w = await mp.evaluate(() => ({ page: document.documentElement.scrollWidth, text: Math.max(...[...document.querySelectorAll('.rec > :not(table)')].map((e) => e.getBoundingClientRect().right)) }));
  check(w.page <= 390 && w.text <= 390, `#/recst ${lang} at 390 × 664: fits (page ${w.page}, text to ${Math.round(w.text)})`);
}
await tb.close();

console.log(rows.join('\n'));
console.log(cost.join('\n'));
if (errors.length) console.log('page errors:', errors);
check(!errors.length, `no page errors (${errors.length})`);
if (failures.length) {
  console.log(`FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('all checks passed');
