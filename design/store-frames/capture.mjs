#!/usr/bin/env node
// Captures the six app screens the frame proposals show, from the real Snacklist web build on this
// checkout's verify-snacklist instance (launch.sh --scenario store-frames: „Unser Haushalt“, Anna
// and Jonas, generic stores only, Legal N-23). Writes raw/de-DE/<scene>.png at 1080 x 2400 and
// raw/de-DE/meta.json: per scene the rows its caption points at (`lift`), the top of the floating
// add bar or tab bar (`chrome`, frames never cut below it) and, for the sync scene, the band lifted
// out of the partner's phone (`sender`), all in capture pixels.
//
//   .claude/skills/verify-snacklist/helpers/launch.sh --scenario store-frames --fresh
//   node design/store-frames/capture.mjs
//
// The page clock is fake and paused for each frame (job 65's method): a frame is "N ms after the
// tap", the caret is always off, and the add highlight is caught at the same moment every run.
// The list and sync scenes add items, so run it on a fresh seed.
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addField, addSheet, apiAs, chromium, instance, itemRow, labels, member, openTab, signIn, typeInto } from '../../.claude/skills/verify-snacklist/helpers/lib.mjs';
import { LOCALE } from './shots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'raw', LOCALE);
const VIEWPORT = { width: 432, height: 960 };
const DPR = 2.5;
const APP_ORIGIN = 'https://app.snacklist.app';
const L = labels('de');
const inst = instance();

// The invite page runs at the app's origin, so the link reads app.snacklist.app as on the phones;
// its requests to the local stack need Chromium's local network checks off.
const browser = await chromium.launch({
  args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'],
});
const errors = [];

async function open(handle, { appOrigin = false } = {}) {
  const origin = appOrigin ? APP_ORIGIN : inst.webUrl;
  const context = await browser.newContext({
    baseURL: origin,
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  if (appOrigin) {
    await context.route(`${APP_ORIGIN}/**`, async (route) => {
      const { pathname, search } = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${inst.webUrl}${pathname}${search}` }) });
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${handle}: ${e.message}`));
  const start = Date.now();
  await page.clock.install({ time: start });
  await signIn(page, L, member(inst, handle));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await park(page);
  return Object.assign(page, { clockStart: start });
}

// Fake requestAnimationFrame fires every 16 ms from the install time: stop on that grid.
async function pause(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(page.clockStart + Math.ceil((now + 1000 - page.clockStart) / 16) * 16);
}
const step = (page, ms) => page.clock.runFor(ms);
// The resting pointer: a hover near the right edge shows the web build's scrollbar, which no
// phone has, so it waits in the bottom-left corner, beside the tab bar.
const park = (page) => page.mouse.move(2, VIEWPORT.height - 2);
async function stepUntil(page, locator, settle) {
  const end = Date.now() + 20_000;
  while (!(await locator.isVisible().catch(() => false))) {
    if (Date.now() > end) throw new Error(`${locator} did not show`);
    await step(page, 16);
    await new Promise((r) => setTimeout(r, 15));
  }
  await step(page, settle);
}
// A key restarts the caret's 500 ms blink, so 750 ms later it is off.
async function caretOff(page) {
  await page.keyboard.press('End');
  await step(page, 750);
}

async function box(locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`${locator} has no box`);
  return b;
}
const px = (b) => ({ y: [Math.floor(b.y * DPR), Math.ceil((b.y + b.height) * DPR)], x: [Math.floor(b.x * DPR), Math.ceil((b.x + b.width) * DPR)] });
const span = (boxes) => {
  const p = boxes.map(px);
  return { y: [Math.min(...p.map((b) => b.y[0])), Math.max(...p.map((b) => b.y[1]))], x: [Math.min(...p.map((b) => b.x[0])), Math.max(...p.map((b) => b.x[1]))] };
};
const tabBar = (page) => page.getByRole('tablist');
async function chromeTop(page, withAddBar = true) {
  const tops = [(await box(tabBar(page))).y];
  if (withAddBar && (await addField(page, L).isVisible().catch(() => false))) tops.push((await box(addField(page, L))).y);
  return Math.floor(Math.min(...tops) * DPR) - 24;
}

async function storeId(api, name) {
  const { data, error } = await api.from('stores').select('id').eq('name', name).single();
  if (error) throw error;
  return data.id;
}

const meta = {};
mkdirSync(OUT, { recursive: true });
const shot = async (page, scene, extra) => {
  await page.screenshot({ path: join(OUT, `${scene}.png`) });
  meta[scene] = { raw: `${scene}.png`, ...extra };
  console.log(`${scene}: ${JSON.stringify(meta[scene])}`);
};

// tick: Anna taps Milch; 180 ms later the strike-through has crossed the name and the clock
// never reaches the commit, so the list stays as seeded.
{
  const page = await open('anna');
  await pause(page);
  await caretOff(page);
  // The web build's scrollbar fades out a while after the last pointer move.
  await step(page, 2000);
  const row = itemRow(page, 'Milch');
  const lift = await box(row);
  await row.click();
  await step(page, 180);
  await shot(page, 'tick', { lift: span([lift]), chrome: await chromeTop(page) });

  // add: „3 Jogh“ typed into the add sheet; the household's past trips suggest „3× Joghurt“.
  await page.context().close();
}
{
  const page = await open('anna');
  await typeInto(addField(page, L), '3 Jogh');
  const sheet = addSheet(page, L);
  await sheet.getByRole('button', { name: /Joghurt/ }).first().waitFor();
  await page.waitForTimeout(400);
  await pause(page);
  await page.keyboard.press('End');
  await step(page, 300);
  await shot(page, 'add', { lift: span([await box(sheet)]), chrome: Math.floor(VIEWPORT.height * DPR) });
  await page.context().close();
}

// order: Anpassen → Supermarkt, its categories in walking order, Kühlregal held mid-drag.
{
  const page = await open('anna');
  await page.getByRole('button', { name: L('listEdit') }).click();
  await page.getByRole('button', { name: 'Supermarkt', exact: true }).click();
  await page.getByText(L('dragCategory', { name: 'Kühlregal' })).waitFor();
  await page.waitForTimeout(600);
  const handle = await box(page.getByText(L('dragCategory', { name: 'Kühlregal' })));
  const hx = handle.x + handle.width / 2;
  const hy = handle.y + handle.height / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(hx, hy + i * 4.5);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(500);
  await pause(page);
  await step(page, 400);
  const held = await box(page.getByRole('button', { name: 'Kühlregal', exact: true }));
  await shot(page, 'order', { lift: span([held]), chrome: await chromeTop(page) });
  await page.context().close();
}

// invite: Mehr → Partner einladen → Neue Einladung: the code and the link the phones share.
{
  const page = await open('anna', { appOrigin: true });
  await openTab(page, L, 'tabMore');
  await page.getByRole('button', { name: L('inviteMember') }).click();
  const create = page.getByRole('button', { name: L('newInvite') });
  await create.click();
  await create.blur();
  const revoke = page.getByRole('button', { name: new RegExp(`^${L('inviteRevokeLabel', { code: '[A-Z0-9]{8}' })}$`) });
  await revoke.first().waitFor();
  await park(page);
  await page.waitForTimeout(600);
  await pause(page);
  await step(page, 500);
  const card = await box(page.getByText(new RegExp(`^${L('inviteCodeLabel')} [A-Z0-9]{8}`)).first());
  await shot(page, 'invite', { lift: span([card, await box(revoke.first())]), chrome: await chromeTop(page, false) });
  await page.context().close();
}

// list: Jonas's list 0.8 s after Anna added two items at the market in one statement: the rows
// are tinted honey under „2 neu von Anna“.
const anna = member(inst, 'anna');
const annaApi = await apiAs(inst, anna);
{
  const page = await open('jonas');
  await pause(page);
  const market = await storeId(annaApi, 'Wochenmarkt');
  const names = ['Erdbeeren', 'Radieschen'];
  const { error } = await annaApi.from('items').insert(names.map((name) => ({ household_id: anna.householdId, name, store_id: market, status: 'active' })));
  if (error) throw error;
  await stepUntil(page, page.getByText(L('newItemsFrom', { count: 2, name: anna.name })), 800);
  await caretOff(page);
  await shot(page, 'list', { lift: span(await Promise.all(names.map((n) => box(itemRow(page, n))))), chrome: await chromeTop(page) });
  await page.context().close();
}

// sync: Jonas adds Kaffee from his add sheet, which confirms the store it remembered from past
// trips („Kaffee → Supermarkt“); Anna's list shows it tinted. The frame is Anna's phone with Jonas's confirmation lifted out of his.
{
  const page = await open('anna');
  const jonas = await open('jonas');
  await pause(page);
  await typeInto(addField(jonas, L), 'Kaffee');
  await jonas.keyboard.press('Enter');
  const sheet = addSheet(jonas, L);
  const confirm = sheet.getByText(new RegExp(`${L('addedTo', { name: 'Kaffee', store: 'Supermarkt' })}`));
  await confirm.waitFor();
  await pause(jonas);
  await caretOff(jonas);
  const text = await box(confirm);
  const undo = await box(jonas.getByRole('button', { name: L('undo'), exact: true }));
  const sheetBox = await box(sheet);
  const top = Math.min(text.y, undo.y) - 6;
  const bottom = Math.max(text.y + text.height, undo.y + undo.height) + 6;
  await jonas.screenshot({ path: join(OUT, 'sync-sender.png') });
  await stepUntil(page, page.getByText(L('newItemsFrom', { count: 1, name: member(inst, 'jonas').name })), 300);
  const row = itemRow(page, 'Kaffee');
  await step(page, 300);
  await caretOff(page);
  await shot(page, 'sync', {
    lift: span([await box(row)]),
    chrome: await chromeTop(page),
    sender: { raw: 'sync-sender.png', ...px({ x: sheetBox.x + 8, y: top, width: sheetBox.width - 16, height: bottom - top }) },
  });
  await jonas.context().close();
  await page.context().close();
}

await browser.close();
writeFileSync(join(OUT, 'meta.json'), `${JSON.stringify(meta, null, 1)}\n`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`raw captures: ${OUT}`);
