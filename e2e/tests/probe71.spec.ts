import { expect, test, type Page } from './fixtures';
import {
  addField, addItem, answerConsent, apiAs, cutOff, itemRow, newEmail, openMore, password, screenshot, signUpWithHousehold, tick,
  typeInto, within,
  openEmailSignIn,
} from './helpers';
import { supabaseUrl } from './helpers';

/** The list snapshot the app keeps in localStorage, or null. */
function cachedList(page: Page): Promise<{ server: unknown[]; pending: unknown[] } | null> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /\blist\./.test(k));
    if (!key) return null;
    let value = JSON.parse(localStorage.getItem(key)!);
    if (typeof value === 'string') value = JSON.parse(value);
    return value;
  });
}

/** Makes the stored session look expired, so the start also has to survive a failed token refresh. */
async function expireStoredSession(page: Page): Promise<void> {
  const expired = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    if (!key) return false;
    const session = JSON.parse(localStorage.getItem(key)!);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(key, JSON.stringify(session));
    return true;
  });
  expect(expired, 'the auth session is in localStorage').toBe(true);
}

test('probe71', async ({ page, browser }) => {
  const email = newEmail('offline');
  const open = new Map<object, { url: string; at: number }>();
  page.on('request', (r) => { if (r.url().startsWith(supabaseUrl)) open.set(r, { url: `${r.method()} ${r.url().replace(supabaseUrl, '')}`, at: Date.now() }); });
  page.on('requestfinished', (r) => open.delete(r));
  page.on('requestfailed', (r) => open.delete(r));
  const dump = (why: string) => console.log(`[probe71] ${why}: ${[...open.values()].map((o) => `${o.url.slice(0, 80)} age=${Date.now() - o.at}`).join('; ') || 'none open'}`);
  page.on('console', (m) => { if (/refresh|flush|resync|offline/i.test(m.text())) console.log(`[app] ${m.text().slice(0, 200)}`); });
  await signUpWithHousehold(page, email);
  await addItem(page, 'Brot');
  await addItem(page, 'Milch');
  await expect(itemRow(page, 'Milch')).toBeVisible();
  await expect.poll(async () => {
    const list = await cachedList(page);
    return list && [list.server.length, list.pending.length];
  }, { message: 'the synced list is cached' }).toEqual([2, 0]);

  const network = await cutOff(page);
  await expireStoredSession(page);
  await page.reload();
  // Fails fast: no hidden library retries (they took 7 s per read) before the cache shows.
  await within(3_000, (timeout) => expect(itemRow(page, 'Brot'), 'the cached list shows offline').toBeVisible({ timeout }));
  await expect(itemRow(page, 'Milch')).toBeVisible();
  await expect(addField(page)).toBeFocused();
  await within(3_000, (timeout) => expect(page.getByText(/^Offline:/), 'and says so right away').toHaveCount(1, { timeout }));

  await addItem(page, 'Käse');
  await tick(page, 'Brot');
  await expect(itemRow(page, 'Käse')).toBeVisible();
  await expect(itemRow(page, 'Brot')).toHaveCount(0);

  await page.reload();
  await expect(itemRow(page, 'Käse'), 'queued ops survive a reload while offline').toBeVisible();
  await expect(itemRow(page, 'Milch')).toBeVisible();
  await expect(itemRow(page, 'Brot')).toHaveCount(0);
  await expect(addField(page)).toBeFocused();
  await screenshot(page, 'offline-01-cold-start-from-cache');

  dump('before restore');
  await network.restore();
  dump('after restore');
  const api = await apiAs(email);
  const t0 = Date.now();
  const timer = setInterval(() => dump(`restore+${Date.now() - t0}`), 5_000);
  try { await expect.poll(async () => {
    const { data } = await api.from('items').select('name, status').order('name');
    return data;
  }, { message: 'the queued ops reach the server', timeout: 20_000 }).toEqual([
    { name: 'Brot', status: 'bought' },
    { name: 'Käse', status: 'active' },
    { name: 'Milch', status: 'active' },
  ]); } finally { clearInterval(timer); dump(`poll done after ${Date.now() - t0} ms`); }
  await expect(page.getByText(/^Offline:/)).toHaveCount(0, { timeout: 15_000 });

  const other = await (await browser.newContext()).newPage();
  await other.goto('/');
  await openEmailSignIn(other);
  await typeInto(other.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(other.getByRole('textbox', { name: 'Passwort' }), password);
  await other.getByRole('button', { name: 'Anmelden', exact: true }).click();
  // A new install: the analytics consent first (job 19).
  await answerConsent(other);
  await expect(itemRow(other, 'Käse'), 'another session of the same user sees the synced list').toBeVisible();
  await expect(itemRow(other, 'Milch')).toBeVisible();
  await expect(itemRow(other, 'Brot')).toHaveCount(0);
});

