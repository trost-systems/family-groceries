import { expect, test } from './fixtures';
import { addItem, itemRow, newEmail, screenshot, signUpWithHousehold } from './helpers';
import { watchBuild, withoutWasmGC } from './web-build';

// Job 28: the web build is `flutter build web --wasm`. Chromium runs the wasm app; a browser
// without WasmGC falls back to the JS app from the same build. Both must sign up and add.

test('Chromium runs the wasm build: sign up, add, reload', async ({ page }) => {
  const loaded = watchBuild(page);
  await signUpWithHousehold(page, newEmail('wasm'));
  expect(loaded(), 'main.dart.wasm, never main.dart.js').toEqual(['wasm']);
  expect(await page.evaluate(() => '_flutter_skwasmInstance' in window), 'the skwasm renderer runs').toBe(true);

  await addItem(page, 'Bananen');
  await expect(itemRow(page, 'Bananen')).toBeVisible();
  await page.reload();
  await expect(itemRow(page, 'Bananen')).toBeVisible();
  expect(loaded()).toEqual(['wasm', 'wasm']);
  await screenshot(page, '28-wasm-chromium');
});

test('without WasmGC the same build falls back to JS: sign up, add, reload', async ({ page }) => {
  await withoutWasmGC(page);
  const loaded = watchBuild(page);
  await signUpWithHousehold(page, newEmail('js-fallback'));
  expect(loaded(), 'main.dart.js, never main.dart.wasm').toEqual(['js']);
  expect(await page.evaluate(() => 'flutterCanvasKit' in window), 'the CanvasKit renderer runs').toBe(true);

  await addItem(page, 'Äpfel');
  await expect(itemRow(page, 'Äpfel')).toBeVisible();
  await page.reload();
  await expect(itemRow(page, 'Äpfel')).toBeVisible();
  expect(loaded()).toEqual(['js', 'js']);
  await screenshot(page, '28-js-fallback');
});
