// Drives every approach through the shared scenarios, checks what the bar and the sheet show, writes screenshots.
// Usage: node shoot.mjs <page-url> <out-dir> [playwright-module-dir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import process from 'node:process';

const [url, out, pwDir = `${process.env.HOME}/family-groceries/e2e/node_modules/`] = process.argv.slice(2);
const { chromium } = createRequire(pwDir)('playwright');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2, locale: 'de-DE' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failures = [];
const check = (ok, label) => {
  if (!ok) failures.push(label);
};

const variants = ['current', 'breadcrumb-in-bar', 'stacked-two-line', 'single-chip-truncate', 'list-first-chip', 'hide-household-when-solo'];
const scenarios = ['one-short', 'one-many', 'many-households', 'long-names', 'solo-long'];
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
const press = async (label) => {
  await page.locator('.controls button', { hasText: label }).first().click();
  await settle();
};

// What a bar shows: its visible text, whether it overflows, the header height, a tabs row, and how
// much of each name is really on screen. innerText keeps CSS-cut text, so a name counts as shown
// only when its visible glyphs (its text box cut by every overflow or clip-path box above it) are at least as
// wide as its first letters and an ellipsis in the same font: two for the household, one for the list.
const bar = (v) =>
  page.evaluate((v) => {
    const dev = document.querySelector(`.device[data-variant="${v}"]`);
    const hdr = dev.querySelector('.hdr');
    const b = dev.querySelector('.bar');
    const phone = dev.querySelector('.phone').getBoundingClientRect();
    const outside =
      b.scrollWidth > b.clientWidth + 1 ||
      [...b.querySelectorAll('button')].some((el) => {
        if (!el.getClientRects().length) return false;
        const r = el.getBoundingClientRect();
        return r.right > phone.right - 8 || r.left < phone.left + 8;
      });
    const shown = (sel, letters) => {
      const el = b.querySelector(sel);
      if (!el || !el.getClientRects().length) return { visible: 0, need: 0 };
      const full = (el.dataset.full ?? el.textContent).trim();
      const range = document.createRange();
      let left = Infinity;
      let right = -Infinity;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim()) continue;
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
      for (let e = el; e && e !== dev; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX === 'visible' && cs.clipPath === 'none') continue;
        const r = e.getBoundingClientRect();
        left = Math.max(left, r.left + parseFloat(cs.borderLeftWidth));
        right = Math.min(right, r.right - parseFloat(cs.borderRightWidth));
      }
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(el).font}`;
      const measure = (t) => {
        probe.textContent = t;
        return probe.getBoundingClientRect().width;
      };
      document.body.append(probe);
      const need = Math.min(measure(full), measure(`${full.slice(0, letters)}…`));
      probe.remove();
      return { visible: Math.max(0, right - left), need };
    };
    return {
      text: b.innerText.replace(/\s+/g, ' ').trim(),
      height: hdr.offsetHeight,
      tabs: !!dev.querySelector('.tabs-row'),
      outside,
      anpassen: b.innerText.includes('Anpassen'),
      household: shown('.hh-chip b, .crumb-hh .ell, .stacked small, .one-chip .hh, .hh-tag .ell', 2),
      list: shown('.crumb-list .ell, .stacked .lines b, .one-chip .list, .list-title .fit, .list-only b', 1),
    };
  }, v);
const toggle = async (label, want) => {
  const on = (await page.locator('.controls button', { hasText: label }).getAttribute('aria-pressed')) === 'true';
  if (on !== want) await press(label);
};

await page.goto(`${url}#/alle`);
await settle();

const households = {
  'one-short': ['Trost'],
  'one-many': ['Trost'],
  'many-households': ['Trost'],
  'long-names': ['Wohngemeinschaft Kastanienallee 12, Hinterhaus links'],
  'solo-long': ['Familie Trost-Brandtner aus Sendling'],
};
const solo = { 'one-short': true, 'one-many': true, 'many-households': false, 'long-names': false, 'solo-long': true };

for (const big of [false, true]) {
  for (const offline of [false, true]) {
    await toggle('Große Schrift', big);
    await toggle('Offline', offline);
    for (const width of ['390 px', '360 px', '320 px']) {
      await press(width);
      for (const sc of scenarios) {
        await page.locator('.controls button').filter({ hasText: { 'one-short': '1 Haushalt, 1 Liste', 'one-many': '1 Haushalt, 4 Listen', 'many-households': '3 Haushalte', 'long-names': 'Lange Namen', 'solo-long': 'Nur 1 Haushalt, lang' }[sc] }).click();
        await settle();
        for (const v of variants) {
          const b = await bar(v);
          const tag = `${width} ${big ? '130%' : '100%'} ${offline ? 'off' : 'on'} ${sc} ${v}`;
          check(b.anpassen, `${tag}: Anpassen missing`);
          check(!b.outside, `${tag}: a bar control sticks out of the phone`);
          const shows = (n) => n.need > 0 && n.visible >= n.need - 0.5;
          const seen = (n, what) => `visible ${n.visible.toFixed(1)} px, ${what} and … need ${n.need.toFixed(1)} px (bar: ${b.text})`;
          // Today's bar keeps its lists in the tabs row, and its chip steps aside under 96 px (HouseholdChip.widest).
          if (v !== 'current') {
            check(!b.tabs, `${tag}: second tabs row present`);
            check(shows(b.list), `${tag}: list name not visible in the bar, ${seen(b.list, 'one letter')}`);
            if (v === 'hide-household-when-solo') check(shows(b.household) === !solo[sc], `${tag}: household shown=${shows(b.household)}, solo=${solo[sc]}, ${seen(b.household, 'two letters')}`);
            else check(shows(b.household), `${tag}: household name not visible in the bar, ${seen(b.household, 'two letters')}`);
          }
          if (v !== 'current') check(b.height <= 72, `${tag}: header ${b.height} px`);
          console.log(`${tag.padEnd(64)} head ${b.height}px  hh ${b.household.visible.toFixed(0).padStart(3)}/${b.household.need.toFixed(0)}  list ${b.list.visible.toFixed(0).padStart(3)}/${b.list.need.toFixed(0)}  ${b.text}`);
        }
        if (!big && !offline && width !== '360 px') await page.locator('.grid').screenshot({ path: `${out}/grid-${width.split(' ')[0]}-${sc}.png` });
      }
    }
  }
}
await toggle('Große Schrift', false);
await toggle('Offline', false);

// Sheet scenarios in the single view: switch list, switch household, Siri default untouched.
const phone = page.locator('.phone');
const tapIn = async (text) => {
  await phone.locator('[data-act]').filter({ hasText: text }).first().click();
  await settle();
};
const openSwitcher = async (v) => {
  const sel = { current: '.hh-chip', 'breadcrumb-in-bar': '.crumb-list', 'stacked-two-line': '.stacked', 'single-chip-truncate': '.one-chip', 'list-first-chip': '.list-title', 'hide-household-when-solo': '.bar > button:first-child' }[v];
  await phone.locator(sel).click();
  await settle();
};
await press('390 px');
for (const v of variants.slice(1)) {
  await page.goto(`${url}#/${v}`);
  await settle();
  await press('3 Haushalte');
  await press('Von vorn');
  await openSwitcher(v);
  await phone.screenshot({ path: `${out}/${v}-sheet.png` });
  check(await phone.locator('.sheet').isVisible(), `${v}: sheet did not open`);
  if (v === 'list-first-chip' || v === 'hide-household-when-solo') {
    // Lists come first in these.
  }
  await tapIn('Einkaufsliste');
  let b = await bar(v);
  check(b.text.includes('Einkaufsliste') && b.text.includes('Trost'), `${v}: list switch: ${b.text}`);
  await openSwitcher(v);
  if (v === 'list-first-chip') await tapIn('Haushalt: Trost');
  if (v === 'hide-household-when-solo') await tapIn('Haushalte');
  if (v === 'stacked-two-line') {
    await tapIn('WG Kastanienallee');
    await phone.screenshot({ path: `${out}/${v}-sheet-browse.png` });
    await tapIn('Putzmittel');
  } else if (v === 'single-chip-truncate') await tapIn('Putzmittel');
  else await tapIn('WG Kastanienallee');
  b = await bar(v);
  check(b.text.includes('WG'), `${v}: household switch: ${b.text}`);
  const toast = await phone.locator('.toast').innerText();
  check(toast.includes('Siri, Alexa & KI bleiben bei Trost'), `${v}: toast ${toast}`);
  await phone.screenshot({ path: `${out}/${v}-switched.png` });
  await openSwitcher(v);
  if (v === 'list-first-chip') await tapIn('Haushalt: WG');
  if (v === 'hide-household-when-solo') await tapIn('Haushalte');
  const sheet = await phone.locator('.sheet').innerText();
  check(sheet.includes('Siri, Alexa & KI nutzen: Trost'), `${v}: default row changed`);

  await press('Lange Namen');
  await press('Von vorn');
  await phone.screenshot({ path: `${out}/${v}-long.png` });
  await openSwitcher(v);
  await phone.screenshot({ path: `${out}/${v}-long-sheet.png` });
  await press('Nur 1 Haushalt, lang');
  await press('Von vorn');
  await phone.screenshot({ path: `${out}/${v}-solo.png` });
}

// Long names in the sheet: every page of every sheet, 390 and 320 px, normal and large text.
// A name counts as shown only when an element holding its full text is not clipped by itself or an ancestor.
const fullNames = ['Geburtstagsfeier für Oma Hildegard am Samstag', 'Drogerie, Apotheke und Reformhaus', 'Wohngemeinschaft Kastanienallee 12, Hinterhaus links'];
const sheetPages = {
  'breadcrumb-in-bar': [[]],
  'stacked-two-line': [[]],
  'single-chip-truncate': [[]],
  'list-first-chip': [[], ['Haushalt: Wohngemeinschaft']],
  'hide-household-when-solo': [[], ['Haushalte']],
};
const clipped = () =>
  page.evaluate((names) => {
    const sheet = document.querySelector('.device .sheet-body');
    const cut = (el) => {
      for (let e = el; e && e !== sheet; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const hidesX = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis';
        const hidesY = cs.overflowY !== 'visible' || cs.webkitLineClamp !== 'none';
        if ((hidesX && e.scrollWidth > e.clientWidth + 1) || (hidesY && e.scrollHeight > e.clientHeight + 1)) return true;
      }
      return false;
    };
    const leaves = [...sheet.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const truncated = leaves.filter(cut).map((e) => e.textContent.trim());
    const missing = names.filter((n) => !leaves.some((e) => e.textContent.includes(n) && !cut(e)));
    return { truncated, missing };
  }, fullNames);
for (const big of [false, true]) {
  if (big) await press('Große Schrift');
  for (const width of ['390 px', '320 px']) {
    await press(width);
    for (const v of variants.slice(1)) {
      await page.goto(`${url}#/${v}`);
      await settle();
      await press('Lange Namen');
      await press('Von vorn');
      const seen = new Set();
      for (const steps of sheetPages[v]) {
        await openSwitcher(v);
        for (const step of steps) await tapIn(step);
        const r = await clipped();
        check(r.truncated.length === 0, `${width}${big ? ' large text' : ''} ${v} sheet ${steps.join('>') || 'start'}: cut ${JSON.stringify(r.truncated)}`);
        for (const n of fullNames) if (!r.missing.includes(n)) seen.add(n);
        if (big && width === '320 px') await phone.screenshot({ path: `${out}/${v}-long-sheet-320-big${steps.length ? '-2' : ''}.png` });
        await phone.locator('.scrim').click({ position: { x: 10, y: 10 } });
        await settle();
      }
      for (const n of fullNames) check(seen.has(n), `${width}${big ? ' large text' : ''} ${v}: "${n}" never shown in full in the sheet`);
    }
  }
  if (big) await press('Große Schrift');
}

// Which names each bar cuts, measured (innerText keeps CSS-cut text whole), for three households
// (short names) and long names, at every width, normal and large text, online and offline.
const nameSel = {
  household: '.crumb-hh .ell, .stacked small, .one-chip .hh, .hh-tag .ell',
  list: '.crumb-list .ell, .stacked .lines b, .one-chip .list, .list-title .fit, .list-only b',
};
const cuts = () =>
  page.evaluate((sel) => {
    const isCut = (e) => (e.dataset.full ? e.textContent !== e.dataset.full : e.scrollWidth > e.clientWidth + 1);
    return Object.fromEntries(
      [...document.querySelectorAll('.device')].map((d) => [
        d.dataset.variant,
        Object.fromEntries(
          Object.entries(sel).map(([k, q]) => {
            const e = d.querySelector(`.bar :is(${q})`);
            return [k, e ? (isCut(e) ? 'cut' : 'full') : 'hidden'];
          }),
        ),
      ]),
    );
  }, nameSel);
const table = [];
await page.goto(`${url}#/alle`);
await settle();
for (const sc of ['3 Haushalte', 'Lange Namen']) {
  await press(sc);
  for (const big of [false, true]) {
    for (const offline of [false, true]) {
      for (const width of ['390 px', '360 px', '320 px']) {
        await toggle('Große Schrift', big);
        await toggle('Offline', offline);
        await press(width);
        const c = await cuts();
        table.push({ sc, width, big, offline, c });
        if (sc === '3 Haushalte' && width === '390 px' && big && offline) {
          check(c['stacked-two-line'].household === 'full' && c['stacked-two-line'].list === 'full', `stacked-two-line cuts short names at 390 px, large text, offline: ${JSON.stringify(c['stacked-two-line'])}`);
        }
      }
    }
  }
}
await press('Große Schrift');
await press('Offline');
console.log('\nbar names (household/list): f = full, c = cut, - = hidden');
console.log(['scenario', 'width', 'text', 'sync', ...variants.slice(1).map((v) => v.split('-')[0])].join('\t'));
for (const r of table) {
  const cell = (v) => `${r.c[v].household[0].replace('h', '-')}/${r.c[v].list[0]}`;
  console.log([r.sc.split(' ')[0], r.width.split(' ')[0], r.big ? '130%' : '100%', r.offline ? 'off' : 'on', ...variants.slice(1).map(cell)].join('\t'));
}

await press('3 Haushalte');
await page.goto(`${url}#/current`);
await settle();
await press('Offline');
await page.goto(`${url}#/alle`);
await settle();
const phoneWidth = () => page.locator('.device[data-variant="current"] .phone').evaluate((e) => Math.round(e.getBoundingClientRect().width));
await press('390 px');
check((await phoneWidth()) === 390, `grid-390 shots: phone is ${await phoneWidth()} px`);
await page.locator('.grid').screenshot({ path: `${out}/grid-390-offline.png` });
await press('Große Schrift');
check((await phoneWidth()) === 390, `grid-390 big shot: phone is ${await phoneWidth()} px`);
const stacked390 = (await cuts())['stacked-two-line'];
check(stacked390.household === 'full' && stacked390.list === 'full', `grid-390-offline-big: stacked-two-line cuts ${JSON.stringify(stacked390)}`);
await page.locator('.grid').screenshot({ path: `${out}/grid-390-offline-big.png` });

// bars-130-offline.png: the four always-on bars at 390 and 320 px, 130 % text, offline.
const barShots = [];
for (const w of ['390 px', '320 px']) {
  await press(w);
  for (const v of ['breadcrumb-in-bar', 'stacked-two-line', 'single-chip-truncate', 'list-first-chip']) {
    const png = await page.locator(`.device[data-variant="${v}"] .hdr`).screenshot();
    barShots.push(`<figure style="margin:0;font:12px sans-serif">${w} ${v}<br><img src="data:image/png;base64,${png.toString('base64')}" style="width:${w.split(' ')[0]}px"></figure>`);
  }
}
const sheet = await browser.newPage({ viewport: { width: 820, height: 400 }, deviceScaleFactor: 2 });
await sheet.setContent(`<body style="margin:4px;display:grid;grid-template-columns:repeat(2,max-content);gap:8px">${barShots.join('')}</body>`);
await sheet.screenshot({ path: `${out}/bars-130-offline.png`, fullPage: true });
await sheet.close();
await press('390 px');
for (const v of variants) {
  const b = await bar(v);
  check(!b.outside, `big text offline ${v}: control sticks out`);
}

await browser.close();
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
console.log(failures.length ? `FAIL ${failures.length}\n${failures.join('\n')}` : 'all checks passed');
process.exit(failures.length || errors.length ? 1 : 0);
