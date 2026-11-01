import { expect, test } from './fixtures';
import {
  apiAs,
  functionsUrl,
  itemRow,
  newEmail,
  screenshot,
  signUpWithHousehold,
} from './helpers';
import { call, connectWithToken } from './mcp-helpers';

/** Posts a sentence the way the Siri Shortcut does. */
async function say(token: string, text: string, query = '') {
  const res = await fetch(`${functionsUrl}/voice${query}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { status: res.status, body: await res.text() };
}

async function sessionToken(email: string): Promise<string> {
  const api = await apiAs(email);
  return (await api.auth.getSession()).data.session!.access_token;
}

test('a dictated sentence lands in the open list, split and sorted', async ({ page }) => {
  const email = newEmail('voice');
  await signUpWithHousehold(page, email);
  const token = await sessionToken(email);

  const said = await say(token, 'Milch, zwei Gurken und Klopapier', '?format=text');
  expect(said).toEqual({ status: 200, body: 'Hinzugefügt: Milch, 2 Gurken, Klopapier.' });

  await expect(itemRow(page, 'Milch')).toBeVisible();
  await expect(itemRow(page, 'Gurken 2')).toBeVisible();
  await expect(itemRow(page, 'Klopapier')).toBeVisible();
  const order = await page.getByRole('heading').allInnerTexts();
  expect(order.filter((h) => ['Obst & Gemüse', 'Kühlregal', 'Haushalt'].includes(h))).toEqual([
    'Obst & Gemüse',
    'Kühlregal',
    'Haushalt',
  ]);
  await screenshot(page, 'voice-01-siri-sentence-in-list');

  const again = await say(token, 'Wir brauchen noch Milch und 1 kg Mehl', '?format=text');
  expect(again.body).toBe('Hinzugefügt: 1 kg Mehl. Schon auf der Liste: Milch.');
  await expect(itemRow(page, 'Mehl 1 kg')).toBeVisible();
  await expect(itemRow(page, 'Milch')).toHaveCount(1);
});

test('the JSON answer names each item with its category', async ({ page }) => {
  const email = newEmail('voice-json');
  await signUpWithHousehold(page, email);
  const said = await say(await sessionToken(email), 'Eine Packung Eier sowie Windeln bitte');
  expect(said.status).toBe(200);
  expect(JSON.parse(said.body)).toEqual({
    speech: 'Hinzugefügt: 1 Packung Eier, Windeln.',
    items: [
      { name: 'Eier', brand: null, properties: null, quantity: '1 Packung', category: 'Kühlregal', alreadyOnList: false,
        similarOnList: [] },
      { name: 'Windeln', brand: null, properties: null, quantity: null, category: '👶 Drogerie', alreadyOnList: false,
        similarOnList: [] },
    ],
    truncated: false,
  });
});

test('Siri adds Karotten with Möhren open and says Möhren is on the list (job 32b, AC10)', async ({ page }) => {
  const email = newEmail('voice-similar');
  await signUpWithHousehold(page, email);
  const token = await sessionToken(email);
  await say(token, '500 Gramm Möhren', '?format=text');
  const said = await say(token, 'ein Kilo Karotten und Milch');
  expect(said.status).toBe(200);
  const body = JSON.parse(said.body);
  expect(body.speech).toBe('Hinzugefügt: 1 kg Karotten, Milch. Möhren steht schon auf der Liste.');
  expect(body.items.map((i: { name: string; similarOnList: string[] }) => [i.name, i.similarOnList]))
    .toEqual([['Karotten', ['Möhren']], ['Milch', []]]);
  // Nothing is dropped or merged: both carrots are on the list, as said.
  await expect(itemRow(page, 'Möhren')).toBeVisible();
  await expect(itemRow(page, 'Karotten')).toBeVisible();
  // No hint in the app for an add it did not make.
  await expect(page.getByRole('group', { name: 'Möhren steht schon auf der Liste', exact: true })).toHaveCount(0);
});

test('errors come back as German sentences Siri can speak', async ({ page }) => {
  expect(await say('fgp_not-a-token', 'Milch', '?format=text')).toEqual({
    status: 401,
    body: 'Der Zugriffstoken fehlt oder ist ungültig. Erstelle in der Hummlist-App unter Mehr, Zugänge einen neuen.',
  });

  const email = newEmail('voice-errors');
  await signUpWithHousehold(page, email);
  const token = await sessionToken(email);
  const nothing = await say(token, 'Bitte, danke');
  expect(nothing.status).toBe(422);
  expect(JSON.parse(nothing.body).speech).toMatch(/^Ich habe nichts verstanden/);
});

test('an app session token stops working at the voice endpoint once the session signs out', async ({ page }) => {
  const email = newEmail('voice-signout');
  await signUpWithHousehold(page, email);
  const api = await apiAs(email);
  const token = (await api.auth.getSession()).data.session!.access_token;
  expect((await say(token, 'Milch')).status).toBe(200);
  await api.auth.signOut();
  expect((await say(token, 'Butter')).status, 'the unexpired token of a signed-out session gets 401').toBe(401);
});

test('Siri with a personal access token: add, then revoked is 401', async ({ page }) => {
  const email = newEmail('voice-pat');
  await signUpWithHousehold(page, email);
  const api = await apiAs(email);
  const { data, error } = await api.rpc('create_personal_access_token', { p_name: 'Siri' });
  expect(error).toBeNull();
  const [{ id, token }] = data as { id: string; token: string }[];
  expect(token).toMatch(/^fgp_/);

  const said = await say(token, 'Schreib bitte Windeln und zwei Packungen Klopapier auf', '?format=text');
  expect(said).toEqual({ status: 200, body: 'Hinzugefügt: Windeln, 2 Packungen Klopapier.' });
  await expect(itemRow(page, 'Windeln')).toBeVisible();
  await expect(itemRow(page, 'Klopapier 2 Packungen')).toBeVisible();
  await screenshot(page, 'voice-02-pat-items-in-list');

  const revoked = await api.from('personal_access_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  expect(revoked.error).toBeNull();
  const after = await say(token, 'Milch', '?format=text');
  expect(after.status).toBe(401);
  expect(after.body).toMatch(/^Der Zugriffstoken fehlt oder ist ungültig/);
  await expect(itemRow(page, 'Milch')).toHaveCount(0);
});

test("a token only reaches its own household's list", async ({ browser }) => {
  const [a, b] = [await browser.newPage(), await browser.newPage()];
  const [emailA, emailB] = [newEmail('voice-a'), newEmail('voice-b')];
  await signUpWithHousehold(a, emailA);
  await signUpWithHousehold(b, emailB);
  const { data } = await (await apiAs(emailA)).rpc('create_personal_access_token', { p_name: 'Siri' });
  const [{ token }] = data as { token: string }[];

  expect((await say(token, 'Zahnpasta')).status).toBe(200);
  await expect(itemRow(a, 'Zahnpasta')).toBeVisible();
  const rowsB = await (await apiAs(emailB)).from('items').select('name');
  expect(rowsB.data).toEqual([]);
  await expect(itemRow(b, 'Zahnpasta')).toHaveCount(0);
});

test('Siri adds go through the classifier memory: move, delete, say again', async ({ page }) => {
  const email = newEmail('voice-learn');
  await signUpWithHousehold(page, email);
  const token = await sessionToken(email);
  const api = await apiAs(email);

  const first = JSON.parse((await say(token, 'Hafermilch')).body);
  const learnedFrom = first.items[0].category as string;
  const { data: categories } = await api.from('categories').select('id, name');
  const target = categories!.find((c) => c.name !== learnedFrom && c.name !== 'Sonstiges')!;

  const { data: row } = await api.from('items').select('id').eq('name', 'Hafermilch').single();
  expect((await api.from('items').update({ category_id: target.id }).eq('id', row!.id)).error).toBeNull();
  expect((await api.from('items').delete().eq('id', row!.id)).error).toBeNull();
  await expect(itemRow(page, 'Hafermilch')).toHaveCount(0);

  const again = JSON.parse((await say(token, 'Hafermilch')).body);
  expect(again.items[0]).toMatchObject({ name: 'Hafermilch', category: target.name, alreadyOnList: false });
  await expect(page.getByRole('heading', { name: target.name })).toBeVisible();
  await expect(itemRow(page, 'Hafermilch')).toBeVisible();
  await screenshot(page, 'voice-03-siri-uses-learned-category');
});

test('Siri and MCP agree on what is already on the list (plurals fold)', async ({ page }) => {
  const email = newEmail('voice-mcp');
  await signUpWithHousehold(page, email);
  const { data } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Siri' });
  const [{ token }] = data as { token: string }[];

  expect((await say(token, 'Zwei Gurken', '?format=text')).body).toBe('Hinzugefügt: 2 Gurken.');
  expect((await say(token, 'Gurke', '?format=text')).body).toBe('Schon auf der Liste: 2 Gurken.');
  const mcp = await connectWithToken(token);
  const viaMcp = await call<{ added: unknown[]; alreadyOnList: { name: string }[] }>(mcp, 'add_items', {
    items: [{ name: 'Gurke' }],
  });
  expect(viaMcp.added).toEqual([]);
  expect(viaMcp.alreadyOnList.map((i) => i.name)).toEqual(['Gurken']);
  await expect(itemRow(page, 'Gurken 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Gurke/ })).toHaveCount(1);
});

test('a different size or type is a new item, not "already on the list"', async ({ page }) => {
  const email = newEmail('voice-sizes');
  await signUpWithHousehold(page, email);
  const { data } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Siri' });
  const [{ token }] = data as { token: string }[];

  expect((await say(token, 'Windeln Größe 4', '?format=text')).body).toBe('Hinzugefügt: Windeln Größe 4.');
  expect((await say(token, 'Windeln Größe 5 und Mehl Typ 405', '?format=text')).body).toBe(
    'Hinzugefügt: Windeln Größe 5, Mehl Typ 405.',
  );
  const mcp = await connectWithToken(token);
  const viaMcp = await call<{
    added: { name: string }[];
    alreadyOnList: { name: string; properties: string | null }[];
  }>(mcp, 'add_items', {
    items: [{ name: 'Mehl Typ 550' }, { name: 'Windeln Größe 4' }],
  });
  expect(viaMcp.added.map((i) => i.name)).toEqual(['Mehl Typ 550']);
  expect(viaMcp.alreadyOnList.map((i) => [i.name, i.properties])).toEqual([['Windeln', 'Größe 4']]);
  for (const name of ['Windeln Größe 4', 'Windeln Größe 5', 'Mehl Typ 405', 'Mehl Typ 550']) {
    await expect(itemRow(page, name)).toBeVisible();
  }
});

/** Posts the way the native Siri intents do (job 51): JSON with mode and lang. */
async function ask(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${functionsUrl}/voice`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('native Siri: the credential the app mints adds in English, reads back, and ends with its session', async ({ page }) => {
  const email = newEmail('voice-siri');
  await signUpWithHousehold(page, email);
  const iphone = await apiAs(email);
  const { data, error } = await iphone.rpc('create_siri_credential');
  expect(error).toBeNull();
  const [{ token }] = data as { id: string; token: string }[];
  expect(token).toMatch(/^fgp_/);

  const added = await ask(token, { text: 'milk, eggs and bread', mode: 'add', lang: 'en' });
  expect(added.status).toBe(200);
  expect(added.body.outcome).toBe('added');
  expect(added.body.speech).toBe('Added milk, eggs and bread to Hummlist.');
  expect(added.body.items.map((i: { name: string; category: string }) => [i.name, i.category])).toEqual([
    ['milk', 'Kühlregal'],
    ['eggs', 'Kühlregal'],
    ['bread', 'Brot & Backwaren'],
  ]);
  for (const name of ['milk', 'eggs', 'bread']) await expect(itemRow(page, name)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Brot & Backwaren' })).toBeVisible();
  await screenshot(page, 'voice-04-native-siri-english');

  const again = await ask(token, { text: 'milk', mode: 'add', lang: 'en' });
  expect([again.status, again.body.outcome, again.body.speech]).toEqual([200, 'nothing_added', 'Already on the list: milk.']);

  const read = await ask(token, { mode: 'read', lang: 'en' });
  expect(read).toEqual({
    status: 200,
    body: {
      outcome: 'read',
      speech: expect.stringMatching(/^There are 3 things on your Hummlist: /),
      items: expect.arrayContaining([{ name: 'milk', quantity: null }, { name: 'bread', quantity: null }]),
      total: 3,
    },
  });
  const gelesen = await ask(token, { mode: 'read', lang: 'de' });
  expect(gelesen.body.speech).toMatch(/^Auf der Hummlist stehen 3 Sachen: /);

  const mcp = await fetch(`${functionsUrl}/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  expect(mcp.status, 'only the voice function takes a Siri credential').toBe(401);
  await mcp.body?.cancel();

  await iphone.auth.signOut({ scope: 'local' });
  const after = await ask(token, { text: 'butter', mode: 'add', lang: 'en' });
  expect(after.status, 'signing out on that iPhone ends its Siri credential').toBe(401);
  expect(after.body.outcome).toBe('unauthorized');
  expect(after.body.speech).toMatch(/nothing was added/);
  await expect(itemRow(page, 'butter')).toHaveCount(0);
});

test('the Shortcut recipe with a PAT answers exactly as before job 51', async ({ page }) => {
  const email = newEmail('voice-recipe');
  await signUpWithHousehold(page, email);
  const { data } = await (await apiAs(email)).rpc('create_personal_access_token', { p_name: 'Siri' });
  const [{ token }] = data as { token: string }[];

  const said = await say(token, 'Zwei Gurken und Klopapier');
  expect(said.status).toBe(200);
  expect(JSON.parse(said.body)).toEqual({
    speech: 'Hinzugefügt: 2 Gurken, Klopapier.',
    items: [
      { name: 'Gurken', brand: null, properties: null, quantity: '2', category: 'Obst & Gemüse', alreadyOnList: false,
        similarOnList: [] },
      { name: 'Klopapier', brand: null, properties: null, quantity: null, category: 'Haushalt', alreadyOnList: false,
        similarOnList: [] },
    ],
    truncated: false,
  });
  expect(await say(token, 'Bitte, danke', '?format=text')).toEqual({
    status: 422,
    body: 'Ich habe nichts verstanden, was auf die Liste soll. Sag zum Beispiel: Milch, zwei Gurken und Klopapier.',
  });
});
