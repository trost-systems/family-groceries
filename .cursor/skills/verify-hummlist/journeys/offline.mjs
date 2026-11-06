// Feature offline, sub-feature offline-queue with quick-add's amounts (job 104): lines typed with
// the browser offline are split on the device. Adds each line offline, syncs, then adds it again
// online, and proves both stored the same name and Menge (supabase/tests/quantity_parse.tsv).
//
//   node journeys/offline.mjs <evidence dir> [--lang de|en] [--lines "zwei Gurken|Karotten drei"]
import process from 'node:process';
import { addField, addSheet, apiAs, capture, instance, logger, member, openApp, signIn, typeInto } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const opt = (name, def) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : def);
const lang = opt('lang', 'de');
const lines = opt('lines', 'zwei Gurken|Karotten drei|zwölf Eier|ein halbes Brot|two lemons|Drei Glocken Spaghetti').split('|');
if (!dir) throw new Error('usage: offline.mjs <evidence dir> [--lang de|en] [--lines "a|b"]');

const log = logger(dir);
const inst = instance();
const user = member(inst);
const api = await apiAs(inst, user);
const { browser, context, page, L, errors } = await openApp(inst, { lang, videoDir: dir });
const initial = new Set((await api.from('items').select('id').eq('household_id', user.householdId)).data.map((r) => r.id));
const known = new Set(initial);
const fresh = async () => {
  const { data, error } = await api.from('items').select('id, name, quantity, status')
    .eq('household_id', user.householdId).order('created_at');
  if (error) throw error;
  return data.filter((r) => !known.has(r.id));
};
const settled = async (count, what) => {
  for (let i = 0; i < 80; i++) {
    const rows = await fresh();
    if (rows.length >= count) return rows;
    await page.waitForTimeout(500);
  }
  throw new Error(`${what}: expected ${count} new rows, found ${(await fresh()).length}. A line whose item is already open is not added twice; give lines that parse to different items`);
};
/** Adds every line; online, waits for each line's row, so rows pair with lines by line. */
const addAll = async ({ online }) => {
  const rows = [];
  for (const line of lines) {
    await typeInto(addField(page, L), line);
    await page.keyboard.press('Enter');
    if (online) {
      rows.push((await settled(rows.length + 1, `"${line}"`)).at(-1));
    } else {
      // Offline, Enter waits up to 3 s for the server before it takes the device's row.
      await page.waitForTimeout(3_500);
    }
  }
  await addSheet(page, L).getByRole('button', { name: L('close'), exact: true }).click();
  await addSheet(page, L).waitFor({ state: 'detached', timeout: 10_000 });
  return rows;
};
let failed = null;
try {
  await signIn(page, L, user);
  await context.setOffline(true);
  await page.getByText(/^Offline:/).first().waitFor({ timeout: 15_000 }).catch(() => {});
  log(`offline as ${user.handle}; adding ${lines.length} lines`);
  await addAll({ online: false });
  await capture(page, dir, '01-added-offline');
  await context.setOffline(false);
  // Synced in the order they were added, so the rows pair with the lines by position.
  const offline = await settled(lines.length, 'offline adds after the sync');
  for (const row of offline) known.add(row.id);
  await capture(page, dir, '02-synced');
  const { error } = await api.from('items').delete().in('id', offline.map((r) => r.id));
  if (error) throw error;
  await page.waitForTimeout(2_000);

  log('online; adding the same lines');
  const online = await addAll({ online: true });
  await capture(page, dir, '03-added-online');
  const table = lines.map((line, i) => [line, offline[i], online[i]]);
  for (const [line, off, on] of table) {
    log(`"${line}": offline ${off.name} | ${off.quantity ?? '-'}; online ${on.name} | ${on.quantity ?? '-'}`);
  }
  const differ = table.filter(([, off, on]) => off.name !== on.name || off.quantity !== on.quantity);
  if (differ.length) throw new Error(`offline and online differ for: ${differ.map(([l]) => l).join(', ')}`);
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  const { data } = await api.from('items').select('id').eq('household_id', user.householdId);
  const left = (data ?? []).map((r) => r.id).filter((id) => !initial.has(id));
  if (left.length) await api.from('items').delete().in('id', left);
  await context.close();
  await browser.close();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS offline amounts match online (evidence: ${dir})`);
