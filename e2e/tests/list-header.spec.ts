import { expect, test, type Page } from './fixtures';
import { addItem, cutOff, itemRow, listBarHeight, newEmail, screenshot, signUpWithHousehold, tick } from './helpers';

/** The sync icon's accessible names: "1 Änderung wird synchronisiert" and "Offline: …". */
const pending = (page: Page) => page.getByText(/^\d+ Änderung(en)? w(ird|erden) synchronisiert$/);
const offline = (page: Page) => page.getByText(/^Offline:/);

test('the bar above the list keeps its height in every sync state and names no household or count', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('topbar'));
  await addItem(page, 'Brot');
  await addItem(page, 'Milch');
  await addItem(page, 'Seife');
  await expect(itemRow(page, 'Seife')).toBeVisible();
  await expect(pending(page)).toHaveCount(0, { timeout: 15_000 });

  await expect(page.getByText('Unser Haushalt'), 'no household name').toHaveCount(0);
  await expect(page.getByText(/^\d+ Artikel$/), 'no item count').toHaveCount(0);

  // The explainer card is the list's first entry, right under the bar, and stays while items are ticked
  // (a store divider would move when its last item goes). It must not move while the sync icon comes and goes.
  const card = page.getByRole('button', { name: 'Verstanden', exact: true });
  const top = async () => (await card.boundingBox())!.y;
  const synced = await top();
  expect(synced, 'the list starts under the bar').toBeGreaterThan(listBarHeight);
  expect(synced, 'right under it').toBeLessThan(listBarHeight + 48);
  await screenshot(page, 'topbar-01-synced');

  // Hold every item write until released: the tick stays pending.
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const items = '**/rest/v1/items**';
  await page.route(items, async (route) => {
    if (route.request().method() !== 'GET') await held;
    await route.fallback();
  });
  await tick(page, 'Milch');
  await expect(pending(page), 'the pending icon shows').toHaveCount(1);
  expect(await top(), 'pending: the list did not move').toBe(synced);
  await screenshot(page, 'topbar-02-pending');

  release();
  await page.unroute(items);
  await expect(pending(page), 'the tick reached the server').toHaveCount(0, { timeout: 15_000 });
  expect(await top(), 'synced again').toBe(synced);

  const network = await cutOff(page);
  await tick(page, 'Seife');
  await expect(offline(page), 'the offline icon shows').toHaveCount(1, { timeout: 10_000 });
  expect(await top(), 'offline: the list did not move').toBe(synced);
  await screenshot(page, 'topbar-03-offline');

  await network.restore();
  await expect(offline(page), 'back online').toHaveCount(0, { timeout: 20_000 });
  await expect(pending(page)).toHaveCount(0, { timeout: 15_000 });
  expect(await top(), 'back online: the list did not move').toBe(synced);
});
