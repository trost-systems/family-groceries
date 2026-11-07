// Job 166: the sync indicator follows the device's network on its own. Playwright's offline mode fires the
// browser's offline and online events, which the app watches; nothing on the page is touched while it switches.
import { expect, test } from './fixtures';
import { addItem, apiAs, itemRow, must, newEmail, offlineIndicator, screenshot, signUpWithHousehold, tick } from './helpers';

test('the network going away shows offline without a tap; back, the queued tick syncs and it goes', async ({ page, context }) => {
  const email = newEmail('network');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Brot');
  await addItem(page, 'Milch');
  await expect(itemRow(page, 'Milch')).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(offlineIndicator(page), 'online: nothing').toHaveCount(0);

  await context.setOffline(true);
  // The channel's heartbeat would notice only after 25 s or more; the network event says it at once.
  await expect(offlineIndicator(page), 'offline with no tap and no request').toHaveCount(1, { timeout: 3_000 });
  await screenshot(page, 'network-01-offline');

  await tick(page, 'Brot');
  await expect(itemRow(page, 'Brot'), 'optimistic while offline').toHaveCount(0);

  await context.setOffline(false);
  await expect(offlineIndicator(page), 'back online: gone with no tap').toHaveCount(0, { timeout: 10_000 });
  await screenshot(page, 'network-02-back');
  const api = await apiAs(email);
  await expect(async () => {
    const { data, error } = await api.from('items').select('name,status').eq('name', 'Brot');
    expect(error).toBeNull();
    expect(data, 'the tick made offline reached the server').toEqual([{ name: 'Brot', status: 'bought' }]);
  }).toPass({ timeout: 5_000 });
  await api.auth.signOut({ scope: 'local' });
});

test('a realtime socket that died with the network is replaced once it is back: a partner add shows at once', async ({ page, context }) => {
  // A phone's socket can die with its network and still look open: frames go nowhere, nothing closes it, and the
  // heartbeat notices only after 25 to 50 s. Every socket opened before the network goes away plays that socket.
  let sockets = 0;
  let deadBelow = 0;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const n = ++sockets;
    const dead = (): boolean => n <= deadBelow;
    const server = ws.connectToServer();
    ws.onMessage((message) => !dead() && server.send(message));
    server.onMessage((message) => !dead() && ws.send(message));
  });
  const email = newEmail('dead-socket');
  await signUpWithHousehold(page, email);
  await addItem(page, 'Brot');
  await page.waitForTimeout(1_000);
  await expect(offlineIndicator(page)).toHaveCount(0);

  deadBelow = sockets;
  await context.setOffline(true);
  await expect(offlineIndicator(page)).toHaveCount(1, { timeout: 3_000 });
  await page.waitForTimeout(2_000);
  await context.setOffline(false);
  await expect(offlineIndicator(page), 'back online').toHaveCount(0, { timeout: 10_000 });
  // Past the resyncs of the reconnect: from here only the live channel brings the add.
  await page.waitForTimeout(2_000);

  const api = await apiAs(email);
  const { data } = await api.from('household_members').select('household_id').single();
  await api.from('items').insert({ household_id: must(data, 'membership').household_id, name: 'Zwischendurch' });
  await expect(itemRow(page, 'Zwischendurch'), 'over a new socket, not after the heartbeat').toBeVisible({ timeout: 5_000 });
  expect(sockets, 'a new socket').toBeGreaterThan(deadBelow);
  await api.auth.signOut({ scope: 'local' });
});
