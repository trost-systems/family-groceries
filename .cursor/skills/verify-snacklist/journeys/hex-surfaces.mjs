// Features list-manage, stores-walk-order and edit-item: the hex surfaces in one pass, for
// before/after evidence of the shared hex widgets (job 148). The list's top bar at rest and with
// rows scrolled under it, „Läden“, one store's category order and the edit sheet with its name
// field focused. Adds two generic stores first and deletes them after (no retailer names, N-23).
//
//   node journeys/hex-surfaces.mjs <evidence dir> [--lang de|en] [--dark]
import process from 'node:process';
import { apiAs, capture, instance, itemRow, logger, member, openApp, reveal, signIn } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'de';
const dark = rest.includes('--dark');
if (!dir) throw new Error('usage: hex-surfaces.mjs <evidence dir> [--lang de|en] [--dark]');

const log = logger(dir);
const inst = instance();
const user = member(inst);
const api = await apiAs(inst, user);
const storeNames = lang === 'de' ? ['Wochenmarkt', 'Bäckerei'] : ['Farmers market', 'Bakery'];
for (const name of storeNames) {
  const { error } = await api.rpc('add_store', { p_household: user.householdId, p_name: name });
  if (error) throw error;
}
const { browser, page, L, errors } = await openApp(inst, { lang, dark });
let failed = null;
try {
  await signIn(page, L, user);
  await page.waitForTimeout(600);
  await capture(page, dir, '01-list-top');

  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(600);
  await capture(page, dir, '02-list-scrolled');
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(400);

  const edit = page.getByRole('button', { name: L('listEdit'), exact: true });
  const box = await edit.boundingBox();
  log(`Anpassen box ${JSON.stringify(box)}`);
  await edit.click();
  await page.getByRole('button', { name: new RegExp(storeNames[0]) }).first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await capture(page, dir, '03-stores');

  await page.getByRole('button', { name: new RegExp(storeNames[0]) }).first().click();
  await page.waitForTimeout(700);
  await capture(page, dir, '04-store-categories');

  // The back button's tooltip, still up after the first click, renames it for a moment.
  const back = async () => {
    await page.getByRole('button', { name: lang === 'de' ? 'Zurück' : 'Back', exact: true }).click();
    await page.mouse.move(195, 600);
    await page.waitForTimeout(1_500);
  };
  await back();
  await back();

  const row = itemRow(page, lang === 'de' ? 'Vollmilch' : 'Milk').first();
  await reveal(page, row);
  await row.click({ button: 'right' });
  await page.waitForTimeout(700);
  await capture(page, dir, '05-edit-sheet');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  for (const name of storeNames) {
    const { data } = await api.from('stores').select('id').eq('household_id', user.householdId).eq('name', name);
    for (const { id } of data ?? []) await api.rpc('delete_store', { p_store: id });
  }
  await browser.close();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log('PASS');
