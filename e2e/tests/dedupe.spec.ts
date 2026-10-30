// Job 32b (Spec #8 AC9, AC11): adding "Karotten" while "Möhren" is open adds it and shows
// "Möhren steht schon auf der Liste" with Zusammenführen. Ignoring keeps two items; merging keeps
// one with the summed quantity (server-side, one transaction), and Rückgängig brings both back
// exactly, also for the partner who synced the merge.
import { expect, test } from './fixtures';
import {
  actionSnackBar, addItem, addSheet, apiAs, closeSheet, createInviteCode, enterItem, itemRow, joinWithCode, newEmail,
  screenshot, signUp, signUpWithHousehold,
} from './helpers';

const hint = (page: import('@playwright/test').Page) => actionSnackBar(page, 'Möhren steht schon auf der Liste');

async function openItems(email: string): Promise<[string, string | null][]> {
  const api = await apiAs(email);
  const { data, error } = await api.from('items').select('name, quantity, created_at').eq('status', 'active')
    .order('created_at');
  if (error) throw error;
  return data!.map((r) => [r.name, r.quantity]);
}

test('DEDUPE HINT: Karotten with Möhren open is added; ignoring the hint keeps both', async ({ browser }) => {
  const email = newEmail('dedupe-ignore');
  const page = await (await browser.newContext()).newPage();
  await signUpWithHousehold(page, email);
  await addItem(page, '500 g Möhren');
  await enterItem(page, '1 kg Karotten');

  // While the sheet is open the hint is in its note, under what was added.
  await expect(addSheet(page).getByRole('button', { name: 'Zusammenführen' })).toBeVisible();
  await screenshot(page, '32b-00-hint-in-sheet');
  // Closing the sheet hands it to a snackbar over the list.
  await closeSheet(page);
  await expect(hint(page)).toBeVisible();
  await expect(hint(page).getByRole('button', { name: 'Zusammenführen' })).toBeVisible();
  await expect(itemRow(page, 'Karotten'), 'the add went through by default').toBeVisible();
  await screenshot(page, '32b-01-hint');

  // Ignored: the hint goes by itself and both items stay, text as typed.
  await expect(hint(page)).toHaveCount(0, { timeout: 15_000 });
  await expect(itemRow(page, 'Möhren')).toBeVisible();
  await expect(itemRow(page, 'Karotten')).toBeVisible();
  expect(await openItems(email)).toEqual([['Möhren', '500 g'], ['Karotten', '1 kg']]);
  await screenshot(page, '32b-02-ignored-two-items');
});

test('DEDUPE HINT: Zusammenführen keeps one Möhren with 1,5 kg; Rückgängig brings Karotten back, also for the partner', async ({ browser }) => {
  const email = newEmail('dedupe-merge');
  const peter = await (await browser.newContext()).newPage();
  await signUpWithHousehold(peter, email);
  const code = await createInviteCode(peter);
  const lea = await (await browser.newContext()).newPage();
  await signUp(lea, newEmail('dedupe-lea'));
  await joinWithCode(lea, code);
  // Partner rows read "Neu" until seen (job 16).
  const leaRow = (name: string, quantity: string) => new RegExp(`^${name} ${quantity}( Neu)?$`);

  const api = await apiAs(email);
  const karotten = async () =>
    (await api.from('items').select('id, name, quantity, added_by, created_at, category_id, sort_key')
      .eq('name', 'Karotten').maybeSingle()).data;
  await addItem(lea, '1 Bund Petersilie');
  await addItem(peter, '500 g Möhren');
  await expect(itemRow(lea, 'Möhren')).toBeVisible();
  await addItem(peter, '1 kg Karotten');
  await expect(hint(peter)).toBeVisible();
  // One quick read while the hint shows (six seconds): Karotten as the server has it.
  const before = await karotten();
  expect(before).toMatchObject({ name: 'Karotten', quantity: '1 kg' });

  await hint(peter).getByRole('button', { name: 'Zusammenführen' }).click();
  const merged = actionSnackBar(peter, 'Zusammengeführt: 1,5 kg Möhren');
  await expect(merged).toBeVisible();
  await expect(itemRow(peter, 'Karotten')).toHaveCount(0);
  await expect(itemRow(peter, 'Möhren')).toHaveAccessibleName(/^Möhren 1,5 kg$/);
  await expect(itemRow(lea, 'Karotten'), 'the partner sees one item').toHaveCount(0);
  await expect(itemRow(lea, 'Möhren')).toHaveAccessibleName(leaRow('Möhren', '1,5 kg'));
  expect(await openItems(email)).toEqual([['Petersilie', '1 Bund'], ['Möhren', '1,5 kg']]);
  await screenshot(peter, '32b-03-merged-one-item');
  await screenshot(lea, '32b-04-merged-partner');

  await merged.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(itemRow(peter, 'Karotten')).toBeVisible();
  await expect(itemRow(peter, 'Möhren')).toHaveAccessibleName(/^Möhren 500 g$/);
  await expect(itemRow(lea, 'Karotten'), 'the undo reaches the partner too').toBeVisible();
  await expect(itemRow(lea, 'Möhren')).toHaveAccessibleName(leaRow('Möhren', '500 g'));
  expect(await openItems(email)).toEqual([['Petersilie', '1 Bund'], ['Möhren', '500 g'], ['Karotten', '1 kg']]);
  expect(await karotten(), 'Karotten is back exactly: id, text, quantity, author, time, category, place')
    .toEqual(before);
  await screenshot(peter, '32b-05-undo-two-items');

  // Units that do not convert: the open item keeps its text and notes the other quantity.
  await addItem(lea, '1 Bund Mohrrüben');
  const leaHint = actionSnackBar(lea, 'Möhren steht schon auf der Liste');
  await leaHint.getByRole('button', { name: 'Zusammenführen' }).click();
  await expect(itemRow(lea, 'Mohrrüben')).toHaveCount(0);
  await expect(itemRow(lea, 'Möhren')).toHaveAccessibleName(leaRow('Möhren', '500 g \\+ 1 Bund'));
  await expect(itemRow(peter, 'Möhren')).toHaveAccessibleName(/^Möhren 500 g \+ 1 Bund( Neu)?$/);
  await screenshot(lea, '32b-06-merged-note');
});
