// Job 64b: an add the server skips because the item is already open (job 64's one open item per
// name) shows the open item instead of vanishing: an undone delete and an offline add replayed after
// another phone added the same item.
import { expect, test, type Page } from './fixtures';
import {
  addItem, apiAs, cutOff, editSheet, itemRow, newEmail, openEdit, screenshot, signUpWithHousehold, supabaseUrl, tick,
} from './helpers';

/** Realtime stays subscribed but drops item changes, as on a phone whose channel went quiet. */
async function muteItemChanges(page: Page): Promise<void> {
  await page.routeWebSocket(new RegExp(`^ws://${new URL(supabaseUrl).host}/`), (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as unknown;
      const event = Array.isArray(frame) ? frame[3] : (frame as { event?: string }).event;
      if (event !== 'postgres_changes') ws.send(message);
    });
  });
}

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

test('undoing a delete while another phone put the item back shows that item', async ({ page }) => {
  const email = newEmail('undo');
  await muteItemChanges(page);
  await signUpWithHousehold(page, email);
  await addItem(page, '2 Milch');
  await expect(itemRow(page, 'Milch')).toHaveAccessibleName('Milch 2');

  await openEdit(page, 'Milch');
  await editSheet(page).getByRole('button', { name: 'Löschen' }).click();
  await expect(itemRow(page, 'Milch')).toHaveCount(0);
  await (await otherPhone(email)).add('Milch', '1 l');
  await page.getByRole('button', { name: 'Rückgängig' }).click();

  await expect(itemRow(page, 'Milch'), 'the undo shows the open Milch, as it is').toHaveAccessibleName('Milch 1 l');
  await screenshot(page, '64b-undo-shows-open-item');
  await page.reload();
  await expect(itemRow(page, 'Milch'), 'one Milch on the server').toHaveCount(1);
});

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
  await expect(page.getByText(/^Offline:/)).toHaveCount(0, { timeout: 15_000 });
  await expect(itemRow(page, 'Brot')).toBeVisible();
  await expect(itemRow(page, 'Butter'), 'the tick made offline ticked the Butter that was there').toHaveCount(0);
});
