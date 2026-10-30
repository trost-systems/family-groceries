import { expect, test } from './fixtures';
import { deleteItem, dragItemTo, expectGroup } from './catalog';
import { addItem, apiAs, itemRow, newEmail, openEdit, pickInSheet, reveal, saveEdit, screenshot, signUpWithHousehold, tick } from './helpers';

test('CLASSIFIER-LEARNING: add -> X, move -> Y, re-add -> Y, in this household only', async ({ browser }) => {
  const peterEmail = newEmail('learn');
  const peter = await (await browser.newContext()).newPage();
  await signUpWithHousehold(peter, peterEmail);

  await addItem(peter, 'Hafermilch');
  await expectGroup(peter, 'Hafermilch', 'Kühlregal');
  // Design H shows a category only with items in it, so a drink gives Getränke its divider.
  await addItem(peter, 'Apfelsaft');
  await expectGroup(peter, 'Apfelsaft', 'Getränke');
  await dragItemTo(peter, 'Hafermilch', 'Getränke');
  await expectGroup(peter, 'Hafermilch', 'Getränke');
  await screenshot(peter, '01-dragged-to-getraenke');
  await deleteItem(peter, 'Hafermilch');
  await addItem(peter, '2 Hafermilch');
  await expectGroup(peter, 'Hafermilch', 'Getränke');

  await addItem(peter, 'Zahnbürste');
  await expectGroup(peter, 'Zahnbürste', '👶 Drogerie');
  await openEdit(peter, 'Zahnbürste');
  await pickInSheet(peter, 'Kategorie', 'Haushalt');
  await saveEdit(peter);
  await expectGroup(peter, 'Zahnbürste', 'Haushalt');
  await tick(peter, 'Zahnbürste');
  await addItem(peter, 'Zahnbürsten');
  await expectGroup(peter, 'Zahnbürsten', 'Haushalt');
  await screenshot(peter, '02-relearned-after-readd');

  const api = await apiAs(peterEmail);
  const { data: household } = await api.from('households').select('id').single();
  await tick(peter, 'Hafermilch');
  await expect(itemRow(peter, 'Hafermilch')).toHaveCount(0);
  await expect.poll(async () => {
    const { data } = await api.from('items').select('status').eq('name', 'Hafermilch');
    return data?.map((r) => r.status);
  }, { message: 'the tick reached the server, so add_items adds anew' }).toEqual(['bought']);
  const { data: added, error } = await api.rpc('add_items', {
    p_household: household!.id,
    p_names: ['Hafermilch', '1 Packung Kaffee'],
  });
  expect(error).toBeNull();
  expect(added.map((i: { name: string; quantity: string | null }) => [i.name, i.quantity]))
    .toEqual([['Hafermilch', null], ['Kaffee', '1 Packung']]);
  await expectGroup(peter, 'Hafermilch', 'Getränke');

  const lea = await (await browser.newContext()).newPage();
  await signUpWithHousehold(lea, newEmail('other-household'));
  await addItem(lea, 'Hafermilch');
  await addItem(lea, 'Zahnbürste');
  await expectGroup(lea, 'Hafermilch', 'Kühlregal');
  await expectGroup(lea, 'Zahnbürste', '👶 Drogerie');
  await screenshot(lea, '03-other-household-unaffected');
});

test('seed dictionary spot checks: compounds, plurals, quantities, umlauts', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('seed'));
  const expected: Record<string, string> = {
    'Vollkornbrot': 'Brot & Backwaren',
    'Schlagsahne': 'Kühlregal',
    '6 Eier': 'Kühlregal',
    'Rinderhack': 'Fleisch/Wurst/Fisch',
    'Kichererbsen': 'Vorrat & Konserven',
    'Gummibärchen': 'Süßes & Snacks',
    'Apfelschorle': 'Getränke',
    'Fischstäbchen': 'Tiefkühl',
    'Spülmaschinentabs': 'Haushalt',
    'Windeln Größe 4': '👶 Drogerie',
    'Aepfel 2 kg': 'Obst & Gemüse',
    'Quietscheentchen': 'Sonstiges',
  };
  for (const item of Object.keys(expected)) await addItem(page, item);
  // The last add sits at the end of the list, below the fold: scroll to it like a user.
  await reveal(page, itemRow(page, 'Quietscheentchen'));
  for (const [input, group] of Object.entries(expected)) {
    const name = input.replace(/^\d+ /, '').replace(/ \d+ kg$/, '');
    await expectGroup(page, name, group);
  }
  await screenshot(page, '04-seed-dictionary');
});

test('SPELLING VARIANTS (job 32a): typos, regional and English words land with the word they mean', async ({ browser }) => {
  const email = newEmail('variants');
  const peter = await (await browser.newContext()).newPage();
  await signUpWithHousehold(peter, email);
  const expected: Record<string, [group: string, via: string]> = {
    'Karrotten': ['Obst & Gemüse', 'exact'],
    'Paradeiser': ['Obst & Gemüse', 'synonym'],
    'Semmeln': ['Brot & Backwaren', 'exact'],
    'Mlich': ['Kühlregal', 'fuzzy'],
    'Schokolde': ['Süßes & Snacks', 'fuzzy'],
    'toilet paper': ['Haushalt', 'synonym'],
  };
  for (const item of Object.keys(expected)) await addItem(peter, item);
  for (const [item, [group]] of Object.entries(expected)) await expectGroup(peter, item, group);
  await screenshot(peter, '32a-01-variants-in-their-groups');

  // The text stays as typed; the server noted how it found each category (analytics only).
  const api = await apiAs(email);
  const { data: rows } = await api.from('items').select('name, categorized_via').in('name', Object.keys(expected));
  expect(Object.fromEntries(rows!.map((r) => [r.name, r.categorized_via])))
    .toEqual(Object.fromEntries(Object.entries(expected).map(([item, [, via]]) => [item, via])));

  // A correction of the typo holds for the word's synonyms and spellings, in this household only.
  await openEdit(peter, 'Karrotten');
  await pickInSheet(peter, 'Kategorie', 'Getränke');
  await saveEdit(peter);
  await expectGroup(peter, 'Karrotten', 'Getränke');
  await addItem(peter, 'Möhren');
  await expectGroup(peter, 'Möhren', 'Getränke');
  await screenshot(peter, '32a-02-correction-holds-for-moehren');

  const lea = await (await browser.newContext()).newPage();
  await signUpWithHousehold(lea, newEmail('variants-other'));
  await addItem(lea, 'Möhren');
  await expectGroup(lea, 'Möhren', 'Obst & Gemüse');
  await screenshot(lea, '32a-03-other-household-unaffected');
});
