// Feature stores-walk-order, sub-feature sw-rows: the row icons of a mixed list (job 147). Puts the
// household's open items away, adds a mix of groceries, drugstore, household, DIY and gift items
// and films the list in light and dark at the 390 px phone width. Then answers the remote table's
// URL with a newer table (revision 999: Wattepads ⚪) and checks the app asked once, a plain GET
// without names, and shows the remote icon. No pass may load Noto Sans Symbols 2: its monochrome
// glyphs took 🐕 and 🪴 next to ⚪ until the app laid out every table emoji at start.
//
//   node journeys/item-icons.mjs <evidence dir> [--lang de|en] [--remote-revision n]
import process from 'node:process';
import { apiAs, capture, instance, itemRow, logger, member, openApp, signIn } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const opt = (name, def) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : def);
const lang = opt('lang', 'de');
// --remote-revision 1 (not above the bundled one) must FAIL: the app ignores that file.
const remoteRevision = Number(opt('remote-revision', '999'));
if (!dir) throw new Error('usage: item-icons.mjs <evidence dir> [--lang de|en] [--remote-revision n]');

const names = [
  'Bananen', 'Vollmilch', 'Kartoffelsalat', 'Ingwer', 'Geschenkkarte', 'Gutschein', 'Ohrenstäbchen',
  'Wattepads', 'Paracetamol', 'Hundefutter', 'Schrauben', 'Batterien', 'Blumenerde', 'Klebezettel',
];

const log = logger(dir);
const inst = instance();
const user = member(inst);
const api = await apiAs(inst, user);
const put = await api.from('items').update({ status: 'bought' }).eq('household_id', user.householdId).eq('status', 'active');
if (put.error) throw put.error;
const added = await api.from('items').insert(names.map((name) => ({ household_id: user.householdId, name })));
if (added.error) throw added.error;
log(`added ${names.length} items: ${names.join(', ')}`);

/** The leading 56 px of a row, where its icon sits, as PNG bytes. */
async function iconCell(page, name) {
  const box = await itemRow(page, name).first().boundingBox();
  if (!box) throw new Error(`no row ${name} on screen`);
  return page.screenshot({ clip: { x: box.x, y: box.y, width: 56, height: box.height } });
}

let failed = null;
let bundledCell = null;
for (const dark of [false, true]) {
  const { browser, page, L, errors } = await openApp(inst, { lang, dark });
  const fonts = [];
  page.on('requestfinished', async (request) => {
    if (!request.url().includes('/fonts/')) return;
    const size = (await request.sizes().catch(() => null))?.responseBodySize ?? 0;
    fonts.push(`${request.url().split('/fonts/')[1].split('/')[0]} ${Math.round(size / 1024)} KB`);
  });
  try {
    await signIn(page, L, user);
    const tip = page.getByRole('button', { name: L('tipDismiss'), exact: true });
    if (await tip.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await tip.click();
    for (const name of names) await itemRow(page, name).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    log(`${dark ? 'dark' : 'light'}: every row is on the list; fonts fetched: ${fonts.join(', ')}`);
    if (fonts.some((f) => f.startsWith('notosanssymbols2'))) throw new Error('an emoji went to the monochrome Noto Sans Symbols 2');
    await capture(page, dir, `mixed-list-${dark ? 'dark' : 'light'}`);
    await page.mouse.move(195, 420);
    await page.mouse.wheel(0, 600);
    await page.mouse.move(2, 300);
    await page.waitForTimeout(800);
    await capture(page, dir, `mixed-list-${dark ? 'dark' : 'light'}-2`);
    if (!dark) bundledCell = await iconCell(page, 'Wattepads');
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  } catch (error) {
    failed = error;
    await capture(page, dir, '99-failure').catch(() => {});
  } finally {
    await browser.close();
  }
}
const remoteUrl = 'https://snacklist.app/data/item-icons.v1.json';
if (!failed) {
  const { browser, context, page, L, errors } = await openApp(inst, { lang });
  const requests = [];
  const fonts = [];
  page.on('requestfinished', async (request) => {
    if (!request.url().includes('/fonts/')) return;
    const size = (await request.sizes().catch(() => null))?.responseBodySize ?? 0;
    fonts.push(`${request.url().split('/fonts/')[1].split('/')[0]} ${Math.round(size / 1024)} KB`);
  });
  await context.route(remoteUrl, (route) => {
    const request = route.request();
    requests.push(`${request.method()} ${request.url()} ${JSON.stringify(request.headers())}`);
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ schema: 1, revision: remoteRevision, entries: { wattepads: '⚪' } }),
    });
  });
  try {
    await signIn(page, L, user);
    const tip = page.getByRole('button', { name: L('tipDismiss'), exact: true });
    if (await tip.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await tip.click();
    await itemRow(page, 'Wattepads').first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    log(`remote pass fonts fetched: ${fonts.join(', ')}`);
    if (fonts.some((f) => f.startsWith('notosanssymbols2'))) throw new Error('an emoji went to the monochrome Noto Sans Symbols 2');
    log(`remote table requests: ${requests.length ? requests.join(' | ') : 'none'}`);
    if (requests.length !== 1) throw new Error(`expected one request for ${remoteUrl}, saw ${requests.length}`);
    if (!requests[0].startsWith('GET ')) throw new Error('the remote table is not a plain GET');
    if (names.some((name) => requests[0].toLowerCase().includes(name.toLowerCase()))) throw new Error('the request names an item');
    await page.mouse.wheel(0, 600);
    await page.mouse.move(2, 300);
    await page.waitForTimeout(800);
    await capture(page, dir, 'remote-table-light');
    if (bundledCell?.equals(await iconCell(page, 'Wattepads'))) {
      throw new Error('Wattepads looks as with the bundled table: the remote ⚪ did not apply');
    }
    log('the Wattepads icon cell differs from the bundled table\'s (the remote ⚪)');
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  } catch (error) {
    failed = error;
    await capture(page, dir, '99-failure').catch(() => {});
  } finally {
    await browser.close();
  }
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS item-icons (evidence: ${dir})`);
