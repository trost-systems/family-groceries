// Feature quick-add, entry point: the add bar, a typed prefix and a tap on a catalogue suggestion
// (sub-features qa-sheet, qa-rows, qa-tap-row, qa-added, qa-close). Proves the item lands under
// its category heading in the list and as an active row in the household's items.
//
//   node journeys/quick-add.mjs <evidence dir> [--lang de|en] [--prefix Joghu]
import { accessibleName, addField, addSheet, apiAs, capture, headingAbove, instance, itemRow, logger, member, openApp, reveal, signIn, typeInto } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const opt = (name, def) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : def);
const lang = opt('lang', 'de');
const prefix = opt('prefix', lang === 'de' ? 'Joghu' : 'Ched');
if (!dir) throw new Error('usage: quick-add.mjs <evidence dir> [--lang de|en] [--prefix text]');

const log = logger(dir);
const inst = instance();
const user = member(inst);
const api = await apiAs(inst, user);
const { browser, page, L, errors } = await openApp(inst, { lang, videoDir: dir });
let failed = null;
try {
  await signIn(page, L, user);
  log(`signed in as ${user.handle} (${lang}) on ${inst.webUrl}`);
  await capture(page, dir, '01-list-before');

  await typeInto(addField(page, L), prefix);
  const catalogRow = addSheet(page, L).getByRole('button', { name: new RegExp(`, ${L('suggestionCatalog')}(,|$)`) }).first();
  await catalogRow.waitFor({ timeout: 10_000 });
  const rows = (await addSheet(page, L).ariaSnapshot()).split('\n').filter((l) => l.includes(`, `)).map(accessibleName);
  const label = accessibleName(await catalogRow.ariaSnapshot());
  const name = label.split(', ')[0].replace(/^\S+× |^\d\S* /, '');
  log(`typed "${prefix}": first catalogue row "${label}" (rows: ${rows.join(' | ')})`);
  await capture(page, dir, '02-suggestions');

  await catalogRow.click();
  const note = addSheet(page, L).getByText(new RegExp(`^✓ ${L('addedItem', { name: '' }).trim()} ${name}`));
  await note.waitFor({ timeout: 10_000 });
  log(`note: "${await note.textContent()}"`);
  await capture(page, dir, '03-added-note');

  await addSheet(page, L).getByRole('button', { name: L('close'), exact: true }).click();
  await addSheet(page, L).waitFor({ state: 'detached', timeout: 10_000 });
  await reveal(page, itemRow(page, name).first());
  const heading = await headingAbove(page, itemRow(page, name).first());
  log(`list: "${name}" sits under the heading "${heading}"`);
  await capture(page, dir, '04-list-after');

  const { data, error } = await api.from('items').select('name, status, added_by, categories(name)')
    .eq('household_id', user.householdId).eq('name', name).eq('status', 'active');
  if (error) throw error;
  log(`database: ${JSON.stringify(data)}`);
  if (data.length !== 1) throw new Error(`expected one active "${name}" in the household, found ${data.length}`);
  if (data[0].added_by !== user.id) throw new Error(`added_by is ${data[0].added_by}, not ${user.handle}`);
  if (lang === 'de' && data[0].categories?.name !== heading) {
    throw new Error(`the list shows "${name}" under "${heading}", the database files it under "${data[0].categories?.name}"`);
  }
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  await page.context().close();
  await browser.close();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS quick-add (evidence: ${dir})`);
