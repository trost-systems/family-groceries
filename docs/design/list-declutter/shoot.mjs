// Drives every variant: screenshots, items visible on a 390 × 844 phone, and that every function stays reachable.
// Usage: node shoot.mjs <sandbox-url> <out-dir> [playwright-module-dir], the sandbox URL ending in `list-declutter/`.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { rounds, viewsOf } from './rounds.js';

const [base, out, pwDir = `${process.env.HOME}/family-groceries/e2e/node_modules/`] = process.argv.slice(2);
const { chromium } = createRequire(pwDir)('playwright');
mkdirSync(out, { recursive: true });
// Rounds 1 and 2 have a page each; a phone both show (today, LD1, LD4) opens on round 2's.
const pageOf = (view, path = ['ss-bb', 'round1'].find((p) => viewsOf(rounds.find((r) => r.path === p)).has(view))) => new URL(`${path}/`, base).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2600, height: 1500 }, deviceScaleFactor: 2, locale: 'de-DE', hasTouch: false });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failures = [];
const check = (ok, label) => {
  if (!ok) failures.push(label);
};
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
const open = async (q, view = 'every', path = undefined) => {
  await page.goto(`${pageOf(view, path)}?${new URLSearchParams({ ...q, n: String(Math.random()) })}#/${view}`);
  await page.waitForSelector('.phone');
  await settle();
};
const ids = ['today', 'LD1', 'LD2', 'LD3', 'LD4', 'LD5'];
// Round 2: R2 is the base every SS phone shows under its sheet; the table lists it once for SS1 to SS5.
const r2 = ['R2', 'BB1', 'BB2', 'BB3', 'BB4', 'BB5', 'LD4-3T'];
const table = ['today', 'LD1', ...r2];
const ss = ['SS1', 'SS2', 'SS3', 'SS4', 'SS5'];
const phone = (v) => page.locator(`.phone[data-v="${v}"]`);
const measure = () => page.evaluate(() => globalThis.__measure());
const scrollTo = (v, y) =>
  page.evaluate(
    ([v, y]) => {
      const sc = document.querySelector(`.phone[data-v="${v}"] .scroll`);
      sc.scrollTop = y;
      sc.dispatchEvent(new Event('scroll'));
    },
    [v, y],
  );

const sticksOut = async (v, tag) => {
  const over = await phone(v).evaluate((ph) => {
    const r = ph.getBoundingClientRect();
    return [...ph.querySelectorAll('.bar *, .item *, .div *, .addbar *, .nav *, .trip-bar *, .handle-row *')]
      .filter((el) => el.getBoundingClientRect().width && !el.closest('.swipe-act') && !el.closest('.track'))
      .filter((el) => el.getBoundingClientRect().right > r.right + 0.5 || el.getBoundingClientRect().left < r.left - 0.5)
      .map((el) => `${el.className.baseVal ?? el.className} ${Math.round(el.getBoundingClientRect().left - r.left)}+${Math.round(el.getBoundingClientRect().width)}`)
      .slice(0, 2)
      .join(', ');
  });
  check(!over, `${v} ${tag}: something sticks out of the phone (${over})`);
};
const rows = [['data', 'text', 'lang', 'theme', 'where', ...table].join('\t')];
const bottoms = [['text', ...table].join('\t')];
const hideFs = () =>
  page.evaluate(() => {
    for (const b of document.querySelectorAll('.phone .fs-card [data-act="fs-hide"]')) b.click();
  });
for (const ts of ['100', '130'])
for (const data of ['shot', 'big'])
  for (const lang of ['de', 'en'])
    for (const theme of ['light', 'dark']) {
      await open({ lang, theme, data, ts }, 'every', 'round1');
      const m1 = await measure();
      for (const v of ids) check(m1[v].size === '390×844', `${v} phone is ${m1[v].size}, not 390×844`);
      for (const v of ids) await sticksOut(v, `${data}/${ts}/${lang}/${theme}`);
      await open({ lang, theme, data, ts });
      const m = await measure();
      rows.push([data, ts, lang, theme, 'top', ...table.map((v) => m[v].full)].join('\t'));
      if (data === 'shot' && lang === 'de' && theme === 'light') bottoms.push([ts, ...table.map((v) => m[v].bottomH ?? '')].join('\t'));
      if (ts === '100') await page.screenshot({ path: `${out}/grid-${data}-${lang}-${theme}.png`, fullPage: true });
      for (const v of ['today', 'LD1', ...r2, ...ss]) check(m[v].size === '390×844', `${v} phone is ${m[v].size}, not 390×844`);
      if (data === 'shot') {
        await hideFs();
        await settle();
        const f = await measure();
        rows.push([data, ts, lang, theme, 'first steps hidden', ...table.map((v) => f[v].full)].join('\t'));
      }
      for (const v of ['LD1', ...r2]) await sticksOut(v, `${data}/${ts}/${lang}/${theme}`);
      if (data === 'big') {
        for (const v of table) await scrollTo(v, 420);
        await page.waitForTimeout(400);
        await settle();
        const s = await measure();
        rows.push([data, ts, lang, theme, 'scrolled 420', ...table.map((v) => s[v].full)].join('\t'));
        if (lang === 'de' && theme === 'light' && ts === '100') await page.screenshot({ path: `${out}/grid-big-de-light-scrolled.png`, fullPage: true });
      }
    }
await open({ lang: 'de', theme: 'light', data: 'shot', trip: '1' });
{
  const m = await measure();
  rows.push(['shot', '100', 'de', 'light', 'trip running', ...table.map((v) => (['LD1', 'R2', 'BB4', 'LD4-3T'].includes(v) ? m[v].full : '-'))].join('\t'));
  await page.screenshot({ path: `${out}/grid-shot-de-light-trip.png`, fullPage: true });
}
writeFileSync(`${out}/items-visible.tsv`, `${rows.join('\n')}\n`);
writeFileSync(`${out}/bottom-height.tsv`, `${bottoms.join('\n')}\n`);

// One phone per variant for the PR and review, at the page's single view.
for (const data of ['shot', 'big'])
  for (const v of [...ids.slice(1), 'R2', ...ss, ...r2.slice(1)]) {
    await open({ lang: 'de', theme: 'light', data }, v);
    await page.locator('.single').screenshot({ path: `${out}/${v}-${data}-de-light.png` });
  }
await open({ lang: 'en', theme: 'dark', data: 'shot' }, 'today');
await phone('today').screenshot({ path: `${out}/today-shot-en-dark.png` });

// Reachability: every function from today's screen in every variant.
const fresh = async (v, lang = 'de') => {
  await open({ lang, theme: 'light', data: 'shot' }, v);
};
const click = async (v, sel) => {
  await phone(v).locator(`${sel} >> visible=true`).first().click();
  await settle();
};
const text = (v) => phone(v).innerText();
const closeSheet = async (v) => {
  await phone(v).locator('.scrim').click({ position: { x: 20, y: 20 } });
  await settle();
};
const L = { de: { edit: 'Läden', shop: 'Einmal einkaufen' }, en: { edit: 'Stores', shop: 'Do one shop' } };

for (const lang of ['de', 'en'])
  for (const v of ids) {
    const tag = `${v}/${lang}`;
    await fresh(v, lang);
    const opener = v === 'LD4' ? '.handle-row' : '[data-act="switch"]';
    await click(v, opener);
    check(await phone(v).locator('.sheet').isVisible(), `${tag}: list switcher sheet opens`);
    if (v === 'today') {
      await closeSheet(v);
      await click(v, '.tab[data-i="1"]');
    } else await click(v, '.sheet [data-act="list"][data-i="1"]');
    if (v === 'LD4') await closeSheet(v);
    check((await phone(v).locator('.tab.on, .stacked b, .ld4-title h2').allInnerTexts()).includes('Party'), `${tag}: list switch shows the picked list`);
    await fresh(v, lang);
    await click(v, opener);
    await click(v, '.sheet [data-act="hh"][data-i="1"]');
    if (await phone(v).locator('.scrim').count()) await closeSheet(v);
    check((await text(v)).includes('Oma & Opa'), `${tag}: household switch`);

    await fresh(v, lang);
    if (v === 'LD4') await click(v, '.handle-row');
    await click(v, '[data-act="edit"]');
    check((await text(v)).includes(L[lang].edit), `${tag}: Anpassen reachable`);

    await fresh(v, lang);
    if (v === 'LD4') await click(v, '.handle-row');
    if (await phone(v).locator('[data-sheet="fs"]').count()) await click(v, '[data-sheet="fs"]');
    check((await text(v)).includes(L[lang].shop), `${tag}: first steps card reachable`);
    await click(v, (await phone(v).locator('.sheet').count()) ? '.sheet [data-act="fs-hide"]' : '[data-act="fs-hide"]');
    if (await phone(v).locator('.scrim').count()) await closeSheet(v);
    check(!(await phone(v).locator('.fs-card, .fs-nudge, .fs-row, .dot-badge').count()), `${tag}: first steps hide`);

    await fresh(v, lang);
    check((await phone(v).locator('.mic').count()) > 0, `${tag}: mic`);
    const navOk = (await phone(v).locator('.nav').count()) > 0 || (await phone(v).locator('.dock-more').count()) > 0;
    check(navOk, `${tag}: nav or More reachable`);

    if (v === 'LD3') await click(v, '[data-act="shop"]');
    check((await phone(v).locator('.div .count, .trip-mid').count()) > 0, `${tag}: store count or trip progress shown`);
    if (v === 'LD4') await click(v, '.handle-row');
    check(/\d+[,.]\d\d/.test(await text(v)), `${tag}: a total amount shown`);
  }

// Price targets are as large as today's 48 px button: the hit test, not the drawn box, decides.
for (const [v, sel] of [['today', '.pchip'], ['LD1', '.pghost'], ['LD1', '.pchip'], ['LD3', '.pchip']]) {
  await fresh(v);
  if (v === 'LD3') await click(v, '[data-act="shop"]');
  const hit = await phone(v).locator(sel).first().evaluate((el, sel) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const at = (x, y) => !!document.elementFromPoint(x, y)?.closest(sel);
    return { w: Math.round(r.width), h: Math.round(r.height), edges: at(cx, cy - 23) && at(cx, cy + 23) && (sel !== '.pghost' || (at(cx - 23, cy) && at(cx + 23, cy))) };
  }, sel);
  check(hit.h >= 48 && (sel !== '.pghost' || hit.w >= 48) && hit.edges, `${v}: ${sel} tap target ${hit.w}×${hit.h}, wants 48 px`);
}

// Price entry per variant, ending with "3,50 €" somewhere on the phone.
const typePrice = async (v) => {
  const input = phone(v).locator('[data-price-for]').first();
  await input.fill('3,50');
  await input.press('Enter');
  await settle();
};
const tomaten = (v) => phone(v).locator('.item', { hasText: 'Tomaten' }).first();

await fresh('today');
await tomaten('today').locator('.pchip').click();
await typePrice('today');
check((await tomaten('today').innerText()).includes('3,50'), 'today: price via chip');

await fresh('LD1');
await tomaten('LD1').locator('.pghost').click();
await typePrice('LD1');
check((await tomaten('LD1').innerText()).includes('3,50'), 'LD1: price via € mark');

await fresh('LD2');
check(!(await tomaten('LD2').locator('.pchip').count()), 'LD2: no chip without a price');
await tomaten('LD2').click();
await settle();
check(await phone('LD2').locator('.snack').isVisible(), 'LD2: tick offers + Preis');
await phone('LD2').locator('.snack .fill').click();
await settle();
await typePrice('LD2');
check((await phone('LD2').locator('.total-row').innerText()).includes('19,39'), 'LD2: price after tick counts in the total');

await fresh('LD3');
check(!(await phone('LD3').locator('.pchip').count()), 'LD3: no chips while planning');
await phone('LD3').locator('.item', { hasText: 'Bananen' }).click();
await settle();
check(await phone('LD3').locator('.snack.prompt').isVisible(), 'LD3: first tick asks "Kaufst du gerade ein?"');
await phone('LD3').locator('[data-act="prompt-no"]').click();
await page.waitForTimeout(500);
await tomaten('LD3').click();
await settle();
check(!(await phone('LD3').locator('.snack.prompt').count()), 'LD3: declined prompt does not come back on the next tick');
await click('LD3', '[data-act="shop"]');
check(await phone('LD3').locator('.trip-bar').isVisible(), 'LD3: shop mode shows the trip bar');
await phone('LD3').locator('.item', { hasText: 'Milch' }).locator('.pchip').click();
await typePrice('LD3');
check((await phone('LD3').locator('.trip-bar').innerText()).includes('19,39'), 'LD3: trip bar carries the total');
await click('LD3', '[data-act="trip-end"]');
check(!(await phone('LD3').locator('.trip-bar').count()), 'LD3: end trip');

await fresh('LD4');
const box4 = await tomaten('LD4').boundingBox();
await page.mouse.move(box4.x + 100, box4.y + box4.height / 2);
await page.mouse.down();
await page.waitForTimeout(600);
await page.mouse.up();
await settle();
check(await phone('LD4').locator('.sheet [data-price-for]').isVisible(), 'LD4: hold opens the edit sheet with the price');
await typePrice('LD4');
check((await tomaten('LD4').innerText()).includes('3,50'), 'LD4: price as text in the row');

await fresh('LD5');
const box5 = await tomaten('LD5').boundingBox();
await page.mouse.move(box5.x + 300, box5.y + box5.height / 2);
await page.mouse.down();
await page.mouse.move(box5.x + 200, box5.y + box5.height / 2, { steps: 6 });
await page.mouse.up();
await settle();
check((await phone('LD5').locator('.item-wrap.swiped').count()) === 1, 'LD5: swipe shows the price action');
await phone('LD5').locator('.item-wrap.swiped .swipe-act').click();
await settle();
await typePrice('LD5');
check((await tomaten('LD5').innerText()).includes('3,50'), 'LD5: price via swipe');
check(!(await phone('LD5').locator('.item-wrap.swiped').count()), 'LD5: row closes after saving');

await open({ lang: 'de', theme: 'light', data: 'big' }, 'LD5');
await scrollTo('LD5', 600);
await scrollTo('LD5', 500);
await phone('LD5').locator('.quick-hdr.show').waitFor({ timeout: 1500 }).catch(() => {});
check(await phone('LD5').locator('.quick-hdr.show').isVisible(), 'LD5: scrolling up brings the header back');
await phone('LD5').screenshot({ path: `${out}/LD5-quick-return.png` });
await open({ lang: 'de', theme: 'light', data: 'big' }, 'LD2');
await scrollTo('LD2', 500);
await settle();
check(await phone('LD2').locator('.mini.pinned').isVisible(), 'LD2: header collapses to the mini bar');
await phone('LD2').screenshot({ path: `${out}/LD2-collapsed.png` });

// Typing survives the timers that re-render the phone.
await fresh('LD2');
await tomaten('LD2').click();
await settle();
await phone('LD2').locator('.snack .fill').click();
await phone('LD2').locator('[data-price-for]').pressSequentially('2,20');
await page.waitForTimeout(4500);
check((await phone('LD2').locator('[data-price-for]').inputValue()) === '2,20', 'LD2: a price being typed survives the snack timer');
await fresh('today');
await tomaten('today').locator('.pchip').click();
await phone('today').locator('[data-price-for]').pressSequentially('1,1');
await phone('today').locator('.mic').click();
await page.waitForTimeout(2200);
check((await phone('today').locator('[data-price-for]').inputValue()) === '1,1', 'today: a price being typed survives a toast');

// LD1 hands the total to the job 217 trip bar.
await fresh('LD1');
await phone('LD1').locator('.item', { hasText: 'Bananen' }).click();
await settle();
check(await phone('LD1').locator('.snack.prompt').isVisible(), 'LD1: first tick asks "Kaufst du gerade ein?"');
{
  const gap = await phone('LD1').evaluate((ph) => ph.querySelector('.total-strip').getBoundingClientRect().top - ph.querySelector('.snack.prompt').getBoundingClientRect().bottom);
  check(gap >= 8, `LD1: the prompt sits ${gap} px above the total strip, wants 8 or more`);
}
await phone('LD1').locator('[data-act="prompt-yes"]').click();
await settle();
check((await phone('LD1').locator('.trip-bar').count()) === 1 && (await phone('LD1').locator('.total-strip').count()) === 0, 'LD1: during a trip the trip bar replaces the total strip');
check((await phone('LD1').locator('.trip-mid').innerText()).includes('1 von 8'), 'LD1: trip progress counts from the snapshot');
await click('LD1', '[data-act="trip-end"]');
check((await phone('LD1').locator('.total-strip').count()) === 1, 'LD1: ending the trip brings the strip back');

// A mouse drag across a row does not tick it.
await fresh('LD1');
const drag = await tomaten('LD1').boundingBox();
await page.mouse.move(drag.x + 60, drag.y + drag.height / 2);
await page.mouse.down();
await page.mouse.move(drag.x + 200, drag.y + drag.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
check((await tomaten('LD1').count()) === 1, 'LD1: a mouse drag across a row does not tick it');

// LD5's quick-return header stays through a tick.
await open({ lang: 'de', theme: 'light', data: 'big' }, 'LD5');
await scrollTo('LD5', 600);
await scrollTo('LD5', 500);
await settle();
// A row on screen below the header, clicked where it is: a locator click would first scroll a hidden row into view,
// and that scroll hides the header (job 238 review 0: 1 in 20 runs failed).
const onScreen = await phone('LD5').evaluate((ph) => {
  const sc = ph.querySelector('.scroll').getBoundingClientRect();
  const top = ph.querySelector('.quick-hdr').getBoundingClientRect().bottom;
  const bottom = Math.min(sc.bottom, ph.querySelector('.bottom')?.getBoundingClientRect().top ?? sc.bottom);
  const r = [...ph.querySelectorAll('.item')].map((el) => el.getBoundingClientRect()).find((b) => b.top >= top && b.bottom <= bottom);
  return r && { x: r.left + r.width / 2, y: r.top + r.height / 2, scrollTop: ph.querySelector('.scroll').scrollTop };
});
check(onScreen, 'LD5: a row sits on screen below the quick-return header');
if (onScreen) {
  await page.mouse.click(onScreen.x, onScreen.y);
  await page.waitForTimeout(600);
  const after = await phone('LD5').evaluate((ph) => ph.querySelector('.scroll').scrollTop);
  check(await phone('LD5').locator('.quick-hdr.show').isVisible(), `LD5: quick-return header stays after a tick (scrollTop ${onScreen.scrollTop} -> ${after})`);
}

// Round 2: the five switcher sheets keep every action of today's household sheet and add list switching and management.
const at = (v, sel) => phone(v).locator(`${sel} >> visible=true`).first();
const header = async (v) => ({ hh: await phone(v).locator('.top .stacked small').innerText(), list: await phone(v).locator('.top .stacked b').innerText() });
const sheetText = (v) => phone(v).locator('.sheet').innerText();
const H = { de: { lists: 'Party', join: 'Mit Code beitreten', newHh: 'Neuer Haushalt', voice: 'Siri, Alexa & KI' }, en: { lists: 'Party', join: 'Join with a code', newHh: 'New household', voice: 'Siri, Alexa & AI' } };
const toHouseholds = async (v) => {
  if (v === 'SS3') await click(v, '.sheet [data-seg="hh"]');
  if (v === 'SS5') await click(v, '.sheet .back');
};
for (const lang of ['de', 'en'])
  for (const v of ss) {
    const tag = `${v}/${lang}`;
    await open({ lang, theme: 'light', data: 'shot', scen: 'many' }, v);
    await click(v, '.top [data-act="switch"]');
    check(await phone(v).locator('.sheet').isVisible(), `${tag}: the switcher opens the sheet`);
    await click(v, '.sheet [data-act="pick"][data-h="0"][data-l="1"]');
    check((await header(v)).list === 'Party' && !(await phone(v).locator('.sheet').count()), `${tag}: picking a list switches and closes`);
    await click(v, '.top [data-act="switch"]');
    await toHouseholds(v);
    const txt = await sheetText(v);
    for (const k of ['join', 'newHh', 'voice']) check(txt.includes(H[lang][k]), `${tag}: today's "${H[lang][k]}" is in the sheet`);
    check(txt.includes('Okafor-Weiss'), `${tag}: the pending join request is in the sheet`);
    check((await phone(v).locator('.sheet .tile [data-msg="toastInviteSheet"]').count()) >= 3, `${tag}: every household row keeps its invite button`);
    if (v === 'SS5') {
      await click(v, '.sheet [data-act="drill"][data-i="1"]');
      await click(v, '.sheet [data-act="pick"][data-h="1"][data-l="1"]');
    } else await click(v, '.sheet .tile[data-act="hh"][data-i="1"]');
    check((await header(v)).hh === 'Oma & Opa', `${tag}: household switch`);
    await open({ lang, theme: 'light', data: 'shot', scen: 'many' }, v);
    await click(v, '.top [data-act="switch"]');
    if (v === 'SS4') await click(v, '.sheet [data-act="page"]');
    await click(v, '.sheet [data-act="lmenu"][data-key="0:0"]');
    await click(v, '.sheet .lmenu [data-act="lmove"][data-d="1"]');
    const titles = await phone(v).locator('.sheet .tile.list .tile-title').allInnerTexts();
    check(titles[0] === 'Party' && (await header(v)).list !== 'Party', `${tag}: "Move down" reorders and keeps the shown list (${titles.slice(0, 2)})`);
    await click(v, '.sheet .lmenu [data-act="ldel"]');
    check(!(await phone(v).locator('.sheet .tile.list .tile-title').allInnerTexts()).includes(lang === 'de' ? 'Einkaufsliste' : 'Shopping list'), `${tag}: delete removes the list`);
    await click(v, `.sheet [data-act="lnew"]`);
    check((await header(v)).list === (lang === 'de' ? 'Neue Liste' : 'New list'), `${tag}: "New list" adds one and shows it`);
    await open({ lang, theme: 'light', data: 'shot', scen: 'one' }, v);
    await click(v, '.top [data-act="switch"]');
    await toHouseholds(v);
    check((await sheetText(v)).includes(H[lang].newHh), `${tag}: with one household "New household" is still reachable`);
  }

// Round 2 base in every phone: header layer, First steps as today, total row, three tabs, mic, keyboard, trip.
for (const lang of ['de', 'en'])
  for (const v of r2) {
    const tag = `${v}/${lang}`;
    await open({ lang, theme: 'light', data: 'big' }, v);
    const lay = await phone(v).evaluate((ph) => {
      const top = ph.querySelector('.top');
      const bg = getComputedStyle(top).backgroundColor;
      const rows = [...ph.querySelectorAll('.item')];
      const total = ph.querySelector('.scroll .total-row');
      const lastOpen = rows.at(-1);
      const recent = ph.querySelector('.recent');
      return {
        alpha: Number((bg.match(/[\d.]+(?=\)$)/) ?? ['1'])[0]),
        abs: getComputedStyle(top).position,
        under: ph.querySelector('.scroll').getBoundingClientRect().top <= top.getBoundingClientRect().top,
        totalAfterRows: !!total && !!lastOpen && total.getBoundingClientRect().top >= lastOpen.getBoundingClientRect().bottom,
        totalBeforeRecent: !recent || (total && total.getBoundingClientRect().bottom <= recent.getBoundingClientRect().top),
        fsCard: !!ph.querySelector('.scroll .fs-card .fs-step'),
      };
    });
    check(lay.abs === 'absolute' && lay.under && lay.alpha < 1, `${tag}: the header floats see-through over the list (alpha ${lay.alpha})`);
    check(lay.totalAfterRows && lay.totalBeforeRecent, `${tag}: the total is a row after the open items, above "recently used"`);
    check(lay.fsCard, `${tag}: First steps is today's card`);
    await scrollTo(v, 300);
    await settle();
    const fixed = await phone(v).evaluate((ph) => ph.querySelector('.top').getBoundingClientRect().top - ph.getBoundingClientRect().top);
    check(fixed === 0, `${tag}: the header stays put while scrolling (${fixed})`);

    await open({ lang, theme: 'light', data: 'shot' }, v);
    const tabs = await phone(v).locator('[data-act="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    check(tabs.length === 3 && tabs.join() === (lang === 'de' ? 'Liste,Verlauf,Mehr' : 'List,History,More'), `${tag}: three tabs (${tabs})`);
    const hits = await phone(v).evaluate((ph) => {
      const ok = (el, sel) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const same = (x, y) => document.elementFromPoint(x, y)?.closest(sel) === el;
        return same(cx, cy - 23) && same(cx, cy + 23) && same(cx - 23, cy) && same(cx + 23, cy);
      };
      return {
        tabs: [...ph.querySelectorAll('[data-act="tab"]')].map((t) => ok(t, '[data-act="tab"]') || `${Math.round(t.getBoundingClientRect().width)}×${Math.round(t.getBoundingClientRect().height)}`),
        mic: ok(ph.querySelector('.mic'), '.mic'),
      };
    });
    check(hits.tabs.every((h) => h === true), `${tag}: every tab is a 48 × 48 px target (${hits.tabs})`);
    check(hits.mic, `${tag}: the mic is a 48 × 48 px target`);
    await click(v, `[data-act="tab"][data-tab="log"]`);
    check((await text(v)).includes(lang === 'de' ? 'Verlauf' : 'History') && !(await phone(v).locator('.mic').count()), `${tag}: the History tab opens`);
    await click(v, `[data-act="tab"][data-tab="list"]`);
    check((await phone(v).locator('.mic').count()) === 1, `${tag}: back on the list the field is back`);

    await click(v, '.bottom [data-act="kb"]');
    const kb = await phone(v).evaluate((ph) => {
      const f = ph.querySelector('.addbar.kb-on .addfield').getBoundingClientRect();
      const k = ph.querySelector('.kbd').getBoundingClientRect();
      return { gap: Math.round(k.top - f.bottom), tabs: ph.querySelectorAll('.bottom [data-act="tab"]').length };
    });
    check(kb.gap >= 0 && kb.gap <= 40 && kb.tabs === 0, `${tag}: with the keyboard the field sits right above it (${kb.gap} px) and the tabs go`);
    await click(v, '[data-act="kb-close"]');
    check(!(await phone(v).locator('.kbd').count()), `${tag}: the keyboard closes`);

    await phone(v).locator('.item', { hasText: lang === 'de' ? 'Bananen' : 'Bananas' }).click();
    await settle();
    check(await phone(v).locator('.snack.prompt').isVisible(), `${tag}: first tick asks "shopping right now?"`);
    await click(v, '[data-act="prompt-yes"]');
    const tb = await phone(v).evaluate((ph) => {
      const t = ph.querySelector('.trip-bar')?.getBoundingClientRect();
      const b = [...ph.querySelectorAll('[data-bb]')].map((e) => e.getBoundingClientRect().top);
      return t ? Math.round(Math.min(...b) - t.bottom) : null;
    });
    check(tb != null && tb >= -1, `${tag}: the trip bar sits above the add field (${tb})`);
    await click(v, '[data-act="trip-end"]');
    check(!(await phone(v).locator('.trip-bar').count()), `${tag}: end trip`);
  }

// The app keeps all three tab labels at 130 % (shell.dart _Pill: 13 px labels, 330 px of room); BB4's hint fits at 100 %.
for (const lang of ['de', 'en']) {
  await open({ lang, theme: 'light', data: 'shot', ts: '130' }, 'bb');
  check(!(await page.locator('.pill-nav.three.crowded').count()), `${lang} 130 %: the tab pills keep their labels`);
  await open({ lang, theme: 'light', data: 'shot', ts: '100' }, 'bb');
  const cut = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.phone .bottom .hint')].map((h) => [h.closest('.phone').dataset.v, h.scrollWidth > h.clientWidth])));
  check(cut.BB4 === false, `${lang} 100 %: BB4's hint fits`);
  console.log(`hint cut at 100 % (${lang}):`, JSON.stringify(cut));
}
// How much taller each SS sheet is than today's, open on its first view.
for (const scen of ['two', 'many']) {
  await open({ lang: 'de', theme: 'light', data: 'shot', scen }, 'ss');
  const hs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.phone')].map((ph) => [ph.dataset.v, Math.round(ph.querySelector('.sheet-body')?.scrollHeight ?? 0)])));
  console.log(`sheet content height (${scen}):`, JSON.stringify(Object.fromEntries(Object.entries(hs).map(([k, v]) => [k, `${v} (${v - hs.today >= 0 ? '+' : ''}${v - hs.today})`]))));
}

// BB5: the tabs step aside while scrolling down and come back on the way up.
{
  await open({ lang: 'de', theme: 'light', data: 'big' }, 'BB5');
  const h0 = (await measure()).BB5.bottomH;
  for (const y of [100, 300, 500]) await scrollTo('BB5', y);
  await page.waitForTimeout(400);
  const h1 = (await measure()).BB5.bottomH;
  check(h1 < h0 - 40, `BB5: scrolling down shrinks the bottom (${h0} -> ${h1})`);
  await phone('BB5').screenshot({ path: `${out}/BB5-scrolled.png` });
  for (const y of [450, 400]) await scrollTo('BB5', y);
  await page.waitForTimeout(400);
  check((await measure()).BB5.bottomH === h0, 'BB5: scrolling up brings the tabs back');
}

// Nothing sticks out of the phone, sheets open, at every text size, with many lists and long names.
for (const ts of ['100', '130', '160'])
  for (const view of ['ss', 'bb', 'ld4']) {
    await open({ lang: 'de', theme: 'light', data: 'shot', scen: 'many', ts }, view);
    const over = await page.evaluate(() =>
      [...document.querySelectorAll('.phone')].flatMap((ph) => {
        const r = ph.getBoundingClientRect();
        return [...ph.querySelectorAll('.top *, .bottom *, .item *, .sheet *')]
          .filter((el) => el.getBoundingClientRect().width && !el.closest('.track') && !el.closest('.kbd'))
          .filter((el) => el.getBoundingClientRect().right > r.right + 0.5 || el.getBoundingClientRect().left < r.left - 0.5)
          .slice(0, 1)
          .map((el) => `${ph.dataset.v} ${el.className.baseVal ?? el.className}`);
      }),
    );
    check(!over.length, `${view} at ${ts} %: something sticks out of a phone (${over})`);
    if (ts !== '100') await page.screenshot({ path: `${out}/grid-${view}-many-${ts}.png`, fullPage: true });
  }
for (const [view, q] of [['ss', {}], ['ss', { scen: 'many' }], ['ss', { scen: 'one' }], ['ss', { theme: 'dark', lang: 'en' }], ['bb', {}], ['bb', { theme: 'dark', lang: 'en' }], ['ld4', {}]]) {
  await open({ lang: 'de', theme: 'light', data: 'shot', ...q }, view);
  await page.locator('.grid').screenshot({ path: `${out}/set-${view}-${Object.values(q).join('-') || 'de-light'}.png` });
}

await browser.close();

// Touch, as on Peter's phone: hold, LD5 swipe, LD4 handle drag.
const tb = await chromium.launch();
const tctx = await tb.newContext({ viewport: { width: 1400, height: 1500 }, hasTouch: true, locale: 'de-DE' });
const tp = await tctx.newPage();
const cdp = await tctx.newCDPSession(tp);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const topen = async (v) => {
  await tp.goto(`${pageOf(v)}?lang=de&theme=light&data=shot&n=${Math.random()}#/${v}`);
  await tp.waitForSelector('.phone');
  await tp.evaluate(() => document.fonts.ready);
};
for (const v of [...ids, 'R2', 'BB4', 'LD4-3T']) {
  await topen(v);
  const row = tp.locator(`.phone[data-v="${v}"] .item`, { hasText: 'Tomaten' }).first();
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await row.boundingBox();
  await touch('touchStart', b.x + 80, b.y + b.height / 2);
  await tp.waitForTimeout(650);
  await touch('touchEnd');
  await tp.waitForTimeout(400);
  check(await tp.locator(`.phone[data-v="${v}"] .sheet [data-price-for]`).isVisible(), `${v}: touch hold opens the edit sheet and it stays open`);
}
await topen('LD5');
{
  const row = tp.locator('.phone[data-v="LD5"] .item', { hasText: 'Tomaten' }).first();
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await row.boundingBox();
  const y = b.y + b.height / 2;
  await touch('touchStart', b.x + 300, y);
  for (const dx of [20, 40, 60, 80, 100]) await touch('touchMove', b.x + 300 - dx, y);
  await touch('touchEnd');
  await tp.waitForTimeout(300);
  check((await tp.locator('.phone[data-v="LD5"] .item-wrap.swiped').count()) === 1, 'LD5: touch swipe shows the price action');
}
await topen('LD4');
{
  const b = await tp.locator('.phone[data-v="LD4"] .handle-row').boundingBox();
  await touch('touchStart', b.x + 150, b.y + 10);
  for (const dy of [10, 25, 45, 70]) await touch('touchMove', b.x + 150, b.y + 10 - dy);
  await touch('touchEnd');
  await tp.waitForTimeout(300);
  check(await tp.locator('.phone[data-v="LD4"] .sheet').isVisible(), 'LD4: dragging the handle up opens the sheet');
}
// On a phone the page hides the fake status bar: LD5's quick header must sit flush on the list's top.
const np = await tctx.newPage();
await np.setViewportSize({ width: 390, height: 760 });
await np.goto(`${pageOf('LD5')}?lang=de&theme=light&data=big&n=${Math.random()}#/LD5`);
await np.waitForSelector('.phone');
for (const y of [600, 500]) {
  await np.evaluate((y) => {
    const sc = document.querySelector('.phone[data-v="LD5"] .scroll');
    sc.scrollTop = y;
    sc.dispatchEvent(new Event('scroll'));
  }, y);
  await np.waitForTimeout(100);
}
await np.waitForTimeout(300);
const off = await np.evaluate(() => {
  const ph = document.querySelector('.phone[data-v="LD5"]');
  return ph.querySelector('.quick-hdr.show').getBoundingClientRect().top - ph.querySelector('.scroll').getBoundingClientRect().top;
});
check(Math.abs(off) < 1, `LD5 at 390 px: the quick header sits ${off} px below the list top`);
// On a phone (390 × 664, about iOS Safari's visible height) every bottom area and every sheet's last action is on screen
// and reachable by touch on the phone alone (review 0, M1).
const mp = await tctx.newPage();
await mp.setViewportSize({ width: 390, height: 664 });
const mcdp = await tctx.newCDPSession(mp);
const mtouch = (type, x, y) => mcdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const mtap = async (x, y) => {
  await mtouch('touchStart', x, y);
  await mtouch('touchEnd');
  await mp.waitForTimeout(350);
};
const mswipeUp = async (x, y0, y1) => {
  await mtouch('touchStart', x, y0);
  for (let i = 1; i <= 8; i++) await mtouch('touchMove', x, y0 + ((y1 - y0) * i) / 8);
  await mtouch('touchEnd');
  await mp.waitForTimeout(500);
};
const mopen = async (q, view) => {
  await mp.goto(`${pageOf(view)}?${new URLSearchParams({ lang: 'de', theme: 'light', data: 'shot', ...q, n: String(Math.random()) })}#/${view}`);
  await mp.waitForSelector('.phone');
  await mp.evaluate(() => document.fonts.ready);
  await mp.waitForTimeout(300);
};
// Where `sel` is: on screen, and the hit test at its centre (and ±23 px for `wide === false`) lands on it.
const reach = (sel, full) =>
  mp.evaluate(
    ([sel, full]) => {
      const el = document.querySelector(sel);
      if (!el) return { ok: false, why: 'missing' };
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (r.top < 0 || r.bottom > innerHeight + 0.5) return { ok: false, why: `off screen ${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}`, cx, cy };
      const pts = full ? [[cx, cy], [cx, cy - 23], [cx, cy + 23], [cx - 23, cy], [cx + 23, cy]] : [[cx, cy]];
      const ok = pts.every(([x, y]) => document.elementFromPoint(x, y)?.closest(sel) === el);
      return { ok, why: ok ? '' : 'hit test misses', cx, cy };
    },
    [sel, full],
  );
for (const v of r2) {
  await mopen({}, v);
  const fit = await mp.evaluate(() => ({ bottom: document.querySelector('.phone').getBoundingClientRect().bottom, h: innerHeight, y: scrollY }));
  check(fit.bottom <= fit.h + 0.5 && fit.y === 0, `${v} at 390 × 664: the phone ends on screen (${Math.round(fit.bottom)} of ${fit.h})`);
  const field = await reach('.phone .bottom [data-act="kb"]', false);
  check(field.ok, `${v} at 390 × 664: the add field is reachable (${field.why})`);
  const mic = await reach('.phone .bottom .mic', true);
  check(mic.ok, `${v} at 390 × 664: the mic is a reachable 48 px target (${mic.why})`);
  for (const t of ['list', 'log', 'more']) {
    const r = await reach(`.phone [data-act="tab"][data-tab="${t}"]`, true);
    check(r.ok, `${v} at 390 × 664: the ${t} tab is a reachable 48 px target (${r.why})`);
  }
  const log = await reach('.phone [data-act="tab"][data-tab="log"]', true);
  await mtap(log.cx, log.cy);
  check((await mp.locator('.phone .tabpage').count()) === 1, `${v} at 390 × 664: a touch on History switches the tab`);
}
for (const v of ss) {
  await mopen({ scen: 'many' }, v);
  const sw = await reach('.phone .top [data-act="switch"]', false);
  await mtap(sw.cx, sw.cy);
  if (v === 'SS3') {
    const seg = await reach('.sheet [data-seg="hh"]', false);
    await mtap(seg.cx, seg.cy);
  }
  if (v === 'SS5') {
    const back = await reach('.sheet .back', false);
    await mtap(back.cx, back.cy);
  }
  let last = await reach('.sheet [data-msg="toastVoice"]', false);
  for (let i = 0; i < 10 && !last.ok; i++) {
    await mswipeUp(200, 600, 300);
    last = await reach('.sheet [data-msg="toastVoice"]', false);
  }
  check(last.ok && (await mp.evaluate(() => scrollY)) === 0, `${v} at 390 × 664: swipes on the sheet reach its last action (${last.why})`);
  if (last.ok) {
    await mtap(last.cx, last.cy);
    check((await mp.locator('.phone .toast').count()) === 1, `${v} at 390 × 664: a touch on the last action works`);
    check((await reach('.sheet [data-msg="toastVoice"]', false)).ok, `${v} at 390 × 664: the sheet keeps its scroll place after the tap`);
  }
  if (v === 'SS4') await mp.screenshot({ path: `${out}/phone-390x664-SS4-sheet-end.png` });
}
await mopen({}, 'BB4');
await mp.screenshot({ path: `${out}/phone-390x664-BB4.png` });
// The recommendations fit the phone's width: no sideways pan for every line (review 1, M1).
for (const lang of ['de', 'en'])
  for (const view of ['rec', 'rec1']) {
    await mp.goto(`${pageOf(view)}?lang=${lang}&n=${Math.random()}#/${view}`);
    await mp.waitForSelector('.rec h2');
    const w = await mp.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: innerWidth, text: Math.max(...[...document.querySelectorAll('.rec > :not(table)')].map((e) => e.getBoundingClientRect().right)) }));
    check(w.page <= w.screen && w.text <= w.screen, `#/${view} ${lang} at 390 × 664: fits the screen (page ${w.page}, text to ${Math.round(w.text)} of ${w.screen})`);
  }

await tb.close();
console.log(rows.join('\n'));
if (errors.length) console.log('page errors:', errors);
check(!errors.length, `no page errors (${errors.length})`);
if (failures.length) {
  console.log(`FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('all checks passed');
