// Job 64b: an add the server skips because the item is already open (job 64's one open item per
// name) shows the open item instead of vanishing: an offline add replayed after another phone added
// the same item. (The undone delete case left with the sheet's Löschen, job 149.)
import { expect, test } from './fixtures';
import { addItem, apiAs, cutOff, itemRow, newEmail, offlineIndicator, signUpWithHousehold, tick } from './helpers';

async function otherPhone(email: string) {
  const api = await apiAs(email);
  const { data: household, error } = await api.from('households').select('id').single();
  if (error) throw error;
  return {
    add: async (name: string, quantity?: string) => {
      const { error } = await api.from('items').insert({ household_id: household.id, name, quantity });
      if (error) throw error;
    },
    items: async () => (await api.from('items').select('name, status').order('name')).data,
  };
}

test('an offline add and tick replayed after another phone added the item tick that item', async ({ page }) => {
  const email = newEmail('replay');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Brot');
  const connection = await cutOff(page);
  await addItem(page, 'Butter');
  await tick(page, 'Butter');
  await expect(itemRow(page, 'Butter')).toHaveCount(0);
  const phone = await otherPhone(email);
  await phone.add('Butter');

  await connection.restore();
  await expect.poll(() => phone.items(), { message: 'the queued add and tick reach the server', timeout: 20_000 })
    .toEqual([{ name: 'Brot', status: 'active' }, { name: 'Butter', status: 'bought' }]);
  await expect(offlineIndicator(page)).toHaveCount(0, { timeout: 15_000 });
  await expect(itemRow(page, 'Brot')).toBeVisible();
  await expect(itemRow(page, 'Butter'), 'the tick made offline ticked the Butter that was there').toHaveCount(0);
});
