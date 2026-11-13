// Drives the six scenarios through TM1..TM5 (Premium and Free), checks state, layout and copy,
// and writes contact sheets. Exits 1 on any failed check.
// Usage: node shoot.mjs <page-url> <out-dir> [playwright-module-dir]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import process from 'node:process';

const [url, out, pwDir = `${process.env.HOME}/family-groceries/e2e/node_modules/`] = process.argv.slice(2);
const { chromium } = createRequire(pwDir)('playwright');
mkdirSync(`${out}/raw`, { recursive: true });

const TMS = ['TM1', 'TM2', 'TM3', 'TM4', 'TM5'];
const browser = await chromium.launch();
const failures = [];
const fail = (msg) => failures.push(msg);
const check = (cond, msg) => { if (!cond) fail(msg); };

async function newPage(viewport = { width: 900, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin', hasTouch: viewport.width < 440 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && fail(`console: ${m.text()}`));
  return page;
}

async function start(page, tm, scen, premium = true) {
  await page.goto(`${url}?tm=${tm}`);
  await page.evaluate(([scen, premium]) => { tm217.setup(scen, { ...tm217.state, premium }); tm217.render(); }, [scen, premium]);
  await page.evaluate(() => document.fonts.ready);
}

// Nothing of the trip may cover the add field, the tabs or the keyboard, and every control in
// the bottom area is at least 44 × 44 px.
async function layout(page, label) {
  const issues = await page.evaluate(() => {
    const r = (el) => el && el.getBoundingClientRect();
    const hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const field = r(document.querySelector('.addfield'));
    const nav = r(document.querySelector('.nav'));
    const kb = r(document.querySelector('.kb'));
    const out = [];
    for (const sel of ['.strip-bar', '.float-wrap', '.lap-bar', '.lap-thin', '.toast:not(.top)', '.popover']) {
      for (const el of document.querySelectorAll(`.bottom ${sel}`)) {
        const b = r(el);
        if (hit(b, field)) out.push(`${sel} covers the add field`);
        if (hit(b, nav)) out.push(`${sel} covers the tabs`);
        if (hit(b, kb)) out.push(`${sel} covers the keyboard`);
      }
    }
    if (field && kb && field.bottom > kb.top + 1) out.push('add field under the keyboard');
    const phone = r(document.querySelector('#phone'));
    for (const el of document.querySelectorAll('.bottom button, .page button, .sheet button, .prompt button, .endcard button, .row.asking button, .os-banner button, .trip-card button')) {
      const b = r(el);
      if (b.width === 0) continue;
      if (b.height < 43.5 || b.width < 43.5) out.push(`small target "${el.textContent.trim() || el.getAttribute('aria-label')}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      if (b.right > phone.right + 1 || b.left < phone.left - 1) out.push(`"${el.textContent.trim()}" sticks out of the phone`);
    }
    if (/€|\d+,\d\d/.test(document.querySelector('#phone').innerText)) out.push('a price shows');
    return out;
  });
  for (const i of issues) fail(`${label}: ${i}`);
}

const text = (page) => page.locator('#phone').innerText();
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(tm217.state)));

async function runScenario(page, tm, scenId, premium, shots) {
  await start(page, tm, scenId, premium);
  const steps = await page.evaluate((id) => {
    const sc = tm217.scenarios.find((x) => x.id === id);
    return sc.steps.map((st) => ({ label: st.label, shot: st.shot ?? null, reload: Boolean(st.reload) }));
  }, scenId);
  const seen = [];
  for (const [i, st] of steps.entries()) {
    if (st.reload) {
      await Promise.all([page.waitForEvent('load'), page.evaluate(() => tm217.runStep())]);
      await page.waitForTimeout(900);
    } else {
      await page.evaluate(() => { tm217.runStep(); tm217.render(); });
    }
    await page.waitForTimeout(80);
    const label = `${tm}${premium ? '' : ' Free'} ${scenId} step ${i + 1} (${st.label})`;
    await layout(page, label);
    seen.push({ i, label, text: await text(page), state: await state(page) });
    if (st.shot) {
      const file = `${out}/raw/${tm}-${scenId}${premium ? '' : '-free'}-${i + 1}-${st.shot}.png`;
      await page.locator('#phone').screenshot({ path: file });
      shots.push({ tm, scen: scenId, step: i + 1, shot: st.shot, file, premium });
    }
  }
  return seen;
}

const shots = [];
const page = await newPage();
const has = (t, s) => t.toLowerCase().includes(s.toLowerCase());
const near = (a, iso) => Math.abs(a - Date.parse(iso)) < 30_000;
const promptText = { TM1: 'Kaufst du gerade ein?', TM2: 'Kaufst du gerade ein?', TM3: 'Kaufst du gerade ein?', TM4: 'Bist du gerade bei Lidl?', TM5: 'Gekauft, Einkauf starten' };

for (const tm of TMS) {
  // S1 single store.
  let r = await runScenario(page, tm, 'S1', true, shots);
  check(has(r[0].text, promptText[tm]), `${tm} S1: the first tick asks (${promptText[tm]})`);
  check(r[1].state.trip && r[1].state.trip.snapshot.length === 6, `${tm} S1: the snapshot holds the 6 open items before the tick, Bananen included`);
  check(near(r[1].state.trip.startedAt, '2026-11-14T10:00:00+01:00'), `${tm} S1: the trip starts at the tick (10:00)`);
  check(has(r[3].text, '7:0'), `${tm} S1: the stopwatch shows 7 minutes`);
  const s1 = r[6].state.history[0];
  check(s1.planned.length === 6 && s1.planned.filter((x) => x.bought).length === 4, `${tm} S1: 4 of 6 planned bought`);
  check(s1.added.length === 1 && s1.added[0].name === 'Eis' && s1.added[0].by === null, `${tm} S1: Eis is extra, no "von"`);
  check(Math.round(s1.durationMs / 60000) === 25, `${tm} S1: 25 minutes`);
  check(has(r[6].text, '4 von 6') || tm === 'TM5', `${tm} S1: the summary says 4 von 6`);
  if (tm === 'TM5') check(has(r[6].text, 'Einkauf beendet') && has(r[6].text, '4 von 6 geplant gekauft'), 'TM5 S1: the end card on the list');
  check(has(r[7].text, 'Beim Start auf der Liste') && has(r[7].text, 'Seit dem Start dazugekommen'), `${tm} S1: the history entry opens the summary`);

  // S2 two stores.
  r = await runScenario(page, tm, 'S2', true, shots);
  check(r[2].state.trip.pauses.length === 1, `${tm} S2: paused for the drive`);
  const s2 = r[4].state.history[0];
  check(Math.round(s2.durationMs / 60000) === 18, `${tm} S2: 18 minutes without the 15-minute drive (got ${Math.round(s2.durationMs / 60000)})`);
  check(s2.planned.filter((x) => x.bought).length === 7, `${tm} S2: 7 of 8 planned bought across two stores`);
  check(has(r[4].text, tm === 'TM3' ? 'Lidl + Rewe' : 'Lidl, Rewe') || tm === 'TM5', `${tm} S2: the summary names both stores`);
  if (tm === 'TM4') {
    check(r[3].state.trip.segments.map((g) => g.store).join() === 'Lidl,Rewe', 'TM4 S2: laps Lidl then Rewe');
    check(has(r[3].text, 'Lidl') && has(r[3].text, 'Rewe'), 'TM4 S2: the bar shows both laps');
    check(has(r[4].text, '12 Min.') && has(r[4].text, '6 Min.'), 'TM4 S2: the summary shows 12 Min. at Lidl and 6 Min. at Rewe');
  }

  // S3 app killed and reopened.
  r = await runScenario(page, tm, 'S3', true, shots);
  check(r[1].state.trip && near(r[1].state.trip.startedAt, '2026-11-14T10:00:00+01:00'), `${tm} S3: the trip survives the restart`);
  check(has(r[1].text, '17:0'), `${tm} S3: the stopwatch reads 17 min after reopening (7 + 10 closed)`);
  if (tm === 'TM2') check(has(r[1].text, 'Einkauf läuft noch'), 'TM2 S3: "Einkauf läuft noch" after reopening');
  check(r[2].state.history[0].planned.filter((x) => x.bought).length === 3, `${tm} S3: 3 bought after the restart`);

  // S4 Lea adds items mid-trip.
  r = await runScenario(page, tm, 'S4', true, shots);
  check(has(r[1].text, 'neu · Lea'), `${tm} S4: Lea's items are marked on the list`);
  const s4 = r[2].state.history[0];
  const milch = s4.added.find((x) => x.name === 'Milch');
  const eier = s4.added.find((x) => x.name === 'Eier');
  check(milch && milch.by === 'Lea' && milch.bought, `${tm} S4: Milch is extra, von Lea, bought`);
  check(eier && eier.by === 'Lea' && !eier.bought, `${tm} S4: Eier von Lea, not bought`);
  if (tm !== 'TM5') check(has(r[2].text, 'von Lea'), `${tm} S4: the summary says "von Lea"`);
  check(r[3].state.history[0].markedPlanned.includes(milch.id), `${tm} S4: "War geplant" marks Milch`);
  if (tm !== 'TM5') check(/Beim Start auf der Liste\s*7/i.test(r[3].text), `${tm} S4: Milch moved into the planned part (7)`);

  // S5 left running for hours.
  r = await runScenario(page, tm, 'S5', true, shots);
  const longText = { TM1: 'Noch beim Einkaufen?', TM2: 'Einkauf automatisch beendet', TM3: 'Einkauf läuft seit 4 Std.', TM4: 'Noch bei Lidl?', TM5: 'Einkauf um 10:06 beendet' }[tm];
  check(has(r[1].text, longText), `${tm} S5: after 4 h it shows "${longText}"`);
  const s5 = r[2].state.history[0];
  check(Math.round(s5.durationMs / 60000) === 6 && near(s5.endedAt, '2026-11-14T10:06:00+01:00'), `${tm} S5: ends at the last tick, 6 minutes`);

  // S6 accidental tick, then no.
  r = await runScenario(page, tm, 'S6', true, shots);
  check(has(r[0].text, promptText[tm].replace('Lidl', 'Lidl')), `${tm} S6: the accidental tick asks`);
  check(!r[1].state.trip && !r[1].state.prompt, `${tm} S6: "no" starts nothing`);
  check(!r[2].state.prompt, `${tm} S6: the next tick does not ask again`);
  const asksLater = { TM1: true, TM2: false, TM3: true, TM4: false, TM5: true }[tm];
  check(Boolean(r[3].state.prompt) === asksLater, `${tm} S6: 3 h later it ${asksLater ? 'asks' : 'stays quiet'}`);

  // Free: the Premium gate on S1's summary.
  r = await runScenario(page, tm, 'S1', false, shots);
  const gateText = {
    TM1: 'Geplant und gekauft mit Snacklist Premium', TM2: 'Was war geplant, was kam dazu?',
    TM3: 'Diese Übersicht zeigen wir dir einmal so', TM4: 'Einkauf beendet · 25 Min.', TM5: 'Übersicht',
  }[tm];
  check(has(r[6].text, gateText), `${tm} Free: the end shows "${gateText}"`);
  if (tm === 'TM4') check(has(r[7].text, 'Geplant und gekauft pro Laden siehst du mit Snacklist Premium'), 'TM4 Free: the history entry is locked');
  if (tm === 'TM5') check(has(r[7].text, 'Welche das waren, zeigt Snacklist Premium') && has(r[7].text, '4 von 6'), 'TM5 Free: counts free, names locked');
  if (tm === 'TM1') check(has(r[7].text, 'Snacklist Premium ansehen'), 'TM1 Free: history entry gated too');
  if (tm === 'TM3') {
    await page.locator('.trip-row').nth(1).click();
    await page.waitForTimeout(80);
    check(has(await text(page), 'Geplant und gekauft siehst du mit Snacklist Premium'), 'TM3 Free: an older trip is locked');
    await page.locator('#phone').screenshot({ path: `${out}/raw/TM3-S1-free-9-older-locked.png` });
    shots.push({ tm, scen: 'S1', step: 9, shot: 'older-locked', file: `${out}/raw/TM3-S1-free-9-older-locked.png`, premium: false });
  }
}

// TM2's "Zurücknehmen" and TM5's undo take the accidental tick back without a "no".
for (const [tm, sel] of [['TM2', 'button:has-text("Zurücknehmen")'], ['TM5', '[aria-label="Rückgängig"]'], ['TM3', '.toast.ask button:has-text("Rückgängig")']]) {
  await start(page, tm, 'S6');
  await page.locator('[data-act="tick"]', { hasText: 'Spülmittel' }).click();
  await page.locator(sel).click();
  const st = await state(page);
  check(st.items.find((i) => i.name === 'Spülmittel').doneAt === null && !st.quiet && !st.prompt, `${tm}: undo takes the tick back and asks again next time`);
}

// TM3: an ignored question goes after 6 s and counts as "no".
await start(page, 'TM3', 'S6');
await page.locator('[data-act="tick"]', { hasText: 'Spülmittel' }).click();
await page.waitForTimeout(6300);
{
  const st = await state(page);
  check(!st.prompt && st.quiet && st.quiet.asked === 1, 'TM3: the question goes by itself after 6 s');
}

// Peter's phone: one phone fills the screen, the strip steps the scenario, nothing overlaps.
const phonePage = await newPage({ width: 390, height: 844 });
for (const tm of TMS) {
  await start(phonePage, tm, 'S1');
  for (let i = 0; i < 5; i++) {
    await phonePage.locator('.strip-step button').click();
    await phonePage.waitForTimeout(60);
    await layout(phonePage, `${tm} phone step ${i + 1}`);
  }
  const vis = await phonePage.evaluate(() => {
    const f = document.querySelector('.addfield').getBoundingClientRect();
    return f.bottom <= innerHeight && f.top > 92;
  });
  check(vis, `${tm} phone: the add field is on screen above the keyboard`);
  await phonePage.screenshot({ path: `${out}/raw/${tm}-phone-keyboard.png` });
}
await phonePage.locator('[data-act="panel"]').first().click();
check(await phonePage.locator('.panel').isVisible(), 'phone: the menu opens the panel');
await phonePage.screenshot({ path: `${out}/raw/phone-panel.png` });

// Contact sheets: one per scenario, a row per prototype.
async function sheet(file, rows, title) {
  const cols = Math.max(...rows.map((r) => r.length));
  const cells = rows.map((row) => `<div class="tm">${row[0].tm}</div>${row.map((s) => `<figure><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}"><figcaption>${s.step}. ${s.shot}</figcaption></figure>`).join('')}${'<span></span>'.repeat(cols - row.length)}`).join('');
  const p = await browser.newPage({ viewport: { width: 220 * cols + 60, height: 600 } });
  await p.setContent(`<style>body{margin:0;padding:12px;font:600 14px sans-serif;background:#f4f1ea}h1{font-size:18px;margin:0 0 8px}
    .g{display:grid;grid-template-columns:40px repeat(${cols},210px);gap:8px;align-items:start}.tm{writing-mode:vertical-rl;transform:rotate(180deg);font-size:16px;align-self:center}
    figure{margin:0}img{width:210px;display:block}figcaption{font-size:12px;padding-top:2px}</style><h1>${title}</h1><div class="g">${cells}</div>`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
}
const titles = { S1: 'S1 Ein Laden', S2: 'S2 Zwei Läden', S3: 'S3 App beendet und wieder geöffnet', S4: 'S4 Lea schreibt dazu', S5: 'S5 Stunden später', S6: 'S6 Aus Versehen abgehakt, dann Nein' };
for (const scen of Object.keys(titles)) {
  await sheet(`${out}/${scen}.png`, TMS.map((tm) => shots.filter((s) => s.tm === tm && s.scen === scen && s.premium)), `Job 217 · ${titles[scen]}`);
}
await sheet(`${out}/free-gate.png`, TMS.map((tm) => shots.filter((s) => s.tm === tm && !s.premium && ['summary', 'history', 'older-locked'].includes(s.shot))), 'Job 217 · Free: das Premium-Tor (S1)');

await browser.close();
if (failures.length) {
  console.log(`FAILED ${failures.length}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`all checks passed, ${shots.length} shots`);
