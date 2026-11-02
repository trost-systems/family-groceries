import { expect, test } from './fixtures';
import { apiAs, chainStores, functionsUrl, itemRow, newEmail, screenshot, signUpWithHousehold } from './helpers';
import { call, connectWithToken } from './mcp-helpers';

type Item = {
  name: string;
  brand: string | null;
  properties: string | null;
  quantity: string | null;
  category: string;
  store: string | null;
};

async function personalAccessToken(email: string): Promise<string> {
  const { data, error } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Job 15' });
  if (error) throw error;
  return data[0].token;
}

test('MCP add_items: an old payload still classifies; brand and properties are split or taken as given', async ({ page }) => {
  const email = newEmail('details-mcp');
  await signUpWithHousehold(page, email, { stores: chainStores });
  const mcp = await connectWithToken(await personalAccessToken(email));

  const old = await call<{ added: Item[] }>(mcp, 'add_items', { items: [{ name: 'Gurken', quantity: '2' }, { name: 'Milch' }] });
  expect(old.added.map((i) => [i.name, i.brand, i.properties, i.quantity, i.category])).toEqual([
    ['Gurken', null, null, '2', 'Obst & Gemüse'],
    ['Milch', null, null, null, 'Kühlregal'],
  ]);

  const parsed = await call<{ added: Item[] }>(mcp, 'add_items', { items: [{ name: 'Windeln Pampers Größe 3' }] });
  expect(parsed.added.map((i) => [i.name, i.brand, i.properties, i.category, i.store])).toEqual([
    ['Windeln', 'Pampers', 'Größe 3', '👶 Drogerie', 'dm'],
  ]);

  const given = await call<{ added: Item[] }>(mcp, 'add_items', {
    items: [{ name: 'Joghurt', brand: 'Alpro', properties: 'Skyr Style', quantity: '2' }],
  });
  expect(given.added.map((i) => [i.name, i.brand, i.properties, i.quantity, i.category])).toEqual([
    ['Joghurt', 'Alpro', 'Skyr Style', '2', 'Kühlregal'],
  ]);

  const listed = await call<{ items: Item[] }>(mcp, 'list_items', {});
  expect(listed.items.find((i) => i.name === 'Joghurt')?.brand, 'list_items returns the brand').toBe('Alpro');
  await expect(itemRow(page, 'Windeln'), 'the app shows Marke and Eigenschaften').toHaveAccessibleName('Windeln Pampers · Größe 3');
  await expect(itemRow(page, 'Joghurt')).toHaveAccessibleName('Joghurt Alpro · Skyr Style 2');
  await screenshot(page, 'details-01-mcp-adds');
});

test('voice: "Windeln Pampers Größe 3 und zwei Liter Milch" is split into fields', async ({ page }) => {
  const email = newEmail('details-voice');
  await signUpWithHousehold(page, email, { stores: chainStores });
  const token = (await (await apiAs(email)).auth.getSession()).data.session!.access_token;
  const res = await fetch(`${functionsUrl}/voice`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Windeln Pampers Größe 3 und zwei Liter Milch' }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.speech).toBe('Hinzugefügt: Windeln Pampers Größe 3, 2 l Milch.');
  expect(body.items.map((i: Item) => [i.name, i.brand, i.properties, i.quantity])).toEqual([
    ['Windeln', 'Pampers', 'Größe 3', null],
    ['Milch', null, null, '2 l'],
  ]);
  const api = await apiAs(email);
  const { data: dm } = await api.from('stores').select('id').eq('name', 'dm').single();
  const { data } = await api.from('items').select('name, brand, properties, quantity, store_id').order('name');
  expect(data, 'Laden dm from the drugstore hint').toEqual([
    { name: 'Milch', brand: null, properties: null, quantity: '2 l', store_id: null },
    { name: 'Windeln', brand: 'Pampers', properties: 'Größe 3', quantity: null, store_id: dm!.id },
  ]);
  await expect(itemRow(page, 'Windeln')).toHaveAccessibleName('Windeln Pampers · Größe 3');
  await expect(itemRow(page, 'Milch')).toHaveAccessibleName('Milch 2 l');
});
