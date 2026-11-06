// Job 114 (vmaint-20261105 #12): renaming Apfelsaft to „Mineralwasser“ while Mineralwasser is open
// leaves one open Mineralwasser, as an add of that name would. Online the app folds it at once; a
// rename the server refuses because another phone's copy got there first (made offline, or the
// other phone renamed first) folds into that copy once the list shows it.
import { expect, test, type Page } from './fixtures';
import {
  addItem, apiAs, cutOff, editField, itemRow, newEmail, openEdit, saveEdit, screenshot, signUpWithHousehold,
  supabaseUrl, typeInto,
} from './helpers';

const merged = (page: Page) => page.getByRole('group', { name: /^Zusammengeführt: / });

/** Realtime stays subscribed but drops item changes, so the other phone's write is not shown yet. */
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
    rename: async (from: string, to: string) => {
      const { error } = await api.from('items').update({ name: to }).eq('name', from).eq('status', 'active');
      if (error) throw error;
    },
    open: async () =>
      (await api.from('items').select('name, quantity').eq('status', 'active').order('name')).data,
  };
}

async function rename(page: Page, from: string, to: string): Promise<void> {
  await openEdit(page, from);
  await typeInto(editField(page, 'Bezeichnung'), to);
  await saveEdit(page);
}

test('RENAME: Apfelsaft renamed to Mineralwasser while it is open leaves one Mineralwasser', async ({ page }) => {
  const email = newEmail('rename-open');
  await signUpWithHousehold(page, email);
  await addItem(page, '6 Mineralwasser');
  await addItem(page, '2 Apfelsaft');
  const phone = await otherPhone(email);

  await rename(page, 'Apfelsaft', 'Mineralwasser');
  await expect(merged(page)).toBeVisible();
  await expect(itemRow(page, 'Mineralwasser')).toHaveCount(1);
  await expect(itemRow(page, 'Apfelsaft')).toHaveCount(0);
  await screenshot(page, '114-online-merged');
  await expect.poll(() => phone.open()).toEqual([{ name: 'Mineralwasser', quantity: '8' }]);
  await page.reload();
  await expect(itemRow(page, 'Mineralwasser'), 'one Mineralwasser on the server').toHaveCount(1);
});

test('RENAME: offline, then the other phone adds Mineralwasser: one Mineralwasser after sync', async ({ page }) => {
  const email = newEmail('rename-offline');
  await signUpWithHousehold(page, email);
  await addItem(page, '2 Apfelsaft');
  const phone = await otherPhone(email);
  const connection = await cutOff(page);
  await rename(page, 'Apfelsaft', 'Mineralwasser');
  await phone.add('Mineralwasser', '6');
  await expect(itemRow(page, 'Mineralwasser')).toHaveAccessibleName(/^Mineralwasser 2/);
  await screenshot(page, '114-offline-before-sync');

  await connection.restore();
  await expect.poll(() => phone.open(), { message: 'the rename folded into their item', timeout: 20_000 })
    .toEqual([{ name: 'Mineralwasser', quantity: '8' }]);
  await expect(page.getByText(/^Offline:/)).toHaveCount(0, { timeout: 15_000 });
  await expect(itemRow(page, 'Mineralwasser')).toHaveCount(1);
  await expect(merged(page)).toBeVisible();
});

test('RENAME: two phones renaming onto Mineralwasser end with one, and Rückgängig brings Apfelsaft back', async ({ page }) => {
  const email = newEmail('rename-race');
  await muteItemChanges(page);
  await signUpWithHousehold(page, email);
  await addItem(page, '6 Sprudel');
  await addItem(page, '2 Apfelsaft');
  const phone = await otherPhone(email);
  await phone.rename('Sprudel', 'Mineralwasser');

  await rename(page, 'Apfelsaft', 'Mineralwasser');
  await expect.poll(() => phone.open(), { message: 'the later rename folded into the first' })
    .toEqual([{ name: 'Mineralwasser', quantity: '8' }]);
  await expect(itemRow(page, 'Mineralwasser')).toHaveCount(1);
  await expect(itemRow(page, 'Sprudel')).toHaveCount(0);
  await merged(page).getByRole('button', { name: 'Rückgängig' }).click();
  await expect.poll(() => phone.open())
    .toEqual([{ name: 'Apfelsaft', quantity: '2' }, { name: 'Mineralwasser', quantity: '6' }]);
  await expect(itemRow(page, 'Apfelsaft')).toBeVisible();
  await screenshot(page, '114-race-undone');
});
