import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, type Page, test } from './fixtures';
import { dragItemToStore, holdAndDrop, outline, sectionHeadings, sectionItems, storeOf } from './catalog';
import {
  adminClient, apiAs, createInviteCode, editSheet, itemRow, joinWithCode, newEmail, reveal, screenshot, signUp,
  signUpWithHousehold, storeDivider, putBack, tick, typeInto, within,
} from './helpers';

type Seed = { name: string; store?: string; category: string; brand?: string; properties?: string; quantity?: string; key: number };

/** Puts [items] on the signed-in user's list over the API, with their walk order, and reloads. */
async function seed(page: Page, email: string, items: Seed[]): Promise<SupabaseClient> {
  const api = await apiAs(email);
  const { data: stores } = await api.from('stores').select('id, name, household_id');
  const { data: categories } = await api.from('categories').select('id, name');
  const id = (rows: { id: string; name: string }[] | null, name: string) => rows!.find((r) => r.name === name)!.id;
  const { error } = await api.from('items').insert(items.map((i) => ({
    household_id: stores![0].household_id,
    name: i.name,
    store_id: i.store ? id(stores, i.store) : null,
    category_id: id(categories, i.category),
    brand: i.brand ?? null,
    properties: i.properties ?? null,
    quantity: i.quantity ?? null,
    sort_key: i.key,
  })));
  if (error) throw error;
  await page.reload();
  await expect(itemRow(page, items.at(-1)!.name)).toBeVisible();
  return api;
}

/** Drops [item] [dy] px into the row of [onto] (negative: from its bottom). */
async function dragOnto(page: Page, item: string, onto: string, dy: number): Promise<void> {
  const rows = (await outline(page)).flatMap((s) => s.items);
  const at = (name: string) => rows.findIndex((r) => r === name || r.startsWith(`${name} `));
  await holdAndDrop(page, itemRow(page, item), itemRow(page, onto), (b) => ({
    x: b.x + b.width / 2, y: dy >= 0 ? b.y + dy : b.y + b.height + dy,
  }), { up: at(onto) < at(item) });
}

/** Drops a divider on the upper edge of another. */
type Locator = Parameters<typeof holdAndDrop>[1];

async function dragDivider(page: Page, from: Locator, onto: Locator): Promise<void> {
  await holdAndDrop(page, from, onto, (b) => ({ x: b.x + 40, y: b.y + 4 }), { up: true });
}

const stores = async (page: Page) => (await outline(page)).map((s) => s.store);

const lidl: Seed[] = [
  { name: 'Äpfel', store: 'Lidl', category: 'Obst & Gemüse', quantity: '1 kg', properties: 'Elstar', key: 1024 },
  { name: 'Bananen', store: 'Lidl', category: 'Obst & Gemüse', quantity: '6', properties: 'Bio', key: 2048 },
  { name: 'Gurke', store: 'Lidl', category: 'Obst & Gemüse', key: 3072 },
  { name: 'Milch', store: 'Lidl', category: 'Kühlregal', brand: 'Milbona', properties: '1,5 %', quantity: '2 l', key: 1024 },
  { name: 'Joghurt', store: 'Lidl', category: 'Kühlregal', key: 2048 },
  { name: 'Zahnpasta', store: 'dm', category: '👶 Drogerie', brand: 'elmex', key: 1024 },
  { name: 'Brot', category: 'Brot & Backwaren', key: 1024 },
];

async function dbOrder(group: { store: string | null; category: string }, household: string): Promise<string[]> {
  const admin = adminClient();
  const { data: stores } = await admin.from('stores').select('id, name').eq('household_id', household);
  const { data: categories } = await admin.from('categories').select('id, name').eq('household_id', household);
  let query = admin.from('items').select('name').eq('household_id', household).eq('status', 'active')
    .eq('category_id', categories!.find((c) => c.name === group.category)!.id).order('sort_key');
  query = group.store ? query.eq('store_id', stores!.find((s) => s.name === group.store)!.id) : query.is('store_id', null);
  const { data } = await query;
  return data!.map((r) => r.name);
}

/** A memory table's rows as "item key: name of what it remembers". */
async function memory(table: string, names: string, column: string, household: string): Promise<string[]> {
  const admin = adminClient();
  const { data } = await admin.from(table).select('*').eq('household_id', household);
  const rows = (data ?? []) as Record<string, string>[];
  const { data: named } = await admin.from(names).select('id, name').eq('household_id', household);
  const nameOf = new Map((named ?? []).map((n) => [n.id as string, n.name as string]));
  return rows.map((r) => `${r.item_key}: ${nameOf.get(r[column])}`);
}

async function householdOf(api: SupabaseClient): Promise<string> {
  const { data } = await api.from('stores').select('household_id').limit(1).single();
  return data!.household_id as string;
}

test('stores and categories are dividers that scroll away, stores fold for good, the explainer goes for good', async ({ page }) => {
  const email = newEmail('walk-dividers');
  await signUpWithHousehold(page, email);
  await expect(page.getByText('Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt')).toBeVisible();
  await seed(page, email, lidl);
  await expect(storeDivider(page, 'Lidl')).toHaveAccessibleName(/^Lidl, 5 Artikel/);
  await expect(storeDivider(page, 'dm')).toHaveAccessibleName(/^dm, 1 Artikel/);
  await expect(storeDivider(page, 'Edeka'), 'a store without items does not show').toHaveCount(0);
  await expect(page.getByRole('button', { name: /, 0 Artikel/ }), 'no "0 Artikel" anywhere').toHaveCount(0);
  await expect.poll(() => sectionItems(page, 'Lidl')).toEqual(['Äpfel Elstar 1 kg', 'Bananen Bio 6', 'Gurke', 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);
  await expect.poll(() => sectionHeadings(page, 'Lidl')).toEqual(['Obst & Gemüse', 'Kühlregal']);
  await page.mouse.move(0, 899);
  await screenshot(page, 'walk-01-list');

  const store = storeDivider(page, 'Lidl');
  const heading = page.getByRole('heading', { name: 'Kühlregal', exact: true });
  const row = itemRow(page, 'Joghurt');
  const y = async () => [(await store.boundingBox())!.y, (await heading.boundingBox())!.y, (await row.boundingBox())!.y];
  const before = await y();
  await page.mouse.move(240, 600);
  await page.mouse.wheel(0, 80);
  await page.waitForTimeout(300);
  const after = await y();
  const moved = after.map((v, i) => Math.round(before[i] - v));
  expect(moved[0], 'the list scrolled').toBeGreaterThan(20);
  expect(moved, 'store divider, category divider and row move by the same delta: nothing sticks').toEqual([moved[0], moved[0], moved[0]]);
  await page.mouse.wheel(0, -80);

  await page.getByRole('button', { name: 'Verstanden' }).click();
  await expect(page.getByText('Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt')).toHaveCount(0);

  await store.click();
  await expect(storeDivider(page, 'Lidl')).toHaveAccessibleName(/^Lidl, 5 Artikel/);
  await expect(itemRow(page, 'Äpfel'), 'a folded store shows only its divider').toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Obst & Gemüse', exact: true })).toHaveCount(0);
  await page.mouse.move(0, 899);
  await screenshot(page, 'walk-02-folded');
  await page.reload();
  await expect(itemRow(page, 'Zahnpasta')).toBeVisible();
  await expect(itemRow(page, 'Äpfel'), 'still folded after a reload').toHaveCount(0);
  await expect(page.getByText('Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt'), 'dismissed for good')
    .toHaveCount(0);

  await dragItemToStore(page, 'Brot', 'Lidl');
  await expect(storeDivider(page, 'Lidl'), 'a folded store takes a dropped item').toHaveAccessibleName(/^Lidl, 6 Artikel/);
  await expect(itemRow(page, 'Brot')).toHaveCount(0);
  await storeDivider(page, 'Lidl').click();
  await expect.poll(() => storeOf(page, 'Brot')).toBe('Lidl');
  await expect.poll(() => sectionHeadings(page, 'Lidl'), { message: 'Brot keeps its category, in Lidl\'s order' })
    .toEqual(['Brot & Backwaren', 'Obst & Gemüse', 'Kühlregal']);
  await expect(storeDivider(page, 'Ohne Laden'), 'its last item moved out, the section without a store hides').toHaveCount(0);

  // While an item is dragged the empty stores show, folded, as drop targets.
  await holdAndDrop(page, itemRow(page, 'Zahnpasta'), storeDivider(page, 'Edeka'), (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }), {
    up: false,
    beforeDrop: async () => {
      await expect(storeDivider(page, 'Edeka')).toHaveAccessibleName(/^Edeka, 0 Artikel/);
      await expect(storeDivider(page, 'Ohne Laden')).toHaveAccessibleName(/^Ohne Laden, 0 Artikel/);
      await screenshot(page, 'walk-07-drag-shows-empty-stores');
    },
  });
  await expect(storeDivider(page, 'Edeka'), 'the empty store took the drop').toHaveAccessibleName(/^Edeka, 1 Artikel/);
  await expect(storeDivider(page, 'dm'), 'its last item moved out, dm hides after the drop').toHaveCount(0);
  await expect(storeDivider(page, 'Ohne Laden'), 'still empty, hidden again').toHaveCount(0);
  await expect.poll(() => storeOf(page, 'Zahnpasta')).toBe('Edeka');
  await page.mouse.move(240, 400);
  await page.mouse.wheel(0, -2000);
  await expect(storeDivider(page, 'Lidl')).toBeInViewport();
  await page.mouse.move(0, 899);
  await screenshot(page, 'walk-08-after-drop-into-empty-store');
});

test('drag and drop puts items before and after rows, into categories and stores, and it sticks', async ({ browser }) => {
  const peter = await (await browser.newContext()).newPage();
  const email = newEmail('walk-drag');
  await signUpWithHousehold(peter, email);
  const api = await seed(peter, email, lidl);
  const household = await householdOf(api);
  const lea = await (await browser.newContext()).newPage();
  const code = await createInviteCode(peter);
  await signUp(lea, newEmail('walk-drag-lea'));
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Gurke')).toBeVisible();

  await dragOnto(peter, 'Gurke', 'Äpfel', 8);
  await expect.poll(() => sectionItems(peter, 'Lidl'), { message: 'before a row: upper half' })
    .toEqual(['Gurke', 'Äpfel Elstar 1 kg', 'Bananen Bio 6', 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);
  await within(3_000, (timeout) => expect.poll(() => sectionItems(lea, 'Lidl'), { message: 'live in the second browser', timeout })
    .toEqual(['Gurke', 'Äpfel Elstar 1 kg', 'Bananen Bio 6', 'Milch Milbona · 1,5 % 2 l', 'Joghurt']));
  await dragOnto(peter, 'Gurke', 'Bananen', -8);
  await expect.poll(() => sectionItems(peter, 'Lidl'), { message: 'after a row: lower half' })
    .toEqual(['Äpfel Elstar 1 kg', 'Bananen Bio 6', 'Gurke', 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);
  await dragOnto(peter, 'Äpfel', 'Gurke', -8);
  const produce = ['Bananen Bio 6', 'Gurke', 'Äpfel Elstar 1 kg'];
  await expect.poll(() => sectionItems(peter, 'Lidl')).toEqual([...produce, 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);
  await expect.poll(() => dbOrder({ store: 'Lidl', category: 'Obst & Gemüse' }, household), { message: 'the sort keys say so too' })
    .toEqual(['Bananen', 'Gurke', 'Äpfel']);
  await peter.reload();
  await expect.poll(() => sectionItems(peter, 'Lidl'), { message: 'after a reload' }).toEqual([...produce, 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);
  await expect.poll(() => sectionItems(lea, 'Lidl'), { message: 'and in the other browser' }).toEqual([...produce, 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);

  // The drop that shows the insertion line, caught mid-drag.
  const from = (await itemRow(peter, 'Joghurt').boundingBox())!;
  await peter.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await peter.mouse.down();
  await peter.waitForTimeout(600);
  await peter.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 12, { steps: 4 });
  const target = (await itemRow(peter, 'Milch').boundingBox())!;
  await peter.mouse.move(target.x + target.width / 2, target.y + 10, { steps: 10 });
  await peter.waitForTimeout(200);
  await screenshot(peter, 'walk-03-drag-insertion-line');
  await peter.mouse.up();
  await expect.poll(() => sectionItems(peter, 'Lidl')).toEqual([...produce, 'Joghurt', 'Milch Milbona · 1,5 % 2 l']);

  const chilled = peter.getByRole('heading', { name: 'Kühlregal', exact: true });
  const box = (await itemRow(peter, 'Gurke').boundingBox())!;
  await peter.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await peter.mouse.down();
  await peter.waitForTimeout(600);
  await peter.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 12, { steps: 4 });
  const cb = (await chilled.boundingBox())!;
  await peter.mouse.move(cb.x + 60, cb.y + cb.height / 2, { steps: 15 });
  await peter.waitForTimeout(150);
  await peter.mouse.up();
  await expect.poll(() => sectionItems(peter, 'Lidl'), { message: 'a category divider takes it to the end of that category' })
    .toEqual(['Bananen Bio 6', 'Äpfel Elstar 1 kg', 'Joghurt', 'Milch Milbona · 1,5 % 2 l', 'Gurke']);
  await expect.poll(() => memory('category_memory', 'categories', 'category_id', household), { message: 'the move taught the classifier' })
    .toContain('gurk: Kühlregal');

  await dragItemToStore(peter, 'Joghurt', 'dm');
  await expect.poll(() => storeOf(peter, 'Joghurt'), { message: 'a store divider takes it to that store' }).toBe('dm');
  await expect.poll(() => sectionHeadings(peter, 'dm')).toEqual(['👶 Drogerie', 'Kühlregal']);
  await dragOnto(peter, 'Bananen', 'Zahnpasta', 8);
  await expect.poll(() => sectionItems(peter, 'dm'), { message: 'a row in another store: both store and category' })
    .toEqual(['Bananen Bio 6', 'Zahnpasta elmex', 'Joghurt']);
  await expect.poll(() => memory('item_store_memory', 'stores', 'store_id', household), { message: 'the moves taught the store memory' })
    .toEqual(expect.arrayContaining(['banan: dm', 'joghurt: dm']));
  await expect.poll(() => dbOrder({ store: 'dm', category: '👶 Drogerie' }, household)).toEqual(['Bananen', 'Zahnpasta']);
  await within(3_000, (timeout) => expect.poll(() => storeOf(lea, 'Bananen'), { message: 'live in the second browser', timeout })
    .toBe('dm'));
});

test('categories and stores reorder by drag, for good and live for the other member', async ({ browser }) => {
  const peter = await (await browser.newContext()).newPage();
  const email = newEmail('walk-reorder');
  await signUpWithHousehold(peter, email);
  await seed(peter, email, lidl);
  const lea = await (await browser.newContext()).newPage();
  const code = await createInviteCode(peter);
  await signUp(lea, newEmail('walk-reorder-lea'));
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Gurke')).toBeVisible();

  await dragDivider(peter,
    peter.getByRole('heading', { name: 'Kühlregal', exact: true }),
    peter.getByRole('heading', { name: 'Obst & Gemüse', exact: true }));
  await expect.poll(() => sectionHeadings(peter, 'Lidl'), { message: 'a category moves inside its store' })
    .toEqual(['Kühlregal', 'Obst & Gemüse']);
  await within(3_000, (timeout) => expect.poll(() => sectionHeadings(lea, 'Lidl'), { message: 'live for the other member', timeout })
    .toEqual(['Kühlregal', 'Obst & Gemüse']));

  await expect.poll(() => stores(peter), { message: 'Edeka has no items: not shown' }).toEqual(['dm', 'Lidl', 'Ohne Laden']);
  await dragDivider(peter, storeDivider(peter, 'Lidl'), storeDivider(peter, 'dm'));
  await expect.poll(() => stores(peter), { message: 'a store moves among the stores' }).toEqual(['Lidl', 'dm', 'Ohne Laden']);
  await within(3_000, (timeout) => expect.poll(() => stores(lea), { message: 'live for the other member', timeout })
    .toEqual(['Lidl', 'dm', 'Ohne Laden']));
  await peter.reload();
  await expect(itemRow(peter, 'Gurke')).toBeVisible();
  await expect.poll(() => stores(peter), { message: 'after a reload' }).toEqual(['Lidl', 'dm', 'Ohne Laden']);
  await expect.poll(() => sectionHeadings(peter, 'Lidl')).toEqual(['Kühlregal', 'Obst & Gemüse']);
});

test('a tap ticks, a tap under Zuletzt verwendet puts it back in place, a hold or right click edits, names wrap, no added-by badge', async ({ browser }) => {
  const peter = await (await browser.newContext()).newPage();
  const email = newEmail('walk-rows');
  await signUpWithHousehold(peter, email);
  const long = 'Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen und extra viel Kruste';
  await seed(peter, email, [...lidl, { name: long, store: 'Lidl', category: 'Brot & Backwaren', key: 1024 }]);

  await tick(peter, 'Bananen');
  await expect(itemRow(peter, 'Bananen')).toHaveCount(0);
  await putBack(peter, 'Bananen');
  await expect.poll(() => sectionItems(peter, 'Lidl'), { message: 'putting it back puts it where it was' })
    .toEqual([long, 'Äpfel Elstar 1 kg', 'Bananen Bio 6', 'Gurke', 'Milch Milbona · 1,5 % 2 l', 'Joghurt']);

  await itemRow(peter, 'Gurke').click({ button: 'right' });
  await expect(editSheet(peter), 'a right click edits').toBeVisible();
  await editSheet(peter).getByRole('button', { name: 'Abbrechen' }).click();
  await expect(editSheet(peter)).toHaveCount(0);
  const g = (await itemRow(peter, 'Gurke').boundingBox())!;
  await peter.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await peter.mouse.down();
  await peter.waitForTimeout(700);
  await peter.mouse.up();
  await expect(editSheet(peter), 'a hold that stays put edits').toBeVisible();
  await editSheet(peter).getByRole('button', { name: 'Abbrechen' }).click();

  const longRow = (await itemRow(peter, long).boundingBox())!;
  const short = (await itemRow(peter, 'Gurke').boundingBox())!;
  expect(longRow.height, 'a long name wraps: the row grows').toBeGreaterThan(short.height + 20);
  await expect(itemRow(peter, long)).toHaveAccessibleName(new RegExp(`^${long}`));

  const leaEmail = newEmail('walk-rows-lea');
  const lea = await (await browser.newContext()).newPage();
  const code = await createInviteCode(peter);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Gurke')).toBeVisible();
  await (await apiAs(leaEmail)).from('items').insert({
    household_id: await householdOf(await apiAs(leaEmail)), name: 'Hafer',
  });
  // The add bar at the bottom leaves the list less room: Hafer lands below the fold.
  await reveal(peter, itemRow(peter, 'Hafer'));
  await expect(itemRow(peter, 'Hafer'), 'the partner\'s add: no initial, but new').toHaveAccessibleName(/^Hafer\sNeu$/);
  await expect(peter.getByText(`1 neu von ${leaEmail.split('@')[0]}`)).toBeVisible();
  await peter.mouse.move(0, 899);
  await screenshot(peter, 'walk-04-rows');
});

test('wide screens put the stores in columns, and drag and drop works across them', async ({ page }) => {
  const email = newEmail('walk-wide');
  await page.setViewportSize({ width: 1366, height: 1024 });
  await signUpWithHousehold(page, email);
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await seed(page, email, [
    ...lidl,
    { name: 'Hack', store: 'Edeka', category: 'Fleisch/Wurst/Fisch', quantity: '500 g', key: 1024 },
    { name: 'Schokolade', store: 'Edeka', category: 'Süßes & Snacks', brand: 'Ritter Sport', key: 1024 },
  ]);
  const columns = async (names: string[]) =>
    new Set(await Promise.all(names.map(async (n) => (await storeDivider(page, n).boundingBox())?.x ?? NaN))).size;
  await expect.poll(() => columns(['dm', 'Lidl', 'Edeka', 'Ohne Laden']), { message: 'three columns at 1366 px' }).toBe(3);
  expect((await itemRow(page, 'Gurke').boundingBox())!.width, 'a readable row width').toBeLessThanOrEqual(560);
  await screenshot(page, 'walk-05-wide-1366');

  expect(await stores(page), 'a screen reader reads column by column').toEqual(['dm', 'Lidl', 'Edeka', 'Ohne Laden']);
  await dragItemToStore(page, 'Brot', 'Edeka');
  await expect.poll(() => storeOf(page, 'Brot'), { message: 'a drop in another column' }).toBe('Edeka');

  await page.setViewportSize({ width: 820, height: 1180 });
  await expect.poll(() => columns(['dm', 'Lidl']), { message: 'one column at 820 px' }).toBe(1);
  const row = (await itemRow(page, 'Gurke').boundingBox())!;
  expect(row.width, 'centred at its max width').toBe(640);
  expect(row.x).toBeCloseTo((820 - 640) / 2, 0);
  await screenshot(page, 'walk-06-wide-820');
});
