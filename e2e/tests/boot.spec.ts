import { expect, test } from './fixtures';

// Chromium aborts in-flight loads with ERR_NETWORK_CHANGED when the host's
// interfaces change (Wi-Fi switch, a VPN, Docker bridges on a build box).
for (const asset of ['canvaskit/chromium/canvaskit.js', 'main.dart.js']) {
  test(`the app still starts when loading ${asset} fails once`, async ({ page }) => {
    let failed = false;
    await page.route(`**/${asset}`, (route) => {
      if (failed) return route.continue();
      failed = true;
      return route.abort('failed');
    });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible({ timeout: 15_000 });
    expect(failed).toBe(true);
  });
}

test('a boot asset that keeps failing stops after two reloads', async ({ page }) => {
  let loads = 0;
  page.on('request', (request) => { if (request.isNavigationRequest()) loads++; });
  await page.route('**/main.dart.js', (route) => route.abort('failed'));
  await page.goto('/');
  await expect.poll(() => loads).toBe(3);
  await page.waitForTimeout(2_000);
  expect(loads, 'no endless reload loop').toBe(3);
});

test('the app is called Hummlist in the tab and when installed', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveTitle('Hummlist');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Hummlist');
  const manifest = await (await request.get('/manifest.json')).json();
  expect([manifest.name, manifest.short_name]).toEqual(['Hummlist', 'Hummlist']);
});
